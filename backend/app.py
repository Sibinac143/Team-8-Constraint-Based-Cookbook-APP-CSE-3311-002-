from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route("/")
def home():
    return "Hello from backend!"

@app.route("/search")
def search_recipes():
    ingredient = request.args.get("ingredient")

    if not ingredient:
        return jsonify({"error": "No ingredient provided"}), 400

    url = f"https://www.themealdb.com/api/json/v1/1/filter.php?i={ingredient}"
    response = requests.get(url)
    data = response.json()

    meals = data.get("meals")

    # If no recipes found
    if not meals:
        return jsonify([])

    # Clean the response
    cleaned_results = []
    for meal in meals:
        cleaned_results.append({
            "id": meal["idMeal"],
            "name": meal["strMeal"],
            "image": meal["strMealThumb"]
        })

    return jsonify(cleaned_results)


if __name__ == "__main__":
    app.run(debug=True)
