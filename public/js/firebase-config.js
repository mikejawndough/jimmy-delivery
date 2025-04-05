// public/js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyDcNH3J0i7TsXP6XgEG862EQA72Lmrzcro",
  authDomain: "jimmysdelivery-9261d.firebaseapp.com",
  projectId: "jimmysdelivery-9261d",
  storageBucket: "jimmysdelivery-9261d.firebasestorage.app",
  messagingSenderId: "52478759963",
  appId: "1:52478759963:web:11fd5ab98b7bfd841bd4be",
  measurementId: "G-CW1LMVX7QN"
};

firebase.initializeApp(firebaseConfig);

// Assign global references
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("✅ Firebase Auth & Firestore available");