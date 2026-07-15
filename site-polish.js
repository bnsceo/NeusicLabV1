(() => {
  'use strict';
  const header=document.querySelector('.site-header');
  const menuButton=document.getElementById('menuButton');
  const mobileMenu=document.getElementById('mobileMenu');
  const form=document.getElementById('waitlistForm');
  const emailInput=document.getElementById('waitlistEmail');
  const status=document.getElementById('waitlistStatus');
  const STORE='neusic-waitlist-v1';

  const setMenu=open=>{
    mobileMenu?.classList.toggle('open',open);
    menuButton?.setAttribute('aria-expanded',String(open));
    if(menuButton)menuButton.textContent=open?'CLOSE':'MENU';
  };
  menuButton?.addEventListener('click',()=>setMenu(!mobileMenu.classList.contains('open')));
  mobileMenu?.addEventListener('click',event=>{if(event.target.closest('a'))setMenu(false)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')setMenu(false)});
  const updateHeader=()=>header?.classList.toggle('scrolled',scrollY>18);
  updateHeader();addEventListener('scroll',updateHeader,{passive:true});

  const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const setStatus=(message,type='')=>{if(!status)return;status.textContent=message;status.className=`form-status${type?` ${type}`:''}`};
  try{
    const saved=JSON.parse(localStorage.getItem(STORE)||'null');
    if(saved?.email&&emailInput){emailInput.value=saved.email;setStatus('This email is already saved for early-access updates.','success')}
  }catch(_){}
  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const email=emailInput.value.trim().toLowerCase();
    if(!validEmail(email)){setStatus('Enter a valid email address.','error');emailInput.focus();return}
    const button=form.querySelector('button');button.disabled=true;button.textContent='Saving…';
    const endpoint=form.dataset.endpoint?.trim();
    try{
      if(endpoint){
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,source:'neusic-landing',createdAt:new Date().toISOString()})});
        if(!response.ok)throw new Error('Waitlist request failed');
        setStatus('You are on the Neusic early-access list.','success');
      }else{
        localStorage.setItem(STORE,JSON.stringify({email,createdAt:new Date().toISOString()}));
        setStatus('Interest saved on this device while the public waitlist connection is being completed.','success');
      }
    }catch(error){console.error(error);setStatus('The waitlist could not be reached. Your email was not sent.','error')}
    finally{button.disabled=false;button.innerHTML='Join Waitlist <span>→</span>'}
  });

  const targets=[...document.querySelectorAll('.mode-preview,.mode-copy,.companion-section>*')];
  if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    targets.forEach(element=>element.classList.add('reveal'));
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});
    targets.forEach(element=>observer.observe(element));
  }else targets.forEach(element=>element.classList.add('visible'));
})();
