"use strict";

const modelGroups = [
  {
    label: "MISTRAL",
    mark: "M",
    options: [
      ["mistral-baseline", "Mistral (Baseline)"],
      ["mistral-appropriateness", "Mistral — Fine-tuned for Appropriateness"],
      ["mistral-positivity", "Mistral — Fine-tuned for Positivity Alignment"],
      ["mistral-cultural", "Mistral — Fine-tuned for Socio-Cultural Values Alignment"]
    ]
  },
  {
    label: "AYA",
    mark: "A",
    options: [
      ["aya-baseline", "Aya (Baseline)"],
      ["aya-appropriateness", "Aya — Fine-tuned for Appropriateness"],
      ["aya-positivity", "Aya — Fine-tuned for Positivity Alignment"],
      ["aya-cultural", "Aya — Fine-tuned for Socio-Cultural Values Alignment"]
    ]
  }
];

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function setupNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".main-nav");

  if (!toggle || !navigation) return;

  toggle.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  navigation.addEventListener("click", () => {
    navigation.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  });
}

function setupCustomSelects() {
  document.querySelectorAll(".custom-select").forEach((select) => {
    const trigger = select.querySelector(".select-trigger");
    const menu = select.querySelector(".select-menu");
    const input = select.querySelector("input[type='hidden']");

    modelGroups.forEach((group) => {
      const heading = document.createElement("div");
      heading.className = "option-group";
      heading.textContent = group.label;
      menu.appendChild(heading);

      group.options.forEach(([value, label]) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "select-option";
        option.dataset.value = value;
        option.innerHTML = `<span class="model-mark">${group.mark}</span>${label}`;

        option.addEventListener("click", () => {
          input.value = value;
          trigger.innerHTML = `${label}<span>⌄</span>`;
          trigger.style.color = "var(--text)";
          select.classList.remove("open");
          trigger.setAttribute("aria-expanded", "false");
          trigger.classList.remove("invalid");

          const error = document.querySelector(`#${input.id}-error`);
          if (error) error.textContent = "";
        });

        menu.appendChild(option);
      });
    });

    trigger.addEventListener("click", () => {
      document.querySelectorAll(".custom-select.open").forEach((other) => {
        if (other !== select) other.classList.remove("open");
      });

      const isOpen = select.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".custom-select")) {
      document.querySelectorAll(".custom-select.open").forEach((select) => {
        select.classList.remove("open");
      });
    }
  });
}

function setupEvaluationForm() {
  const form = document.querySelector("#evaluation-form");
  if (!form) return;

  const prompt = document.querySelector("#prompt");
  const counter = document.querySelector("#character-count");

  prompt.addEventListener("input", () => {
    counter.textContent = `${prompt.value.length} / 1000`;
    prompt.classList.remove("invalid");
    document.querySelector("#prompt-error").textContent = "";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    let valid = true;
    const modelA = document.querySelector("#modelA");
    const modelB = document.querySelector("#modelB");

    if (!prompt.value.trim()) {
      prompt.classList.add("invalid");
      document.querySelector("#prompt-error").textContent =
        "Please enter a prompt or scenario.";
      valid = false;
    }

    [modelA, modelB].forEach((model) => {
      if (!model.value) {
        document
          .querySelector(`[data-select='${model.id}'] .select-trigger`)
          .classList.add("invalid");

        document.querySelector(`#${model.id}-error`).textContent =
          "Please select a model.";

        valid = false;
      }
    });

    if (modelA.value && modelA.value === modelB.value) {
      document.querySelector("#modelB-error").textContent =
        "Choose a different configuration for comparison.";

      document
        .querySelector("[data-select='modelB'] .select-trigger")
        .classList.add("invalid");

      valid = false;
    }

    if (valid) {
      showToast(
        "This feature is not yet implemented. The evaluation will be available in a later stage."
      );
    }
  });
}

function validateAuthField(input) {
  const error = input.closest(".field-group")?.querySelector(".error-message");
  let message = "";

  if (!input.value.trim()) {
    message = "This field is required.";
  } else if (
    input.type === "email" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)
  ) {
    message = "Enter a valid email address.";
  } else if (
    input.name === "password" &&
    input.closest("#signup-form") &&
    (
      input.value.length < 8 ||
      !/[a-zA-Z]/.test(input.value) ||
      !/[0-9]/.test(input.value)
    )
  ) {
    message =
      "Password must be at least 8 characters and contain at least one letter and one number.";
  } else if (
    (input.name === "firstName" || input.name === "lastName") &&
    input.value.trim().length > 50
  ) {
    message = "Name must not exceed 50 characters.";
  }

  input.classList.toggle("invalid", Boolean(message));

  if (error) error.textContent = message;

  return !message;
}

async function sendAuthRequest(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Something went wrong. Please try again."
    );
  }

  return result;
}

function setupAuthForms() {
  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.previousElementSibling;
      const showing = input.type === "text";

      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
      button.setAttribute(
        "aria-label",
        showing ? "Show password" : "Hide password"
      );
    });
  });

  document.querySelectorAll(".auth-form").forEach((form) => {
    form
      .querySelectorAll("input[required]:not([type='checkbox'])")
      .forEach((input) => {
        input.addEventListener("blur", () => validateAuthField(input));

        input.addEventListener("input", () => {
          if (input.classList.contains("invalid")) {
            validateAuthField(input);
          }
        });
      });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      let valid = true;

      form
        .querySelectorAll("input[required]:not([type='checkbox'])")
        .forEach((input) => {
          valid = validateAuthField(input) && valid;
        });

      const terms = form.querySelector("#terms");

      if (terms && !terms.checked) {
        document.querySelector("#terms-error").textContent =
          "You must agree before creating an account.";
        valid = false;
      } else if (terms) {
        document.querySelector("#terms-error").textContent = "";
      }

      if (!valid) return;

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;

      try {
        if (form.id === "signup-form") {
          await sendAuthRequest("/api/signup", {
            first_name: form.elements.firstName.value.trim(),
            last_name: form.elements.lastName.value.trim(),
            email: form.elements.email.value.trim(),
            password: form.elements.password.value
          });

          window.location.href = "index.html";
        } else if (form.id === "login-form") {
          await sendAuthRequest("/api/login", {
            email: form.elements.email.value.trim(),
            password: form.elements.password.value
          });

          window.location.href = "index.html";
        }
      } catch (error) {
        showToast(error.message);
      } finally {
        submitButton.disabled = false;
      }
    });
  });
}

async function setupHomeAccount() {
  const loginLink = document.querySelector(".login-link");
  if (!loginLink) return;

  try {
    const response = await fetch("/api/me", {
      credentials: "same-origin"
    });

    if (!response.ok) return;

    // Logged-in users see a Log Out button instead of their name.
    loginLink.textContent = "Log Out";
    loginLink.classList.add("logout-button");
    loginLink.href = "#";

    loginLink.addEventListener("click", async (event) => {
      event.preventDefault();

      try {
        const response = await fetch("/api/logout", {
          method: "POST",
          credentials: "same-origin"
        });

        if (!response.ok) {
          throw new Error("Could not log out. Please try again.");
        }

        window.location.href = "index.html";
      } catch (error) {
        showToast(error.message);
      }
    });
  } catch (error) {
    console.error("Could not check login status:", error);
  }
}

function setupPlaceholderLinks() {
  document.querySelectorAll("[data-placeholder-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showToast("This page will be implemented in a later stage.");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupCustomSelects();
  setupEvaluationForm();
  setupAuthForms();
  setupHomeAccount();
  setupPlaceholderLinks();
});