// public/js/order.js

function addToCart(button) {
    const name = button.getAttribute("data-name");
    const basePrice = parseFloat(button.getAttribute("data-price"));
    if (!name || isNaN(basePrice)) {
      alert("Item details are missing or invalid.");
      return;
    }
    let price = basePrice;
    let isInfused = false;
    
    const menuItem = button.closest('.menu-item');
    if (menuItem) {
      const infusedToggle = menuItem.querySelector('.infused-toggle');
      if (infusedToggle && infusedToggle.checked) {
        isInfused = true;
        price += 20;
      }
    }
    
    const item = { name, price, infused: isInfused, quantity: 1 };
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    
    // Optional: Update quantity if item already exists
    const existingIndex = cart.findIndex(i => i.name === item.name && i.infused === item.infused);
    if (existingIndex !== -1) {
      cart[existingIndex].quantity += 1;
    } else {
      cart.push(item);
    }
    
    localStorage.setItem("cart", JSON.stringify(cart));
    alert(`${name}${isInfused ? " (Infused)" : ""} added to cart!`);
    
    if (typeof updateMiniCart === "function") {
      updateMiniCart();
    }
  }
    
  window.addToCart = addToCart;