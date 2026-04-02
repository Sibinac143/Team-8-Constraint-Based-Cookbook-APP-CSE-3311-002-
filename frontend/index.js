const API_BASE = "http://127.0.0.1:5000";

let ingredients = [];
let cookbotInitialized = false;
let lastSmartSearch = null;
const COOKBOT_HISTORY_KEY = "cookbot_history_v1";
const MAX_HISTORY_MESSAGES = 8;

document.addEventListener("DOMContentLoaded", () => {
  loadUserHeader();
  loadPosts();
  restoreCookbotHistory();
  wireSearchInput();

  const composer = document.getElementById("postComposerBody");
  if (composer) composer.style.display = "none";

  const relevantSection = document.getElementById("relevantPostsSection");
  if (relevantSection) relevantSection.style.display = "none";
});

function loadUserHeader() {
  const username = localStorage.getItem("username");
  const welcomeText = document.getElementById("welcomeText");
  if (username && welcomeText) {
    welcomeText.textContent = `Constraint-Based Cookbook • Hello, ${username}`;
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "login.html";
}

function scrollToRecipes() {
  const el = document.getElementById("recipesSection");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToCommunity() {
  const el = document.getElementById("communitySection");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function togglePostComposer() {
  const body = document.getElementById("postComposerBody");
  if (!body) return;
  body.style.display = body.style.display === "none" ? "block" : "none";
}

function toggleManualIngredientMode() {
  const section = document.getElementById("manualIngredientSection");
  if (!section) return;
  section.style.display = section.style.display === "none" ? "block" : "none";
}

function handleManualIngredientEnter(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addManualIngredient();
  }
}

function addManualIngredient() {
  const input = document.getElementById("manualIngredientInput");
  if (!input) return;

  const value = input.value.trim().toLowerCase();
  if (!value) return;

  if (!ingredients.includes(value)) {
    ingredients.push(value);
  }

  input.value = "";
  renderIngredients();
  updateFriendlySummary();
}

function wireSearchInput() {
  const input = document.getElementById("ingredientInput");
  if (!input) return;

  input.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await runSearchFromMainInput();
    }
  });
}

async function runSearchFromMainInput() {
  const input = document.getElementById("ingredientInput");
  if (!input) return;

  const value = input.value.trim();

  if (value) {
    await processSmartSearchInput(value);
    return;
  }

  searchRecipes();
}

