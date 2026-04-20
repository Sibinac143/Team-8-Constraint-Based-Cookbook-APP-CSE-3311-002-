import os
import json
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText

from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from werkzeug.security import generate_password_hash, check_password_hash
import requests
import certifi

load_dotenv()

app = Flask(__name__)
CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///cookbook.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = "cookbook-secret-key-change-in-production"

db = SQLAlchemy(app)
jwt = JWTManager(app)

SUPPORTED_EQUIPMENT = ["oven", "microwave", "stove", "air fryer", "blender"]

openai_client = None
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception as e:
        print("OpenAI client init failed:", e)
        openai_client = None


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    favorites = db.relationship("Favorite", backref="user", cascade="all, delete-orphan")
    posts = db.relationship("Post", backref="user", cascade="all, delete-orphan")
    comments = db.relationship("Comment", backref="user", cascade="all, delete-orphan")
    likes = db.relationship("PostLike", backref="user", cascade="all, delete-orphan")
    reset_tokens = db.relationship("PasswordResetToken", backref="user", cascade="all, delete-orphan")


class Favorite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    meal_id = db.Column(db.String(20), nullable=False)
    meal_name = db.Column(db.String(200), nullable=False)
    meal_image = db.Column(db.String(500), nullable=False)


class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    username = db.Column(db.String(80), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    caption = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    comments = db.relationship("Comment", backref="post", cascade="all, delete-orphan")
    likes = db.relationship("PostLike", backref="post", cascade="all, delete-orphan")


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("post.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    username = db.Column(db.String(80), nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())


class PostLike(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("post.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    __table_args__ = (
        db.UniqueConstraint("post_id", "user_id", name="unique_post_like"),
    )


class PasswordResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    token = db.Column(db.String(120), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


def send_reset_email(to_email, reset_link):
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_pass or not smtp_from:
        raise RuntimeError("SMTP environment variables are missing")

    subject = "Dishcovery Password Reset"
    body = f"""Hello,

We received a request to reset your Dishcovery password.

Use the link below to reset it:
{reset_link}

If you did not request this, you can ignore this email.

Dishcovery
"""

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_email

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [to_email], msg.as_string())


def serialize_comment(comment):
    return {
        "id": comment.id,
        "username": comment.username,
        "text": comment.text,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }


def serialize_post(post, current_user_id=None):
    like_count = len(post.likes)
    liked_by_user = False

    if current_user_id is not None:
        liked_by_user = any(like.user_id == current_user_id for like in post.likes)

    return {
        "id": post.id,
        "user_id": post.user_id,
        "username": post.username,
        "title": post.title,
        "caption": post.caption,
        "image_url": post.image_url,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "comments": [serialize_comment(comment) for comment in post.comments],
        "like_count": like_count,
        "liked_by_user": liked_by_user,
    }


def recipe_matches_equipment(instructions, user_equipment):
    instructions = (instructions or "").lower()
    for equipment in SUPPORTED_EQUIPMENT:
        if equipment in instructions and equipment not in user_equipment:
            return False
    return True


def calculate_match_score(recipe_ingredients, user_ingredients):
    if not user_ingredients:
        return 40

    matches = 0
    for ingredient in recipe_ingredients:
        for user_ing in user_ingredients:
            if user_ing in ingredient.lower():
                matches += 1
                break

    if not recipe_ingredients:
        return 0

    return int((matches / len(recipe_ingredients)) * 100)


def preference_bonus(recipe_name, recipe_instructions, smart_filters):
    score = 0
    text = f"{(recipe_name or '').lower()} {(recipe_instructions or '').lower()}"

    tone = smart_filters.get("tone", "neutral")
    speed = smart_filters.get("speed", "normal")
    comfort = smart_filters.get("comfort", False)
    soft_food = smart_filters.get("soft_food", False)

    light_keywords = ["salad", "soup", "broth", "steamed", "grilled", "vegetable", "rice", "simple", "light", "fresh"]
    quick_keywords = ["quick", "easy", "simple", "stir", "fry", "omelette", "toast", "wrap", "salad", "microwave"]
    comfort_keywords = ["soup", "rice", "porridge", "broth", "warm", "soft", "simple", "comfort", "stew"]
    soft_keywords = ["soup", "rice", "mashed", "soft", "porridge", "broth", "stew"]

    if tone == "light":
        score += sum(1 for word in light_keywords if word in text) * 6
    if speed == "quick":
        score += sum(1 for word in quick_keywords if word in text) * 5
    if comfort:
        score += sum(1 for word in comfort_keywords if word in text) * 6
    if soft_food:
        score += sum(1 for word in soft_keywords if word in text) * 6

    return score


def search_meals_by_constraints(ingredients, user_equipment, smart_filters=None):
    smart_filters = smart_filters or {}
    search_seed = ingredients[0] if ingredients else "chicken"

    url = f"https://www.themealdb.com/api/json/v1/1/filter.php?i={search_seed}"
    response = requests.get(url, verify=certifi.where(), timeout=15)
    data = response.json()

    meals = data.get("meals")
    if not meals:
        return []

    filtered_results = []

    for meal in meals[:12]:
        meal_id = meal["idMeal"]
        detail_url = f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={meal_id}"
        detail_response = requests.get(detail_url, verify=certifi.where(), timeout=15)
        detail_data = detail_response.json()

        if not detail_data.get("meals"):
            continue

        recipe = detail_data["meals"][0]
        instructions = recipe.get("strInstructions", "")
        recipe_name = recipe.get("strMeal", "")

        recipe_ingredients = []
        for i in range(1, 21):
            ing = recipe.get(f"strIngredient{i}")
            if ing and ing.strip():
                recipe_ingredients.append(ing.lower())

        if not recipe_matches_equipment(instructions, user_equipment):
            continue

        base_score = calculate_match_score(recipe_ingredients, ingredients)
        extra_score = preference_bonus(recipe_name, instructions, smart_filters)
        total_score = min(base_score + extra_score, 100)

        filtered_results.append({
            "id": meal["idMeal"],
            "name": recipe_name,
            "image": meal["strMealThumb"],
            "score": total_score,
        })

    filtered_results.sort(key=lambda x: x["score"], reverse=True)
    return filtered_results


def extract_ingredients_from_question(text):
    cleaned = (
        text.lower()
        .replace("what can i cook with", "")
        .replace("?", "")
        .strip()
    )

    parts = []
    for chunk in cleaned.replace(" and ", ",").split(","):
        item = chunk.strip()
        if item:
            parts.append(item)
    return parts


@app.route("/")
def home():
    return "Backend running"


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password, method="pbkdf2:sha256"),
    )

    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({
        "access_token": token,
        "username": user.username,
    }), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({
        "access_token": token,
        "username": user.username,
    })


@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({
            "message": "If that email exists, a reset link has been sent."
        }), 200

    old_tokens = PasswordResetToken.query.filter_by(user_id=user.id, used=False).all()
    for row in old_tokens:
        row.used = True

    raw_token = secrets.token_urlsafe(32)
    reset_row = PasswordResetToken(
        user_id=user.id,
        token=raw_token,
        expires_at=datetime.utcnow() + timedelta(hours=1),
        used=False,
    )

    db.session.add(reset_row)
    db.session.commit()

    frontend_base = "http://52.14.252.143"
    reset_link = f"{frontend_base}/reset.html?token={raw_token}"

    try:
        send_reset_email(user.email, reset_link)
    except Exception as e:
        print("RESET EMAIL ERROR:", e)
        return jsonify({"error": f"Could not send reset email: {str(e)}"}), 500

    return jsonify({
        "message": "If that email exists, a reset link has been sent."
    }), 200


@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    token = data.get("token", "").strip()
    new_password = data.get("password", "")

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    row = PasswordResetToken.query.filter_by(token=token, used=False).first()

    if not row:
        return jsonify({"error": "Invalid or expired reset token"}), 400

    if row.expires_at < datetime.utcnow():
        row.used = True
        db.session.commit()
        return jsonify({"error": "Invalid or expired reset token"}), 400

    user = db.session.get(User, row.user_id)
    if not user:
        row.used = True
        db.session.commit()
        return jsonify({"error": "User not found"}), 404

    user.password_hash = generate_password_hash(new_password, method="pbkdf2:sha256")
    row.used = True
    db.session.commit()

    return jsonify({"message": "Password reset successful"}), 200


@app.route("/posts", methods=["GET"])
def get_posts():
    auth_header = request.headers.get("Authorization", "")
    current_user_id = None

    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            from flask_jwt_extended import decode_token
            decoded = decode_token(token)
            current_user_id = int(decoded["sub"])
        except Exception:
            current_user_id = None

    posts = Post.query.order_by(Post.id.desc()).all()
    return jsonify([serialize_post(post, current_user_id=current_user_id) for post in posts])


@app.route("/posts", methods=["POST"])
@jwt_required()
def create_post():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}

    title = data.get("title", "").strip()
    caption = data.get("caption", "").strip()
    image_url = data.get("image_url", "").strip()

    if not title:
        return jsonify({"error": "Title is required"}), 400

    post = Post(
        user_id=user.id,
        username=user.username,
        title=title,
        caption=caption,
        image_url=image_url,
    )

    db.session.add(post)
    db.session.commit()

    return jsonify({
        "message": "Post created",
        "post": serialize_post(post, current_user_id=user.id),
    }), 201


