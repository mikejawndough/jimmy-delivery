// /js/firebase-config.js

document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined") {
    console.error("Firebase SDK not loaded.");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyDcNH3J0i7TsXP6XgEG862EQA72Lmrzcro",
      authDomain: "jimmysdelivery-9261d.firebaseapp.com",
      projectId: "jimmysdelivery-9261d",
      storageBucket: "jimmysdelivery-9261d.appspot.com",
      messagingSenderId: "52478759963",
      appId: "1:52478759963:web:11fd5ab98b7bfd841bd4be",
      measurementId: "G-CW1LMVX7QN"
    });
  }

  window.firebase = firebase;
  window.auth = firebase.auth();
  window.db = firebase.firestore();

  console.log("✅ Firebase initialized.");
});