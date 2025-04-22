// public/js/app.js

document.addEventListener("DOMContentLoaded", () => {
  // Ensure Firebase is available
  if (typeof firebase === "undefined") {
    console.error("Firebase not loaded.");
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  // Handle Firebase Authentication State
  auth.onAuthStateChanged((user) => {
    const loginContainer = document.getElementById("login-container");
    const orderContainer = document.getElementById("order-container");
    const loginBtn = document.getElementById("header-login");
    const logoutBtn = document.getElementById("header-logout");

    if (user) {
      console.log('User logged in:', user.email);
      if (loginContainer) loginContainer.style.display = "none";
      if (orderContainer) orderContainer.style.display = "block";
      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
      loadOrders(user);
    } else {
      console.log('No user logged in');
      if (loginContainer) loginContainer.style.display = "block";
      if (orderContainer) orderContainer.style.display = "none";
      if (loginBtn) loginBtn.style.display = "inline-block";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  });

  // Load orders for authenticated user
  function loadOrders(user) {
    if (!user) return;
    const orderContainer = document.getElementById("orders-container");
    if (!orderContainer) return;

    db.collection("orders")
      .where("customerEmail", "==", user.email)
      .orderBy("createdAt", "desc")
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
        <h3>Order #${order.id}</h3>
        <p><strong>Status:</strong> ${order.status || "Unknown"}</p>
        <p><strong>Items:</strong> ${order.items?.map(i => i.name).join(", ") || "N/A"}</p>
        <p><strong>Total:</strong> $${order.total?.toFixed(2) || "0.00"}</p>
        <p><strong>Driver:</strong> ${order.assignedTo || "Not Assigned"}</p>
      `;
      orderContainer.appendChild(div);
    });
  }

  // Login form
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      const errorMessage = document.getElementById("error-message");

      auth.signInWithEmailAndPassword(email, password)
        .then(() => {
          if (errorMessage) errorMessage.textContent = "";
        })
        .catch(err => {
          if (errorMessage) errorMessage.textContent = "Login failed: " + err.message;
        });
    });
  }

  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().then(() => {
        console.log("User signed out.");
      });
    });
  }
});