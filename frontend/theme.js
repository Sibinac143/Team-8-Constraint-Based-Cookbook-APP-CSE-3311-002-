// Applied in every page <head> after styles.css to restore the user's chosen theme.
(function () {
  const ACCENTS = {
    pink:   ["#ec4899", "#db2777"],
    blue:   ["#3b82f6", "#2563eb"],
    purple: ["#8b5cf6", "#7c3aed"],
    orange: ["#f97316", "#ea580c"],
  };

  const key = localStorage.getItem("dishcovery_theme");
  if (!key || key === "green" || !ACCENTS[key]) return;

  const [a, d] = ACCENTS[key];
  const s = document.createElement("style");
  s.id = "dishcovery-theme";
  s.textContent = `
    button:not(.theme-swatch){background-color:${a}!important;}
    button:not(.theme-swatch):hover{background-color:${d}!important;}
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
  `;
  document.head.appendChild(s);
})();
