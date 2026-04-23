const API_BASE = "/api";

const COOKBOT_HISTORY_KEY = "cookbot_history_v1";
const MAX_HISTORY_MESSAGES = 8;
let cookbotInitialized = false;

document.addEventListener("DOMContentLoaded", () => {
  loadUserHeader();
  loadPosts();
  injectCookbotWidget();
});

function loadUserHeader() {
  const username = localStorage.getItem("username");
  const welcomeText = document.getElementById("welcomeText");

  if (welcomeText) {
    if (username) {
      welcomeText.textContent = `Dishcovery Community • Hello, ${username}!`;
    } else {
      welcomeText.textContent = "Dishcovery Community";
    }
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "login.html";
}

async function createPost() {
  const token = localStorage.getItem("token");
  const title = document.getElementById("postTitle").value.trim();
  const caption = document.getElementById("postCaption").value.trim();
  const imageUrl = document.getElementById("postImageUrl").value.trim();
  const messageEl = document.getElementById("postMessage");

  if (!messageEl) return;

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

    document.getElementById("postTitle").value = "";
    document.getElementById("postCaption").value = "";
    document.getElementById("postImageUrl").value = "";

    loadPosts();
  } catch (error) {
    messageEl.textContent = "Could not connect to the server.";
    messageEl.className = "community-message error";
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
  } catch (error) {
    alert("Could not connect to the server.");
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
          <p>Be the first person to share something with the community.</p>
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
              ${
                post.caption
                  ? `<p class="post-caption">${escapeHtml(post.caption)}</p>`
                  : ""
              }
              ${
                post.image_url
                  ? `<img class="post-image" src="${escapeAttribute(
                      post.image_url
                    )}" alt="${escapeAttribute(post.title)}" onerror="this.style.display='none';" />`
                  : ""
              }
            </div>

            <div class="post-reactions-row">
              ${renderLikeButton(post)}
              <span class="community-stat-pill">💬 ${comments.length} comments</span>
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
        <p>Please try again in a moment.</p>
      </div>
    `;
  }
}

/* ----------------------------
   Shared floating CookBot
   ---------------------------- */
function injectCookbotWidget() {
  if (document.getElementById("cookbotPanel")) return;

  const widget = document.createElement("div");
  widget.innerHTML = `
    <button class="floating-bot-btn" onclick="toggleCookbot()">🤖</button>

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
