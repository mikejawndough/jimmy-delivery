const express = require('express');
const app = express();
const path = require('path');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
const Vonage = require('@vonage/server-sdk');
require('dotenv').config();

// === Firebase Admin Initialization ===
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// === Middleware ===
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// === Logging ===
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// === Get all orders ===
app.get('/orders', async (req, res) => {
  try {
    console.log('Fetching orders...');
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// === Get full driver list ===
app.get('/drivers-full', async (req, res) => {
  try {
    const snapshot = await db.collection('drivers').get();
    const drivers = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        email: doc.id,
        name: data.name || doc.id,
        isActive: data.isActive || false
      };
    });
    res.status(200).json({ drivers });
  } catch (error) {
    console.error("Error fetching full driver list:", error.message);
    res.status(500).json({ error: "Failed to fetch driver data" });
  }
});

// === Update driver active status ===
app.patch('/driver-active', async (req, res) => {
  const { email, isActive } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    await db.collection("drivers").doc(email).update({ isActive });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to update driver:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

// === Create driver account ===
app.post('/create-driver', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required." });

  try {
    const userRecord = await admin.auth().createUser({ email, password });
    await db.collection('drivers').doc(email).set({
      email,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(200).json({ message: "Driver created", uid: userRecord.uid });
  } catch (error) {
    console.error("Error creating driver:", error);
    res.status(500).json({ error: error.message });
  }
});

// === Update order status ===
app.patch('/order/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status, assignedTo } = req.body;
  try {
    await db.collection('orders').doc(orderId).update({ status, assignedTo });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// === Create Order, Auto-Assign Driver, Send SMS & Email ===
app.post('/order', async (req, res) => {
  try {
    const newOrder = req.body;

    const activeDriverSnapshot = await db.collection('drivers').where('isActive', '==', true).get();
    const activeDrivers = activeDriverSnapshot.docs.map(doc => doc.id);

    const snapshot = await db.collection('orders').where('status', '!=', 'Completed').get();
    const driverLoad = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.assignedTo) {
        if (!driverLoad[data.assignedTo]) driverLoad[data.assignedTo] = [];
        driverLoad[data.assignedTo].push(data);
      }
    });

    const driverEmails = activeDrivers.filter(email => Object.keys(driverLoad).includes(email));

    let assignedDriver = null;
    let etaText = 'N/A';

    if (driverEmails.length > 0) {
      let shortestETA = Infinity;
      for (const driverEmail of driverEmails) {
        const lastOrder = driverLoad[driverEmail].slice(-1)[0];
        const lastCoords = lastOrder?.coords || { lat: 40.9115, lng: -73.7824 };

        const to = `${newOrder.coords.lng},${newOrder.coords.lat}`;
        const from = `${lastCoords.lng},${lastCoords.lat}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?access_token=${process.env.MAPBOX_ACCESS_TOKEN}&overview=false`;

        const response = await axios.get(url);
        const durationSec = response.data.routes?.[0]?.duration || Infinity;

        if (durationSec < shortestETA) {
          shortestETA = durationSec;
          assignedDriver = driverEmail;
        }
      }

      const etaMin = Math.round(shortestETA / 60);
      etaText = `${etaMin} mins`;
    } else {
      const fallbackSnapshot = await db.collection('drivers').where('isActive', '==', true).get();
      const randomIndex = Math.floor(Math.random() * fallbackSnapshot.docs.length);
      assignedDriver = fallbackSnapshot.docs[randomIndex].id;
    }

    newOrder.assignedTo = assignedDriver;
    newOrder.status = `Order Received (Driver: ${assignedDriver}, ETA: ${etaText})`;
    newOrder.timestamp = new Date();

    const docRef = await db.collection('orders').add(newOrder);
    const orderId = docRef.id;
    const trackerLink = `https://yourdomain.com/tracker.html?orderId=${orderId}`;
    const message = `Thanks for ordering from Jimmy’s! Track your order here: ${trackerLink}`;

    // === Send SMS ===
    if (process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET) {
      const vonage = new Vonage({
        apiKey: process.env.VONAGE_API_KEY,
        apiSecret: process.env.VONAGE_API_SECRET
      });

      vonage.message.sendSms(
        process.env.VONAGE_NUMBER,
        newOrder.phoneNumber,
        message,
        (err) => { if (err) console.error("Vonage error:", err); }
      );
    }

    // === Send Email ===
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        to: newOrder.customerEmail,
        from: 'orders@jimmysmenu.com',
        subject: 'Your Jimmy’s Pizza Order',
        text: message,
        html: `<p>${message}</p>`
      });
    }

    res.status(200).json({ orderId });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to process order' });
  }
});

// === Mapbox ETA API ===
app.get('/mapbox-eta/:orderId', async (req, res) => {
  try {
    const orderDoc = await db.collection('orders').doc(req.params.orderId).get();
    if (!orderDoc.exists) return res.status(404).json({ error: 'Order not found' });

    const order = orderDoc.data();
    const to = `${order.coords.lng},${order.coords.lat}`;
    const from = "-73.7824,40.9115";
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?access_token=${process.env.MAPBOX_ACCESS_TOKEN}&overview=false`;
    const response = await axios.get(url);

    const durationSec = response.data.routes?.[0]?.duration;
    if (!durationSec) throw new Error("No ETA returned");

    res.json({ eta: `${Math.round(durationSec / 60)} mins` });
  } catch (error) {
    console.error("ETA error:", error.message);
    res.status(500).json({ error: "Failed to get ETA" });
  }
});

// === Static Pages ===
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/driver', (req, res) => res.sendFile(path.join(__dirname, 'public/driver.html')));
app.get('/order', (req, res) => res.sendFile(path.join(__dirname, 'public/order.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'public/checkout.html')));
app.get('/tracker', (req, res) => res.sendFile(path.join(__dirname, 'public/tracker.html')));
app.get('/customer', (req, res) => res.sendFile(path.join(__dirname, 'public/customer.html')));

// === Server Start ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});