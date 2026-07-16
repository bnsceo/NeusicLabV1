/* Production hardening for the restored Neusic Lab shell. */
(() => {
  'use strict';
  if(window.__neusicStudioV4Hardening)return;window.__neusicStudioV4Hardening=true;
  document.querySelectorAll('body > .neusic-creator-credit').forEach(element=>element.remove());
  const app=document.getElementById('app');
  if(app){
    app.style.setProperty('height','calc(100dvh - var(--suite-h,38px))','important');
    app.style.setProperty('max-height','calc(100dvh - var(--suite-h,38px))','important');
    app.style.setProperty('margin-top','var(--suite-h,38px)','important');
    app.style.setProperty('margin-bottom','0','important');
  }
  const navigate=path=>{try{window.top.location.href=path}catch(_){location.href=path}};
  document.addEventListener('click',event=>{
    const tool=event.target.closest('[data-studio-tool]')?.dataset.studioTool;
    if(tool==='live-loop'||tool==='wave'){
      event.preventDefault();event.stopImmediatePropagation();navigate(tool==='live-loop'?'../live-loop/':'../wave-loom/');return;
    }
    if(event.target.closest('[data-v4-wave]')){event.preventDefault();event.stopImmediatePropagation();navigate('../wave-loom/');}
  },true);
})();
