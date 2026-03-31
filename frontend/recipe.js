const params = new URLSearchParams(window.location.search);
const recipeId = params.get("id");
const userIngredients = params.get("ingredients") || "";

const BACKEND_URL = "http://127.0.0.1:5000";

// Auth check
const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

const username = localStorage.getItem("username") || "User";
document.getElementById("welcomeMsg").textContent = `Hello, ${username}!`;

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "login.html";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ----------------------------
// Favorites
// ----------------------------
let isFavorited = false;
let recipeName = "";
let recipeImage = "";

async function checkFavoriteStatus() {
  try {
    const res = await fetch(`${BACKEND_URL}/user/favorites`, {
      headers: authHeaders(),
    });
    const favorites = await res.json();
    isFavorited = favorites.some((f) => f.meal_id === recipeId);
    updateFavoriteBtn();
  } catch (err) {
    console.error("Could not load favorites", err);
  }
}

function updateFavoriteBtn() {
  const btn = document.getElementById("favoriteBtn");
  if (isFavorited) {
    btn.textContent = "★ Favorited";
    btn.classList.add("favorited");
  } else {
    btn.textContent = "⭐ Add to Favorites";
    btn.classList.remove("favorited");
  }
}

async function toggleFavorite() {
  if (isFavorited) {
    await fetch(`${BACKEND_URL}/user/favorites/${recipeId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    isFavorited = false;
  } else {
    await fetch(`${BACKEND_URL}/user/favorites`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        meal_id: recipeId,
        meal_name: recipeName,
        meal_image: recipeImage,
      }),
    });
    isFavorited = true;
  }
  updateFavoriteBtn();
}

// ----------------------------
// Load recipe
// ----------------------------
async function loadRecipe() {
  try {
    const response = await fetch(
      `${BACKEND_URL}/recipe/${recipeId}?ingredient=${userIngredients}`
    );
    const data = await response.json();

    if (data.error) {
      document.body.innerHTML = `<p style="color:red;">${data.error}</p>`;
      return;
    }

    recipeName = data.name;
    recipeImage = data.image;

    document.getElementById("recipe-name").innerText = data.name;
    document.getElementById("recipe-image").src = data.image;
    document.getElementById("instructions").innerText = data.instructions;

    const ingredientsList = document.getElementById("ingredients");
    ingredientsList.innerHTML = data.ingredients
      .map((i) => `<li>${i}</li>`)
      .join("");

    const missingDiv = document.getElementById("missing");
    if (data.missing && data.missing.length > 0) {
      missingDiv.innerHTML =
        "<h3>Missing Ingredients</h3>" +
        data.missing.map((i) => `<li style="color:red;">${i}</li>`).join("");
    } else {
      missingDiv.innerHTML =
        "<p style='color:green;'>You have all the ingredients! 🎉</p>";
    }

    checkFavoriteStatus();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = "<p style='color:red;'>Error loading recipe.</p>";
  }
}

function goBack() {
  window.history.back();
}

loadRecipe();
