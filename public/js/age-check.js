// age-check.js

if (localStorage.getItem("verifiedAge") !== "true") {
  window.location.href = "index.html";
}