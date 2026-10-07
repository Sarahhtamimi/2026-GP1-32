// ==========================================
// SIAQ - Authentication
// ==========================================

import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


// ==========================================
// SIGN UP
// ==========================================

const signupForm = document.getElementById("signupForm");

if (signupForm) {

  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const emailInput = document.getElementById("signupEmail");
  const passwordInput = document.getElementById("signupPassword");
  const confirmInput = document.getElementById("signupConfirm");
  const termsInput = document.getElementById("terms");
  const signupMessage = document.getElementById("signupMessage");


  // ------------------------------------------
  // Helper Functions
  // ------------------------------------------

  function showFieldError(input, message) {

    const label = input.closest("label");

    if (!label) return;

    label.classList.add("invalid");

    const errorElement =
      label.querySelector(".field-error");

    if (errorElement) {
      errorElement.textContent = message;
    }
  }


  function clearFieldError(input) {

    const label = input.closest("label");

    if (!label) return;

    label.classList.remove("invalid");
  }


  function showSignupMessage(message, type = "error") {

    if (!signupMessage) return;

    signupMessage.textContent = message;

    signupMessage.className =
      `auth-message show ${type}`;
  }


  function clearSignupMessage() {

    if (!signupMessage) return;

    signupMessage.textContent = "";

    signupMessage.className = "auth-message";
  }


  function clearAllErrors() {

    clearFieldError(firstNameInput);
    clearFieldError(lastNameInput);
    clearFieldError(emailInput);
    clearFieldError(passwordInput);
    clearFieldError(confirmInput);

    clearSignupMessage();
  }


  // ------------------------------------------
  // Remove Errors While Typing
  // ------------------------------------------

  [
    firstNameInput,
    lastNameInput,
    emailInput,
    passwordInput,
    confirmInput
  ].forEach((input) => {

    input.addEventListener("input", () => {

      clearFieldError(input);
      clearSignupMessage();

    });

  });


  termsInput.addEventListener("change", () => {

    clearSignupMessage();

  });


  // ------------------------------------------
  // Submit Sign Up Form
  // ------------------------------------------

  signupForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      clearAllErrors();


      const firstName =
        firstNameInput.value.trim();

      const lastName =
        lastNameInput.value.trim();

      const email =
        emailInput.value.trim();

      const password =
        passwordInput.value;

      const confirmPassword =
        confirmInput.value;

      const terms =
        termsInput.checked;


      let hasError = false;


      // ----------------------------------------
      // First Name Validation
      // ----------------------------------------

      if (!firstName) {

        showFieldError(
          firstNameInput,
          "Please enter your first name."
        );

        hasError = true;

      } else if (firstName.length > 50) {

        showFieldError(
          firstNameInput,
          "First name must not exceed 50 characters."
        );

        hasError = true;
      }


      // ----------------------------------------
      // Last Name Validation
      // ----------------------------------------

      if (!lastName) {

        showFieldError(
          lastNameInput,
          "Please enter your last name."
        );

        hasError = true;

      } else if (lastName.length > 50) {

        showFieldError(
          lastNameInput,
          "Last name must not exceed 50 characters."
        );

        hasError = true;
      }


      // ----------------------------------------
      // Email Validation
      // ----------------------------------------

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


      if (!email) {

        showFieldError(
          emailInput,
          "Please enter your email address."
        );

        hasError = true;

      } else if (!emailPattern.test(email)) {

        showFieldError(
          emailInput,
          "Please enter a valid email address."
        );

        hasError = true;
      }


      // ----------------------------------------
      // Password Validation
      // ----------------------------------------

      const hasLetter =
        /[A-Za-z]/.test(password);

      const hasNumber =
        /[0-9]/.test(password);


      if (!password) {

        showFieldError(
          passwordInput,
          "Please enter a password."
        );

        hasError = true;

      } else if (
        password.length < 8 ||
        !hasLetter ||
        !hasNumber
      ) {

        showFieldError(
          passwordInput,
          "Password must be at least 8 characters and contain at least one letter and one number."
        );

        hasError = true;
      }


      // ----------------------------------------
      // Confirm Password Validation
      // ----------------------------------------

      if (!confirmPassword) {

        showFieldError(
          confirmInput,
          "Please confirm your password."
        );

        hasError = true;

      } else if (password !== confirmPassword) {

        showFieldError(
          confirmInput,
          "Passwords do not match."
        );

        hasError = true;
      }


      // ----------------------------------------
      // Terms Validation
      // ----------------------------------------

      if (!terms) {

        showSignupMessage(
          "Please agree to the terms and conditions before creating your account."
        );

        hasError = true;
      }


      if (hasError) {
        return;
      }


      // ----------------------------------------
      // Firebase Sign Up
      // ----------------------------------------

      try {

        const userCredential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );


        const user =
          userCredential.user;


        // --------------------------------------
        // Save User Information in Firestore
        // --------------------------------------

        await setDoc(
          doc(
            db,
            "users",
            user.uid
          ),
          {

            user_id: user.uid,

            first_name: firstName,

            last_name: lastName,

            email: email,

            role: "user",

            status: "active",

            created_at: serverTimestamp()

          }
        );


        // --------------------------------------
        // Successful Sign Up
        // --------------------------------------

        showSignupMessage(
          "Account created successfully. Redirecting to the homepage...",
          "success"
        );


        setTimeout(() => {

          window.location.href =
            "index.html";

        }, 900);


      } catch (error) {

        console.error(
          "Signup error:",
          error
        );


        if (
          error.code ===
          "auth/email-already-in-use"
        ) {

          showFieldError(
            emailInput,
            "This email is already registered. Please log in instead."
          );

        } else if (
          error.code ===
          "auth/invalid-email"
        ) {

          showFieldError(
            emailInput,
            "Please enter a valid email address."
          );

        } else if (
          error.code ===
          "auth/weak-password"
        ) {

          showFieldError(
            passwordInput,
            "Password must be at least 8 characters and contain at least one letter and one number."
          );

        } else if (
          error.code ===
          "auth/network-request-failed"
        ) {

          showSignupMessage(
            "We couldn't connect to the server. Please check your internet connection and try again."
          );

        } else if (
          error.code ===
          "auth/too-many-requests"
        ) {

          showSignupMessage(
            "Too many attempts. Please wait a moment before trying again."
          );

        } else {

          showSignupMessage(
            "We couldn't create your account. Please try again."
          );

        }

      }

    }
  );

}