@app.route("/posts/<int:post_id>/comments", methods=["POST"])
@jwt_required()
def create_comment(post_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"error": "Post not found"}), 404

    data = request.get_json() or {}
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "Comment cannot be empty"}), 400

    comment = Comment(
        post_id=post.id,
        user_id=user.id,
        username=user.username,
        text=text,
    )

    db.session.add(comment)
    db.session.commit()

    return jsonify({
        "message": "Comment added",
        "comment": serialize_comment(comment),
    }), 201


@app.route("/posts/<int:post_id>/like", methods=["POST"])
@jwt_required()
def toggle_post_like(post_id):
    user_id = int(get_jwt_identity())
    post = db.session.get(Post, post_id)

    if not post:
        return jsonify({"error": "Post not found"}), 404

    existing_like = PostLike.query.filter_by(post_id=post_id, user_id=user_id).first()

    if existing_like:
        db.session.delete(existing_like)
        db.session.commit()
        liked = False
    else:
        like = PostLike(post_id=post_id, user_id=user_id)
        db.session.add(like)
        db.session.commit()
        liked = True

    refreshed_post = db.session.get(Post, post_id)

    return jsonify({
        "liked": liked,
        "like_count": len(refreshed_post.likes),
    })


@app.route("/user/favorites", methods=["GET"])
@jwt_required()
def get_favorites():
    user_id = int(get_jwt_identity())
    rows = Favorite.query.filter_by(user_id=user_id).all()

    return jsonify([
        {
            "meal_id": row.meal_id,
            "meal_name": row.meal_name,
            "meal_image": row.meal_image,
        }
        for row in rows
    ])


