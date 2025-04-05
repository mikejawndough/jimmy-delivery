// Initialize Firebase App
const db = firebase.firestore();
const auth = firebase.auth();

// Function to display orders
function loadOrders() {
  const user = auth.currentUser;
  if (!user) {
    console.log('No user logged in.');
    return;
  }

  db.collection('orders')
    .where('customerId', '==', user.uid)
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      const orders = snapshot.docs.map(doc => doc.data());
      renderOrders(orders);
    });
}

// Function to render orders to the dashboard
function renderOrders(orders) {
  const orderContainer = document.getElementById('orders-container');
  orderContainer.innerHTML = ''; // Clear existing content

  orders.forEach(order => {
    const orderCard = document.createElement('div');
    orderCard.className = 'order';
    orderCard.innerHTML = `
      <h3>Order #${order.id}</h3>
      <p><strong>Items:</strong> ${order.items.join(', ')}</p>
      <p><strong>Status:</strong> ${order.status}</p>
      <p><strong>Driver:</strong> ${order.driverName || 'Not Assigned'}</p>
      <button class="reorder-btn" onclick="reorderItems('${order.id}')">Reorder</button>
      <button class="favorites-btn" onclick="addToFavorites('${order.id}')">Add to Favorites</button>
    `;
    orderContainer.appendChild(orderCard);
  });
}

// Reorder functionality
function reorderItems(orderId) {
  // Simulate adding items to the cart for reordering
  console.log('Reordering items for order:', orderId);
  // Logic for reordering items can be added here
}

// Function to manage favorites (add an order to favorites)
function addToFavorites(orderId) {
  const user = auth.currentUser;
  if (!user) {
    console.log('No user logged in.');
    return;
  }

  db.collection('favorites').add({
    userId: user.uid,
    orderId: orderId,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  }).then(() => {
    console.log('Order added to favorites!');
  }).catch(error => {
    console.error('Error adding to favorites:', error);
  });
}

// Handle user login state changes
auth.onAuthStateChanged(user => {
  if (user) {
    console.log('User logged in:', user.email);
    loadOrders();
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('order-container').style.display = 'block';
  } else {
    console.log('User not logged in');
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('order-container').style.display = 'none';
  }
});

// Handle login form submission
document.getElementById('login-form').addEventListener('submit', event => {
  event.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorMessage = document.getElementById('error-message');

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('order-container').style.display = 'block';
      loadOrders();
    })
    .catch(err => {
      errorMessage.textContent = 'Login failed: ' + err.message;
    });
});

// Handle logout
document.getElementById('logout-btn').addEventListener('click', () => {
  auth.signOut().then(() => {
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('order-container').style.display = 'none';
    console.log('Logged out');
  }).catch(err => {
    console.error('Error logging out:', err);
  });
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const user = auth.currentUser;
  if (user) {
    loadOrders();
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('order-container').style.display = 'block';
  }
});