// ==========================================
// LOGIN
// ==========================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

  const emailInput =
    document.getElementById("loginEmail");

  const passwordInput =
    document.getElementById("loginPassword");

  const loginMessage =
    document.getElementById("loginMessage");


  // ------------------------------------------
  // Helper Functions
  // ------------------------------------------

  function showLoginFieldError(input, message) {

    const label =
      input.closest("label");

    if (!label) return;

    label.classList.add("invalid");

    const errorElement =
      label.querySelector(".field-error");

    if (errorElement) {
      errorElement.textContent = message;
    }
  }


  function clearLoginFieldError(input) {

    const label =
      input.closest("label");

    if (!label) return;

    label.classList.remove("invalid");
  }


  function showLoginMessage(
    message,
    type = "error"
  ) {

    if (!loginMessage) return;

    loginMessage.textContent = message;

    loginMessage.className =
      `auth-message show ${type}`;
  }


  function clearLoginMessage() {

    if (!loginMessage) return;

    loginMessage.textContent = "";

    loginMessage.className =
      "auth-message";
  }


  function clearLoginErrors() {

    clearLoginFieldError(emailInput);

    clearLoginFieldError(passwordInput);

    clearLoginMessage();
  }


  // ------------------------------------------
  // Remove Errors While Typing
  // ------------------------------------------

  emailInput.addEventListener(
    "input",
    () => {

      clearLoginFieldError(emailInput);

      clearLoginMessage();

    }
  );


  passwordInput.addEventListener(
    "input",
    () => {

      clearLoginFieldError(passwordInput);

      clearLoginMessage();

    }
  );


  // ------------------------------------------
  // Submit Login Form
  // ------------------------------------------

  loginForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      clearLoginErrors();


      const email =
        emailInput.value.trim();

      const password =
        passwordInput.value;


      let hasError = false;


      // ----------------------------------------
      // Email Validation
      // ----------------------------------------

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


      if (!email) {

        showLoginFieldError(
          emailInput,
          "Please enter your email address."
        );

        hasError = true;

      } else if (
        !emailPattern.test(email)
      ) {

        showLoginFieldError(
          emailInput,
          "Please enter a valid email address."
        );

        hasError = true;
      }


      // ----------------------------------------
      // Password Validation
      // ----------------------------------------

      if (!password) {

        showLoginFieldError(
          passwordInput,
          "Please enter your password."
        );

        hasError = true;
      }


      if (hasError) {
        return;
      }


      // ----------------------------------------
      // Firebase Login
      // ----------------------------------------

      try {

        const userCredential =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );


        const user =
          userCredential.user;


        // --------------------------------------
        // Get User Information From Firestore
        // --------------------------------------

        const userDocument =
          await getDoc(
            doc(
              db,
              "users",
              user.uid
            )
          );


        // --------------------------------------
        // User Document Must Exist
        // --------------------------------------

        if (!userDocument.exists()) {

          await signOut(auth);

          showLoginMessage(
            "Your account information could not be found. Please contact support."
          );

          return;
        }


        // --------------------------------------
        // Check Account Status
        // --------------------------------------

        const userData =
          userDocument.data();


        if (
          userData.status === "blocked"
        ) {

          await signOut(auth);

          showLoginMessage(
            "Your account has been blocked. Please contact the administrator."
          );

          return;
        }


        // --------------------------------------
        // Successful Login
        // --------------------------------------

        console.log(
          "Logged in successfully"
        );


        showLoginMessage(
          "Login successful. Redirecting to the homepage...",
          "success"
        );


        setTimeout(() => {

          window.location.href =
            "index.html";

        }, 700);


      } catch (error) {

        console.error(
          "Login error:",
          error
        );


        if (
          error.code ===
            "auth/invalid-credential" ||

          error.code ===
            "auth/user-not-found" ||

          error.code ===
            "auth/wrong-password"
        ) {

          showLoginMessage(
            "Incorrect email or password. Please try again."
          );

        } else if (
          error.code ===
          "auth/invalid-email"
        ) {

          showLoginFieldError(
            emailInput,
            "Please enter a valid email address."
          );

        } else if (
          error.code ===
          "auth/too-many-requests"
        ) {

          showLoginMessage(
            "Too many login attempts. Please wait a moment and try again."
          );

        } else if (
          error.code ===
          "auth/network-request-failed"
        ) {

          showLoginMessage(
            "Unable to connect. Please check your internet connection and try again."
          );

        } else {

          showLoginMessage(
            "Unable to log in. Please try again."
          );

        }

      }

    }
  );

}


