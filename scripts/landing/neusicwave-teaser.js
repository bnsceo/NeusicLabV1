const form = document.getElementById("waitlistForm");
const emailInput = document.getElementById("email");
const statusText = document.getElementById("formStatus");
const modal = document.getElementById("successModal");
const closeSuccess = document.getElementById("closeSuccess");
const dismissSuccess = document.getElementById("dismissSuccess");
const submitButton = form.querySelector("button[type='submit']");
const originalButtonMarkup = submitButton.innerHTML;

document.getElementById("year").textContent = new Date().getFullYear();

function showSuccess() {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  dismissSuccess.focus();
}

function hideSuccess() {
  modal.hidden = true;
  document.body.style.overflow = "";
  emailInput.focus();
}

function setSubmitting(active) {
  submitButton.disabled = active;
  submitButton.innerHTML = active ? "Joining…" : originalButtonMarkup;
}

closeSuccess.addEventListener("click", hideSuccess);
dismissSuccess.addEventListener("click", hideSuccess);
modal.addEventListener("click", (event) => {
  if (event.target === modal) hideSuccess();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) hideSuccess();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusText.textContent = "";

  if (!emailInput.checkValidity()) {
    statusText.textContent = "Enter a valid email address.";
    emailInput.focus();
    return;
  }

  if (!navigator.onLine) {
    statusText.textContent = "You appear to be offline. Reconnect and try again.";
    return;
  }

  setSubmitting(true);

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error(`Waitlist request failed: ${response.status}`);

    form.reset();
    showSuccess();
  } catch (error) {
    console.error("NeusicWave waitlist submission failed", error);
    statusText.textContent = "We couldn't add you right now. Please try again.";
  } finally {
    setSubmitting(false);
  }
});
