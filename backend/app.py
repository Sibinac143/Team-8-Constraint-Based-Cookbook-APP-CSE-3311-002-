from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route("/")
def home():
    return "Hello from backend!"

@app.route("/search")
def search_recipes():
    # Get ingredient from URL
    ingredient = request.args.get("ingredient", "")

    # If no ingredient provided
    if not ingredient:
        return jsonify({"error": "No ingredient provided"}), 400

    # Call TheMealDB API
    url = f"https://www.themealdb.com/api/json/v1/1/filter.php?i={ingredient}"
    response = requests.get(url)
    data = response.json()

    meals = data.get("meals", [])

    # Clean up the response
    results = []
    for meal in meals:
        results.append({
            "id": meal["idMeal"],
            "name": meal["strMeal"],
            "image": meal["strMealThumb"]
        })

    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True)
