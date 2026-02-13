from flask_cors import CORS
from flask import Flask, request, jsonify
import requests
import certifi

app = Flask(__name__)
CORS(app)


SUPPORTED_EQUIPMENT = ["oven", "microwave", "stove", "air fryer", "blender"]


def recipe_matches_equipment(instructions, user_equipment):
    instructions = instructions.lower()

    for equipment in SUPPORTED_EQUIPMENT:
        if equipment in instructions and equipment not in user_equipment:
            return False
    return True


@app.route("/")
def home():
    return "Hello from backend!"


@app.route("/search")
def search_recipes():
    ingredient = request.args.get("ingredient")
    equipment_param = request.args.get("equipment", "")

    # Convert equipment string to list
    user_equipment = [
        e.strip().lower() for e in equipment_param.split(",") if e.strip()
    ]

    if not ingredient:
        return jsonify({"error": "No ingredient provided"}), 400

    url = f"https://www.themealdb.com/api/json/v1/1/filter.php?i={ingredient}"
    response = requests.get(url, verify=certifi.where())
    data = response.json()

    meals = data.get("meals")
    if not meals:
        return jsonify([])

    filtered_results = []

    for meal in meals[:10]:  # limit to first 10 to keep it fast
        meal_id = meal["idMeal"]

        # Get full recipe details
        detail_url = f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={meal_id}"
        detail_response = requests.get(detail_url, verify=certifi.where())
        detail_data = detail_response.json()

        recipe = detail_data["meals"][0]
        instructions = recipe["strInstructions"]

        # Check equipment
        if recipe_matches_equipment(instructions, user_equipment):
            filtered_results.append(
                {
                    "id": meal["idMeal"],
                    "name": meal["strMeal"],
                    "image": meal["strMealThumb"],
                }
            )

    return jsonify(filtered_results)


if __name__ == "__main__":
    app.run(debug=True)
