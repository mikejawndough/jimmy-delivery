document.addEventListener("DOMContentLoaded", function () {
  const footer = document.getElementById("footer-placeholder");
  if (!footer) return;

  fetch('/footer.html')
    .then(res => res.text())
    .then(data => {
      footer.innerHTML = data;
    })
    .catch(err => console.error("Footer load error:", err));
});