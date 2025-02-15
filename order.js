// order.js

// 1. Fetch and Render Menu Items
function loadMenu() {
  fetch('http://localhost:3000/menu')
    .then(response => response.json())
    .then(data => {
      const menuDiv = document.getElementById('menu');
      const itemsSelect = document.getElementById('items');
      data.menu.forEach(item => {
        // Display the menu item in the menu container
        const itemDiv = document.createElement('div');
        itemDiv.className = 'menu-item';
        itemDiv.textContent = `${item.id}: ${item.name} - $${item.price}`;
        menuDiv.appendChild(itemDiv);

        // Add the item as an option in the multi-select
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} - $${item.price}`;
        itemsSelect.appendChild(option);
      });
    })
    .catch(err => console.error('Error loading menu:', err));
}

// 2. Handle Order Form Submission
document.getElementById('order-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const customerName = document.getElementById('customerName').value;
  const address = document.getElementById('address').value;
  const customerEmail = document.getElementById('customerEmail').value;
  const phoneNumber = document.getElementById('phoneNumber').value; // optional, if you plan to use it
  const selectedOptions = Array.from(document.getElementById('items').selectedOptions);
  const items = selectedOptions.map(option => parseInt(option.value));

  const orderData = {
    customerName,
    address,
    customerEmail,  // Include customer email
    // Optionally, you can include phoneNumber if needed:
    phoneNumber,
    items
  };

  fetch('http://localhost:3000/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  })
    .then(response => response.json())
    .then(data => {
      console.log("Order placed:", data);
      alert("Order placed successfully!");
    })
    .catch(err => console.error("Error placing order:", err));
});

// 3. Initialize the Page
window.addEventListener('load', () => {
  loadMenu();
});

