from flask_cors import CORS
from flask import Flask, request, jsonify
import requests
import certifi

app = Flask(__name__)
CORS(app)

SUPPORTED_EQUIPMENT = ["oven", "microwave", "stove", "air fryer", "blender"]


# -----------------------------
# Equipment filtering
# -----------------------------
def recipe_matches_equipment(instructions, user_equipment):

    instructions = instructions.lower()

    for equipment in SUPPORTED_EQUIPMENT:
        if equipment in instructions and equipment not in user_equipment:
            return False

    return True


# -----------------------------
# Match score calculation
# -----------------------------
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


# -----------------------------
# Home route
# -----------------------------
@app.route("/")
def home():
    return "Hello from backend!"


# -----------------------------
# Search recipes
# -----------------------------
@app.route("/search")
def search_recipes():

    ingredient_param = request.args.get("ingredient", "")
    ingredients = [i.strip().lower() for i in ingredient_param.split(",") if i.strip()]

    equipment_param = request.args.get("equipment", "")
    user_equipment = [
        e.strip().lower() for e in equipment_param.split(",") if e.strip()
    ]

    if not ingredients:
        return jsonify({"error": "No ingredient provided"}), 400

    # TheMealDB can only search one ingredient at a time
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

        # Extract recipe ingredients
        recipe_ingredients = []

        for i in range(1, 21):
            ing = recipe[f"strIngredient{i}"]
            if ing and ing.strip():
                recipe_ingredients.append(ing.lower())

        # Check equipment constraint
        if not recipe_matches_equipment(instructions, user_equipment):
            continue

        # Calculate match score
        score = calculate_match_score(recipe_ingredients, ingredients)

        filtered_results.append(
            {
                "id": meal["idMeal"],
                "name": meal["strMeal"],
                "image": meal["strMealThumb"],
                "score": score,
            }
        )

    # Sort by best match score
    filtered_results.sort(key=lambda x: x["score"], reverse=True)

    return jsonify(filtered_results)


# -----------------------------
# Recipe details page
# -----------------------------
@app.route("/recipe/<meal_id>")
def get_recipe(meal_id):

    ingredient_param = request.args.get("ingredient", "")
    user_ingredients = [
        i.strip().lower() for i in ingredient_param.split(",") if i.strip()
    ]

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

    # Determine missing ingredients
    missing = []

    for ing in recipe_ingredients:
        if not any(user_ing in ing for user_ing in user_ingredients):
            missing.append(ing)

    return jsonify(
        {
            "name": recipe["strMeal"],
            "image": recipe["strMealThumb"],
            "instructions": recipe["strInstructions"],
            "ingredients": ingredients_with_measure,
            "missing": missing,
        }
    )


# -----------------------------
# Run server
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)
