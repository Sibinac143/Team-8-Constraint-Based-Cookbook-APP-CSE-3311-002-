const BACKEND_URL = "http://127.0.0.1:5000";

// Redirect to login if not authenticated
const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

const username = localStorage.getItem("username") || "User";
document.getElementById("welcomeMsg").textContent = `Hello, ${username}!`;

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

// ----------------------------
// Ingredients
// ----------------------------
let ingredients = [];

const ingredientInput = document.getElementById("ingredient");
const ingredientList = document.getElementById("ingredientList");
const addIngredientBtn = document.getElementById("addIngredientBtn");
const clearBtn = document.getElementById("clearBtn");
const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");


//Supabase
const supabaseUrl = 'https://irvmscgjboifqclemvqo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlydm1zY2dqYm9pZnFjbGVtdnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjkyNjQsImV4cCI6MjA5MDc0NTI2NH0.DhHtkajHvHFdD8R6yEVfWprdzv09GgX6U7lEbJRC5wg';
const MYsupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

addIngredientBtn.addEventListener("click", () => {
  const ingredient = ingredientInput.value.trim().toLowerCase();
  if (!ingredient || ingredients.includes(ingredient)) return;
  ingredients.push(ingredient);
  ingredientInput.value = "";
  renderIngredients();
  saveUserData();
});

ingredientInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addIngredientBtn.click();
});

function renderIngredients() {
  ingredientList.innerHTML = ingredients
    .map(
      (ing) => `
    <span class="ingredient-bubble">
      ${ing}
      <button onclick="removeIngredient('${ing}')">✕</button>
    </span>
  `
    )
    .join("");
}

function removeIngredient(ing) {
  ingredients = ingredients.filter((i) => i !== ing);
  renderIngredients();
  saveUserData();
}

clearBtn.addEventListener("click", () => {
  ingredients = [];
  renderIngredients();
  saveUserData();
});

// ----------------------------
// Save / Load user data
// ----------------------------
async function saveUserData() {
  const selectedEquipment = Array.from(
    document.querySelectorAll(".equip:checked")
  ).map((cb) => cb.value);

  await fetch(`${BACKEND_URL}/user/ingredients`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ingredients }),
  });

  await fetch(`${BACKEND_URL}/user/equipment`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ equipment: selectedEquipment }),
  });
}

async function loadUserData() {
  try {
    const [ingRes, eqRes] = await Promise.all([
      fetch(`${BACKEND_URL}/user/ingredients`, { headers: authHeaders() }),
      fetch(`${BACKEND_URL}/user/equipment`, { headers: authHeaders() }),
    ]);

    if (ingRes.status === 401 || eqRes.status === 401) {
      logout();
      return;
    }

    const ingData = await ingRes.json();
    const eqData = await eqRes.json();

    ingredients = ingData;
    renderIngredients();

    document.querySelectorAll(".equip").forEach((cb) => {
      cb.checked = eqData.includes(cb.value);
    });
  } catch (err) {
    console.error("Failed to load user data", err);
  }
}

// Save equipment whenever a checkbox changes
document.querySelectorAll(".equip").forEach((cb) => {
  cb.addEventListener("change", saveUserData);
});

// ----------------------------
// Search
// ----------------------------
searchBtn.addEventListener("click", async () => {
  if (ingredients.length === 0) {
    resultsDiv.innerHTML =
      "<p style='color:red;'>Please add at least one ingredient.</p>";
    return;
  }

  const selectedEquipment = Array.from(
    document.querySelectorAll(".equip:checked")
  ).map((cb) => cb.value);

  resultsDiv.innerHTML = "<p>🔍 Searching recipes...</p>";

  try {
    const params = new URLSearchParams();
    params.set("ingredient", ingredients.join(","));
    if (selectedEquipment.length > 0) {
      params.set("equipment", selectedEquipment.join(","));
    }

    const response = await fetch(`${BACKEND_URL}/search?${params.toString()}`);
    const data = await response.json();

    if (data.error) {
      resultsDiv.innerHTML = `<p style='color:red;'>${data.error}</p>`;
      return;
    }

    if (!data || data.length === 0) {
      resultsDiv.innerHTML = "<p>No recipes found.</p>";
      return;
    }

    resultsDiv.innerHTML = data
      .map(
        (meal) => `
      <div class="recipe-card" onclick="openRecipe('${meal.id}')">
        <img src="${meal.image}" alt="${meal.name}">
        <h3>${meal.name}</h3>
      </div>
    `
      )
      .join("");
  } catch (err) {
    resultsDiv.innerHTML =
      "<p style='color:red;'>Error connecting to backend.</p>";
    console.error(err);
  }
});

function openRecipe(id) {
  window.location.href = `recipe.html?id=${id}&ingredients=${ingredients.join(",")}`;
}

// Load saved data on page start
loadUserData();
