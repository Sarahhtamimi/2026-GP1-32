import { auth } from "./firebase.js";
import { meetsPasswordRequirements } from "./password-policy.js";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");
const code = params.get("oobCode");
const form = document.getElementById("resetPasswordForm");
const password = document.getElementById("newPassword");
const confirmation = document.getElementById("confirmPassword");
const submit = document.getElementById("resetSubmit");
const message = document.getElementById("resetMessage");
const invalidLink = "This reset link is invalid, expired, or already used. Request a new link.";

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = text ? `auth-message show ${type}` : "auth-message";
}

if (code && ["verifyEmail", "recoverEmail", "verifyAndChangeEmail", "revertSecondFactorAddition"].includes(mode)) {
  // Firebase uses the custom action URL for every email template.
  const handler = new URL(`https://${auth.config.authDomain}/__/auth/action`);
  handler.search = window.location.search;
  window.location.replace(handler.href);
} else if (mode !== "resetPassword" || !code) {
  showMessage(invalidLink);
} else {
  verifyPasswordResetCode(auth, code).then(() => {
    showMessage("");
    form.hidden = false;
  }).catch((error) => {
    showMessage(error.code === "auth/network-request-failed"
      ? "Unable to connect. Check your connection and reload the page."
      : invalidLink);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (form.hidden || submit.disabled) return;

  const newPassword = password.value;
  if (!meetsPasswordRequirements(newPassword)) {
    showMessage("Use at least 8 characters, including one English letter and one number.");
    password.focus();
    return;
  }
  if (newPassword !== confirmation.value) {
    showMessage("Passwords do not match.");
    confirmation.focus();
    return;
  }

  showMessage("");
  submit.disabled = true;
  submit.textContent = "Saving...";
  try {
    await confirmPasswordReset(auth, code, newPassword);
    form.reset();
    form.hidden = true;
    window.history.replaceState(null, "", window.location.pathname);
    document.getElementById("requestReset").hidden = true;
    document.getElementById("backToLogin").hidden = false;
    showMessage("Your password has been reset. You can now log in.", "success");
  } catch (error) {
    if (["auth/expired-action-code", "auth/invalid-action-code", "auth/user-disabled", "auth/user-not-found"].includes(error.code)) {
      form.reset();
      form.hidden = true;
      showMessage(invalidLink);
    } else if (["auth/password-does-not-meet-requirements", "auth/weak-password"].includes(error.code)) {
      showMessage("This password does not meet the account's password policy. Choose a different password.");
      password.focus();
    } else {
      showMessage("Unable to save your password. Please try again.");
    }
  } finally {
    submit.disabled = false;
    submit.textContent = "Reset Password";
  }
});
