// Initialize Firebase App
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};
firebase.initializeApp(firebaseConfig);

// Firestore Database and Firebase Auth
const db = firebase.firestore();
const auth = firebase.auth();

// Handle Firebase Authentication State
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('User logged in:', user.email);
    // You can perform actions like redirecting users to their dashboard
    document.getElementById("header-login").style.display = "none";
    document.getElementById("header-logout").style.display = "block";
  } else {
    console.log('No user logged in');
    document.getElementById("header-login").style.display = "block";
    document.getElementById("header-logout").style.display = "none";
  }
});

// Example function for loading user orders from Firestore
function loadOrders() {
  const user = auth.currentUser;
  if (user) {
    db.collection("orders").where("userId", "==", user.uid).onSnapshot(snapshot => {
      const orders = snapshot.docs.map(doc => doc.data());
      renderOrders(orders);
    });
  } else {
    console.log("User not authenticated, unable to load orders.");
  }
}

// Function to render orders
function renderOrders(orders) {
  const orderContainer = document.getElementById("orders-container");
  orderContainer.innerHTML = ''; // Clear previous content
  orders.forEach(order => {
    const orderElement = document.createElement("div");
    orderElement.classList.add("order");
    orderElement.innerHTML = `<h3>Order ID: ${order.id}</h3><p>Status: ${order.status}</p>`;
    orderContainer.appendChild(orderElement);
  });
}

document.addEventListener("DOMContentLoaded", loadOrders);