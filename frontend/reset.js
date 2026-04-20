const BACKEND_URL = "/api";

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

async function resetPassword() {
  const token = getTokenFromUrl();
  const newPassword = document.getElementById("newPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  const messageEl = document.getElementById("resetMessage");
  const errorEl = document.getElementById("resetError");

  messageEl.textContent = "";
  errorEl.textContent = "";

  if (!token) {
    errorEl.textContent = "Missing reset token.";
    return;
  }

  if (!newPassword || !confirmPassword) {
    errorEl.textContent = "Please fill in both password fields.";
    return;
  }

  if (newPassword !== confirmPassword) {
    errorEl.textContent = "Passwords do not match.";
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token: token,
        new_password: newPassword
      })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || "Could not reset password.";
      return;
    }

    messageEl.textContent = "Password updated successfully. Redirecting to login...";
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
  } catch (err) {
    errorEl.textContent = "Could not connect to server.";
  }
}
