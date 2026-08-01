(() => {
  'use strict';
  if (window.__neusicSuiteIdentity) return;
  window.__neusicSuiteIdentity = true;
  const path = location.pathname.toLowerCase();
  const product = path.includes('/live-loop/') ? 'live-loop' : path.includes('/wave-loom/') ? 'wave' : (path.includes('/studio/') || path.includes('/app/')) ? 'lab' : null;
  if (!product) return;
  document.body.dataset.neusicProduct = product;
  const parts = location.pathname.split('/').filter(Boolean);
  const base = location.hostname.endsWith('github.io') && parts.length ? `/${parts[0]}` : '';
  const href = suffix => `${base}${suffix}` || '/';
  const products = [
    {id:'live-loop',label:'Neusic Live Loop',href:href('/live-loop/')},
    {id:'wave',label:'Neusic Wave',href:href('/wave-loom/')},
    {id:'lab',label:'Neusic Lab',href:href('/studio/')}
  ];
  const next = products[products.findIndex(item => item.id === product) + 1] || null;
  if (!next) return;
  const transport = document.querySelector('.topbar .transport');
  if (!transport || transport.querySelector('.neusic-suite-next')) return;
  const link = document.createElement('a');
  link.className = 'neusic-suite-next';
  link.href = next.href;
  link.setAttribute('aria-label', `Continue to ${next.label}`);
  link.innerHTML = `<span>Recommended next</span><b>${next.label.replace('Neusic ','')} →</b>`;
  transport.append(link);
})();
