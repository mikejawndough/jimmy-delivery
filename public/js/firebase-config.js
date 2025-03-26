// public/js/firebase-config.js

// Your Firebase config
var firebaseConfig = {
  apiKey: "AIzaSyDcNH3J0i7TsXP6XgEG862EQA72Lmrzcro",
  authDomain: "jimmysdelivery-9261d.firebaseapp.com",
  projectId: "jimmysdelivery-9261d",
  storageBucket: "jimmysdelivery-9261d.appspot.com", // fixed typo
  messagingSenderId: "52478759963",
  appId: "1:52478759963:web:11fd5ab98b7bfd841bd4be",
};

// Initialize Firebase (only once)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("✅ Firebase initialized");
} else {
  console.log("⚠️ Firebase already initialized");
}

// Assign global references
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("✅ Firebase Auth & Firestore available");