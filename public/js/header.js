document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined") {
    console.error("Firebase not loaded.");
    return;
  }

  const auth = firebase.auth();

  // Firebase Auth State
  auth.onAuthStateChanged((user) => {
    const loginBtn = document.getElementById("header-login");
    const logoutBtn = document.getElementById("header-logout");

    if (user) {
      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
    } else {
      if (loginBtn) loginBtn.style.display = "inline-block";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  });

  // Logout
  const logoutBtn = document.getElementById("header-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      firebase.auth().signOut().then(() => {
        window.location.reload();
      });
    });
  }

  updateHeaderCart(); // Run on initial load

  // Toggle mini cart
  document.addEventListener("click", (e) => {
    const cartIcon = document.getElementById("cartIcon");
    const miniCart = document.getElementById("miniCart");

    if (!cartIcon || !miniCart) return;

    if (cartIcon.contains(e.target)) {
      miniCart.style.display = miniCart.style.display === "block" ? "none" : "block";
    } else if (!miniCart.contains(e.target)) {
      miniCart.style.display = "none";
    }
  });
});

function updateHeaderCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartCountSpan = document.getElementById("cart-count");
  const miniCartList = document.getElementById("mini-cart-items");
  const totalSpan = document.getElementById("mini-cart-total");

  if (!cartCountSpan || !miniCartList || !totalSpan) return;

  let totalItems = 0;
  let totalPrice = 0;

  miniCartList.innerHTML = "";

  cart.forEach((item, index) => {
    const qty = item.quantity || 1;
    totalItems += qty;
    totalPrice += item.price * qty;

    const li = document.createElement("li");

    const span = document.createElement("span");
    span.classList.add("item-text");
    span.textContent = `${item.name} x${qty}`;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.classList.add("remove-btn");
    removeBtn.onclick = () => {
      cart.splice(index, 1);
      localStorage.setItem("cart", JSON.stringify(cart));
      updateHeaderCart();
    };

    li.appendChild(span);
    li.appendChild(removeBtn);
    miniCartList.appendChild(li);
  });

  cartCountSpan.textContent = totalItems;
  totalSpan.textContent = totalPrice.toFixed(2);
}