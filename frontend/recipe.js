const params = new URLSearchParams(window.location.search);
const recipeId = params.get("id");

const BACKEND_URL = "http://127.0.0.1:5000";

async function loadRecipe() {
  const response = await fetch(`${BACKEND_URL}/recipe/${recipeId}`);

  const data = await response.json();

  document.getElementById("recipe-name").innerText = data.name;

  document.getElementById("recipe-image").src = data.image;

  document.getElementById("instructions").innerText = data.instructions;

  const ingredientsList = document.getElementById("ingredients");

  ingredientsList.innerHTML = data.ingredients
    .map((i) => `<li>${i}</li>`)
    .join("");
}

function goBack() {
  window.history.back();
}

loadRecipe();
