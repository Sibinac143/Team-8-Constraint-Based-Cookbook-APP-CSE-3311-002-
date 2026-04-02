const BACKEND_URL = "http://127.0.0.1:5000";

//Initializing Supabase
const supabaseUrl = 'https://irvmscgjboifqclemvqo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlydm1zY2dqYm9pZnFjbGVtdnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjkyNjQsImV4cCI6MjA5MDc0NTI2NH0.DhHtkajHvHFdD8R6yEVfWprdzv09GgX6U7lEbJRC5wg';
const MYsupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

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

//  Calling Supabase to check credentials
  const { data, error } = await MYsupabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  // Handling the result
  if (error) {
    errorEl.textContent = error.message; // Show "Invalid login credentials" etc.
  } else {
  //Storing  the username for your welcome message
    localStorage.setItem("username", data.user.email.split('@')[0]); 
    localStorage.setItem("token", data.session.access_token);
    
    // Redirect to your main search page
    window.location.href = "index.html";
  }
}

async function doRegister() {
  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const errorEl = document.getElementById("registerError");
  errorEl.textContent = "";

  const {error } = await MYsupabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        display_name: username, 
      },
    },
    
  });

  if (error) {
    errorEl.textContent = error.message;
  } else {
    alert("Registration successful! Please check your email for a confirmation link.");
    // Redirect or switch to login tab
    switchTab('login');
  }
}

// Allow pressing Enter to submit
document.getElementById("loginPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});
document.getElementById("regPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doRegister();
});
