require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const publicPath = path.join(__dirname, 'public');

// Firebase setup
let firebaseAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!firebaseAccountRaw) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT is missing!");
  process.exit(1);
}
let serviceAccount = JSON.parse(firebaseAccountRaw);
if (serviceAccount.private_key.includes("\\n")) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

if (!process.env.SENDGRID_API_KEY) {
  console.error("❌ SENDGRID_API_KEY is missing!");
  process.exit(1);
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// ADMIN AUTH ROUTES
app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.cookie('admin', 'true', { httpOnly: true, sameSite: 'Strict' });
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/admin-logout', (req, res) => {
  res.clearCookie('admin');
  res.status(200).json({ success: true });
});

app.use('/admin.html', (req, res, next) => {
  if (req.cookies.admin === 'true') {
    return next();
  } else {
    return res.redirect('/admin-login.html');
  }
});

// API route to send Google Maps key if needed
app.get('/api/google-key', (req, res) => {
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: "Google API key not configured" });
  }
  res.json({ googleApiKey: process.env.GOOGLE_API_KEY });
});

// Order toggle settings from Firestore
let isOrderingEnabled = true;
async function loadOrderingStatus() {
  try {
    const docRef = db.collection('adminSettings').doc('ordering');
    const doc = await docRef.get();
    if (doc.exists && typeof doc.data().isOrderingEnabled !== 'undefined') {
      isOrderingEnabled = doc.data().isOrderingEnabled;
    } else {
      await docRef.set({ isOrderingEnabled });
    }
  } catch (error) {
    console.error("Error loading ordering status:", error);
  }
}
loadOrderingStatus();

// Order endpoints
app.post('/order', async (req, res) => {
  if (!isOrderingEnabled) {
    return res.status(403).json({ error: 'Ordering is currently disabled by admin.' });
  }
  const { items, customerName, customerEmail, phoneNumber, address, coords, deliveryDatetime, recurring, frequency, recurringStart, recurringEnd } = req.body;
  if (!items || !customerName || !customerEmail || !phoneNumber || !address) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const newOrder = {
    customerName,
    customerEmail,
    phoneNumber,
    address,
    coords: coords || null,
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
    res.json({ orderId: orderRef.id, status: newOrder.status });
  } catch (error) {
    res.status(500).json({ error: "Failed to place order." });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

app.get('/orders/customer', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Email query parameter is required." });
  try {
    const snapshot = await db.collection('customers').doc(email).collection('orderHistory').orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

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
    await db.collection('customers').doc(orderData.customerEmail).collection('orderHistory').doc(orderId).update({ status });
    const msg = {
      to: orderData.customerEmail,
      from: "no-reply@jimmyspizza.com",
      subject: "Your Order Status Has Changed!",
      text: `Your order is now: ${status}`
    };
    await sgMail.send(msg);
    res.json({ orderId, status });
  } catch (error) {
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// Admin toggle routes
app.get('/admin/order-status', async (req, res) => {
  try {
    const docRef = db.collection('adminSettings').doc('ordering');
    const doc = await docRef.get();
    const enabled = doc.exists ? Boolean(doc.data().isOrderingEnabled) : isOrderingEnabled;
    res.json({ enabled });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ordering status." });
  }
});

app.post('/admin/toggle-ordering', async (req, res) => {
  const { enabled } = req.body;
  isOrderingEnabled = enabled;
  try {
    await db.collection('adminSettings').doc('ordering').set({ isOrderingEnabled: enabled });
    res.json({ message: `Ordering is now ${enabled ? 'ENABLED' : 'DISABLED'}.` });
  } catch (error) {
    res.status(500).json({ error: "Failed to update ordering status." });
  }
});

// Socket.io (optional)
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
});

// Serve static
app.use(express.static(publicPath));

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Server running on port ${PORT}`);
});