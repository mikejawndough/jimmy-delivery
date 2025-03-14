// header.js

function updateMiniCart() {
  // Retrieve the cart from localStorage or initialize an empty array
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  // Update the cart count displayed in the header
  const cartCountElem = document.getElementById("cart-count");
  cartCountElem.textContent = cart.length;
  
  // Update the mini cart dropdown list and total
  const miniCartItemsElem = document.getElementById("mini-cart-items");
  const miniCartTotalElem = document.getElementById("mini-cart-total");
  miniCartItemsElem.innerHTML = "";
  let total = 0;
  
  cart.forEach((item, index) => {
    total += item.price; // item.price should include the infused upcharge if applicable
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="item-text">${item.name}${item.infused ? " (Infused)" : ""} - $${item.price.toFixed(2)}</span>
      <button class="remove-btn" onclick="removeMiniCartItem(${index})">&times;</button>
    `;
    miniCartItemsElem.appendChild(li);
  });
  
  // Optionally add a delivery fee (for example, $5.99)
  total += 5.99;
  miniCartTotalElem.textContent = total.toFixed(2);
}

function removeMiniCartItem(index) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  updateMiniCart();
}

// Attach event listener to cart icon to toggle mini cart dropdown
document.getElementById("cartIcon").addEventListener("click", function() {
  const miniCart = document.getElementById("miniCart");
  miniCart.style.display = (miniCart.style.display === "block") ? "none" : "block";
});

// Optionally, update the mini cart on page load
document.addEventListener("DOMContentLoaded", updateMiniCart);

// Expose functions globally if needed
window.updateMiniCart = updateMiniCart;
window.removeMiniCartItem = removeMiniCartItem;
