// public/js/firebase-config.js

// Your Firebase config
// Initialize Firebase using the configuration from your .env or environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Assign global references
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("✅ Firebase Auth & Firestore available");