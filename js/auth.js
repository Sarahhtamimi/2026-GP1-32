import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


// ==========================
// SIGN UP
// ==========================

const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        first_name: firstName,
        last_name: lastName,
        email: email,
        role: "user",
        status: "active",
        created_at: serverTimestamp()
      });

      console.log("Account created successfully");

      window.location.href = "index.html";

    } catch (error) {
      console.error("Signup error:", error);
      alert(error.message);
    }
  });
}


// ==========================
// LOGIN
// ==========================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      console.log("Logged in successfully");

      window.location.href = "index.html";

    } catch (error) {
      console.error("Login error:", error);
      alert("Email or password is incorrect.");
    }
  });
}


// ==========================
// LOGOUT
// ==========================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);

      console.log("Logged out successfully");

      window.location.href = "login.html";

    } catch (error) {
      console.error("Logout error:", error);
      alert("Something went wrong while logging out.");
    }
  });
}