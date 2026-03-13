const params = new URLSearchParams(window.location.search);

const recipeId = params.get("id");
const userIngredients = params.get("ingredients") || "";

const BACKEND_URL = "http://127.0.0.1:5000";

async function loadRecipe() {
  try {
    const response = await fetch(
      `${BACKEND_URL}/recipe/${recipeId}?ingredient=${userIngredients}`,
    );

    const data = await response.json();

    if (data.error) {
      document.body.innerHTML = `<p style="color:red;">${data.error}</p>`;
      return;
    }

    // Recipe title
    document.getElementById("recipe-name").innerText = data.name;

    // Recipe image
    document.getElementById("recipe-image").src = data.image;

    // Instructions
    document.getElementById("instructions").innerText = data.instructions;

    // Ingredients list
    const ingredientsList = document.getElementById("ingredients");

    ingredientsList.innerHTML = data.ingredients
      .map((i) => `<li>${i}</li>`)
      .join("");

    // Missing ingredients section
    const missingDiv = document.getElementById("missing");

    if (data.missing && data.missing.length > 0) {
      missingDiv.innerHTML =
        "<h3>Missing Ingredients</h3>" +
        data.missing.map((i) => `<li style="color:red;">${i}</li>`).join("");
    } else {
      missingDiv.innerHTML =
        "<p style='color:green;'>You have all the ingredients! 🎉</p>";
    }
  } catch (err) {
    console.error(err);

    document.body.innerHTML = "<p style='color:red;'>Error loading recipe.</p>";
  }
}

function goBack() {
  window.history.back();
}

loadRecipe();
