// public/js/checkout.js

document.addEventListener("DOMContentLoaded", function() {
  // --- Delivery Radius Check using Photon Autocomplete ---
  const NEW_ROCHELLE_COORDS = { lat: 40.9115, lng: -73.7824 };
  const DELIVERY_RADIUS_MILES = 5;
  
  function toRadians(deg) {
    return deg * (Math.PI / 180);
  }
  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 3958.8; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  const addressInput = document.getElementById("address");
  const suggestionsList = document.getElementById("suggestions");
  
  async function fetchPhotonSuggestions(query) {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Photon API error:", response.status, errorText);
        return [];
      }
      const data = await response.json();
      if (!data || !Array.isArray(data.features)) {
        console.error("Unexpected Photon response:", data);
        return [];
      }
      return data.features;
    } catch (error) {
      console.error("Error fetching Photon suggestions:", error);
      return [];
    }
  }
  
  function renderSuggestions(suggestions) {
    suggestionsList.innerHTML = "";
    suggestions.forEach(feature => {
      const li = document.createElement("li");
      li.textContent = feature.properties.display_name;
      li.addEventListener("click", function() {
        addressInput.value = feature.properties.display_name;
        suggestionsList.innerHTML = "";
        const locObj = { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] };
        const distance = haversineDistance(
          NEW_ROCHELLE_COORDS.lat,
          NEW_ROCHELLE_COORDS.lng,
          locObj.lat,
          locObj.lng
        );
        console.log(`Distance from New Rochelle: ${distance.toFixed(2)} miles`);
        if (distance > DELIVERY_RADIUS_MILES) {
          alert(`Sorry, we only deliver within ${DELIVERY_RADIUS_MILES} miles of New Rochelle.`);
          addressInput.value = "";
        }
      });
      suggestionsList.appendChild(li);
    });
  }
  
  if (addressInput) {
    addressInput.addEventListener("keyup", async function() {
      const query = addressInput.value;
      if (query.length < 3) {
        suggestionsList.innerHTML = "";
        return;
      }
      const suggestions = await fetchPhotonSuggestions(query);
      renderSuggestions(suggestions);
    });
  }
  
  // --- Existing Functions (unchanged) ---
  function displayCart() {
    const cartList = document.getElementById("cart-items");
    const totalElement = document.getElementById("cart-total");
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    cartList.innerHTML = "";
    let total = 0;
    cart.forEach(item => {
      const qty = item.quantity || 1;
      total += item.price * qty;
      const li = document.createElement("li");
      li.textContent = `${item.name}${item.infused ? " (Infused)" : ""} x${qty} - $${(item.price * qty).toFixed(2)}`;
      cartList.appendChild(li);
    });
    total += 5.99;
    totalElement.textContent = total.toFixed(2);
  }
  displayCart();
  
  document.querySelectorAll('input[name="delivery-option"]').forEach(radio => {
    radio.addEventListener("change", function() {
      const scheduleDiv = document.getElementById("schedule-delivery");
      if (scheduleDiv) {
        scheduleDiv.style.display = (this.value === "scheduled") ? "block" : "none";
      }
    });
  });
  
  document.querySelectorAll('input[name="recurring"]').forEach(radio => {
    radio.addEventListener("change", function() {
      const recurringOptions = document.getElementById("recurring-options");
      if (recurringOptions) {
        recurringOptions.style.display = (this.value === "yes") ? "block" : "none";
      }
    });
  });
  
  let paypalPaymentCompleted = false;
  
  document.querySelectorAll('input[name="payment-method"]').forEach(elem => {
    elem.addEventListener("change", function(event) {
      const paypalContainer = document.getElementById("paypal-button-container");
      const placeOrderBtn = document.getElementById("place-order");
      if (event.target.value === "paypal") {
        if (paypalContainer) paypalContainer.style.display = "block";
        if (placeOrderBtn) placeOrderBtn.disabled = true;
      } else {
        if (paypalContainer) paypalContainer.style.display = "none";
        if (placeOrderBtn) placeOrderBtn.disabled = false;
      }
    });
  });
  
  function initializePaypalButtons() {
    if (typeof paypal === "undefined" || !paypal.Buttons) {
      setTimeout(initializePaypalButtons, 100);
      return;
    }
    paypal.Buttons({
      createOrder: function(data, actions) {
        return actions.order.create({
          purchase_units: [{
            amount: { value: "10.00" }
          }]
        });
      },
      onApprove: function(data, actions) {
        return actions.order.capture().then(function(details) {
          alert("PayPal Transaction completed by " + details.payer.name.given_name);
          paypalPaymentCompleted = true;
          const placeOrderBtn = document.getElementById("place-order");
          if (placeOrderBtn) placeOrderBtn.disabled = false;
        });
      },
      onError: function(err) {
        console.error("PayPal Checkout error:", err);
      }
    }).render("#paypal-button-container");
  }
  initializePaypalButtons();
  
  document.getElementById("order-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    const customerName = document.getElementById("customer-name").value.trim();
    const phoneNumber = document.getElementById("phone-number").value.trim();
    const customerEmail = document.getElementById("customer-email").value.trim();
    const address = document.getElementById("address").value.trim();
    
    if (!customerName || !phoneNumber || !customerEmail || !address) {
      alert("Please fill out all required fields.");
      return;
    }
    
    let deliveryDatetime = "";
    const deliveryOption = document.querySelector('input[name="delivery-option"]:checked').value;
    if (deliveryOption === "asap") {
      deliveryDatetime = new Date().toISOString();
    } else {
      const month = document.getElementById("delivery-month").value;
      const day = document.getElementById("delivery-day").value;
      const year = document.getElementById("delivery-year").value;
      const hourRaw = document.getElementById("delivery-hour").value;
      const minute = document.getElementById("delivery-minute").value;
      const ampm = document.getElementById("delivery-ampm").value;
      if (!month || !day || !year || !hourRaw || !minute || !ampm) {
        alert("Please select a complete delivery date and time.");
        return;
      }
      let hour = parseInt(hourRaw);
      if (ampm === "PM" && hour < 12) { hour += 12; }
      if (ampm === "AM" && hour === 12) { hour = 0; }
      const hourStr = hour.toString().padStart(2, "0");
      const dateTimeString = `${year}-${month}-${day}T${hourStr}:${minute}:00`;
      deliveryDatetime = new Date(dateTimeString).toISOString();
    }
    
    const selectedPayment = document.querySelector('input[name="payment-method"]:checked').value;
    if (selectedPayment === "paypal" && !paypalPaymentCompleted) {
      alert("Please complete the PayPal payment before placing your order.");
      return;
    }
    
    const recurring = document.querySelector('input[name="recurring"]:checked').value;
    let frequency = null, recurringStart = null, recurringEnd = null;
    if (recurring === "yes") {
      frequency = document.getElementById("frequency").value;
      recurringStart = document.getElementById("recurring-start").value;
      recurringEnd = document.getElementById("recurring-end").value;
    }
    
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const DELIVERY_FEE = 5.99;
    const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0) + DELIVERY_FEE;
    
    const newOrder = {
      customerName,
      phoneNumber,
      customerEmail,
      address,
      items: cart,
      total,
      paymentMethod: selectedPayment,
      status: "Order Received",
      createdAt: new Date().toISOString(),
      deliveryDatetime,
      recurring,
      frequency,
      recurringStart,
      recurringEnd
    };
    
    try {
      const response = await fetch("http://localhost:3000/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrder)
      });
      const data = await response.json();
      if (response.ok) {
        alert(`Order placed successfully! Order ID: ${data.orderId}`);
        localStorage.removeItem("cart");
        window.location.href = "tracker.html?orderId=" + data.orderId;
      } else {
        throw new Error(data.error || "Failed to place order");
      }
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Failed to place order. Try again.");
    }
  });
});