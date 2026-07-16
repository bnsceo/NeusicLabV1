/* Production hardening for the restored Neusic Lab shell. */
(() => {
  'use strict';
  if(window.__neusicStudioV4Hardening)return;window.__neusicStudioV4Hardening=true;
  document.querySelectorAll('body > .neusic-creator-credit').forEach(element=>element.remove());
  try{localStorage.setItem('neusic-flow-onboarded','1')}catch(_){}

  const app=document.getElementById('app');
  if(app){
    app.style.setProperty('height','calc(100dvh - var(--suite-h,38px))','important');
    app.style.setProperty('max-height','calc(100dvh - var(--suite-h,38px))','important');
    app.style.setProperty('margin-top','var(--suite-h,38px)','important');
    app.style.setProperty('margin-bottom','0','important');
  }

  function neutralizeLegacyOverlays(){
    document.querySelectorAll('.flow-modal').forEach(element=>element.remove());
    document.querySelectorAll('.flow-scrim,#producer-flow-panel,.mobile-action-scrim,.mobile-action-sheet,.mobile-sidebar-scrim').forEach(element=>{
      element.hidden=true;
      element.setAttribute('aria-hidden','true');
      element.style.setProperty('display','none','important');
      element.style.setProperty('pointer-events','none','important');
    });
    document.getElementById('neusic-system-footer')?.remove();
    document.querySelectorAll('[aria-label="Primary tools"]').forEach(element=>element.remove());
    document.body.classList.remove('mobile-sidebar-open');
  }
  neutralizeLegacyOverlays();
  const overlayObserver=new MutationObserver(()=>neutralizeLegacyOverlays());
  overlayObserver.observe(document.body,{subtree:true,childList:true});
  setTimeout(neutralizeLegacyOverlays,700);
  setTimeout(neutralizeLegacyOverlays,1300);

  const navigate=path=>{try{window.top.location.href=path}catch(_){location.href=path}};
  document.addEventListener('click',event=>{
    const tool=event.target.closest('[data-studio-tool]')?.dataset.studioTool;
    if(tool==='live-loop'||tool==='wave'){
      event.preventDefault();event.stopImmediatePropagation();navigate(tool==='live-loop'?'../live-loop/':'../wave-loom/');return;
    }
    if(event.target.closest('[data-v4-wave]')){event.preventDefault();event.stopImmediatePropagation();navigate('../wave-loom/');}
  },true);
})();