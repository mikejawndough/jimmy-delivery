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
const { DateTime } = require('luxon');  // For time zone handling

// 2. Initialize Express App and HTTP Server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Debugging Environment Variables
console.log('FIREBASE_SERVICE_ACCOUNT from env:', process.env.FIREBASE_SERVICE_ACCOUNT);
console.log("DEBUG: Does .env exist?", fs.existsSync('./.env'));
console.log("DEBUG: SENDGRID_API_KEY Loaded:", process.env.SENDGRID_API_KEY ? "Yes" : "No");

// 3. Load Firebase Service Account from Environment Variable
let firebaseAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!firebaseAccountRaw) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT is missing!");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(firebaseAccountRaw);
  // Replace escaped newline characters with actual newlines if present
  if (serviceAccount.private_key.includes("\\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
} catch (error) {
  console.error("❌ Error parsing FIREBASE_SERVICE_ACCOUNT:", error);
  process.exit(1);
}

// 4. Initialize Firebase
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
console.log("✅ Firebase Initialized Successfully!");

// 5. Initialize SendGrid
const sendGridApiKey = process.env.SENDGRID_API_KEY;
if (!sendGridApiKey) {
  console.error("❌ SENDGRID_API_KEY is missing!");
  process.exit(1);
}
sgMail.setApiKey(sendGridApiKey);

// 6. Firebase Config Endpoint – Returns Firebase Config as JSON
app.get('/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  });
});

// 7. Middleware
app.use(express.json());
app.use(cors());

// 8. Serve Static Files from the 'public' Directory
const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) {
  console.error("❌ ERROR: Public directory not found:", publicPath);
  process.exit(1);
}
console.log("✅ Serving static files from:", publicPath);
app.use(express.static(publicPath));

// 9. Global Ordering Toggle (Magic Switch)
// When true, orders are accepted; when false, they are rejected.
let isOrderingEnabled = true;

// 10. Routes to Serve HTML Files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/order', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'order.html'));
});
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});
app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 11. Admin Toggle Endpoint – Turn Ordering On/Off
app.post('/admin/toggle-ordering', (req, res) => {
  const { enabled } = req.body; // expects a boolean value
  isOrderingEnabled = enabled;
  res.json({ message: `Ordering is now ${enabled ? 'ENABLED' : 'DISABLED'}.` });
});

// 12. Order Placement Endpoint – Only Accept Orders When Allowed
app.post('/order', async (req, res) => {
  // Check if ordering is enabled
  if (!isOrderingEnabled) {
    return res.status(403).json({ error: 'Ordering is currently disabled by admin.' });
  }
  
  // Use Luxon to get the current time in Eastern Time (EST/EDT)
  const now = DateTime.now().setZone('America/New_York');
  // Store hours: from 6pm (18) to 2am (2); allow orders if current hour is >= 18 OR < 2.
  if (!(now.hour >= 18 || now.hour < 2)) {
    return res.status(403).json({ error: 'Store is currently closed. Orders are accepted from 6pm to 2am EST.' });
  }
  
  // Validate order details from the request body
  const { items, customerName, customerEmail, phoneNumber, address } = req.body;
  if (!items || !customerName || !customerEmail || !phoneNumber || !address) {
    console.error("❌ Error: Missing required fields.");
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  
  // Create a new order object, adding a delivery fee of $5.99
  const newOrder = {
    customerName,
    customerEmail,
    phoneNumber,
    address,
    items,
    total: items.reduce((sum, item) => sum + item.price, 5.99),
    status: 'Order Received',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  try {
    const orderRef = await db.collection('orders').add(newOrder);
    const userOrdersRef = db.collection('customers').doc(customerEmail);
    await userOrdersRef.set({ email: customerEmail }, { merge: true });
    await userOrdersRef.collection('orderHistory').doc(orderRef.id).set(newOrder);
    
    console.log(`✅ Order placed with ID: ${orderRef.id}`);
    
    // Send notification email via SendGrid
    const msg = {
      to: "ashleysajous@elitebarbershopny.com",
      from: "no-reply@jimmyspizza.com",
      subject: "New Order Received",
      text: `New order from ${customerName} (${customerEmail}). Address: ${address}. Items: ${items.map(item => item.name).join(', ')}`,
    };
    try {
      await sgMail.send(msg);
      console.log("✅ Order notification email sent successfully");
    } catch (emailError) {
      console.error("❌ SendGrid Error:", emailError.response ? emailError.response.body : emailError);
    }
    
    res.json({ orderId: orderRef.id, status: newOrder.status });
  } catch (error) {
    console.error("❌ Error placing order:", error.response ? error.response.body : error);
    res.status(500).json({ error: "Failed to place order." });
  }
});

// 13. Retrieve All Orders for Admin
app.get('/orders', async (req, res) => {
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ orders });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders.", details: error.message });
  }
});

// 14. Retrieve Customer Orders
app.get('/orders/customer', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: "Email query parameter is required." });
  }
  try {
    const snapshot = await db.collection('customers').doc(email)
      .collection('orderHistory').orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ orders });
  } catch (error) {
    console.error("❌ Error fetching customer orders:", error);
    res.status(500).json({ error: "Failed to fetch orders.", details: error.message });
  }
});

// 15. Update Order Status
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
    
    // Send email notification on status update
    const msg = {
      to: orderData.customerEmail,
      from: "no-reply@jimmyspizza.com",
      subject: "Your Order Status Has Changed!",
      text: `Your order is now: ${status}`,
    };
    try {
      await sgMail.send(msg);
      console.log(`✅ Email sent to ${orderData.customerEmail} about status update.`);
    } catch (emailError) {
      console.error("❌ SendGrid Error:", emailError.response ? emailError.response.body : emailError);
    }
    
    // Emit a Socket.IO event to update real-time tracking
    io.emit('orderStatusUpdated', { orderId, status, customerEmail: orderData.customerEmail });
    
    res.json({ orderId, status });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// 16. Socket.IO Setup for Real-Time Order Updates
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`❌ Client disconnected: ${socket.id}`));
});

// 17. Start the Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Server running on port ${PORT}`);
});