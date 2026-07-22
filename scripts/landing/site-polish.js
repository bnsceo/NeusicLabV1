(() => {
  'use strict';
  const header=document.querySelector('.site-header');
  const form=document.getElementById('waitlistForm');
  const emailInput=document.getElementById('waitlistEmail');
  const status=document.getElementById('waitlistStatus');
  const menuButton=document.getElementById('menuButton');
  const mobileMenu=document.getElementById('mobileMenu');
  const STORE='neusic-waitlist-v1';
  const GOOGLE_FORM_URL='https://docs.google.com/forms/d/e/1FAIpQLSeUFb-vNAOpIV4E4slFvlyS2v90GbkhoC8OSdtkR1mTzlHSKA/viewform?usp=pp_url';
  const GOOGLE_EMAIL_FIELD='entry.1214627679';

  header?.classList.remove('menu-free');

  const closeMobileMenu=()=>{
    mobileMenu?.classList.remove('open');
    menuButton?.setAttribute('aria-expanded','false');
    document.body.classList.remove('mobile-menu-open');
  };
  menuButton?.addEventListener('click',()=>{
    const open=!mobileMenu?.classList.contains('open');
    mobileMenu?.classList.toggle('open',open);
    menuButton.setAttribute('aria-expanded',String(open));
    document.body.classList.toggle('mobile-menu-open',open);
  });
  mobileMenu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMobileMenu));
  addEventListener('resize',()=>{if(innerWidth>760)closeMobileMenu()},{passive:true});

  // Keep legacy suite links usable while preserving direct routes on the landing page.
  const routeMap={live:'./live-loop/',wave:'./wave-loom/',studio:'./studio/'};
  document.querySelectorAll('a[href*="suite/?suite="]').forEach(link=>{
    try{
      const value=new URL(link.getAttribute('href'),location.href).searchParams.get('suite');
      if(routeMap[value]) link.setAttribute('href',routeMap[value]);
    }catch(_){}
  });

  if(!document.querySelector('link[href*="css/shared/neusic-agent.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./css/shared/neusic-agent.css?v=1';document.head.appendChild(link)}
  if(!document.querySelector('script[src*="scripts/shared/neusic-agent.js"]')){const script=document.createElement('script');script.src='./scripts/shared/neusic-agent.js?v=1';script.defer=true;document.body.appendChild(script)}

  const updateHeader=()=>header?.classList.toggle('scrolled',scrollY>18);
  updateHeader();addEventListener('scroll',updateHeader,{passive:true});

  const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const setStatus=(message,type='')=>{if(!status)return;status.textContent=message;status.className=`form-status${type?` ${type}`:''}`};
  try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved?.email&&emailInput){emailInput.value=saved.email;setStatus('Continue to the Google Form to complete your early-access request.')}}catch(_){}

  form?.addEventListener('submit',event=>{
    event.preventDefault();
    const email=emailInput.value.trim().toLowerCase();
    if(!validEmail(email)){setStatus('Enter a valid email address.','error');emailInput.focus();return}

    const button=form.querySelector('button');
    button.disabled=true;
    button.textContent='Opening form…';

    try{
      const url=new URL(GOOGLE_FORM_URL);
      url.searchParams.set(GOOGLE_EMAIL_FIELD,email);
      localStorage.setItem(STORE,JSON.stringify({email,savedAt:new Date().toISOString(),provider:'google-forms'}));
      setStatus('Complete the required questions in Google Forms to join the waitlist.');
      window.location.assign(url.toString());
    }catch(error){
      console.error(error);
      setStatus('The Google Form could not be opened. Please try again.','error');
    }finally{
      button.disabled=false;
      button.innerHTML='Join Waitlist <span>→</span>';
    }
  });

  const targets=[...document.querySelectorAll('.mode-preview,.mode-copy,.companion-section>*')];
  if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){targets.forEach(element=>element.classList.add('reveal'));const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});targets.forEach(element=>observer.observe(element));}else targets.forEach(element=>element.classList.add('visible'));
})();