@app.route("/user/favorites", methods=["POST"])
@jwt_required()
def add_favorite():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    meal_id = data.get("meal_id")
    meal_name = data.get("meal_name")
    meal_image = data.get("meal_image")

    if not meal_id or not meal_name or not meal_image:
        return jsonify({"error": "Missing fields"}), 400

    existing = Favorite.query.filter_by(user_id=user_id, meal_id=meal_id).first()
    if existing:
        return jsonify({"message": "Already favorited"})

    favorite = Favorite(
        user_id=user_id,
        meal_id=meal_id,
        meal_name=meal_name,
        meal_image=meal_image,
    )

    db.session.add(favorite)
    db.session.commit()

    return jsonify({"message": "Added to favorites"}), 201


@app.route("/user/favorites/<meal_id>", methods=["DELETE"])
@jwt_required()
def remove_favorite(meal_id):
    user_id = int(get_jwt_identity())
    favorite = Favorite.query.filter_by(user_id=user_id, meal_id=meal_id).first()

    if favorite:
        db.session.delete(favorite)
        db.session.commit()

    return jsonify({"message": "Removed from favorites"})


@app.route("/search", methods=["GET"])
def search_recipes():
    ingredient_param = request.args.get("ingredient", "")
    preferences_param = request.args.get("preferences", "")

    ingredients = [i.strip().lower() for i in ingredient_param.split(",") if i.strip()]

    smart_filters = {}
    if preferences_param:
        try:
            smart_filters = json.loads(preferences_param)
        except Exception:
            smart_filters = {}

    filtered_results = search_meals_by_constraints(ingredients, [], smart_filters)
    return jsonify(filtered_results)


@app.route("/smart-search", methods=["POST"])
def smart_search():
    data = request.get_json() or {}
    query = data.get("query", "").strip()

    if not query:
        return jsonify({"error": "Query is required"}), 400

    if not openai_client:
        simple_ingredients = extract_ingredients_from_question(query)
        return jsonify({
            "ingredients": simple_ingredients,
            "tools": [],
            "intent": "recipe_search",
            "query_summary": query,
            "preferences": {
                "tone": "neutral",
                "speed": "normal",
                "comfort": False,
                "soft_food": False,
            }
        })

    prompt = f"""
You are a search parsing assistant for a recipe app.

The user may describe:
- ingredients they have
- food preferences like light, quick, simple, comforting
- a situation like headache, tired, not feeling great

Important:
- Treat situation phrases like headache, tired, upset stomach, not feeling well as FOOD PREFERENCE CONTEXT ONLY.
- Do NOT give medical advice.
- Convert them into gentle food preferences like simple, light, warm, soft, comforting.

Extract and return ONLY valid JSON in this exact format:

{{
  "ingredients": ["ingredient1", "ingredient2"],
  "tools": [],
  "intent": "recipe_search",
  "query_summary": "short summary here",
  "preferences": {{
    "tone": "light",
    "speed": "quick",
    "comfort": true,
    "soft_food": false
  }}
}}

Rules:
- tools must always be []
- intent can only be: recipe_search, general_food_question, app_help
- tone can only be: light, hearty, neutral
- speed can only be: quick, normal
- comfort and soft_food must be true or false
- If unknown, use neutral/normal/false
- Return JSON only, no markdown

User query: {query}
"""

    try:
        response = openai_client.responses.create(
            model="gpt-5.4",
            input=prompt,
        )

        raw_text = response.output_text.strip().replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw_text)

        preferences = parsed.get("preferences", {}) or {}

        return jsonify({
            "ingredients": parsed.get("ingredients", []),
            "tools": [],
            "intent": parsed.get("intent", "recipe_search"),
            "query_summary": parsed.get("query_summary", ""),
            "preferences": {
                "tone": preferences.get("tone", "neutral"),
                "speed": preferences.get("speed", "normal"),
                "comfort": bool(preferences.get("comfort", False)),
                "soft_food": bool(preferences.get("soft_food", False)),
            }
        })

    except Exception as e:
        print("SMART SEARCH ERROR:", e)
        return jsonify({"error": f"Smart search failed: {str(e)}"}), 500


