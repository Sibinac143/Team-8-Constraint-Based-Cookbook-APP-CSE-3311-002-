const searchBtn = document.getElementById("searchBtn");
const ingredientInput = document.getElementById("ingredient");
const resultsDiv = document.getElementById("results");

const BACKEND_URL = "http://127.0.0.1:5000/search";
const addIngredientBtn = document.getElementById("addIngredientBtn");
const ingredientListDiv = document.getElementById("ingredient-list");

let ingredients = [];

addIngredientBtn.addEventListener("click", () => {
  const ingredient = ingredientInput.value.trim().toLowerCase();
  if (!ingredient) return;
  ingredients.push(ingredient);
  renderIngredients();
  ingredientInput.value = "";
});

function renderIngredients() {
  ingredientListDiv.innerHTML = ingredients
    .map(
      (ing, index) => `
    <span class="ingredient-bubble">
      ${ing}
      <button onclick="removeIngredient(${index})">x</button>
    </span>
  `,
    )
    .join("");
}

function removeIngredient(index) {
  ingredients.splice(index, 1);

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

  if (!ingredient) {
    resultsDiv.innerHTML =
      "<p style='color:red;'>Please enter an ingredient.</p>";
    return;
  }

  resultsDiv.innerHTML = "<p>Loading...</p>";

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

function openRecipe(id) {
  window.location.href = `recipe.html?id=${id}`;
}
