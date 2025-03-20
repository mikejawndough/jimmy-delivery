// server.js

// 1. Load Environment Variables and Required Modules
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');

// 2. Define publicPath so it's available everywhere
const publicPath = path.join(__dirname, 'public');

// 3. Initialize Express App and HTTP Server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// 4. Debug Environment Variables
console.log('FIREBASE_SERVICE_ACCOUNT:', process.env.FIREBASE_SERVICE_ACCOUNT ? "Loaded" : "Not set");
console.log("DEBUG: Does .env exist?", fs.existsSync('./.env'));
console.log("DEBUG: SENDGRID_API_KEY Loaded:", process.env.SENDGRID_API_KEY ? "Yes" : "No");

// 5. Load Firebase Service Account from Environment Variable
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
  // Optionally log part of the key (avoid printing full key in production)
  console.log("Service Account parsed successfully for project:", serviceAccount.project_id);
} catch (error) {
  console.error("❌ Error parsing FIREBASE_SERVICE_ACCOUNT:", error);
  process.exit(1);
}

// 6. Initialize Firebase Admin SDK
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
console.log("✅ Firebase Admin Initialized Successfully!");

// 7. Initialize SendGrid
const sendGridApiKey = process.env.SENDGRID_API_KEY;
if (!sendGridApiKey) {
  console.error("❌ SENDGRID_API_KEY is missing!");
  process.exit(1);
}
sgMail.setApiKey(sendGridApiKey);

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

// 10. API Routes (Defined BEFORE static file serving)

// GET endpoint: fetch current ordering status
app.get('/admin/order-status', async (req, res) => {
  try {
    const docRef = db.collection('adminSettings').doc('ordering');
    const doc = await docRef.get();
    if (doc.exists) {
      let enabled = doc.data().isOrderingEnabled;
      enabled = Boolean(enabled);
      console.log("GET /admin/order-status: Returning", enabled);
      res.json({ enabled });
    } else {
      console.warn("Ordering document does not exist; returning in-memory value.");
      res.json({ enabled: isOrderingEnabled });
    }
  } catch (error) {
    console.error("Error fetching ordering status:", error);
    res.status(500).json({ error: "Failed to fetch ordering status." });
  }
});

// POST endpoint: update ordering status
app.post('/admin/toggle-ordering', async (req, res) => {
  const { enabled } = req.body; // expects boolean
  isOrderingEnabled = enabled;
  try {
    await db.collection('adminSettings').doc('ordering').set({ isOrderingEnabled: enabled });
    console.log("POST /admin/toggle-ordering: Updated status to", enabled);
    res.json({ message: `Ordering is now ${enabled ? 'ENABLED' : 'DISABLED'}.` });
  } catch (error) {
    console.error("Error updating ordering status in Firestore:", error);
    res.status(500).json({ error: "Failed to update ordering status." });
  }
});

// Order Placement Endpoint – only allow if ordering is enabled
app.post('/order', async (req, res) => {
  if (!isOrderingEnabled) {
    return res.status(403).json({ error: 'Ordering is currently disabled by admin.' });
  }
  const { items, customerName, customerEmail, phoneNumber, address, deliveryDatetime, recurring, frequency, recurringStart, recurringEnd } = req.body;
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
    console.error("Error placing order:", error.response ? error.response.body : error);
    res.status(500).json({ error: "Failed to place order." });
  }
});

// GET endpoint: retrieve all orders for admin
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
    console.log("GET /orders: Fetched", orders.length, "orders");
    res.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// GET endpoint: retrieve customer orders by email
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
    console.error("Error fetching customer orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// PATCH endpoint: update order status
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
      console.error("SendGrid Error:", emailError.response ? emailError.response.body : emailError);
    }
    res.json({ orderId, status });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// Socket.io for real-time order updates
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`❌ Client disconnected: ${socket.id}`));
});

// 11. Serve Static Files from the 'public' Directory (after API routes)
console.log("✅ Serving static files from:", publicPath);
app.use(express.static(publicPath, {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// 12. Start the Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Server running on port ${PORT}`);
});