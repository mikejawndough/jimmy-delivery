// public/js/header.js
(function() {
  function waitForHeaderElements(callback) {
    var loginBtn = document.getElementById("header-login");
    var logoutBtn = document.getElementById("header-logout");
    var cartIcon = document.getElementById("cartIcon");
    var miniCart = document.getElementById("miniCart");
    if (loginBtn && logoutBtn && cartIcon && miniCart) {
      callback();
    } else {
      setTimeout(function() {
        waitForHeaderElements(callback);
      }, 100);
    }
  }

  // Mini-Cart Functions
  function updateMiniCart() {
    var cart = JSON.parse(localStorage.getItem("cart")) || [];
    var cartCountElem = document.getElementById("cart-count");
    if (cartCountElem) {
      cartCountElem.textContent = cart.length;
    }
    var miniCartItemsElem = document.getElementById("mini-cart-items");
    var miniCartTotalElem = document.getElementById("mini-cart-total");
    if (miniCartItemsElem && miniCartTotalElem) {
      miniCartItemsElem.innerHTML = "";
      var total = 0;
      cart.forEach(function(item, index) {
        total += item.price;
        var li = document.createElement("li");
        li.innerHTML = `
          <span class="item-text">${item.name}${item.infused ? " (Infused)" : ""} - $${item.price.toFixed(2)}</span>
          <button class="remove-btn" onclick="removeMiniCartItem(${index})">&times;</button>
        `;
        miniCartItemsElem.appendChild(li);
      });
      // Example: add a $5.99 delivery fee
      total += 5.99;
      miniCartTotalElem.textContent = total.toFixed(2);
    }
  }

  function removeMiniCartItem(index) {
    var cart = JSON.parse(localStorage.getItem("cart")) || [];
    cart.splice(index, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    updateMiniCart();
  }

  window.updateMiniCart = updateMiniCart;
  window.removeMiniCartItem = removeMiniCartItem;

  function attachCartEvents() {
    var cartIcon = document.getElementById("cartIcon");
    var miniCart = document.getElementById("miniCart");
    if (cartIcon && miniCart) {
      cartIcon.addEventListener("click", function() {
        miniCart.style.display = (miniCart.style.display === "block") ? "none" : "block";
      });
    }
    updateMiniCart();
  }

  // Toggle login form visibility
  function toggleLoginForm() {
    var loginFormContainer = document.getElementById("login-form-container");
    if (loginFormContainer) {
      loginFormContainer.style.display = (loginFormContainer.style.display === "block") ? "none" : "block";
    } else {
      console.error("Login form container not found.");
    }
  }

  // Attach authentication state listener
  function attachAuthListener() {
    var loginBtn = document.getElementById("header-login");
    var logoutBtn = document.getElementById("header-logout");
    if (!loginBtn || !logoutBtn) return;

    if (window.auth && typeof auth.onAuthStateChanged === "function") {
      auth.onAuthStateChanged(function(user) {
        if (user) {
          // If logged in: hide login button, show logout button
          loginBtn.style.display = "none";
          logoutBtn.style.display = "inline-block";
          logoutBtn.textContent = `Log Out (${user.email})`;
          logoutBtn.onclick = function() {
            logout(); // calls global logout() from app.js
          };
          // Also hide the login form container if it's open
          var loginFormContainer = document.getElementById("login-form-container");
          if (loginFormContainer) {
            loginFormContainer.style.display = "none";
          }
        } else {
          // If not logged in: show login button, hide logout button
          loginBtn.style.display = "inline-block";
          logoutBtn.style.display = "none";
          loginBtn.textContent = "Log In";
          loginBtn.onclick = function() {
            toggleLoginForm();
          };
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function() {
    waitForHeaderElements(function() {
      attachCartEvents();
      attachAuthListener();
    });
  });
})();