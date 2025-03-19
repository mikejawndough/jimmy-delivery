// public/js/header.js

(function() {
  // Poll until the header elements exist
  function waitForHeaderElements(callback) {
    var loginBtn = document.getElementById("header-login");
    var cartIcon = document.getElementById("cartIcon");
    var miniCart = document.getElementById("miniCart");
    if (loginBtn && cartIcon && miniCart) {
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
        li.innerHTML = '<span class="item-text">' +
          item.name + (item.infused ? " (Infused)" : "") +
          ' - $' + item.price.toFixed(2) + '</span>' +
          '<button class="remove-btn" onclick="removeMiniCartItem(' + index + ')">&times;</button>';
        miniCartItemsElem.appendChild(li);
      });
      // Add a fixed delivery fee (example: $5.99)
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
  
  // Expose these functions globally for inline onclicks, if needed
  window.updateMiniCart = updateMiniCart;
  window.removeMiniCartItem = removeMiniCartItem;
  
  // Attach click event to the cart icon to toggle mini-cart display
  function attachCartEvents() {
    var cartIcon = document.getElementById("cartIcon");
    var miniCart = document.getElementById("miniCart");
    if (cartIcon && miniCart) {
      cartIcon.addEventListener("click", function() {
        if (miniCart.style.display === "block") {
          miniCart.style.display = "none";
        } else {
          miniCart.style.display = "block";
        }
      });
    }
    updateMiniCart();
  }
  
  // Authentication state listener for the header login button
  function attachAuthListener() {
    var loginBtn = document.getElementById("header-login");
    if (!loginBtn) return;
    if (window.auth && typeof auth.onAuthStateChanged === "function") {
      auth.onAuthStateChanged(function(user) {
        if (user) {
          loginBtn.textContent = user.email;
          loginBtn.onclick = function() {
            // Optionally, implement a user menu toggle here.
            console.log("User is logged in; no login popup needed.");
          };
        } else {
          loginBtn.textContent = "Log In";
          loginBtn.onclick = function() {
            openLoginPopup();
          };
        }
      });
    }
  }
  
  // Define openLoginPopup so that the login modal appears
  function openLoginPopup() {
    var modal = document.getElementById("login-popup");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "login-popup";
      modal.style.position = "fixed";
      modal.style.top = "0";
      modal.style.left = "0";
      modal.style.width = "100%";
      modal.style.height = "100%";
      modal.style.backgroundColor = "rgba(0,0,0,0.5)";
      modal.style.display = "flex";
      modal.style.justifyContent = "center";
      modal.style.alignItems = "center";
      
      var popupContent = document.createElement("div");
      popupContent.style.backgroundColor = "#fff";
      popupContent.style.padding = "20px";
      popupContent.style.borderRadius = "8px";
      popupContent.style.position = "relative";
      popupContent.style.maxWidth = "400px";
      popupContent.style.width = "90%";
      
      var closeButton = document.createElement("button");
      closeButton.textContent = "X";
      closeButton.style.position = "absolute";
      closeButton.style.top = "10px";
      closeButton.style.right = "10px";
      closeButton.addEventListener("click", function() {
        modal.style.display = "none";
      });
      popupContent.appendChild(closeButton);
      
      // Clone the login form from #login-section if it exists
      var loginForm = document.getElementById("login-section");
      if (loginForm) {
        var clonedForm = loginForm.cloneNode(true);
        clonedForm.classList.remove("hidden");
        clonedForm.removeAttribute("id"); // Avoid duplicate IDs
        popupContent.appendChild(clonedForm);
      } else {
        popupContent.innerHTML += "<p>Login form not found.</p>";
      }
      
      modal.appendChild(popupContent);
      document.body.appendChild(modal);
    } else {
      modal.style.display = "flex";
    }
  }
  
  // Expose openLoginPopup globally
  window.openLoginPopup = openLoginPopup;
  
  // When DOM is fully loaded, attach header events
  document.addEventListener("DOMContentLoaded", function() {
    waitForHeaderElements(function() {
      attachCartEvents();
      attachAuthListener();
    });
  });
})();