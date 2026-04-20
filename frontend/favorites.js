const BACKEND_URL = "/api";

const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("username") || "User";
  const welcomeMsg = document.getElementById("welcomeMsg");
  if (welcomeMsg) {
    welcomeMsg.textContent = `Dishcovery • Hello, ${username}`;
  }

  loadFavorites();
});

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

async function removeFavorite(mealId) {
  try {
    const response = await fetch(`${BACKEND_URL}/user/favorites/${mealId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (response.status === 401) {
      window.location.href = "login.html";
      return;
    }

    loadFavorites();
  } catch (error) {
    console.error("Error removing favorite:", error);
  }
}

async function loadFavorites() {
  const container = document.getElementById("favorites");
  if (!container) return;

  container.innerHTML = `
    <div class="community-card empty-feed-card">
      <p>Loading saved recipes...</p>
    </div>
  `;

  try {
    const response = await fetch(`${BACKEND_URL}/user/favorites`, {
      headers: authHeaders(),
    });

    if (response.status === 401) {
      window.location.href = "login.html";
      return;
    }

    const favorites = await response.json();

    if (!Array.isArray(favorites) || favorites.length === 0) {
      container.innerHTML = `
        <div class="community-card empty-feed-card">
          <h3>No saved recipes yet</h3>
          <p>Save recipes from the search page and they’ll appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = favorites
      .map(
        (meal) => `
          <div class="recipe-card">
            <img
              src="${escapeAttribute(meal.meal_image)}"
              alt="${escapeAttribute(meal.meal_name)}"
              onclick="openRecipe('${escapeJsString(meal.meal_id)}')"
            />
            <h3 onclick="openRecipe('${escapeJsString(meal.meal_id)}')">
              ${escapeHtml(meal.meal_name)}
            </h3>
            <button
              class="remove-fav-btn"
              onclick="removeFavorite('${escapeJsString(meal.meal_id)}')"
            >
              Remove
            </button>
          </div>
        `
      )
      .join("");
  } catch (error) {
    container.innerHTML = `
      <div class="community-card empty-feed-card">
        <h3>Could not load favorites</h3>
        <p>Please try again in a moment.</p>
      </div>
    `;
    console.error("Error loading favorites:", error);
  }
}

function openRecipe(id) {
  window.location.href = `recipe.html?id=${encodeURIComponent(id)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeJsString(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}