// ==========================================
// LOGOUT
// ==========================================

const logoutBtn =
  document.getElementById("logoutBtn");

if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    async () => {

      try {

        await signOut(auth);

        console.log(
          "Logged out successfully"
        );

        window.location.href =
          "index.html";

      } catch (error) {

        console.error(
          "Logout error:",
          error
        );

        // No popup alert.
        // The user remains on the current page.

      }

    }
  );

}


// ==========================================
// AUTH NAVIGATION STATE
// ==========================================

const navProfile =
  document.getElementById("navProfile");

const navLogin =
  document.getElementById("navLogin");

const navSignup =
  document.getElementById("navSignup");

const navLogout =
  document.getElementById("logoutBtn");


onAuthStateChanged(
  auth,
  (user) => {

    if (user) {

      // Logged in
      if (navProfile) {
        navProfile.style.display = "";
      }

      if (navLogout) {
        navLogout.style.display = "";
      }

      if (navLogin) {
        navLogin.style.display = "none";
      }

      if (navSignup) {
        navSignup.style.display = "none";
      }

    } else {

      // Logged out
      if (navProfile) {
        navProfile.style.display = "none";
      }

      if (navLogout) {
        navLogout.style.display = "none";
      }

      if (navLogin) {
        navLogin.style.display = "";
      }

      if (navSignup) {
        navSignup.style.display = "";
      }

    }

  }
);