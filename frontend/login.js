const BACKEND_URL = "/api";

function switchTab(tab) {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const forgotForm = document.getElementById("forgotForm");

  clearMessages();

  if (forgotForm) forgotForm.style.display = "none";

  if (tab === "login") {
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    loginForm.style.display = "block";
    registerForm.style.display = "none";
  } else {
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
    registerForm.style.display = "block";
    loginForm.style.display = "none";
  }
}

function showForgotPassword() {
  clearMessages();

  document.getElementById("loginTab").classList.remove("active");
  document.getElementById("registerTab").classList.remove("active");
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("registerForm").style.display = "none";
  document.getElementById("forgotForm").style.display = "block";
}

function backToLogin() {
  clearMessages();

  document.getElementById("loginTab").classList.add("active");
  document.getElementById("registerTab").classList.remove("active");
  document.getElementById("forgotForm").style.display = "none";
  document.getElementById("registerForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
}

function clearMessages() {
  ["loginError", "registerError", "forgotError", "forgotMessage"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

async function doLogin() {
  clearMessages();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    document.getElementById("loginError").textContent = "Please enter email and password.";
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      document.getElementById("loginError").textContent = data.error || "Login failed.";
      return;
    }

    localStorage.setItem("token", data.access_token);
    localStorage.setItem("username", data.username);
    window.location.href = "index.html";
  } catch (err) {
    document.getElementById("loginError").textContent = "Could not connect to server.";
  }
}

async function doRegister() {
  clearMessages();

  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  if (!username || !email || !password) {
    document.getElementById("registerError").textContent = "Please fill in all fields.";
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      document.getElementById("registerError").textContent = data.error || "Registration failed.";
      return;
    }

    localStorage.setItem("token", data.access_token);
    localStorage.setItem("username", data.username);
    window.location.href = "index.html";
  } catch (err) {
    document.getElementById("registerError").textContent = "Could not connect to server.";
  }
}

async function sendResetLink() {
  clearMessages();

  const email = document.getElementById("forgotEmail").value.trim();

  if (!email) {
    document.getElementById("forgotError").textContent = "Please enter your email.";
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (!res.ok) {
      document.getElementById("forgotError").textContent =
        data.error || "Could not send reset email.";
      return;
    }

    document.getElementById("forgotMessage").textContent =
      "If that email exists, a reset link has been sent.";
  } catch (err) {
    document.getElementById("forgotError").textContent = "Could not connect to server.";
  }
}
