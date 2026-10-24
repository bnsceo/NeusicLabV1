// NeusicWave home: the "Notify me on delivery" waitlist form (FormSubmit, same endpoint as before).
document.getElementById('year').textContent = new Date().getFullYear();

const form = document.querySelector('form.notify');
const email = form.querySelector('input[type=email]');
const status = form.querySelector('.form-status');
const button = form.querySelector('button[type=submit]');

function say(text, err = false) { status.textContent = text; status.classList.toggle('err', err); }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  say('');
  if (!email.checkValidity()) { say('That email address looks incomplete. Check it and try again.', true); email.focus(); return; }
  if (!navigator.onLine) { say('You seem to be offline. Reconnect and try again.', true); return; }
  button.disabled = true; button.textContent = 'Sending…';
  try {
    const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(res.status);
    form.reset();
    say("You're on the list. We'll tell you the moment it arrives.");
  } catch (err) {
    console.error('NeusicWave waitlist submission failed', err);
    say("We couldn't add you just now. Try again in a minute.", true);
  } finally { button.disabled = false; button.textContent = 'Notify me'; }
});