async function processSmartSearchInput(rawText) {
  const input = document.getElementById("ingredientInput");
  const summary = document.getElementById("smartSearchSummary");
  if (!input) return;

  try {
    const response = await fetch(`${API_BASE}/smart-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: rawText })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data.error || "Smart search failed");
      if (summary) summary.style.display = "none";
      return;
    }

    const parsedIngredients = Array.isArray(data.ingredients) ? data.ingredients : [];
    const querySummary = data.query_summary || "";
    const preferences = data.preferences || {};

    ingredients = [];
    parsedIngredients.forEach((item) => {
      const normalized = String(item).trim().toLowerCase();
      if (normalized && !ingredients.includes(normalized)) {
        ingredients.push(normalized);
      }
    });

    renderIngredients();
    input.value = "";

    lastSmartSearch = {
      ingredients: parsedIngredients,
      tools: [],
      summary: querySummary,
      intent: data.intent || "recipe_search",
      preferences: {
        tone: preferences.tone || "neutral",
        speed: preferences.speed || "normal",
        comfort: !!preferences.comfort,
        soft_food: !!preferences.soft_food
      }
    };

    updateFriendlySummary();
    searchRecipes();
  } catch (error) {
    console.error("Smart search request failed", error);
    if (summary) summary.style.display = "none";
  }
}

function updateFriendlySummary() {
  const summary = document.getElementById("smartSearchSummary");
  if (!summary) return;

  const preferences = lastSmartSearch?.preferences || {
    tone: "neutral",
    speed: "normal",
    comfort: false,
    soft_food: false
  };

  const parts = [];

  if (ingredients.length > 0) {
    if (ingredients.length === 1) {
      parts.push(`Searching with ${ingredients[0]}`);
    } else if (ingredients.length === 2) {
      parts.push(`Searching with ${ingredients[0]} and ${ingredients[1]}`);
    } else {
      parts.push(`Searching with ${ingredients.slice(0, 3).join(", ")}`);
    }
  }

  if (preferences.tone === "light") parts.push("looking for something light");
  if (preferences.speed === "quick") parts.push("keeping it quick");
  if (preferences.comfort) parts.push("leaning comforting");
  if (preferences.soft_food) parts.push("soft and simple");

  if (!parts.length && lastSmartSearch?.summary) {
    parts.push(lastSmartSearch.summary);
  }

  if (!parts.length) {
    summary.style.display = "none";
    summary.textContent = "";
    return;
  }

  const text =
    parts[0].charAt(0).toUpperCase() + parts[0].slice(1) +
    (parts.length > 1 ? ` • ${parts.slice(1).join(" • ")}` : "");

  summary.textContent = text;
  summary.style.display = "inline-flex";
}

function removeIngredient(ingredient) {
  ingredients = ingredients.filter((item) => item !== ingredient);
  renderIngredients();
  updateFriendlySummary();
}

function clearIngredients() {
  ingredients = [];
  lastSmartSearch = null;
  renderIngredients();

  const results = document.getElementById("results");
  if (results) results.innerHTML = "";

  const relevantPosts = document.getElementById("relevantPostsContainer");
  if (relevantPosts) relevantPosts.innerHTML = "";

  const relevantSection = document.getElementById("relevantPostsSection");
  if (relevantSection) relevantSection.style.display = "none";

  const summary = document.getElementById("smartSearchSummary");
  if (summary) {
    summary.style.display = "none";
    summary.textContent = "";
  }

  const mainInput = document.getElementById("ingredientInput");
  if (mainInput) mainInput.value = "";

  const manualInput = document.getElementById("manualIngredientInput");
  if (manualInput) manualInput.value = "";
}

function renderIngredients() {
  const list = document.getElementById("ingredientList");
  if (!list) return;

  if (!ingredients.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = ingredients
    .map(
      (ingredient) => `
        <div class="ingredient-bubble">
          ${escapeHtml(ingredient)}
          <button onclick="removeIngredient('${escapeJsString(ingredient)}')">×</button>
        </div>
      `
    )
    .join("");
}

function buildRecipeBadges(recipe) {
  const badges = [];
  const preferences = lastSmartSearch?.preferences || {
    tone: "neutral",
    speed: "normal",
    comfort: false,
    soft_food: false
  };

  if (preferences.tone === "light") badges.push("Light");
  if (preferences.speed === "quick") badges.push("Quick");
  if (preferences.comfort) badges.push("Comforting");
  if (preferences.soft_food) badges.push("Soft");
  if (ingredients.length > 0) badges.push("Uses your ingredients");

  if (recipe.score >= 80) {
    badges.push("Strong match");
  } else if (recipe.score >= 60) {
    badges.push("Good match");
  }

  return [...new Set(badges)].slice(0, 4);
}

function renderRecipeBadges(recipe) {
  const badges = buildRecipeBadges(recipe);
  if (!badges.length) return "";

  return `
    <div class="recipe-badge-row">
      ${badges.map((badge) => `<span class="recipe-mini-badge">${escapeHtml(badge)}</span>`).join("")}
    </div>
  `;
}

async function searchRecipes() {
  const results = document.getElementById("results");
  if (!results) return;

  const preferences = lastSmartSearch?.preferences || {
    tone: "neutral",
    speed: "normal",
    comfort: false,
    soft_food: false
  };

  const hasPreferenceSearch =
    preferences.tone !== "neutral" ||
    preferences.speed !== "normal" ||
    preferences.comfort ||
    preferences.soft_food;

  if (!ingredients.length && !hasPreferenceSearch) {
    results.innerHTML = `
      <div class="community-card empty-feed-card">
        <h3>No ingredients yet</h3>
        <p>Describe what you have, or add ingredients manually.</p>
      </div>
    `;
    return;
  }

  results.innerHTML = `
    <div class="community-card empty-feed-card">
      <p>Searching recipes...</p>
    </div>
  `;

  try {
    const params = new URLSearchParams({
      ingredient: ingredients.join(","),
      preferences: JSON.stringify(preferences)
    });

    const response = await fetch(`${API_BASE}/search?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      results.innerHTML = `
        <div class="community-card empty-feed-card">
          <h3>Search failed</h3>
          <p>${escapeHtml(data.error || "Unable to search recipes.")}</p>
        </div>
      `;
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      results.innerHTML = `
        <div class="community-card empty-feed-card">
          <h3>No recipes found</h3>
          <p>Try another search description.</p>
        </div>
      `;

      showRelevantPostsSection();
      await loadRelevantPostsForIngredients();
      return;
    }

    results.innerHTML = data
      .map(
        (recipe) => `
          <div class="recipe-card">
            <img src="${escapeAttribute(recipe.image)}" alt="${escapeAttribute(recipe.name)}" />
            ${renderRecipeBadges(recipe)}
            <h3>${escapeHtml(recipe.name)}</h3>
            <p class="recipe-score">Match score: ${recipe.score}%</p>

            <div class="recipe-card-actions">
              <button onclick="viewRecipe('${escapeJsString(recipe.id)}')">View Recipe</button>
              <button
                class="favorite-btn"
                onclick="saveFavorite('${escapeJsString(recipe.id)}', '${escapeJsString(recipe.name)}', '${escapeJsString(recipe.image)}')"
              >
                Save
              </button>
            </div>
          </div>
        `
      )
      .join("");

    showRelevantPostsSection();
    await loadRelevantPostsForIngredients();
  } catch (error) {
    results.innerHTML = `
      <div class="community-card empty-feed-card">
        <h3>Server unavailable</h3>
        <p>Make sure your backend is running on http://127.0.0.1:5000.</p>
      </div>
    `;
  }
}

