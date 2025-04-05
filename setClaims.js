// setClaims.js - Assigns admin or driver roles to users
const admin = require("firebase-admin");
const path = require("path"); // Use path module for better path handling

// Load the service account key dynamically
const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");

console.log("✅ Attempting to load serviceAccountKey.json from:", serviceAccountPath);

try {
  const serviceAccount = require(serviceAccountPath);

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error(`❌ Error loading serviceAccountKey.json: ${error.message}`);
  process.exit(1); // Exit if there's an error loading the file
}

// --- Set Admin Role ---
async function setAdmin(uid) {
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`✅ Admin role granted to user: ${uid}`);
  } catch (error) {
    console.error(`❌ Error setting admin role: ${error.message}`);
  }
}

// --- Set Driver Role ---
async function setDriver(uid) {
  try {
    await admin.auth().setCustomUserClaims(uid, { driver: true });
    console.log(`✅ Driver role granted to user: ${uid}`);
  } catch (error) {
    console.error(`❌ Error setting driver role: ${error.message}`);
  }
}

// --- Remove Custom Claims ---
async function removeClaims(uid) {
  try {
    await admin.auth().setCustomUserClaims(uid, {});
    console.log(`✅ Claims removed for user: ${uid}`);
  } catch (error) {
    console.error(`❌ Error removing claims: ${error.message}`);
  }
}

// ------- USAGE -------
// Replace with the actual UID from Firebase Authentication
const uid = "PUT_USER_UID_HERE"; // Replace with actual UID

// --- Uncomment One of These to Assign a Role ---
// setAdmin(uid);    // Grant admin role
// setDriver(uid);   // Grant driver role
// removeClaims(uid); // Remove all custom claims