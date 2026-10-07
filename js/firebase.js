import { initializeApp } from

"https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";

import { getAuth } from

"https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import { getFirestore } from

"https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {

  apiKey: "AIzaSyApqC49_K7Fg7zgyoCfovWQ2bQ7OH6XvXM",

  authDomain: "siaq-graduation-project.firebaseapp.com",

  projectId: "siaq-graduation-project",

  storageBucket: "siaq-graduation-project.firebasestorage.app",

  messagingSenderId: "114285424004",

  appId:"1:114285424004:web:c7ea47f82a5ff354b441d1" ,

   measurementId: "G-RV0K2H5DMS"

};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

export { auth, db };