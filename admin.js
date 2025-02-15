// admin.js

// 1. Render Orders in the Table
function renderOrders(orders) {
  const tbody = document.querySelector('#orders-table tbody');
  tbody.innerHTML = ''; // Clear existing rows

  orders.forEach(order => {
    const tr = document.createElement('tr');

    // Order ID
    const idCell = document.createElement('td');
    idCell.textContent = order.id;
    tr.appendChild(idCell);

    // Customer Name
    const customerCell = document.createElement('td');
    customerCell.textContent = order.customerName || 'N/A';
    tr.appendChild(customerCell);

    // Address
    const addressCell = document.createElement('td');
    addressCell.textContent = order.address || 'N/A';
    tr.appendChild(addressCell);

    // Items
    const itemsCell = document.createElement('td');
    itemsCell.textContent = (order.items || []).join(', ');
    tr.appendChild(itemsCell);

    // Created At
    const createdAtCell = document.createElement('td');
    if (order.createdAt && order.createdAt.seconds) {
      createdAtCell.textContent = new Date(order.createdAt.seconds * 1000).toLocaleString();
    } else {
      createdAtCell.textContent = 'N/A';
    }
    tr.appendChild(createdAtCell);

    tbody.appendChild(tr);
  });
}

// 2. Fetch Orders from the Server
function fetchOrders() {
  console.log("Fetching orders...");
  fetch('http://localhost:3000/orders')
    .then(response => {
      console.log("Response status:", response.status);
      return response.json();
    })
    .then(data => {
      console.log("Fetched orders data:", data);
      if (data.orders) {
        renderOrders(data.orders);
      } else {
        console.warn("No orders field in response.");
      }
    })
    .catch(err => console.error("Error fetching orders:", err));
}

// 3. Initial Setup: Fetch orders when page loads
window.addEventListener('load', () => {
  fetchOrders();
});

