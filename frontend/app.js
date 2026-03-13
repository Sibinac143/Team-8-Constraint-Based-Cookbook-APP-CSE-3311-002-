const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");

const BACKEND_URL = "http://127.0.0.1:5000/search";
const ingredientListDiv = document.getElementById("ingredient-list");

let ingredients = [];

const ingredientInput = document.getElementById("ingredient");
const ingredientList = document.getElementById("ingredientList");
const addIngredientBtn = document.getElementById("addIngredientBtn");
const clearBtn = document.getElementById("clearBtn");

addIngredientBtn.addEventListener("click", () => {
  const ingredient = ingredientInput.value.trim().toLowerCase();
  if (!ingredient || ingredients.includes(ingredient)) return;
  ingredients.push(ingredient);
  ingredientInput.value = "";
  renderIngredients();
});

function renderIngredients() {
  ingredientList.innerHTML = ingredients
    .map(
      (ing) => `
    <span class="ingredient-bubble">
      ${ing}
      <button onclick="removeIngredient('${ing}')">✕</button>
    </span>
  `,
    )
    .join("");
}

function removeIngredient(ing) {
  ingredients = ingredients.filter((i) => i !== ing);

  renderIngredients();
}

searchBtn.addEventListener("click", async () => {
  if (ingredients.length === 0) {
    resultsDiv.innerHTML =
      "<p style='color:red;'>Please add at least one ingredient.</p>";
    return;
  }

  // collect checked equipment values
  const selectedEquipment = Array.from(
    document.querySelectorAll(".equip:checked"),
  ).map((cb) => cb.value);

  resultsDiv.innerHTML = "<p>🔍 Searching recipes...</p>";

  try {
    const params = new URLSearchParams();
    params.set("ingredient", ingredients.join(","));

    // send equipment only if user selected something
    if (selectedEquipment.length > 0) {
      params.set("equipment", selectedEquipment.join(","));
    }

    const response = await fetch(`${BACKEND_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.error) {
      resultsDiv.innerHTML = `<p style='color:red;'>${data.error}</p>`;
      return;
    }

    if (!data || data.length === 0) {
      resultsDiv.innerHTML = "<p>No recipes found.</p>";
      return;
    }

    // Render recipe cards using your CSS classes
    resultsDiv.innerHTML = data
      .map(
        (meal) => `
      <div class="recipe-card" onclick="openRecipe('${meal.id}')">
        <img src="${meal.image}" alt="${meal.name}">
        <h3>${meal.name}</h3>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    resultsDiv.innerHTML =
      "<p style='color:red;'>Error connecting to backend.</p>";
    console.error(err);
  }
});

clearBtn.addEventListener("click", () => {
  ingredients = [];

  renderIngredients();
});

function openRecipe(id) {
  window.location.href = `recipe.html?id=${id}&ingredients=${ingredients.join(",")}`;
}
