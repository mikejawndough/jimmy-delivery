let driverMap = {};

async function loadDriverMap() {
  try {
    const res = await fetch("/drivers-full");
    const data = await res.json();
    driverMap = {};
    data.drivers.forEach(driver => {
      driverMap[driver.email] = driver.name;
    });
  } catch (err) {
    console.error("Failed to fetch drivers:", err);
  }
}

async function trackOrderStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("orderId");

  const statusEl = document.getElementById("order-status");
  const driverEl = document.getElementById("driver-name");
  const fillEl = document.getElementById("status-fill");
  const textEl = document.getElementById("status-text");
  const alertBanner = document.getElementById("status-alert");

  if (!orderId) {
    if (statusEl) statusEl.textContent = "No order ID provided.";
    return;
  }

  await loadDriverMap();

  const db = firebase.firestore();
  const orderRef = db.collection("orders").doc(orderId);

  orderRef.onSnapshot((doc) => {
    if (!doc.exists) {
      if (statusEl) statusEl.textContent = "Order not found.";
      return;
    }

    const order = doc.data();
    const driverName = driverMap[order.assignedTo] || order.assignedTo || "Unassigned";

    // Alert banner
    if (alertBanner && window.lastStatus && order.status !== window.lastStatus) {
      alertBanner.textContent = "Your order status has changed: " + order.status;
      alertBanner.style.display = "block";
      setTimeout(() => { alertBanner.style.display = "none"; }, 5000);
    }
    window.lastStatus = order.status;

    // Update order status text
    if (statusEl) statusEl.textContent = order.status || "Pending";

    // Update driver name
    if (driverEl) driverEl.textContent = driverName;

    // Update progress bar
    let progress = 0;
    if (order.status.includes("Order Received")) progress = 25;
    else if (order.status.includes("Preparing")) progress = 50;
    else if (order.status.includes("Out for Delivery")) progress = 75;
    else if (order.status.includes("Completed")) progress = 100;

    if (fillEl) fillEl.style.width = progress + "%";
    if (textEl) textEl.textContent = progress + "%";
  });
}

document.addEventListener("DOMContentLoaded", trackOrderStatus);