@app.route("/recipe/<meal_id>", methods=["GET"])
def get_recipe(meal_id):
    ingredient_param = request.args.get("ingredient", "")
    user_ingredients = [i.strip().lower() for i in ingredient_param.split(",") if i.strip()]

    url = f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={meal_id}"
    response = requests.get(url, verify=certifi.where(), timeout=15)
    data = response.json()

    if not data.get("meals"):
        return jsonify({"error": "Recipe not found"}), 404

    recipe = data["meals"][0]

    recipe_ingredients = []
    ingredients_with_measure = []

    for i in range(1, 21):
        ingredient = recipe.get(f"strIngredient{i}")
        measure = recipe.get(f"strMeasure{i}", "")

        if ingredient and ingredient.strip():
            recipe_ingredients.append(ingredient.lower())
            ingredients_with_measure.append(f"{measure} {ingredient}".strip())

    missing = []
    for ing in recipe_ingredients:
        if not any(user_ing in ing for user_ing in user_ingredients):
            missing.append(ing)

    return jsonify({
        "name": recipe.get("strMeal"),
        "image": recipe.get("strMealThumb"),
        "instructions": recipe.get("strInstructions"),
        "ingredients": ingredients_with_measure,
        "missing": missing,
    })


@app.route("/cookbot", methods=["POST"])
def cookbot():
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "Message is required"}), 400

    if not openai_client:
        lower = message.lower()
        if "chicken" in lower and "rice" in lower:
            reply = "Try a quick chicken and rice bowl, chicken fried rice, or a light chicken soup."
        elif "light" in lower:
            reply = "You could try soup, rice bowls, salads, or simple egg dishes for something light."
        else:
            reply = "Try combining your main ingredient with rice, pasta, or vegetables for a quick meal."
        return jsonify({"reply": reply})

    lower = message.lower()
    recipe_context = ""

    if "what can i cook with" in lower:
        requested_ingredients = extract_ingredients_from_question(message)
        if requested_ingredients:
            search_results = search_meals_by_constraints(requested_ingredients, [])
            if search_results:
                lines = []
                for item in search_results[:5]:
                    lines.append(f"- {item['name']} (match score: {item['score']}%)")
                recipe_context = "Relevant recipe matches from the app:\n" + "\n".join(lines)
            else:
                recipe_context = "The app did not find recipe matches for that ingredient combination."

    system_prompt = """
You are CookBot, an intelligent cooking assistant inside a social recipe app.
Be practical, warm, and concise.
Prefer helpful structured answers with short sections when useful:
- Best options
- Ingredient swaps
- Quick steps
- App tip

If a user mentions headache, being tired, or not feeling well:
- do not give medical advice
- suggest simple, light, warm, or comforting food ideas only

Use recipe_context when present.
Do not invent features that do not exist.
"""

    conversation_parts = []
    for item in history[-6:]:
        role = item.get("role", "")
        content = item.get("content", "")
        if role and content:
            conversation_parts.append(f"{role.upper()}: {content}")

    conversation_text = "\n".join(conversation_parts)

    user_input = f"""
Conversation so far:
{conversation_text}

Current user message:
{message}

{recipe_context}
"""

    try:
        response = openai_client.responses.create(
            model="gpt-5.4",
            instructions=system_prompt,
            input=user_input,
        )

        return jsonify({"reply": response.output_text})
    except Exception as e:
        return jsonify({"error": f"CookBot failed: {str(e)}"}), 500


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
