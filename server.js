// server.js

// 1. Load Environment Variables and Required Modules
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');

// 2. Define publicPath (static files folder)
const publicPath = path.join(__dirname, 'public');

// 3. Initialize Express App and HTTP Server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// 4. Debug Environment Variables
console.log('FIREBASE_SERVICE_ACCOUNT:', process.env.FIREBASE_SERVICE_ACCOUNT ? "FOUND" : "NOT FOUND");
console.log("DEBUG: Does .env exist?", fs.existsSync('./.env'));
console.log("DEBUG: SENDGRID_API_KEY Loaded:", process.env.SENDGRID_API_KEY ? "Yes" : "No");

// 5. Load Firebase Service Account from Environment Variables
let firebaseAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!firebaseAccountRaw) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT is missing!");
  process.exit(1);
}
let serviceAccount;
try {
  serviceAccount = JSON.parse(firebaseAccountRaw);
  if (serviceAccount.private_key.includes("\\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
} catch (error) {
  console.error("❌ Error parsing FIREBASE_SERVICE_ACCOUNT:", error);
  process.exit(1);
}

// 6. Initialize Firebase Admin
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
console.log("✅ Firebase Admin Initialized Successfully!");

// 7. Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.error("❌ SENDGRID_API_KEY is missing!");
  process.exit(1);
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 8. Global Ordering Toggle with Firestore Persistence
let isOrderingEnabled = true; // default value
async function loadOrderingStatus() {
  try {
    const docRef = db.collection('adminSettings').doc('ordering');
    const doc = await docRef.get();
    if (doc.exists && typeof doc.data().isOrderingEnabled !== 'undefined') {
      isOrderingEnabled = doc.data().isOrderingEnabled;
      console.log("Loaded ordering status from Firestore:", isOrderingEnabled);
    } else {
      await docRef.set({ isOrderingEnabled });
      console.log("Created ordering status document with default value:", isOrderingEnabled);
    }
  } catch (error) {
    console.error("Error loading ordering status from Firestore:", error);
  }
}
loadOrderingStatus();

// 9. Middleware
app.use(express.json());
app.use(cors());

// 10. API Endpoint to Serve Google API Key (must be before static file serving)
app.get('/api/google-key', (req, res) => {
  const key = process.env.GOOGLE_API_KEY;
  console.log("Google API Key sent to frontend:", key); // Debug
  if (!key) {
    return res.status(500).json({ error: "Google API key not configured" });
  }
  res.json({ googleApiKey: key });
});

// 11. Order Placement Endpoint – Manual Admin Toggle
app.post('/order', async (req, res) => {
  if (!isOrderingEnabled) {
    return res.status(403).json({ error: 'Ordering is currently disabled by admin.' });
  }
  const {
    items,
    customerName,
    customerEmail,
    phoneNumber,
    address,
    deliveryDatetime,
    recurring,
    frequency,
    recurringStart,
    recurringEnd
  } = req.body;
  if (!items || !customerName || !customerEmail || !phoneNumber || !address) {
    console.error("❌ Error: Missing required fields.");
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const newOrder = {
    customerName,
    customerEmail,
    phoneNumber,
    address,
    items,
    total: items.reduce((sum, item) => sum + item.price, 5.99),
    status: 'Order Received',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    deliveryDatetime: deliveryDatetime || null,
    recurring: recurring || "no",
    frequency: frequency || null,
    recurringStart: recurringStart || null,
    recurringEnd: recurringEnd || null
  };
  try {
    const orderRef = await db.collection('orders').add(newOrder);
    const userOrdersRef = db.collection('customers').doc(customerEmail);
    await userOrdersRef.set({ email: customerEmail }, { merge: true });
    await userOrdersRef.collection('orderHistory').doc(orderRef.id).set(newOrder);
    console.log(`✅ Order placed with ID: ${orderRef.id}`);
    res.json({ orderId: orderRef.id, status: newOrder.status });
  } catch (error) {
    console.error("❌ Error placing order:", error.response ? error.response.body : error);
    res.status(500).json({ error: "Failed to place order." });
  }
});

// 12. Orders Endpoints (for admin or customer view)
app.get('/orders', async (req, res) => {
  try {
    let snapshot;
    try {
      snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    } catch (err) {
      console.error("Error ordering by createdAt, falling back:", err);
      snapshot = await db.collection('orders').get();
    }
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ orders });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

app.get('/orders/customer', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: "Email query parameter is required." });
  }
  try {
    const snapshot = await db.collection('customers').doc(email)
      .collection('orderHistory')
      .orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ orders });
  } catch (error) {
    console.error("❌ Error fetching customer orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// 13. Patch endpoint to update order status
app.patch('/order/:id/status', async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required.' });
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return res.status(404).json({ error: 'Order not found.' });
    const orderData = orderSnap.data();
    await orderRef.update({ status });
    await db.collection('customers').doc(orderData.customerEmail)
      .collection('orderHistory').doc(orderId).update({ status });
    const msg = {
      to: orderData.customerEmail,
      from: "no-reply@jimmyspizza.com",
      subject: "Your Order Status Has Changed!",
      text: `Your order is now: ${status}`
    };
    try {
      await sgMail.send(msg);
      console.log(`✅ Email sent to ${orderData.customerEmail} about status update.`);
    } catch (emailError) {
      console.error("❌ SendGrid Error:", emailError.response ? emailError.response.body : emailError);
    }
    res.json({ orderId, status });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// 14. Admin Ordering Status Endpoints
app.get('/admin/order-status', async (req, res) => {
  try {
    const docRef = db.collection('adminSettings').doc('ordering');
    const doc = await docRef.get();
    if (doc.exists) {
      let enabled = Boolean(doc.data().isOrderingEnabled);
      res.json({ enabled });
    } else {
      console.warn("Ordering document does not exist; using in-memory value.");
      res.json({ enabled: isOrderingEnabled });
    }
  } catch (error) {
    console.error("Error fetching ordering status:", error);
    res.status(500).json({ error: "Failed to fetch ordering status." });
  }
});

app.post('/admin/toggle-ordering', async (req, res) => {
  const { enabled } = req.body;
  isOrderingEnabled = enabled;
  try {
    await db.collection('adminSettings').doc('ordering').set({ isOrderingEnabled: enabled });
    console.log("Ordering status updated to:", enabled);
    res.json({ message: `Ordering is now ${enabled ? 'ENABLED' : 'DISABLED'}.` });
  } catch (error) {
    console.error("Error updating ordering status in Firestore:", error);
    res.status(500).json({ error: "Failed to update ordering status." });
  }
});

// 15. Socket.io for real-time order updates (if needed)
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`❌ Client disconnected: ${socket.id}`));
});

// 16. Serve static files from the public directory
console.log("✅ Serving static files from:", publicPath);
app.use(express.static(publicPath, {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// 17. Start the Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Server running on port ${PORT}`);
});