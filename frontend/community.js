const API_BASE = "/api";

document.addEventListener("DOMContentLoaded", () => {
  loadUserHeader();
  loadPosts();
});

function loadUserHeader() {
  const username = localStorage.getItem("username");
  const welcomeText = document.getElementById("welcomeText");

  if (username) {
    welcomeText.textContent = `Community Kitchen • Hello, ${username}!`;
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

async function loadPosts() {
  const postsContainer = document.getElementById("postsContainer");

  postsContainer.innerHTML = `
    <div class="community-card empty-feed-card">
      <p>Loading posts...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE}/posts`);
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
          </article>
        `;
      })
      .join("");
  } catch (error) {
    postsContainer.innerHTML = `
      <div class="community-card empty-feed-card">
        <h3>Unable to load posts</h3>
        <p>Make sure your backend server is running on /api.</p>
      </div>
    `;
  }
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
