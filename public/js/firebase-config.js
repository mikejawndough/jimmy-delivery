// public/js/firebase-config.js
var firebaseConfig = {
  apiKey: "AIzaSyDcNH3J0i7TsXP6XgEG862EQA72Lmrzcro",
  authDomain: "jimmysdelivery-9261d.firebaseapp.com",
  projectId: "jimmysdelivery-9261d",
  storageBucket: "jimmysdelivery-9261d.firebasestorage.app",
  messagingSenderId: "52478759963",
  appId: "1:52478759963:web:11fd5ab98b7bfd841bd4be",
};
// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
// Immediately assign global references
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("Firebase initialized. Apps count:", firebase.apps.length);