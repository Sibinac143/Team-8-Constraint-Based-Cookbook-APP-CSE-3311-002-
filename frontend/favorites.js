const BACKEND_URL = "/api";

const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

const COOKBOT_HISTORY_KEY = "cookbot_history_v1";
const MAX_HISTORY_MESSAGES = 8;
let cookbotInitialized = false;

document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("username") || "User";
  const welcomeMsg = document.getElementById("welcomeMsg");
  if (welcomeMsg) {
    welcomeMsg.textContent = `Dishcovery • Hello, ${username}`;
  }

  loadFavorites();
  injectCookbotWidget();
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
    const response = await fetch(`${BACKEND_URL}/cookbot`, {
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

function escapeJsString(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}
