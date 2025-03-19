// public/js/customer.js

document.addEventListener("DOMContentLoaded", () => {
  if (window.auth) {
    auth.onAuthStateChanged(user => {
      if (user) {
        loadDashboard(user);
      } else {
        showLogin();
      }
    });
  }
});

window.loadDashboard = function(user) {
  document.getElementById("login-section")?.classList.add("hidden");
  document.getElementById("signup-section")?.classList.add("hidden");
  document.getElementById("dashboard-section")?.classList.remove("hidden");

  const userInfo = document.getElementById("user-info");
  if (userInfo) userInfo.textContent = `Logged in as ${user.email}`;

  db.collection("customers").doc(user.email).collection("orderHistory")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      const orderList = document.getElementById("order-list");
      if (orderList) {
        orderList.innerHTML = "";
        snapshot.forEach(doc => {
          const order = doc.data();
          const li = document.createElement("li");
          li.textContent = `Order #${doc.id}: ${order.items.map(i => i.name).join(", ")} - ${order.status}`;
          orderList.appendChild(li);
        });
      }
    }, error => console.error("Error loading order history:", error));

  loadFavorites();
};

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
window.loadFavorites = loadFavorites;

window.addFavorite = function(item) {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to add favorites.");
    return;
  }
  const customerDoc = db.collection("customers").doc(user.email);
  const favoritesRef = customerDoc.collection("favorites");
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