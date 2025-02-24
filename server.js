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

// 5. Create Express App, HTTP Server, and Initialize Socket.io
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// 6. Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// 7. Test SendGrid API Key Before Sending Orders
async function testSendGrid() {
  try {
    await sgMail.send({
      to: "akmdra3@gmail.com",
      from: "ashleysajous@elitebarbershopny.com", // Ensure this is verified in SendGrid
      subject: "Test Email",
      text: "This is a test email from Jimmy's Pizza.",
    });
    console.log("✅ SendGrid test email sent successfully.");
  } catch (error) {
    console.error("❌ SendGrid is not working:", error.response ? error.response.body : error);
  }
}
testSendGrid();

// 8. Order Placement Endpoint
app.post('/order', async (req, res) => {
  const { items, customerName, customerEmail, phoneNumber, address } = req.body;
  
  // Validate Input
  if (!items || !customerName || !customerEmail || !phoneNumber || !address) {
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
    // Save order to Firebase
    const orderRef = await db.collection('orders').add(newOrder);

    // Save order in customer's order history
    const userOrdersRef = db.collection('customers').doc(customerEmail);
    await userOrdersRef.set({ email: customerEmail }, { merge: true });
    await userOrdersRef.collection('orderHistory').doc(orderRef.id).set(newOrder);

    console.log(`✅ Order placed with ID: ${orderRef.id}`);

    // Send order notification email
    const msg = {
      to: "akmdra3@gmail.com", // Replace with admin email
      from: "ashleysajous@elitebarbershopny.com", // Ensure this is a verified sender
      subject: "New Order Received",
      text: `New order from ${customerName} (${customerEmail}). Address: ${address}. Items: ${items.map(item => item.name).join(', ')}`,
    };
    sgMail.send(msg)
  .then(() => console.log("✅ Notification email sent"))
  .catch((error) => {
    console.error("❌ SendGrid is not working:", error.response ? error.response.body : error);
  });

    await sgMail.send(msg);
    console.log("✅ Order notification email sent successfully");

    res.json({ orderId: orderRef.id, status: newOrder.status });
  } catch (error) {
    console.error("❌ Error placing order:", error.response ? error.response.body : error);
    res.status(500).json({ error: "Failed to place order." });
  }
});

// 9. Start the Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});