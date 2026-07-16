(() => {
  'use strict';
  if (window.__neusicSuiteIdentity) return;
  window.__neusicSuiteIdentity = true;

  const path = location.pathname.toLowerCase();
  const product = path.includes('/live-loop/') ? 'live-loop' : path.includes('/wave-loom/') ? 'wave' : (path.includes('/studio/') || path.includes('/app/')) ? 'lab' : null;
  if (!product) return;
  document.body.dataset.neusicProduct = product;

  const parts = location.pathname.split('/').filter(Boolean);
  const isPages = location.hostname.endsWith('github.io');
  const base = isPages && parts.length ? `/${parts[0]}` : '';
  const href = suffix => `${base}${suffix}` || '/';
  const products = [
    {id:'live-loop',number:'01',label:'Neusic Live Loop',href:href('/live-loop/')},
    {id:'wave',number:'02',label:'Neusic Wave',href:href('/wave-loom/')},
    {id:'lab',number:'03',label:'Neusic Lab',href:href('/studio/')}
  ];
  const currentIndex = products.findIndex(item => item.id === product);
  const next = products[currentIndex + 1] || null;
  const rail = document.createElement('nav');
  rail.className = 'neusic-suite-rail';
  rail.setAttribute('aria-label','Neusic product journey');
  rail.innerHTML = `
    <a class="neusic-suite-intro" href="${href('/')}">
      <b>NEUSIC</b><span>3 products · 1 connected project</span>
    </a>
    <div class="neusic-suite-path">
      ${products.map((item,index) => `${index ? '<i class="neusic-suite-arrow">→</i>' : ''}<a href="${item.href}"${item.id === product ? ' aria-current="page"' : ''}><small>${item.number}</small>${item.label}</a>`).join('')}
    </div>
    <a class="neusic-suite-next" href="${next ? next.href : href('/')}" aria-label="${next ? `Continue to ${next.label}` : 'Return to Neusic home'}"><span>${next ? 'Recommended next' : 'Project home'}</span><b>${next ? next.label.replace('Neusic ','') : 'HOME'} →</b></a>`;

  const header = document.querySelector('.topbar, header');
  if (header?.parentNode) header.insertAdjacentElement('afterend',rail);
  else document.body.prepend(rail);
})();
