// The "Request an invite" form: posts JSON to the studio's own endpoint, which stores the request for the owner to approve. Its messages come from the page, so each language says its own.
(function () {
  var form = document.querySelector('form.notify'); if (!form) return;
  var email = form.querySelector('input[type=email]'), status = form.querySelector('.form-status'), button = form.querySelector('button[type=submit]'), note = form.querySelector('#note'), trap = form.querySelector('.hp'), label = button.textContent, d = form.dataset;
  function say(text, err) { status.textContent = text; status.classList.toggle('err', !!err); }
  form.addEventListener('submit', function (e) {
    e.preventDefault(); say('');
    if (!email.checkValidity()) { say(d.bad, true); email.focus(); return; }
    if (!navigator.onLine) { say(d.off, true); return; }
    button.disabled = true; button.textContent = d.send;
    fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value.trim(), note: note.value.trim(), website: trap.value }) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (reply) { if (!res.ok) { say(reply.error || d.fail, true); return; } form.reset(); say(d.ok); }); })
      .catch(function () { say(d.fail, true); })
      .then(function () { button.disabled = false; button.textContent = label; });
  });
})();
