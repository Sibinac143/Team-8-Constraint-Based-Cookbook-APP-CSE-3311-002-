from flask_cors import CORS
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
import requests
import certifi

app = Flask(__name__)
CORS(app, supports_credentials=True)

# ----------------------------
# Config
# ----------------------------
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///cookbook.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = "cookbook-secret-key-change-in-production"

db = SQLAlchemy(app)
jwt = JWTManager(app)

SUPPORTED_EQUIPMENT = ["oven", "microwave", "stove", "air fryer", "blender"]


# ----------------------------
# Database Models
# ----------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

    ingredients = db.relationship("UserIngredient", backref="user", cascade="all, delete-orphan")
    equipment = db.relationship("UserEquipment", backref="user", cascade="all, delete-orphan")
    favorites = db.relationship("Favorite", backref="user", cascade="all, delete-orphan")


class UserIngredient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    ingredient = db.Column(db.String(100), nullable=False)


class UserEquipment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    equipment = db.Column(db.String(100), nullable=False)


class Favorite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    meal_id = db.Column(db.String(20), nullable=False)
    meal_name = db.Column(db.String(200), nullable=False)
    meal_image = db.Column(db.String(500), nullable=False)


# ----------------------------
# Auth Routes
# ----------------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 409

    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password)
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": token, "username": user.username}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": token, "username": user.username})


# ----------------------------
# User Ingredients
# ----------------------------
@app.route("/user/ingredients", methods=["GET"])
@jwt_required()
def get_ingredients():
    user_id = int(get_jwt_identity())
    rows = UserIngredient.query.filter_by(user_id=user_id).all()
    return jsonify([r.ingredient for r in rows])


@app.route("/user/ingredients", methods=["POST"])
@jwt_required()
def save_ingredients():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    ingredients = data.get("ingredients", [])

    UserIngredient.query.filter_by(user_id=user_id).delete()
    for ing in ingredients:
        if ing.strip():
            db.session.add(UserIngredient(user_id=user_id, ingredient=ing.strip().lower()))
    db.session.commit()
    return jsonify({"message": "Saved"})


# ----------------------------
# User Equipment
# ----------------------------
@app.route("/user/equipment", methods=["GET"])
@jwt_required()
def get_equipment():
    user_id = int(get_jwt_identity())
    rows = UserEquipment.query.filter_by(user_id=user_id).all()
    return jsonify([r.equipment for r in rows])


@app.route("/user/equipment", methods=["POST"])
@jwt_required()
def save_equipment():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    equipment = data.get("equipment", [])

    UserEquipment.query.filter_by(user_id=user_id).delete()
    for eq in equipment:
        if eq.strip():
            db.session.add(UserEquipment(user_id=user_id, equipment=eq.strip().lower()))
    db.session.commit()
    return jsonify({"message": "Saved"})


# ----------------------------
# Favorites
# ----------------------------
@app.route("/user/favorites", methods=["GET"])
@jwt_required()
def get_favorites():
    user_id = int(get_jwt_identity())
    rows = Favorite.query.filter_by(user_id=user_id).all()
    return jsonify([
        {"meal_id": r.meal_id, "meal_name": r.meal_name, "meal_image": r.meal_image}
        for r in rows
    ])


@app.route("/user/favorites", methods=["POST"])
@jwt_required()
def add_favorite():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    meal_id = data.get("meal_id")
    meal_name = data.get("meal_name")
    meal_image = data.get("meal_image")

    if not meal_id or not meal_name or not meal_image:
        return jsonify({"error": "Missing fields"}), 400

    if Favorite.query.filter_by(user_id=user_id, meal_id=meal_id).first():
        return jsonify({"message": "Already favorited"})

    db.session.add(Favorite(user_id=user_id, meal_id=meal_id, meal_name=meal_name, meal_image=meal_image))
    db.session.commit()
    return jsonify({"message": "Added to favorites"}), 201


