// setAdmin.js

const admin = require("firebase-admin");

// Path to your downloaded service account key
const serviceAccount = require("./service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// The UID of the user to make admin (get this from Firebase Console > Authentication)
const adminUIDs = [
  "tglqAgjDr4cXlf9TvXHUF79oxei1",
  "qAIutW4GuhMOrHOlPSNgtNfIbov1",
];

adminUIDs.forEach(uid => {
  admin.auth().setCustomUserClaims(uid, { admin: true })
    .then(() => console.log(`Admin claim set for ${uid}`))
    .catch(err => console.error(`Error for ${uid}:`, err));
});