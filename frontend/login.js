const BACKEND_URL = "http://127.0.0.1:5000";

// Redirect to index if already logged in
if (localStorage.getItem("token")) {
  window.location.href = "index.html";
}

function switchTab(tab) {
  document.getElementById("loginForm").style.display = tab === "login" ? "block" : "none";
  document.getElementById("registerForm").style.display = tab === "register" ? "block" : "none";
  document.getElementById("loginTab").classList.toggle("active", tab === "login");
  document.getElementById("registerTab").classList.toggle("active", tab === "register");
}

async function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorEl = document.getElementById("loginError");
  errorEl.textContent = "";

  if (!email || !password) {
    errorEl.textContent = "Please fill in all fields.";
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || "Login failed.";
      return;
    }
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("username", data.username);
    window.location.href = "index.html";
  } catch {
    errorEl.textContent = "Could not connect to server.";
  }
}

async function doRegister() {
  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const errorEl = document.getElementById("registerError");
  errorEl.textContent = "";

  if (!username || !email || !password) {
    errorEl.textContent = "Please fill in all fields.";
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || "Registration failed.";
      return;
    }
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("username", data.username);
    window.location.href = "index.html";
  } catch {
    errorEl.textContent = "Could not connect to server.";
  }
}

// Allow pressing Enter to submit
document.getElementById("loginPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});
document.getElementById("regPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doRegister();
});