function showRelevantPostsSection() {
  const relevantSection = document.getElementById("relevantPostsSection");
  if (relevantSection) relevantSection.style.display = "block";
}

async function loadRelevantPostsForIngredients() {
  const container = document.getElementById("relevantPostsContainer");
  if (!container) return;

  const hasIngredients = ingredients.length > 0;
  const hasComfortPreference = !!lastSmartSearch?.preferences?.comfort;
  const hasLightPreference = lastSmartSearch?.preferences?.tone === "light";

  if (!hasIngredients && !hasComfortPreference && !hasLightPreference) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="community-card empty-feed-card">
      <p>Looking for community posts related to your search...</p>
    </div>
  `;

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/posts`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const posts = await response.json();

    if (!Array.isArray(posts) || posts.length === 0) {
      container.innerHTML = `
        <div class="community-card empty-feed-card">
          <h3>No matching community posts yet</h3>
          <p>Try sharing what you cook with these ingredients.</p>
        </div>
      `;
      return;
    }

    const scoredPosts = posts
      .map((post) => {
        const text = `${post.title || ""} ${post.caption || ""}`.toLowerCase();
        let matchCount = 0;

        ingredients.forEach((ingredient) => {
          if (text.includes(ingredient)) matchCount += 1;
        });

        if (lastSmartSearch?.preferences?.comfort) {
          if (text.includes("soup") || text.includes("warm") || text.includes("comfort")) {
            matchCount += 1;
          }
        }

        if (lastSmartSearch?.preferences?.tone === "light") {
          if (text.includes("light") || text.includes("salad") || text.includes("simple")) {
            matchCount += 1;
          }
        }

        return { ...post, matchCount };
      })
      .filter((post) => post.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 4);

    if (!scoredPosts.length) {
      container.innerHTML = `
        <div class="community-card empty-feed-card">
          <h3>No matching community posts yet</h3>
          <p>Try sharing something that fits this search.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = scoredPosts
      .map(
        (post) => `
          <article class="community-card post-card compact-post-card">
            <div class="post-header">
              <div class="post-avatar">${getInitial(post.username)}</div>
              <div>
                <h3 class="post-user">${escapeHtml(post.username)}</h3>
                <p class="post-date">${formatDate(post.created_at)}</p>
              </div>
            </div>

            <div class="post-body">
              <h2 class="post-title">${escapeHtml(post.title)}</h2>
              ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ""}
              ${post.image_url ? `<img class="post-image" src="${escapeAttribute(post.image_url)}" alt="${escapeAttribute(post.title)}" onerror="this.style.display='none';" />` : ""}
            </div>

            <p class="ingredient-match-label">Matched signals: ${post.matchCount}</p>
          </article>
        `
      )
      .join("");
  } catch (error) {
    container.innerHTML = `
      <div class="community-card empty-feed-card">
        <h3>Could not load matching community posts</h3>
        <p>Try again in a moment.</p>
      </div>
    `;
  }
}

function viewRecipe(mealId) {
  const params = new URLSearchParams({
    ingredient: ingredients.join(",")
  });

  window.location.href = `recipe.html?id=${encodeURIComponent(mealId)}&${params.toString()}`;
}

async function saveFavorite(mealId, mealName, mealImage) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please log in first.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/user/favorites`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        meal_id: mealId,
        meal_name: mealName,
        meal_image: mealImage
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not save favorite.");
      return;
    }

    alert(data.message || "Saved to favorites.");
  } catch (error) {
    alert("Could not connect to the server.");
  }
}

