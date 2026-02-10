import requests

# Ingredient to search for
ingredient = "chicken"

# API URL
url = f"https://www.themealdb.com/api/json/v1/1/filter.php?i={ingredient}"

# Make the request
response = requests.get(url)

# Convert response to JSON
data = response.json()

# Print recipe names
meals = data.get("meals", [])

print("Recipes found:\n")

for meal in meals:
    print(meal["strMeal"])
