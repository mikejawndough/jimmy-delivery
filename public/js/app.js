// public/js/app.js

document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Handle Firebase Authentication State
  auth.onAuthStateChanged((user) => {
    const loginBtn = document.getElementById("header-login");
    const logoutBtn = document.getElementById("header-logout");

    if (user) {
      console.log('User logged in:', user.email);
      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "block";
      loadOrders(user);
    } else {
      console.log('No user logged in');
      if (loginBtn) loginBtn.style.display = "block";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  });

  // Load orders for authenticated user
  function loadOrders(user) {
    if (!user) return;
    const orderContainer = document.getElementById("orders-container");
    if (!orderContainer) return;

    db.collection("orders")
      .where("userId", "==", user.uid)
      .onSnapshot(snapshot => {
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        renderOrders(orders);
      });
  }

  // Render orders to page
  function renderOrders(orders) {
    const orderContainer = document.getElementById("orders-container");
    if (!orderContainer) return;

    orderContainer.innerHTML = '';
    orders.forEach(order => {
      const div = document.createElement("div");
      div.classList.add("order");
      div.innerHTML = `
        <h3>Order ID: ${order.id}</h3>
        <p>Status: ${order.status || "Unknown"}</p>
      `;
      orderContainer.appendChild(div);
    });
  }
});