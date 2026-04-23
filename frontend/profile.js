const API_BASE = "/api";

const THEMES = [
  { key: "green",  label: "Forest",  accent: "#22c55e", dark: "#16a34a" },
  { key: "pink",   label: "Blush",   accent: "#ec4899", dark: "#db2777" },
  { key: "blue",   label: "Ocean",   accent: "#3b82f6", dark: "#2563eb" },
  { key: "purple", label: "Lavender",accent: "#8b5cf6", dark: "#7c3aed" },
  { key: "orange", label: "Sunset",  accent: "#f97316", dark: "#ea580c" },
];

document.addEventListener("DOMContentLoaded", () => {
  loadUserHeader();
  fetchProfile();
  renderThemePicker();
});

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "login.html";
}

function loadUserHeader() {
  const username = localStorage.getItem("username");
  const el = document.getElementById("welcomeText");
  if (el && username) el.textContent = `Dishcovery • Hello, ${username}`;
}

async function fetchProfile() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      window.location.href = "login.html";
      return;
    }

    const data = await response.json();

    const username = data.username || localStorage.getItem("username") || "—";
    const initial = username.trim().charAt(0).toUpperCase();

    document.getElementById("profileAvatar").textContent = initial;
    document.getElementById("profileUsername").textContent = username;
    document.getElementById("profileEmail").textContent = data.email || "";
    document.getElementById("statFavorites").textContent = data.favorites_count ?? "0";
    document.getElementById("statPosts").textContent = data.posts_count ?? "0";
  } catch {
    document.getElementById("profileUsername").textContent =
      localStorage.getItem("username") || "—";
  }
}

function renderThemePicker() {
  const current = localStorage.getItem("dishcovery_theme") || "green";
  const container = document.getElementById("themeSwatches");
  if (!container) return;

  container.innerHTML = THEMES.map((t) => `
    <button
      class="theme-swatch ${t.key === current ? "theme-swatch-active" : ""}"
      style="background: ${t.accent};"
      onclick="selectTheme('${t.key}')"
      title="${t.label}"
    >
      ${t.key === current ? "✓" : ""}
    </button>
    <span class="theme-swatch-label">${t.label}</span>
  `).join("");
}

function selectTheme(key) {
  localStorage.setItem("dishcovery_theme", key);
  applyThemeToPage(key);
  renderThemePicker();
}

function applyThemeToPage(key) {
  const t = THEMES.find((x) => x.key === key);
  if (!t) return;

  let el = document.getElementById("dishcovery-theme");
  if (key === "green") {
    if (el) el.remove();
    return;
  }

  if (!el) {
    el = document.createElement("style");
    el.id = "dishcovery-theme";
    document.head.appendChild(el);
  }

  const a = t.accent;
  const d = t.dark;

  el.textContent = `
    button{background-color:${a}!important;}
    button:hover{background-color:${d}!important;}
    .auth-header,.auth-header.premium-header{background:${a}!important;}
    .post-avatar,.step-number,.floating-bot-btn,.match-summary-bullet,.missing-good-icon,.cookbot-message.user{background:${a}!important;}
    .pill-group input[type="checkbox"]:checked+.pill{background:${a}!important;border-color:${a}!important;box-shadow:0 6px 14px ${a}44!important;}
    input:focus,textarea:focus{border-color:${a}!important;box-shadow:0 0 0 4px ${a}1a!important;}
    .auth-tab.active{color:${a}!important;border-bottom-color:${a}!important;}
    .card-eyebrow{color:${d}!important;}
    .ingredient-bubble{background:${a}22!important;color:${d}!important;}
    .ingredient-bubble button{background:transparent!important;color:${d}!important;}
    .community-badge,.login-hero-badge,.community-shortcut-badge{background:${a}18!important;color:${d}!important;}
    .recipe-mini-badge,.smart-search-summary{background:${a}15!important;border-color:${a}44!important;color:${d}!important;}
    .auth-header-btn{background:rgba(255,255,255,.18)!important;}
    .auth-header-btn:hover{background:rgba(255,255,255,.28)!important;}
    .auth-header-btn.logout-btn{background:rgba(0,0,0,.12)!important;}
    .auth-header-btn.nav-active{background:rgba(0,0,0,.28)!important;}
    .like-btn{background:#f8fafc!important;color:#111827!important;border:1px solid #e5e7eb!important;}
    .like-btn:hover{background:#f1f5f9!important;}
    .like-btn.liked{background:#fee2e2!important;color:#b91c1c!important;border-color:#fecaca!important;}
    .favorite-btn{background:#fbbf24!important;color:#111827!important;}
    .favorite-btn:hover{background:#f59e0b!important;}
    .remove-fav-btn{background:#dc3545!important;}
    .remove-fav-btn:hover{background:#c82333!important;}
    .cookbot-clear,.cookbot-close{background:rgba(255,255,255,.12)!important;}
    .cookbot-suggestions button{background:#f3f4f6!important;color:#111827!important;border:1px solid #e5e7eb!important;}
    .auth-tab{background:none!important;}
    .modern-auth-tabs .auth-tab.active{background:white!important;color:#111827!important;}
    .clear-all-btn{background:transparent!important;color:#667085!important;border:1px solid #e5e7eb!important;box-shadow:none!important;}
    .compact-toggle-btn{background:white!important;color:#111827!important;border:1px solid #d5dde5!important;}
    .secondary-auth-btn{background:#eef2f7!important;color:#111827!important;}
    .forgot-link-btn{background:transparent!important;color:${d}!important;box-shadow:none!important;}
    .login-card-label,.auth-info,.community-message.success{color:${d}!important;}
    .login-feature-icon{background:${a}18!important;}
    .theme-swatch-active{box-shadow:0 0 0 3px white,0 0 0 5px ${a}!important;}
  `;
}

function escapeHtml(v) {
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
