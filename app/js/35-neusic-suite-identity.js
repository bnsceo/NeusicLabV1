/* Shared Neusic product journey for Classic Studio. */
(() => {
  'use strict';
  if (document.getElementById('neusic-lab-suite')) return;
  const path=location.pathname.split('/').filter(Boolean);
  const base=location.hostname.endsWith('github.io')&&path.length?`/${path[0]}`:'';
  const href=suffix=>`${base}${suffix}`||'/';
  const rail=document.createElement('nav');
  rail.id='neusic-lab-suite';
  rail.setAttribute('aria-label','Neusic product journey');
  rail.innerHTML=`
    <a class="suite-home" href="${href('/')}"><i>N</i><span>NEUSIC</span></a>
    <div class="suite-path">
      <a href="${href('/live-loop/')}">01 · Live Loop</a><span>→</span>
      <a href="${href('/wave-loom/')}">02 · Wave</a><span>→</span>
      <a class="current" href="${href('/studio/')}" aria-current="page">03 · Lab</a>
    </div>
    <div class="suite-context">3 products · 1 project <b>Finish here</b></div>`;
  document.body.prepend(rail);

  const app=document.getElementById('app');
  rail.style.setProperty('top','var(--neusic-credit-safe,0px)','important');
  if(app){
    app.style.setProperty('height','calc(100dvh - var(--suite-h) - (var(--neusic-credit-safe,0px) * 2))','important');
    app.style.setProperty('max-height','calc(100dvh - var(--suite-h) - (var(--neusic-credit-safe,0px) * 2))','important');
    app.style.setProperty('margin-top','calc(var(--suite-h) + var(--neusic-credit-safe,0px))','important');
    app.style.setProperty('margin-bottom','var(--neusic-credit-safe,0px)','important');
  }
})();
