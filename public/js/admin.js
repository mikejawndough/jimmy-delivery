// public/js/admin.js

// Render orders in the admin table
function renderOrders(orders) {
  const tbody = document.querySelector("#orders-table tbody");
  tbody.innerHTML = "";
  orders.forEach(order => {
    const tr = document.createElement("tr");

    // Order ID
    const idCell = document.createElement("td");
    idCell.textContent = order.id;
    tr.appendChild(idCell);

    // Customer Name
    const customerCell = document.createElement("td");
    customerCell.textContent = order.customerName || "N/A";
    tr.appendChild(customerCell);

    // Address
    const addressCell = document.createElement("td");
    addressCell.textContent = order.address || "N/A";
    tr.appendChild(addressCell);

    // Items
    const itemsCell = document.createElement("td");
    itemsCell.textContent = order.items ? order.items.map(item => item.name).join(", ") : "N/A";
    tr.appendChild(itemsCell);

    // Created At
    const createdAtCell = document.createElement("td");
    if (order.createdAt && order.createdAt.seconds) {
      createdAtCell.textContent = new Date(order.createdAt.seconds * 1000).toLocaleString();
    } else if (order.createdAt) {
      createdAtCell.textContent = new Date(order.createdAt).toLocaleString();
    } else {
      createdAtCell.textContent = "N/A";
    }
    tr.appendChild(createdAtCell);

    // Status Dropdown
    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    const statuses = ["Order Received", "Preparing", "Out for Delivery", "Completed"];
    statuses.forEach(status => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      if (order.status === status) option.selected = true;
      statusSelect.appendChild(option);
    });
    statusSelect.dataset.id = order.id;
    statusCell.appendChild(statusSelect);
    tr.appendChild(statusCell);

    // Update Button
    const updateCell = document.createElement("td");
    const updateButton = document.createElement("button");
    updateButton.textContent = "Update";
    updateButton.dataset.id = order.id;
    updateButton.addEventListener("click", () => updateOrderStatus(order.id, statusSelect.value));
    updateCell.appendChild(updateButton);
    tr.appendChild(updateCell);

    tbody.appendChild(tr);
  });
}

// Fetch orders from the server
async function fetchOrders() {
  try {
    const response = await fetch("/orders");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    if (data.orders && data.orders.length > 0) {
      renderOrders(data.orders);
    } else {
      console.warn("No orders found.");
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
  }
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(`/order/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    alert(`Order ${orderId} updated to ${newStatus}`);
    fetchOrders();
  } catch (error) {
    console.error("Error updating order status:", error);
  }
}

// Initial setup: fetch orders on page load
window.addEventListener("load", fetchOrders);
