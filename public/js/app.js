// public/js/app.js

// Wait for DOM to load and initialize Firebase
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Fetch Firebase config from your backend endpoint
    const response = await fetch('/firebase-config');
    const config = await response.json();
    // Initialize Firebase only once
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    // Set Firebase Auth persistence so users remain logged in across pages
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => {
        // Listen for authentication state changes
        firebase.auth().onAuthStateChanged(user => {
          updateGlobalAuthControls(user);
        });
      })
      .catch(error => console.error("Error setting auth persistence:", error));
  } catch (error) {
    console.error("Error loading Firebase config:", error);
  }
});

// -------------------- Global Authentication Functions --------------------

// Update the global authentication controls (assumes an element with ID "auth-controls" in header.html)
function updateGlobalAuthControls(user) {
  const authControls = document.getElementById("auth-controls");
  if (!authControls) return; // if the element doesn't exist, skip updating

  if (user) {
    // If the user is signed in, display a welcome message and a logout button.
    authControls.innerHTML = `
      <span>Welcome, ${user.email}</span>
      <button id="logout-btn">Log Out</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", () => {
      firebase.auth().signOut().catch(error => console.error("Error signing out:", error));
    });
  } else {
    // If no user is signed in, display a login button.
    authControls.innerHTML = `<button id="login-btn">Log In</button>`;
    document.getElementById("login-btn").addEventListener("click", () => {
      // For example, redirect to customer.html where your login UI exists
      window.location.href = "customer.html";
    });
  }
}

// Expose the update function globally in case you need to call it elsewhere
window.updateGlobalAuthControls = updateGlobalAuthControls;

// -------------------- Authentication Functions --------------------

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
  const name = document.getElementById("name")?.value;
  const email = document.getElementById("signup-email")?.value;
  const phone = document.getElementById("phone")?.value;
  const password = document.getElementById("signup-password")?.value;
  
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      return firebase.firestore().collection("customers").doc(email).set({
        name,
        email,
        phone,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(() => {
      alert("Account created! You can now log in.");
      window.showLogin();
    })
    .catch(error => alert("Error: " + error.message));
};

window.login = function(event) {
  event.preventDefault();
  const email = document.getElementById("login-email")?.value;
  const password = document.getElementById("login-password")?.value;
  
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      alert("Login successful!");
      // Optionally load dashboard if defined
      if (typeof window.loadDashboard === "function") {
        window.loadDashboard(userCredential.user);
      }
    })
    .catch(error => alert("Error: " + error.message));
};

window.logout = function() {
  firebase.auth().signOut().then(() => {
    if (typeof window.showLogin === "function") {
      window.showLogin();
    }
  }).catch(error => console.error("Error signing out:", error));
};

// -------------------- Favorites Functions --------------------

function loadFavorites() {
  const user = firebase.auth().currentUser;
  const favoritesList = document.getElementById("favorites-list");
  if (!user || !favoritesList) return;
  firebase.firestore().collection("customers").doc(user.email)
    .collection("favorites")
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
window.loadFavorites = loadFavorites;

window.addFavorite = function(item) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("You must be logged in to add favorites.");
    return;
  }
  const customerDoc = firebase.firestore().collection("customers").doc(user.email);
  const favoritesRef = customerDoc.collection("favorites");
  // Check if the favorite already exists (by name)
  favoritesRef.where("name", "==", item.name).get().then(snapshot => {
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

// -------------------- Cart Functions --------------------

window.addToCart = function(item) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.push(item);
  localStorage.setItem("cart", JSON.stringify(cart));
  alert(`${item.name}${item.infused ? " (Infused)" : ""} added to cart!`);
};

window.getCart = function() {
  return JSON.parse(localStorage.getItem("cart")) || [];
};

window.clearCart = function() {
  localStorage.removeItem("cart");
};