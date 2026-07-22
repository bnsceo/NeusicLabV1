(() => {
  'use strict';
  const toast = document.createElement('div');
  toast.className = 'mobile-recording-toast';
  toast.setAttribute('role','status');
  toast.setAttribute('aria-live','polite');
  document.body.appendChild(toast);
  let timer = 0;

  const show = (message, error=false, duration=4200) => {
    if (!matchMedia('(max-width:760px)').matches || !message) return;
    clearTimeout(timer);
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    timer = setTimeout(() => toast.classList.remove('show'), duration);
  };

  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.loop-track [data-action="record"]')) return;
    const state = event.target.closest('.loop-track')?.dataset.state;
    if (!/Recording|Overdubbing/i.test(state || '')) show('Opening microphone… allow access when your phone asks.', false, 3000);
  }, {capture:true});

  addEventListener('neusic:live-loop-status', event => {
    const message = String(event.detail?.message || '');
    const isError = /blocked|failed|cannot|could not|no microphone|no audio|locked|permission/i.test(message);
    show(message, isError, isError ? 7500 : 4200);
  });
})();
