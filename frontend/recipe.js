const API_BASE = "/api";

const COOKBOT_HISTORY_KEY = "cookbot_history_v1";
const MAX_HISTORY_MESSAGES = 8;
let cookbotInitialized = false;

document.addEventListener("DOMContentLoaded", () => {
  loadRecipe();
  injectCookbotWidget();
});

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get("id"),
    ingredients: params.get("ingredient") || ""
  };
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "login.html";
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

/* ----------------------------
   Shared floating CookBot
   ---------------------------- */
function injectCookbotWidget() {
  if (document.getElementById("cookbotPanel")) return;

  const widget = document.createElement("div");
  widget.innerHTML = `
    <button class="floating-bot-btn" onclick="toggleCookbot()">🤖 CookBot</button>

    <div id="cookbotPanel" class="cookbot-panel hidden">
      <div class="cookbot-header">
        <div>
          <h3>CookBot</h3>
          <p>Your kitchen assistant</p>
        </div>

        <div class="cookbot-header-actions">
          <button class="cookbot-clear" onclick="clearCookbotHistory()">Clear</button>
          <button class="cookbot-close" onclick="toggleCookbot()">×</button>
        </div>
      </div>

      <div id="cookbotMessages" class="cookbot-messages"></div>

      <div class="cookbot-suggestions">
        <button onclick="sendQuickCookbot('What can I cook with chicken and rice?')">Chicken + rice</button>
        <button onclick="sendQuickCookbot('I need something light today')">Something light</button>
        <button onclick="sendQuickCookbot('Give me a quick dinner idea')">Quick dinner</button>
      </div>

      <div class="cookbot-input-row">
        <input
          id="cookbotInput"
          type="text"
          placeholder="Ask CookBot something..."
          onkeydown="handleCookbotEnter(event)"
        />
        <button onclick="sendCookbotMessage()">Send</button>
      </div>
    </div>
  `;

  document.body.appendChild(widget);
}

function toggleCookbot() {
  const panel = document.getElementById("cookbotPanel");
  if (!panel) return;

  panel.classList.toggle("hidden");

  if (!cookbotInitialized) {
    const messages = getCookbotHistory();
    if (!messages.length) {
      const welcome = "Hi! I’m CookBot. Ask me what to cook, ingredient swaps, or quick meal ideas.";
      addCookbotMessage("bot", welcome, true);
      saveCookbotHistory([{ role: "assistant", content: welcome }]);
    } else {
      renderCookbotHistory();
    }
    cookbotInitialized = true;
  }
}

function handleCookbotEnter(event) {
  if (event.key === "Enter") {
    sendCookbotMessage();
  }
}

function sendQuickCookbot(text) {
  const input = document.getElementById("cookbotInput");
  if (!input) return;

  input.value = text;
  sendCookbotMessage();
}

function getCookbotHistory() {
  try {
    return JSON.parse(localStorage.getItem(COOKBOT_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCookbotHistory(history) {
  localStorage.setItem(COOKBOT_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY_MESSAGES)));
}

function renderCookbotHistory() {
  const messagesEl = document.getElementById("cookbotMessages");
  if (!messagesEl) return;

  messagesEl.innerHTML = "";
  const history = getCookbotHistory();

  history.forEach((item) => {
    const sender = item.role === "user" ? "user" : "bot";
    addCookbotMessage(sender, item.content, true);
  });
}

async function sendCookbotMessage() {
  const input = document.getElementById("cookbotInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  addCookbotMessage("user", text);
  input.value = "";

  let history = getCookbotHistory();
  history.push({ role: "user", content: text });
  saveCookbotHistory(history);

  const messages = document.getElementById("cookbotMessages");
  if (messages) {
    const thinking = document.createElement("div");
    thinking.className = "cookbot-message bot";
    thinking.id = "cookbotThinking";
    thinking.textContent = "CookBot is thinking...";
    messages.appendChild(thinking);
    messages.scrollTop = messages.scrollHeight;
  }

  try {
    const response = await fetch(`${API_BASE}/cookbot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        equipment: [],
        history: getCookbotHistory()
      })
    });

    const data = await response.json();

    const thinkingEl = document.getElementById("cookbotThinking");
    if (thinkingEl) thinkingEl.remove();

    const reply = response.ok
      ? (data.reply || "I couldn't generate a reply.")
      : (data.error || "CookBot could not respond.");

    addCookbotMessage("bot", reply);

    history = getCookbotHistory();
    history.push({ role: "assistant", content: reply });
    saveCookbotHistory(history);
  } catch (error) {
    const thinkingEl = document.getElementById("cookbotThinking");
    if (thinkingEl) thinkingEl.remove();

    const reply = "I couldn’t reach the backend. Make sure the server is running.";
    addCookbotMessage("bot", reply);

    const history = getCookbotHistory();
    history.push({ role: "assistant", content: reply });
    saveCookbotHistory(history);
  }
}

function addCookbotMessage(sender, text) {
  const messages = document.getElementById("cookbotMessages");
  if (!messages) return;

  const bubble = document.createElement("div");
  bubble.className = `cookbot-message ${sender}`;
  bubble.textContent = text;

  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}

function clearCookbotHistory() {
  localStorage.removeItem(COOKBOT_HISTORY_KEY);
  const messages = document.getElementById("cookbotMessages");
  if (messages) messages.innerHTML = "";
  cookbotInitialized = false;
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
