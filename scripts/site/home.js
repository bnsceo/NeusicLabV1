// NeusicWave home: the "Request an invite" form. It posts JSON to the preview's own endpoint (studio.neusicwave.com),
// which stores the request for Anderson to approve; nothing is sent to a third party.
document.getElementById('year').textContent = new Date().getFullYear();

const form = document.querySelector('form.notify');
const email = form.querySelector('input[type=email]');
const status = form.querySelector('.form-status');
const button = form.querySelector('button[type=submit]');
const note = form.querySelector('#note');
const trap = form.querySelector('.hp'); // a hidden field only bots fill in

function say(text, err = false) { status.textContent = text; status.classList.toggle('err', err); }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  say('');
  if (!email.checkValidity()) { say('That email address looks incomplete. Check it and try again.', true); email.focus(); return; }
  if (!navigator.onLine) { say('You seem to be offline. Reconnect and try again.', true); return; }
  button.disabled = true; button.textContent = 'Sending…';
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), note: note.value.trim(), website: trap.value }),
    });
    const reply = await res.json().catch(() => ({}));
    if (!res.ok) { say(reply.error || "We couldn't take that just now. Try again in a minute.", true); return; }
    form.reset();
    say("Thanks. When there's room, your invite link will arrive by email.");
  } catch (err) {
    console.error('NeusicWave invite request failed', err);
    say("We couldn't send that just now. Try again in a minute.", true);
  } finally { button.disabled = false; button.textContent = 'Request invite'; }
});