@app.route("/user/favorites/<meal_id>", methods=["DELETE"])
@jwt_required()
def remove_favorite(meal_id):
    user_id = int(get_jwt_identity())
    fav = Favorite.query.filter_by(user_id=user_id, meal_id=meal_id).first()
    if fav:
        db.session.delete(fav)
        db.session.commit()
    return jsonify({"message": "Removed from favorites"})


# ----------------------------
# Equipment filtering
# ----------------------------
def recipe_matches_equipment(instructions, user_equipment):
    instructions = instructions.lower()
    for equipment in SUPPORTED_EQUIPMENT:
        if equipment in instructions and equipment not in user_equipment:
            return False
    return True


# ----------------------------
# Match score calculation
# ----------------------------
def calculate_match_score(recipe_ingredients, user_ingredients):
    matches = 0
    for ingredient in recipe_ingredients:
        for user_ing in user_ingredients:
            if user_ing in ingredient.lower():
                matches += 1
                break
    if len(recipe_ingredients) == 0:
        return 0
    return int((matches / len(recipe_ingredients)) * 100)


# ----------------------------
# Home route
# ----------------------------
@app.route("/")
def home():
    return "Hello from backend!"


# ----------------------------
# Search recipes
# ----------------------------
@app.route("/search")
def search_recipes():
    ingredient_param = request.args.get("ingredient", "")
    ingredients = [i.strip().lower() for i in ingredient_param.split(",") if i.strip()]

    equipment_param = request.args.get("equipment", "")
    user_equipment = [e.strip().lower() for e in equipment_param.split(",") if e.strip()]

    if not ingredients:
        return jsonify({"error": "No ingredient provided"}), 400

    url = f"https://www.themealdb.com/api/json/v1/1/filter.php?i={ingredients[0]}"
    response = requests.get(url, verify=certifi.where())
    data = response.json()

    meals = data.get("meals")
    if not meals:
        return jsonify([])

    filtered_results = []

    for meal in meals[:10]:
        meal_id = meal["idMeal"]
        detail_url = f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={meal_id}"
        detail_response = requests.get(detail_url, verify=certifi.where())
        detail_data = detail_response.json()
        recipe = detail_data["meals"][0]
        instructions = recipe["strInstructions"]

        recipe_ingredients = []
        for i in range(1, 21):
            ing = recipe[f"strIngredient{i}"]
            if ing and ing.strip():
                recipe_ingredients.append(ing.lower())

        if not recipe_matches_equipment(instructions, user_equipment):
            continue

        score = calculate_match_score(recipe_ingredients, ingredients)
        filtered_results.append({
            "id": meal["idMeal"],
            "name": meal["strMeal"],
            "image": meal["strMealThumb"],
            "score": score,
        })

    filtered_results.sort(key=lambda x: x["score"], reverse=True)
    return jsonify(filtered_results)


# ----------------------------
# Recipe details
# ----------------------------
@app.route("/recipe/<meal_id>")
def get_recipe(meal_id):
    ingredient_param = request.args.get("ingredient", "")
    user_ingredients = [i.strip().lower() for i in ingredient_param.split(",") if i.strip()]

    url = f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={meal_id}"
    response = requests.get(url, verify=certifi.where())
    data = response.json()

    if not data["meals"]:
        return jsonify({"error": "Recipe not found"}), 404

    recipe = data["meals"][0]
    recipe_ingredients = []
    ingredients_with_measure = []

    for i in range(1, 21):
        ingredient = recipe[f"strIngredient{i}"]
        measure = recipe[f"strMeasure{i}"]
        if ingredient and ingredient.strip():
            recipe_ingredients.append(ingredient.lower())
            ingredients_with_measure.append(f"{measure} {ingredient}")

    missing = []
    for ing in recipe_ingredients:
        if not any(user_ing in ing for user_ing in user_ingredients):
            missing.append(ing)

    return jsonify({
        "name": recipe["strMeal"],
        "image": recipe["strMealThumb"],
        "instructions": recipe["strInstructions"],
        "ingredients": ingredients_with_measure,
        "missing": missing,
    })


# ----------------------------
# Run server
# ----------------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
