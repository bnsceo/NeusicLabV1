const form = document.getElementById("waitlistForm");
const emailInput = document.getElementById("email");
const statusText = document.getElementById("formStatus");
const submitFrame = document.getElementById("googleFormsTarget");
const modal = document.getElementById("successModal");
const closeSuccess = document.getElementById("closeSuccess");
const dismissSuccess = document.getElementById("dismissSuccess");
const submitButton = form.querySelector("button[type='submit']");
const originalButtonMarkup = submitButton.innerHTML;

let submissionPending = false;
let submissionTimer = null;

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

function restoreSubmitButton() {
  submitButton.disabled = false;
  submitButton.innerHTML = originalButtonMarkup;
}

function completeSubmission() {
  if (!submissionPending) return;
  submissionPending = false;
  window.clearTimeout(submissionTimer);
  submissionTimer = null;
  form.reset();
  restoreSubmitButton();
  showSuccess();
}

closeSuccess.addEventListener("click", hideSuccess);
dismissSuccess.addEventListener("click", hideSuccess);
modal.addEventListener("click", (event) => {
  if (event.target === modal) hideSuccess();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) hideSuccess();
});

submitFrame.addEventListener("load", completeSubmission);

form.addEventListener("submit", (event) => {
  statusText.textContent = "";

  if (!emailInput.checkValidity()) {
    event.preventDefault();
    statusText.textContent = "Enter a valid email address.";
    emailInput.focus();
    return;
  }

  if (!navigator.onLine) {
    event.preventDefault();
    statusText.textContent = "You appear to be offline. Reconnect and try again.";
    return;
  }

  submissionPending = true;
  submitButton.disabled = true;
  submitButton.textContent = "Joining…";

  // Google Forms responds inside the hidden iframe. This timeout protects the
  // interface if a browser blocks the iframe's load event after the POST.
  submissionTimer = window.setTimeout(completeSubmission, 8000);
});
