// server.js

// 1. Load Environment Variables and Required Modules
require('dotenv').config(); // Loads variables from .env into process.env
const fs = require('fs');
console.log("DEBUG: Does .env exist?", fs.existsSync('./.env'));
console.log("DEBUG: FIREBASE_SERVICE_ACCOUNT (raw):", process.env.FIREBASE_SERVICE_ACCOUNT);

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// 2. Load Firebase Service Account from Environment Variable
let firebaseAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!firebaseAccountRaw) {
  console.error("FIREBASE_SERVICE_ACCOUNT environment variable not set.");
  process.exit(1);
}

let serviceAccount;
try {
  // Parse the raw JSON from the environment variable
  serviceAccount = JSON.parse(firebaseAccountRaw);

  // Manually convert every '\\n' in the private key to actual newlines
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
} catch (err) {
  console.error("Error parsing FIREBASE_SERVICE_ACCOUNT:", err);
  process.exit(1);
}

// 3. Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// 4. Set SendGrid API Key from Environment Variables
const sendGridApiKey = process.env.SENDGRID_API_KEY;
if (!sendGridApiKey) {
  console.error("SENDGRID_API_KEY environment variable not set.");
  process.exit(1);
}
sgMail.setApiKey(sendGridApiKey);

// 5. Create Express App, HTTP Server, and Initialize Socket.io
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// 6. Apply Middleware
app.use(express.json());
app.use(cors());

// 7. Static Data for Menu (Example)
const menu = [
  { id: 1, name: 'Burger', price: 5.99 },
  { id: 2, name: 'Pizza', price: 8.99 },
  { id: 3, name: 'Fries', price: 2.99 },
];

// 8. Endpoints

// GET /menu - Return static menu data
app.get('/menu', (req, res) => {
  res.json({ menu });
});

// POST /order - Create a new order and send a notification email
app.post('/order', async (req, res) => {
  const { items, customerName, address, customerEmail, phoneNumber } = req.body;
  if (!items || !customerName || !address || !customerEmail) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // Use a default location (e.g., restaurant location)
  const defaultLocation = { lat: 40.7128, lng: -74.0060 };

  const newOrder = {
    items,
    customerName,
    address,
    customerEmail,
    phoneNumber, // Optional
    status: 'Order Received',
    location: defaultLocation,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const orderRef = await db.collection('orders').add(newOrder);
    console.log(`Order placed with ID: ${orderRef.id}`);

    const msg = {
      to: "orders@jimmysmenu.com", // Replace with your email
      from: "no-reply@jimmyspizza.com", // Must be a verified sender in SendGrid
      subject: "New Order Received at Jimmy's Pizza",
      text: `A new order has been placed by ${customerName} (${customerEmail}).\n\nAddress: ${address}\nItems: ${items.join(', ')}\n\nPlease check the admin dashboard for more details.`,
      html: `<p>A new order has been placed by <strong>${customerName}</strong> (${customerEmail}).</p>
             <p><strong>Address:</strong> ${address}</p>
             <p><strong>Items:</strong> ${items.join(', ')}</p>
             <p>Please check the admin dashboard for more details.</p>`,
    };

    sgMail
      .send(msg)
      .then(() => console.log("Notification email sent"))
      .catch((error) => console.error("Error sending notification email:", error));

    res.json({ orderId: orderRef.id, status: newOrder.status });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Could not place order." });
  }
});

// GET /order/:id - Retrieve a single order by its ID
app.get('/order/:id', async (req, res) => {
  const orderId = req.params.id;
  try {
    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Could not fetch order." });
  }
});

// GET /orders - Retrieve all orders (for admin dashboard)
app.get('/orders', async (req, res) => {
  try {
    const snapshot = await db.collection('orders').get();
    const orders = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    console.log(`Fetched ${orders.length} orders`);
    res.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// GET /orders/customer - Retrieve orders for a specific customer by email
app.get('/orders/customer', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: "Email query parameter is required." });
  }
  try {
    const snapshot = await db.collection('orders').where('customerEmail', '==', email).get();
    const orders = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.json({ orders });
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// PATCH /order/:id/status - Update the status of an order
app.patch('/order/:id/status', async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const doc = await orderRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    await orderRef.update({ status });
    res.json({ orderId, status });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// Socket.io Setup for Real-Time Updates (Optional)
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Optional Global Update Loop for Simulated Updates
setInterval(async () => {
  try {
    const snapshot = await db.collection('orders').get();
    snapshot.forEach(async (doc) => {
      const order = doc.data();
      if (!order.location || order.location.lat === undefined || order.location.lng === undefined) {
        console.warn(`Order ${doc.id} is missing a valid location. Skipping update.`);
        return;
      }
      const newLocation = {
        lat: order.location.lat + (Math.random() - 0.5) * 0.001,
        lng: order.location.lng + (Math.random() - 0.5) * 0.001
      };
      const updatedOrder = {
        ...order,
        status: 'Order Out For Delivery',
        location: newLocation
      };
      try {
        await db.collection('orders').doc(doc.id).update(updatedOrder);
        io.emit('orderUpdate', { id: doc.id, ...updatedOrder });
        console.log(`Updated order ${doc.id}: ${updatedOrder.status}`);
      } catch (updateError) {
        console.error(`Error updating order ${doc.id}:`, updateError);
      }
    });
  } catch (error) {
    console.error("Error updating orders:", error);
  }
}, 5000);

// Start the Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Kitchen is open on port ${PORT}`);
});

