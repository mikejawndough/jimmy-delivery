// customer.js

// Render the customer's orders in the table
function renderCustomerOrders(orders) {
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

// Fetch orders for a specific customer based on their email
function fetchCustomerOrders(email) {
  console.log("Fetching orders for customer:", email);
  fetch(`http://localhost:3000/orders/customer?email=${encodeURIComponent(email)}`)
    .then(response => response.json())
    .then(data => {
      console.log("Fetched customer orders:", data);
      if (data.orders) {
        renderCustomerOrders(data.orders);
      } else {
        console.warn("No orders found for this customer.");
      }
    })
    .catch(err => console.error("Error fetching customer orders:", err));
}

