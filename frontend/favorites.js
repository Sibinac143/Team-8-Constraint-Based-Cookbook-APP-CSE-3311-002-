const BACKEND_URL = "/api";

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

async function removeFavorite(meal_id) {
  await fetch(`${BACKEND_URL}/user/favorites/${meal_id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  loadFavorites();
}

async function loadFavorites() {
  const container = document.getElementById("favorites");
  container.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(`${BACKEND_URL}/user/favorites`, {
      headers: authHeaders(),
    });

    if (res.status === 401) {
      window.location.href = "login.html";
      return;
    }

    const favorites = await res.json();

    if (favorites.length === 0) {
      container.innerHTML = "<p>You haven't favorited any recipes yet. Go search for some!</p>";
      return;
    }

    container.innerHTML = favorites
      .map(
        (meal) => `
      <div class="recipe-card">
        <img src="${meal.meal_image}" alt="${meal.meal_name}" onclick="openRecipe('${meal.meal_id}')">
        <h3 onclick="openRecipe('${meal.meal_id}')">${meal.meal_name}</h3>
        <button class="remove-fav-btn" onclick="removeFavorite('${meal.meal_id}')">✕ Remove</button>
      </div>
    `
      )
      .join("");
  } catch (err) {
    container.innerHTML = "<p style='color:red;'>Error loading favorites.</p>";
    console.error(err);
  }
}

function openRecipe(id) {
  window.location.href = `recipe.html?id=${id}`;
}

loadFavorites();
