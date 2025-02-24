// 1. Fetch and Render Orders in the Table
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

    // Items (Display Item Names)
    const itemsCell = document.createElement('td');
    itemsCell.textContent = order.items ? order.items.map(item => item.name).join(', ') : 'N/A';
    tr.appendChild(itemsCell);

    // Created At (Format Timestamp)
    const createdAtCell = document.createElement('td');
    if (order.createdAt && order.createdAt.seconds) {
      createdAtCell.textContent = new Date(order.createdAt.seconds * 1000).toLocaleString();
    } else if (order.createdAt) {
      createdAtCell.textContent = new Date(order.createdAt).toLocaleString();
    } else {
      createdAtCell.textContent = 'N/A';
    }
    tr.appendChild(createdAtCell);

    // Order Status Dropdown
    const statusCell = document.createElement('td');
    const statusSelect = document.createElement('select');
    const statuses = ["Order Received", "Preparing", "Out for Delivery", "Completed"];

    statuses.forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (order.status === status) {
        option.selected = true;
      }
      statusSelect.appendChild(option);
    });

    statusSelect.dataset.id = order.id;
    statusCell.appendChild(statusSelect);
    tr.appendChild(statusCell);

    // Update Button
    const updateCell = document.createElement('td');
    const updateButton = document.createElement('button');
    updateButton.textContent = 'Update';
    updateButton.dataset.id = order.id;
    updateButton.addEventListener('click', () => updateOrderStatus(order.id, statusSelect.value));
    updateCell.appendChild(updateButton);
    tr.appendChild(updateCell);

    tbody.appendChild(tr);
  });
}

// 2. Fetch Orders from the Server
async function fetchOrders() {
  console.log("📡 Fetching orders...");
  try {
    const response = await fetch('/orders');

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Orders received:", data);

    if (data.orders && data.orders.length > 0) {
      renderOrders(data.orders);
    } else {
      console.warn("⚠️ No orders found.");
    }
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
  }
}

// 3. Update Order Status in Firestore
async function updateOrderStatus(orderId, newStatus) {
  console.log(`🔄 Updating Order ${orderId} to: ${newStatus}`);
  try {
    const response = await fetch(`/order/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    console.log(`✅ Order ${orderId} updated to ${newStatus}`);
    alert(`Order ${orderId} updated to ${newStatus}`);

    // Refresh order list after update
    fetchOrders();
  } catch (error) {
    console.error("❌ Error updating order status:", error);
  }
}

// 4. Initial Setup: Fetch orders when page loads
window.addEventListener('load', fetchOrders);