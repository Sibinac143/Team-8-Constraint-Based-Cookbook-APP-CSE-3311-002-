const searchBtn = document.getElementById("searchBtn");
const ingredientInput = document.getElementById("ingredient");
const resultsDiv = document.getElementById("results");

const BACKEND_URL = "http://127.0.0.1:5000/search";

searchBtn.addEventListener("click", async () => {
  const ingredient = ingredientInput.value.trim();

  if (!ingredient) {
    resultsDiv.innerHTML = "<p style='color:red;'>Please enter an ingredient.</p>";
    return;
  }

  resultsDiv.innerHTML = "<p>Loading...</p>";

  try {
    const response = await fetch(`${BACKEND_URL}?ingredient=${encodeURIComponent(ingredient)}`);
    const data = await response.json();

    // If backend returns error JSON
    if (data.error) {
      resultsDiv.innerHTML = `<p style='color:red;'>${data.error}</p>`;
      return;
    }

    // If no recipes found
    if (!data || data.length === 0) {
      resultsDiv.innerHTML = "<p>No recipes found.</p>";
      return;
    }

    // Render recipe cards
    resultsDiv.innerHTML = data.map(meal => `
      <div style="
        background:white;
        padding:15px;
        margin:10px auto;
        max-width:400px;
        border-radius:10px;
        box-shadow:0 2px 8px rgba(0,0,0,0.1);
      ">
        <h3>${meal.name}</h3>
        <img src="${meal.image}" alt="${meal.name}" style="width:100%; border-radius:10px;">
      </div>
    `).join("");

  } catch (err) {
    resultsDiv.innerHTML = "<p style='color:red;'>Error connecting to backend.</p>";
    console.error(err);
  }
});

