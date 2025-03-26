document.addEventListener("DOMContentLoaded", function() {
  // --- Delivery Radius Constants ---
  const NEW_ROCHELLE_COORDS = { lat: 40.9115, lng: -73.7824 };
  const DELIVERY_RADIUS_MILES = 5;

  // --- Haversine Formula for Distance ---
  function toRadians(deg) {
    return deg * (Math.PI / 180);
  }
  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 3958.8;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- Google Places Autocomplete Setup ---
  window.initAutocomplete = function() {
    const addressInput = document.getElementById("address");
    if (!addressInput) {
      console.error("Address input field not found.");
      return;
    }
    if (!window.google || !google.maps || !google.maps.places) {
      console.error("Google Places API not available.");
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(addressInput, {
      // Optionally restrict to US
      // componentRestrictions: { country: "us" }
    });

    autocomplete.addListener("place_changed", function() {
      const place = autocomplete.getPlace();
      if (!place.geometry) {
        alert("No details available for input: '" + addressInput.value + "'");
        return;
      }

      addressInput.value = place.formatted_address || addressInput.value;

      const loc = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };
      const distance = haversineDistance(
        NEW_ROCHELLE_COORDS.lat, NEW_ROCHELLE_COORDS.lng,
        loc.lat, loc.lng
      );

      console.log(`Distance from New Rochelle: ${distance.toFixed(2)} miles`);
      if (distance > DELIVERY_RADIUS_MILES) {
        alert(`Sorry, we only deliver within ${DELIVERY_RADIUS_MILES} miles of New Rochelle.`);
        addressInput.value = "";
      }
    });
  };

  // --- Display Cart Items ---
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

    total += 5.99; // Delivery fee
    totalElement.textContent = total.toFixed(2);
  }
  displayCart();

  // --- Delivery Option Toggle ---
  document.querySelectorAll('input[name="delivery-option"]').forEach(radio => {
    radio.addEventListener("change", function() {
      const scheduleDiv = document.getElementById("schedule-delivery");
      if (scheduleDiv) {
        scheduleDiv.style.display = (this.value === "scheduled") ? "block" : "none";
      }
    });
  });

  // --- Recurring Order Toggle ---
  document.querySelectorAll('input[name="recurring"]').forEach(radio => {
    radio.addEventListener("change", function() {
      const recurringOptions = document.getElementById("recurring-options");
      if (recurringOptions) {
        recurringOptions.style.display = (this.value === "yes") ? "block" : "none";
      }
    });
  });

  // --- Payment Method Handling ---
  let paypalPaymentCompleted = false;
  document.querySelectorAll('input[name="payment-method"]').forEach(elem => {
    elem.addEventListener("change", function(event) {
      const paypalContainer = document.getElementById("paypal-button-container");
      const placeOrderBtn = document.getElementById("place-order");
      const isPaypal = event.target.value === "paypal";

      if (paypalContainer) paypalContainer.style.display = isPaypal ? "block" : "none";
      if (placeOrderBtn) placeOrderBtn.disabled = isPaypal && !paypalPaymentCompleted;
    });
  });

  // --- Initialize PayPal Buttons ---
  function initializePaypalButtons() {
    if (typeof paypal === "undefined") {
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
          alert("PayPal transaction completed by " + details.payer.name.given_name);
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

  // --- Order Form Submission ---
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
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;

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
      const response = await fetch("/order", {
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