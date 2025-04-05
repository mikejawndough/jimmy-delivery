document.addEventListener("DOMContentLoaded", function () {
  const DELIVERY_RADIUS_MILES = 5;
  const NEW_ROCHELLE_COORDS = { lat: 40.9115, lng: -73.7824 };
  let addressCoords = null;
  let paypalPaymentCompleted = false;

  function displayCart() {
    const cartList = document.getElementById("cart-items");
    const totalElement = document.getElementById("cart-total");
    if (!cartList || !totalElement) return;

    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    cartList.innerHTML = "";
    let total = 0;

    cart.forEach((item) => {
      const qty = item.quantity || 1;
      total += item.price * qty;
      const li = document.createElement("li");
      li.textContent = `${item.name} x${qty} - $${(item.price * qty).toFixed(2)}`;
      cartList.appendChild(li);
    });

    total += 5.99; // Delivery fee
    totalElement.textContent = total.toFixed(2);
  }

  displayCart();

  // Delivery Option Toggle
  document.querySelectorAll('input[name="delivery-option"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const scheduleDiv = document.getElementById("schedule-delivery");
      scheduleDiv.style.display = radio.value === "scheduled" ? "block" : "none";
    });
  });

  // Recurring Option Toggle
  document.querySelectorAll('input[name="recurring"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const recurringOptions = document.getElementById("recurring-options");
      recurringOptions.style.display = radio.value === "yes" ? "block" : "none";
    });
  });

  // Payment Method Toggle
  document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const paypalContainer = document.getElementById("paypal-button-container");
      const placeOrderBtn = document.getElementById("place-order");
      const isPaypal = e.target.value === "paypal";
      if (paypalContainer) paypalContainer.style.display = isPaypal ? "block" : "none";
      if (placeOrderBtn) placeOrderBtn.disabled = isPaypal && !paypalPaymentCompleted;
    });
  });

  function initializePaypalButtons() {
    if (typeof paypal === "undefined") {
      setTimeout(initializePaypalButtons, 100);
      return;
    }

    paypal.Buttons({
      createOrder: function (data, actions) {
        const total = document.getElementById("cart-total").textContent || "10.00";
        return actions.order.create({
          purchase_units: [{ amount: { value: total } }]
        });
      },
      onApprove: function (data, actions) {
        return actions.order.capture().then(function (details) {
          alert("PayPal transaction completed by " + details.payer.name.given_name);
          paypalPaymentCompleted = true;
          const placeOrderBtn = document.getElementById("place-order");
          if (placeOrderBtn) placeOrderBtn.disabled = false;
        });
      },
      onError: function (err) {
        console.error("PayPal Checkout error:", err);
        alert("PayPal error. Try again or choose a different payment method.");
      }
    }).render("#paypal-button-container");
  }

  initializePaypalButtons();

  document.getElementById("order-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("customer-name").value.trim();
    const phone = document.getElementById("phone-number").value.trim();
    const email = document.getElementById("customer-email").value.trim();
    const address = document.getElementById("address").value.trim();
    const apt = document.getElementById("apt-number").value.trim();

    if (!name || !phone || !email || !address)
      return alert("Please fill in all required fields.");
    if (!addressCoords)
      return alert("Please use the autocomplete to select a valid address.");

    const deliveryOption = document.querySelector('input[name="delivery-option"]:checked').value;
    let deliveryDatetime = new Date().toISOString();

    if (deliveryOption === "scheduled") {
      const month = document.getElementById("delivery-month").value;
      const day = document.getElementById("delivery-day").value;
      const year = document.getElementById("delivery-year").value;
      const hour = document.getElementById("delivery-hour").value;
      const minute = document.getElementById("delivery-minute").value;
      const ampm = document.getElementById("delivery-ampm").value;

      if (!month || !day || !year || !hour || !minute || !ampm)
        return alert("Please complete the scheduled delivery time.");

      let hourNum = parseInt(hour);
      if (ampm === "PM" && hourNum < 12) hourNum += 12;
      if (ampm === "AM" && hourNum === 12) hourNum = 0;

      const timeStr = `${year}-${month}-${day}T${hourNum.toString().padStart(2, "0")}:${minute}:00`;
      deliveryDatetime = new Date(timeStr).toISOString();
    }

    const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value;
    if (paymentMethod === "paypal" && !paypalPaymentCompleted)
      return alert("Complete PayPal payment before placing your order.");

    const recurring = document.querySelector('input[name="recurring"]:checked').value;
    const frequency = recurring === "yes" ? document.getElementById("frequency").value : null;
    const recurringStart = recurring === "yes" ? document.getElementById("recurring-start").value : null;
    const recurringEnd = recurring === "yes" ? document.getElementById("recurring-end").value : null;

    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const DELIVERY_FEE = 5.99;
    const total = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0) + DELIVERY_FEE;

    const newOrder = {
      customerName: name,
      phoneNumber: phone,
      customerEmail: email,
      address,
      aptNumber: apt,
      coords: addressCoords,
      items: cart,
      total,
      paymentMethod,
      status: "Order Received",
      createdAt: new Date().toISOString(),
      deliveryDatetime,
      recurring,
      frequency,
      recurringStart,
      recurringEnd
    };

    try {
      const res = await fetch("/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrder)
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Order placed! Track here: tracker.html?orderId=${data.orderId}`);
        localStorage.removeItem("cart");
        window.location.href = "tracker.html?orderId=" + data.orderId;
      } else {
        throw new Error(data.error || "Failed to place order");
      }
    } catch (err) {
      console.error("Order error:", err);
      alert("Error submitting order. Please try again.");
    }
  });

  // Set addressCoords from Mapbox event
  window.addEventListener("mapboxGeocoderResult", function (event) {
    addressCoords = event.detail.coords;
  });
});