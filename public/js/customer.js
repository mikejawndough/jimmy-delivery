// public/js/customer.js

// Initialize Firebase from your /firebase-config endpoint
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch('/firebase-config');
    const config = await response.json();
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    window.auth = firebase.auth();
    window.db = firebase.firestore();
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
});

// Authentication functions
window.showLogin = function() {
  document.getElementById("signup-section")?.classList.add("hidden");
  document.getElementById("login-section")?.classList.remove("hidden");
};

window.showSignup = function() {
  document.getElementById("login-section")?.classList.add("hidden");
  document.getElementById("signup-section")?.classList.remove("hidden");
};

window.signup = function(event) {
  event.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("signup-email").value;
  const phone = document.getElementById("phone").value;
  const password = document.getElementById("signup-password").value;
  
  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      return db.collection("customers").doc(email).set({
        name,
        email,
        phone,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(() => {
      alert("Account created! You can now log in.");
      showLogin();
    })
    .catch(error => alert("Error: " + error.message));
};

window.login = function(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  
  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      alert("Login successful!");
      loadDashboard(userCredential.user);
    })
    .catch(error => alert("Error: " + error.message));
};

window.logout = function() {
  auth.signOut().then(() => {
    document.getElementById("dashboard-section")?.classList.add("hidden");
    showLogin();
  });
};

// Load dashboard (order history and favorites)
window.loadDashboard = function(user) {
  document.getElementById("login-section")?.classList.add("hidden");
  document.getElementById("signup-section")?.classList.add("hidden");
  document.getElementById("dashboard-section")?.classList.remove("hidden");
  document.getElementById("user-info").textContent = `Logged in as ${user.email}`;
  
  // Load Order History
  db.collection("customers").doc(user.email).collection("orderHistory")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      const orderList = document.getElementById("order-list");
      orderList.innerHTML = "";
      snapshot.forEach(doc => {
        const order = doc.data();
        const li = document.createElement("li");
        li.textContent = `Order #${doc.id}: ${order.items.map(i => i.name).join(', ')} - ${order.status}`;
        orderList.appendChild(li);
      });
    }, error => {
      console.error("Error loading order history:", error);
    });
  
  // Load Favorites
  loadFavorites();
};

// Listen for auth state changes
auth.onAuthStateChanged(user => {
  if (user) {
    loadDashboard(user);
  } else {
    showLogin();
  }
});

// Function to load favorites from Firestore
function loadFavorites() {
  const user = auth.currentUser;
  if (!user) return;
  const favoritesList = document.getElementById("favorites-list");
  if (!favoritesList) return;
  db.collection("customers").doc(user.email).collection("favorites")
    .orderBy("addedAt", "desc")
    .onSnapshot(snapshot => {
      favoritesList.innerHTML = "";
      snapshot.forEach(doc => {
        const fav = doc.data();
        const li = document.createElement("li");
        li.textContent = `${fav.name} - $${fav.price.toFixed(2)}${fav.infused ? " (Infused)" : ""}`;
        favoritesList.appendChild(li);
      });
    }, error => console.error("Error loading favorites:", error));
}

// Function to add a favorite item to Firestore
window.addFavorite = function(item) {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to add favorites.");
    return;
  }
  const customerDoc = db.collection("customers").doc(user.email);
  const favoritesRef = customerDoc.collection("favorites");
  // Check for duplicate favorite by name
  favoritesRef.where("name", "==", item.name).get()
    .then(snapshot => {
      if (!snapshot.empty) {
        alert(`${item.name} is already in your favorites.`);
        return;
      }
      return favoritesRef.add({
        name: item.name,
        price: item.price,
        infused: item.infused,
        addedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(() => {
      alert(`${item.name} added to favorites!`);
    })
    .catch(error => {
      console.error("Error adding favorite:", error);
      alert("Error adding favorite: " + error.message);
    });
};
