(() => {
  'use strict';
  const header=document.querySelector('.site-header');
  const form=document.getElementById('waitlistForm');
  const emailInput=document.getElementById('waitlistEmail');
  const status=document.getElementById('waitlistStatus');
  const STORE='neusic-waitlist-v1';
  const GOOGLE_FORM_ENDPOINT='https://docs.google.com/forms/d/e/1FAIpQLSeUFb-vNAOpIV4E4slFvlyS2v90GbkhoC8OSdtkR1mTzlHSKA/formResponse';
  const GOOGLE_EMAIL_FIELD='entry.1214627679';

  document.querySelector('.desktop-nav')?.remove();
  document.getElementById('menuButton')?.remove();
  document.getElementById('mobileMenu')?.remove();
  header?.classList.add('menu-free');

  if(!document.querySelector('link[href*="neusic-agent.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./neusic-agent.css?v=1';document.head.appendChild(link)}
  if(!document.querySelector('script[src*="neusic-agent.js"]')){const script=document.createElement('script');script.src='./neusic-agent.js?v=1';script.defer=true;document.body.appendChild(script)}

  const updateHeader=()=>header?.classList.toggle('scrolled',scrollY>18);
  updateHeader();addEventListener('scroll',updateHeader,{passive:true});

  const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const setStatus=(message,type='')=>{if(!status)return;status.textContent=message;status.className=`form-status${type?` ${type}`:''}`};
  try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved?.email&&emailInput){emailInput.value=saved.email;setStatus('This email is already on the Neusic early-access list.','success')}}catch(_){}

  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const email=emailInput.value.trim().toLowerCase();
    if(!validEmail(email)){setStatus('Enter a valid email address.','error');emailInput.focus();return}

    const button=form.querySelector('button');
    button.disabled=true;
    button.textContent='Joining…';

    try{
      const body=new URLSearchParams();
      body.set(GOOGLE_EMAIL_FIELD,email);
      await fetch(GOOGLE_FORM_ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:body.toString()});
      localStorage.setItem(STORE,JSON.stringify({email,createdAt:new Date().toISOString(),provider:'google-forms'}));
      setStatus('You are on the Neusic early-access list.','success');
      emailInput.value=email;
    }catch(error){
      console.error(error);
      setStatus('The waitlist could not be reached. Please try again.','error');
    }finally{
      button.disabled=false;
      button.innerHTML='Join Waitlist <span>→</span>';
    }
  });

  const targets=[...document.querySelectorAll('.mode-preview,.mode-copy,.companion-section>*')];
  if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){targets.forEach(element=>element.classList.add('reveal'));const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});targets.forEach(element=>observer.observe(element));}else targets.forEach(element=>element.classList.add('visible'));
})();