async function toggleLike(postId) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please log in to like posts.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/posts/${postId}/like`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not update like.");
      return;
    }

    loadPosts();
    loadRelevantPostsForIngredients();
  } catch (error) {
    alert("Could not connect to the server.");
  }
}

async function createPost() {
  const token = localStorage.getItem("token");
  const titleInput = document.getElementById("postTitle");
  const captionInput = document.getElementById("postCaption");
  const imageInput = document.getElementById("postImageUrl");
  const messageEl = document.getElementById("postMessage");

  if (!titleInput || !captionInput || !imageInput || !messageEl) return;

  const title = titleInput.value.trim();
  const caption = captionInput.value.trim();
  const imageUrl = imageInput.value.trim();

  if (!token) {
    messageEl.textContent = "You must be logged in to create a post.";
    messageEl.className = "community-message error";
    return;
  }

  if (!title) {
    messageEl.textContent = "Please enter a post title.";
    messageEl.className = "community-message error";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        caption,
        image_url: imageUrl
      })
    });

    const data = await response.json();

    if (!response.ok) {
      messageEl.textContent = data.error || "Could not create post.";
      messageEl.className = "community-message error";
      return;
    }

    messageEl.textContent = "Post published successfully.";
    messageEl.className = "community-message success";

    titleInput.value = "";
    captionInput.value = "";
    imageInput.value = "";

    loadPosts();
    loadRelevantPostsForIngredients();
  } catch (error) {
    messageEl.textContent = "Could not connect to the server.";
    messageEl.className = "community-message error";
  }
}

async function submitComment(postId) {
  const token = localStorage.getItem("token");
  const input = document.getElementById(`commentInput-${postId}`);

  if (!input) return;

  const text = input.value.trim();

  if (!token) {
    alert("Please log in to comment.");
    return;
  }

  if (!text) return;

  try {
    const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not add comment.");
      return;
    }

    input.value = "";
    loadPosts();
    loadRelevantPostsForIngredients();
  } catch (error) {
    alert("Could not connect to the server.");
  }
}

function renderLikeButton(post) {
  const activeClass = post.liked_by_user ? "liked" : "";
  const label = post.liked_by_user ? "Liked" : "Like";

  return `
    <button class="like-btn ${activeClass}" onclick="toggleLike(${post.id})">
      ❤ ${label} (${post.like_count || 0})
    </button>
  `;
}

async function loadPosts() {
  const postsContainer = document.getElementById("postsContainer");
  if (!postsContainer) return;

  postsContainer.innerHTML = `
    <div class="community-card empty-feed-card">
      <p>Loading posts...</p>
    </div>
  `;

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/posts`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const posts = await response.json();

    if (!Array.isArray(posts) || posts.length === 0) {
      postsContainer.innerHTML = `
        <div class="community-card empty-feed-card">
          <h3>No posts yet</h3>
          <p>Be the first to share something delicious.</p>
        </div>
      `;
      return;
    }

    postsContainer.innerHTML = posts
      .map((post) => {
        const createdText = formatDate(post.created_at);
        const comments = Array.isArray(post.comments) ? post.comments : [];

        return `
          <article class="community-card post-card">
            <div class="post-header">
              <div class="post-avatar">${getInitial(post.username)}</div>
              <div>
                <h3 class="post-user">${escapeHtml(post.username)}</h3>
                <p class="post-date">${createdText}</p>
              </div>
            </div>

            <div class="post-body">
              <h2 class="post-title">${escapeHtml(post.title)}</h2>
              ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ""}
              ${post.image_url ? `<img class="post-image" src="${escapeAttribute(post.image_url)}" alt="${escapeAttribute(post.title)}" onerror="this.style.display='none';" />` : ""}
            </div>

            <div class="post-reactions-row">
              ${renderLikeButton(post)}
            </div>

            <div class="post-comments-block">
              <h4 class="comments-heading">Comments</h4>

              <div class="comments-list">
                ${
                  comments.length
                    ? comments
                        .map(
                          (comment) => `
                            <div class="comment-item">
                              <span class="comment-user">${escapeHtml(comment.username)}</span>
                              <span class="comment-text">${escapeHtml(comment.text)}</span>
                            </div>
                          `
                        )
                        .join("")
                    : `<p class="no-comments-text">No comments yet. Start the conversation.</p>`
                }
              </div>

              <div class="comment-form">
                <input
                  id="commentInput-${post.id}"
                  class="comment-input"
                  type="text"
                  placeholder="Write a comment..."
                />
                <button class="comment-btn" onclick="submitComment(${post.id})">Post</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    postsContainer.innerHTML = `
      <div class="community-card empty-feed-card">
        <h3>Unable to load posts</h3>
        <p>Make sure your backend is running on http://127.0.0.1:5000.</p>
      </div>
    `;
  }
}

/* CookBot */
function toggleCookbot() {
  const panel = document.getElementById("cookbotPanel");
  if (!panel) return;

  panel.classList.toggle("hidden");

  if (!cookbotInitialized) {
    const messages = getCookbotHistory();
    if (!messages.length) {
      const welcome = "Hi! I’m CookBot. Ask me what to cook, ingredient substitutions, or how to use this app.";
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

function restoreCookbotHistory() {
  const panel = document.getElementById("cookbotMessages");
  if (!panel) return;
  panel.innerHTML = "";
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

    const reply = "I couldn’t reach the backend. Make sure your Flask server is running.";
    addCookbotMessage("bot", reply);

    const history = getCookbotHistory();
    history.push({ role: "assistant", content: reply });
    saveCookbotHistory(history);
  }
}

function addCookbotMessage(sender, text, skipPersist = false) {
  const messages = document.getElementById("cookbotMessages");
  if (!messages) return;

  const bubble = document.createElement("div");
  bubble.className = `cookbot-message ${sender}`;
  bubble.textContent = text;

  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;

  if (!skipPersist) return;
}

function clearCookbotHistory() {
  localStorage.removeItem(COOKBOT_HISTORY_KEY);
  const messages = document.getElementById("cookbotMessages");
  if (messages) messages.innerHTML = "";
  cookbotInitialized = false;
}

function formatDate(value) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getInitial(username) {
  if (!username || typeof username !== "string") return "?";
  return username.trim().charAt(0).toUpperCase();
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
