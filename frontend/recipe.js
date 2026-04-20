const API_BASE = "/api";

document.addEventListener("DOMContentLoaded", () => {
  loadRecipe();
});

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get("id"),
    ingredients: params.get("ingredient") || ""
  };
}

function goBackHome() {
  window.location.href = "index.html";
}

async function loadRecipe() {
  const { id, ingredients } = getQueryParams();
  const hero = document.getElementById("recipeHero");
  const body = document.getElementById("recipeBody");

  if (!id) {
    hero.innerHTML = `
      <div class="recipe-loading-card">
        <h2>Recipe not found</h2>
        <p>Missing recipe ID.</p>
      </div>
    `;
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/recipe/${encodeURIComponent(id)}?ingredient=${encodeURIComponent(ingredients)}`
    );
    const data = await response.json();

    if (!response.ok) {
      hero.innerHTML = `
        <div class="recipe-loading-card">
          <h2>Could not load recipe</h2>
          <p>${escapeHtml(data.error || "Unknown error.")}</p>
        </div>
      `;
      return;
    }

    renderRecipeHero(data, ingredients);
    renderIngredients(data.ingredients || [], ingredients);
    renderMissingIngredients(data.missing || []);
    renderInstructions(data.instructions || "");
    renderMatchSummary(data, ingredients);

    body.style.display = "grid";
  } catch (error) {
    hero.innerHTML = `
      <div class="recipe-loading-card">
        <h2>Server unavailable</h2>
        <p>Make sure the backend is running.</p>
      </div>
    `;
  }
}

function renderRecipeHero(data, ingredients) {
  const hero = document.getElementById("recipeHero");
  const userIngredients = ingredients
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  hero.innerHTML = `
    <div class="recipe-hero-media">
      <img src="${escapeAttribute(data.image || "")}" alt="${escapeAttribute(data.name || "Recipe")}" />
    </div>

    <div class="recipe-hero-content">
      <p class="community-badge">Recipe Detail</p>
      <h1>${escapeHtml(data.name || "Recipe")}</h1>
      <p class="recipe-hero-subtitle">
        A cleaner step-by-step cooking view based on your current kitchen search.
      </p>

      <div class="recipe-hero-tags">
        ${userIngredients.length ? `<span class="recipe-tag">Using ${escapeHtml(userIngredients.slice(0, 3).join(", "))}</span>` : ""}
        <span class="recipe-tag">${data.missing?.length ? `${data.missing.length} missing` : "Fully matched"}</span>
      </div>

      <div class="recipe-hero-actions">
        <button class="refined-search-btn" onclick="goBackHome()">Back to Search</button>
      </div>
    </div>
  `;
}

function renderIngredients(ingredients, rawUserIngredients) {
  const container = document.getElementById("ingredientsList");
  const userIngredients = rawUserIngredients
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!ingredients.length) {
    container.innerHTML = `<p class="empty-mini-state">No ingredients listed.</p>`;
    return;
  }

  container.innerHTML = ingredients
    .map((ingredientText) => {
      const lower = String(ingredientText).toLowerCase();
      const matched = userIngredients.some(
        (item) => lower.includes(item) || item.includes(lower)
      );

      return `
        <div class="ingredient-card-premium ${matched ? "matched" : "unmatched"}">
          <div class="ingredient-card-icon">${matched ? "✓" : "+"}</div>
          <div class="ingredient-card-text">
            <p>${escapeHtml(ingredientText)}</p>
            <span>${matched ? "You already have this" : "You may need this"}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMissingIngredients(missing) {
  const container = document.getElementById("missingIngredients");

  if (!missing.length) {
    container.innerHTML = `
      <div class="missing-empty-good">
        <span class="missing-good-icon">✓</span>
        <div>
          <strong>You’re all set</strong>
          <p>No missing ingredients were detected.</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = missing
    .map(
      (item) => `
        <div class="missing-item-premium">
          <span class="missing-dot"></span>
          <span>${escapeHtml(item)}</span>
        </div>
      `
    )
    .join("");
}

function renderInstructions(instructionsText) {
  const container = document.getElementById("instructionsList");

  const steps = instructionsText
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean);

  if (!steps.length) {
    container.innerHTML = `<p class="empty-mini-state">No instructions available.</p>`;
    return;
  }

  container.innerHTML = steps
    .map(
      (step, index) => `
        <div class="step-card-premium">
          <div class="step-number">${index + 1}</div>
          <div class="step-text">${escapeHtml(step)}</div>
        </div>
      `
    )
    .join("");
}

function renderMatchSummary(data, rawUserIngredients) {
  const container = document.getElementById("matchSummary");
  const userIngredients = rawUserIngredients
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const missingCount = Array.isArray(data.missing) ? data.missing.length : 0;
  const summaryItems = [];

  if (userIngredients.length) {
    summaryItems.push(
      `Search used ${userIngredients.length} ingredient${userIngredients.length > 1 ? "s" : ""}.`
    );
  }

  if (missingCount === 0) {
    summaryItems.push("This recipe appears fully covered by your current ingredients.");
  } else if (missingCount <= 3) {
    summaryItems.push("This recipe is close to your current kitchen and only needs a few extras.");
  } else {
    summaryItems.push("This recipe may need several additional ingredients.");
  }

  summaryItems.push("Use the missing ingredients panel to quickly decide if it is worth making now.");

  container.innerHTML = summaryItems
    .map(
      (item) => `
        <div class="match-summary-item">
          <span class="match-summary-bullet"></span>
          <span>${escapeHtml(item)}</span>
        </div>
      `
    )
    .join("");
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
