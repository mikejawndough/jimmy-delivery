// public/js/app.js

// Show login view (hide signup)
window.showLogin = function() {
  var signupSection = document.getElementById("signup-section");
  var loginSection = document.getElementById("login-section");
  if (signupSection) signupSection.classList.add("hidden");
  if (loginSection) loginSection.classList.remove("hidden");
};

// Show signup view (hide login)
window.showSignup = function() {
  var loginSection = document.getElementById("login-section");
  var signupSection = document.getElementById("signup-section");
  if (loginSection) loginSection.classList.add("hidden");
  if (signupSection) signupSection.classList.remove("hidden");
};

// Signup function: creates a new user and writes customer data to Firestore
window.signup = function(event) {
  event.preventDefault();
  var name = document.getElementById("name").value;
  var email = document.getElementById("signup-email").value;
  var phone = document.getElementById("phone").value;
  var password = document.getElementById("signup-password").value;
  
  auth.createUserWithEmailAndPassword(email, password)
    .then(function(userCredential) {
      return db.collection("customers").doc(email).set({
        name: name,
        email: email,
        phone: phone,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(function() {
      alert("Account created! You can now log in.");
      showLogin();
    })
    .catch(function(error) {
      alert("Error: " + error.message);
    });
};

// Login function: signs in user
window.login = function(event) {
  event.preventDefault();
  var email = document.getElementById("login-email").value;
  var password = document.getElementById("login-password").value;
  
  auth.signInWithEmailAndPassword(email, password)
    .then(function(userCredential) {
      alert("Login successful!");
      loadDashboard(userCredential.user);
    })
    .catch(function(error) {
      alert("Error: " + error.message);
    });
};

// Logout function: signs out user
window.logout = function() {
  auth.signOut().then(function() {
    var dashboardSection = document.getElementById("dashboard-section");
    if (dashboardSection) dashboardSection.classList.add("hidden");
    showLogin();
  });
};

// Load dashboard for logged-in user
window.loadDashboard = function(user) {
  document.getElementById("login-section")?.classList.add("hidden");
  document.getElementById("signup-section")?.classList.add("hidden");
  document.getElementById("dashboard-section")?.classList.remove("hidden");

  var userInfo = document.getElementById("user-info");
  if (userInfo) userInfo.textContent = "Logged in as " + user.email;

  db.collection("customers").doc(user.email).collection("orderHistory")
    .orderBy("createdAt", "desc")
    .onSnapshot(function(snapshot) {
      var orderList = document.getElementById("order-list");
      if (orderList) {
        orderList.innerHTML = "";
        snapshot.forEach(function(doc) {
          var order = doc.data();
          var li = document.createElement("li");
          li.textContent = "Order #" + doc.id + ": " + order.items.map(function(i) { return i.name; }).join(", ") + " - " + order.status;
          orderList.appendChild(li);
        });
      }
    }, function(error) {
      console.error("Error loading order history:", error);
    });
    
  loadFavorites();
};

// Load favorites for current user
function loadFavorites() {
  var user = auth.currentUser;
  if (!user) return;
  var favoritesList = document.getElementById("favorites-list");
  if (!favoritesList) return;
  db.collection("customers").doc(user.email).collection("favorites")
    .orderBy("addedAt", "desc")
    .onSnapshot(function(snapshot) {
      favoritesList.innerHTML = "";
      snapshot.forEach(function(doc) {
        var fav = doc.data();
        var li = document.createElement("li");
        li.textContent = fav.name + " - $" + fav.price.toFixed(2) + (fav.infused ? " (Infused)" : "");
        favoritesList.appendChild(li);
      });
    }, function(error) {
      console.error("Error loading favorites:", error);
    });
}
window.loadFavorites = loadFavorites;

// Add a favorite item to Firestore
window.addFavorite = function(item) {
  var user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to add favorites.");
    return;
  }
  var customerDoc = db.collection("customers").doc(user.email);
  var favoritesRef = customerDoc.collection("favorites");
  favoritesRef.where("name", "==", item.name).get()
    .then(function(snapshot) {
      if (!snapshot.empty) {
        alert(item.name + " is already in your favorites.");
        return;
      }
      return favoritesRef.add({
        name: item.name,
        price: item.price,
        infused: item.infused,
        addedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(function() {
      alert(item.name + " added to favorites!");
    })
    .catch(function(error) {
      console.error("Error adding favorite:", error);
      alert("Error adding favorite: " + error.message);
    });
};