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

// Initialize Express App Before Middleware
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Debugging
console.log("DEBUG: Does .env exist?", fs.existsSync('./.env'));
console.log("DEBUG: SENDGRID_API_KEY Loaded:", process.env.SENDGRID_API_KEY ? "Yes" : "No");
console.log("DEBUG: FIREBASE_SERVICE_ACCOUNT Loaded:", process.env.FIREBASE_SERVICE_ACCOUNT ? "Yes" : "No");

// 2. Load Firebase Service Account from Environment Variable
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

// 3. Initialize Firebase
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
console.log("✅ Firebase Initialized Successfully!");

// 4. Initialize SendGrid
const sendGridApiKey = process.env.SENDGRID_API_KEY;
if (!sendGridApiKey) {
  console.error("❌ SENDGRID_API_KEY is missing!");
  process.exit(1);
}
sgMail.setApiKey(sendGridApiKey);

// 5. Middleware
app.use(express.json());
app.use(cors());

// 6. Serve Static Files from the 'public' Directory
const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) {
  console.error("❌ ERROR: Public directory not found:", publicPath);
  process.exit(1);
}
console.log("✅ Serving static files from:", publicPath);
app.use(express.static(publicPath));

// 7. Serve index.html for Root Requests
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).send(err);
    }
  });
});

// 8. Order Placement Endpoint
app.post('/order', async (req, res) => {
  const { items, customerName, customerEmail, phoneNumber, address } = req.body;
  
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
  };

  try {
    const orderRef = await db.collection('orders').add(newOrder);
    const userOrdersRef = db.collection('customers').doc(customerEmail);
    await userOrdersRef.set({ email: customerEmail }, { merge: true });
    await userOrdersRef.collection('orderHistory').doc(orderRef.id).set(newOrder);

    console.log(`✅ Order placed with ID: ${orderRef.id}`);

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

// 9. Retrieve All Orders for Admin
app.get('/orders', async (req, res) => {
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ orders });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// 10. Retrieve Customer Orders
app.get('/orders/customer', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: "Email query parameter is required." });
  }
  try {
    const snapshot = await db.collection('customers').doc(email).collection('orderHistory').orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ orders });
  } catch (error) {
    console.error("❌ Error fetching customer orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// 11. Update Order Status
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
      text: `Your order is now: ${status}`,
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

// 12. Socket.io Setup for Real-Time Order Updates
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`❌ Client disconnected: ${socket.id}`));
});

// 13. Start the Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Server running on port ${PORT}`);
});