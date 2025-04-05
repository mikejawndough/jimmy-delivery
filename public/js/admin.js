'use strict';

let driverMap = {}; // email -> name

function renderOrders(orders) {
  const tbody = document.querySelector('#orders-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  orders.forEach(order => {
    const tr = document.createElement('tr');

    const idCell = document.createElement('td');
    idCell.textContent = order.id;
    tr.appendChild(idCell);

    const customerCell = document.createElement('td');
    customerCell.textContent = order.customerName || 'N/A';
    tr.appendChild(customerCell);

    const addressCell = document.createElement('td');
    addressCell.textContent = order.address || 'N/A';
    tr.appendChild(addressCell);

    const itemsCell = document.createElement('td');
    if (order.items && Array.isArray(order.items)) {
      itemsCell.textContent = order.items.map(item => item.name).join(', ');
    } else {
      itemsCell.textContent = 'N/A';
    }
    tr.appendChild(itemsCell);

    const createdAtCell = document.createElement('td');
    if (order.createdAt?.seconds) {
      createdAtCell.textContent = new Date(order.createdAt.seconds * 1000).toLocaleString();
    } else {
      createdAtCell.textContent = 'N/A';
    }
    tr.appendChild(createdAtCell);

    const driverCell = document.createElement('td');
    const driverSelect = document.createElement('select');
    driverSelect.className = 'driver-select';
    driverSelect.dataset.id = order.id;

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select driver';
    driverSelect.appendChild(defaultOption);

    Object.entries(driverMap).forEach(([email, name]) => {
      const option = document.createElement('option');
      option.value = email;
      option.textContent = name;
      if (order.assignedTo === email) option.selected = true;
      driverSelect.appendChild(option);
    });

    driverCell.appendChild(driverSelect);
    tr.appendChild(driverCell);

    const statusCell = document.createElement('td');
    const statusSelect = document.createElement('select');
    const statuses = ["Order Received", "Preparing", "Out for Delivery", "Completed"];
    statuses.forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (order.status === status || order.status?.startsWith(status)) {
        option.selected = true;
      }
      statusSelect.appendChild(option);
    });
    statusSelect.dataset.id = order.id;
    statusCell.appendChild(statusSelect);
    tr.appendChild(statusCell);

    const updateCell = document.createElement('td');
    const updateButton = document.createElement('button');
    updateButton.textContent = 'Update';
    updateButton.dataset.id = order.id;
    updateButton.addEventListener('click', () => {
      const selectedDriver = document.querySelector(`select.driver-select[data-id='${order.id}']`);
      const selectedStatus = document.querySelector(`select[data-id='${order.id}']`);
      const driverEmail = selectedDriver?.value || '';
      updateOrderStatus(order.id, selectedStatus.value, driverEmail);
    });
    updateCell.appendChild(updateButton);
    tr.appendChild(updateCell);

    tbody.appendChild(tr);
  });
}

async function fetchOrders() {
  try {
    const response = await fetch('/orders');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    renderOrders(data.orders);
    renderDriverSummary(data.orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
  }
}

async function updateOrderStatus(orderId, newStatus, driverEmail) {
  try {
    let finalStatus = newStatus;

    if (newStatus === "Out for Delivery") {
      const res = await fetch(`/mapbox-eta/${orderId}`);
      const data = await res.json();
      if (res.ok && data.eta) {
        finalStatus += ` (ETA: ${data.eta})`;
      } else {
        alert("Could not calculate ETA. Status will still update without it.");
      }
    }

    const driverName = driverMap[driverEmail] || driverEmail;
    if (driverEmail) {
      finalStatus = `${newStatus} - Assigned to ${driverName}`;
    }

    const response = await fetch(`/order/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: finalStatus, assignedTo: driverEmail })
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    alert(`Order ${orderId} updated to ${finalStatus}`);
    fetchOrders();
  } catch (error) {
    console.error("Error updating order status:", error);
  }
}

function renderDriverSummary(orders) {
  const summary = {};
  orders.forEach(order => {
    if (order.assignedTo) {
      const name = driverMap[order.assignedTo] || order.assignedTo;
      summary[name] = (summary[name] || 0) + 1;
    }
  });

  const container = document.getElementById("driver-summary");
  if (!container) return;

  container.innerHTML = "";
  const keys = Object.keys(summary);
  if (keys.length === 0) {
    container.innerHTML = "<p>No drivers have been assigned orders yet.</p>";
    return;
  }

  const list = document.createElement("ul");
  keys.forEach(driver => {
    const li = document.createElement("li");
    li.textContent = `${driver} - ${summary[driver]} order(s) assigned`;
    list.appendChild(li);
  });
  container.appendChild(list);
}

async function createDriver() {
  const email = document.getElementById("new-driver-email").value.trim();
  const password = document.getElementById("new-driver-password").value;

  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  try {
    const response = await fetch("/create-driver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();
    const statusMsg = document.getElementById("driver-create-status");

    if (response.ok) {
      statusMsg.style.color = "green";
      statusMsg.textContent = "Driver account created!";
      document.getElementById("new-driver-email").value = "";
      document.getElementById("new-driver-password").value = "";
      loadDriverStatusList();
      fetchOrders();
    } else {
      statusMsg.style.color = "red";
      statusMsg.textContent = "Error: " + result.error;
    }
  } catch (err) {
    console.error("Create driver failed", err);
    alert("Error creating driver.");
  }
}

async function loadDriverStatusList() {
  const container = document.getElementById("driver-status-list");
  if (!container) return;

  try {
    const res = await fetch("/drivers-full");
    const data = await res.json();
    container.innerHTML = "<h3>Driver Availability</h3>";
    driverMap = {}; // Reset

    data.drivers.forEach(driver => {
      driverMap[driver.email] = driver.name;

      const wrapper = document.createElement("div");
      wrapper.style.margin = "8px 0";
      const label = document.createElement("label");
      label.textContent = `${driver.name} (${driver.email})`;
      label.className = 'checkbox-label';
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = driver.isActive;
      checkbox.style.marginLeft = "10px";
      checkbox.onchange = () => toggleDriverActive(driver.email, checkbox.checked);
      wrapper.appendChild(label);
      wrapper.appendChild(checkbox);
      container.appendChild(wrapper);
    });
  } catch (err) {
    console.error("Failed to load full driver list:", err);
  }
}

async function toggleDriverActive(email, isActive) {
  try {
    const res = await fetch("/driver-active", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, isActive })
    });
    if (!res.ok) throw new Error("Failed to update driver status.");
  } catch (err) {
    alert("Error updating driver availability.");
    console.error(err);
  }
}

window.addEventListener('load', () => {
  loadDriverStatusList();
  fetchOrders();
});