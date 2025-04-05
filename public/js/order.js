document.addEventListener("DOMContentLoaded", function () {
  if (typeof auth === 'undefined') {
    console.warn("Firebase auth not loaded. Retrying...");
    setTimeout(loadOrderHistory, 300);
  } else {
    loadOrderHistory();
  }
});

async function getDriverMap() {
  const res = await fetch("/drivers-full");
  const data = await res.json();
  const map = {};
  data.drivers.forEach(driver => {
    map[driver.email] = driver.name;
  });
  return map;
}

function loadOrderHistory() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const driverMap = await getDriverMap();
      const orderList = document.getElementById("order-list");
      if (!orderList) return;

      db.collection("customers")
        .doc(user.email)
        .collection("orderHistory")
        .orderBy("createdAt", "desc")
        .onSnapshot(
          (snapshot) => {
            orderList.innerHTML = "";
            snapshot.forEach((doc) => {
              const order = doc.data();
              const driverName = driverMap[order.assignedTo] || order.assignedTo || "Unassigned";
              const li = document.createElement("li");
              li.textContent = `Order #${doc.id}: ${order.items.map(i => i.name).join(", ")} - ${order.status || "Pending"} - Driver: ${driverName}`;
              orderList.appendChild(li);
            });
          },
          (error) => {
            console.error("Error loading order history:", error);
          }
        );
    }
  });
}

// Add to Cart function with infused dropdown support
function addToCart(button) {
  const itemName = button.getAttribute("data-name");
  const basePrice = parseFloat(button.getAttribute("data-price"));

  const menuItem = button.closest(".menu-item");
  const select = menuItem.querySelector(".infused-select");
  const qtySelect = menuItem.querySelector(".quantity-select");

  const infusedOption = select ? select.value : "regular";
  const quantity = qtySelect ? parseInt(qtySelect.value) : 1;

  let finalPrice = basePrice;
  let itemLabel = itemName;

  if (infusedOption === "infused") {
    finalPrice += 20;
    itemLabel += " (Infused)";
  }

  const cartItem = {
    name: itemLabel,
    price: finalPrice,
    quantity: quantity,
    infused: infusedOption === "infused"
  };

  const cart = JSON.parse(localStorage.getItem("cart")) || [];

  const existing = cart.find(i => i.name === cartItem.name && i.infused === cartItem.infused);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push(cartItem);
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  if (typeof updateHeaderCart === "function") updateHeaderCart();

  console.log("Added to cart:", cartItem);
}