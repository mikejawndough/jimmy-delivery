// public/js/checkout.js

document.addEventListener("DOMContentLoaded", function() {
  // Display cart items on checkout page
  function displayCart() {
    const cartList = document.getElementById("cart-items");
    const totalElement = document.getElementById("cart-total");
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    cartList.innerHTML = "";
    let total = 0;
    cart.forEach(item => {
      total += item.price;
      const li = document.createElement("li");
      li.textContent = `${item.name}${item.infused ? " (Infused)" : ""} - $${item.price.toFixed(2)}`;
      cartList.appendChild(li);
    });
    total += 5.99; // Add delivery fee
    totalElement.textContent = total.toFixed(2);
  }
  
  displayCart();
  
  // Toggle scheduled delivery dropdown display
  document.querySelectorAll('input[name="delivery-option"]').forEach(radio => {
    radio.addEventListener("change", function() {
      const scheduleDiv = document.getElementById("schedule-delivery");
      scheduleDiv.style.display = (this.value === "scheduled") ? "block" : "none";
    });
  });
  
  // Toggle recurring order options display
  document.querySelectorAll('input[name="recurring"]').forEach(radio => {
    radio.addEventListener("change", function() {
      const recurringOptions = document.getElementById("recurring-options");
      recurringOptions.style.display = (this.value === "yes") ? "block" : "none";
    });
  });
  
  let paypalPaymentCompleted = false;
  
  // Payment method toggle: show PayPal button if "paypal" is selected
  document.querySelectorAll('input[name="payment-method"]').forEach(elem => {
    elem.addEventListener("change", function(event) {
      if (event.target.value === "paypal") {
        document.getElementById("paypal-button-container").style.display = "block";
        document.getElementById("place-order").disabled = true;
      } else {
        document.getElementById("paypal-button-container").style.display = "none";
        document.getElementById("place-order").disabled = false;
      }
    });
  });
  
  // Render PayPal button
  paypal.Buttons({
    createOrder: function(data, actions) {
      // Here, you could calculate the total dynamically if needed.
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
        document.getElementById("place-order").disabled = false;
      });
    },
    onError: function(err) {
      console.error("PayPal Checkout error:", err);
    }
  }).render("#paypal-button-container");
  
  // Order form submission logic
  document.getElementById("order-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    const customerName = document.getElementById("customer-name").value.trim();
    const phoneNumber = document.getElementById("phone-number").value.trim();
    const customerEmail = document.getElementById("customer-email").value.trim();
    const address = document.getElementById("address").value.trim();
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
    
    if (!customerName || !phoneNumber || !customerEmail || !address) {
      alert("Please fill out all required fields.");
      return;
    }
    
    const selectedPayment = document.querySelector('input[name="payment-method"]:checked').value;
    if (selectedPayment === "paypal" && !paypalPaymentCompleted) {
      alert("Please complete the PayPal payment before placing your order.");
      return;
    }
    
    // Recurring order fields
    const recurring = document.querySelector('input[name="recurring"]:checked').value;
    let frequency = null, recurringStart = null, recurringEnd = null;
    if (recurring === "yes") {
      frequency = document.getElementById("frequency").value;
      recurringStart = document.getElementById("recurring-start").value;
      recurringEnd = document.getElementById("recurring-end").value;
    }
    
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const DELIVERY_FEE = 5.99;
    const total = cart.reduce((sum, item) => sum + item.price, 0) + DELIVERY_FEE;
    
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
