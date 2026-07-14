/* Neusic mobile-first runtime shell: viewport, action sheet, off-canvas tracks, gestures. */
(function(){
'use strict';
const MOBILE_MAX=899;
let moreButton=null,actionSheet=null,actionScrim=null,sidebarScrim=null;

function loadCss(){
  if(document.querySelector('link[data-neusic-mobile-first]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='css/15-mobile-first.css';link.dataset.neusicMobileFirst='true';
  document.head.appendChild(link);
}

function updateViewport(){
  const viewport=window.visualViewport;
  const width=Math.round(viewport?.width||window.innerWidth);
  const height=Math.round(viewport?.height||window.innerHeight);
  document.documentElement.style.setProperty('--app-vh',`${height}px`);
  document.documentElement.style.setProperty('--app-vw',`${width}px`);
  const mobile=width<MOBILE_MAX;
  document.body.classList.toggle('neusic-mobile',mobile);
  document.body.classList.toggle('neusic-compact',width<430);
  document.body.classList.toggle('neusic-landscape',width>height&&height<600);
  document.body.dataset.device=width<600?'phone':width<MOBILE_MAX?'tablet':'desktop';
  if(!mobile)closeSidebar();
}

function markSecondaryControls(){
  const top=document.getElementById('topbar');if(!top)return;
  const ids=['btn-undo','btn-redo','btn-sb'];
  ids.forEach(id=>document.getElementById(id)?.closest('.tb-btn-wrap,button')?.classList.add('mobile-secondary'));
  top.querySelector('.zoom-group')?.classList.add('mobile-secondary');
  [...top.querySelectorAll('button')].forEach(button=>{
    const title=(button.title||'').toLowerCase();
    if(/save project|load project|export full mix|toggle sidebar/.test(title))button.classList.add('mobile-secondary');
  });
}

function commandButton(icon,label,handler){
  const button=document.createElement('button');
  button.type='button';button.className='mobile-action-btn';button.innerHTML=`<span>${icon}</span>${label}`;
  button.addEventListener('click',()=>{closeActions();handler();});
  return button;
}

function buildActionSheet(){
  if(actionSheet)return;
  actionScrim=document.createElement('button');
  actionScrim.type='button';actionScrim.className='mobile-action-scrim';actionScrim.hidden=true;
  actionScrim.setAttribute('aria-label','Close action menu');actionScrim.addEventListener('click',closeActions);
  actionSheet=document.createElement('section');
  actionSheet.className='mobile-action-sheet';actionSheet.hidden=true;actionSheet.setAttribute('aria-label','Project actions');
  const actions=[
    ['↩','Undo',()=>window.undo?.()],['↪','Redo',()=>window.redo?.()],['💾','Save file',()=>window.saveProjectToFile?.()],
    ['📂','Load file',()=>window.triggerLoadProject?.()],['⬇','Export WAV',()=>window.exportWavFile?.()],['☁','Save now',()=>window.NeusicSafety?.saveNow?.()],
    ['＋','Add track',()=>window.addTrack?.()],['☰','Tracks',toggleSidebar],['⏮','Rewind',()=>window.rewind?.()]
  ];
  actions.forEach(([icon,label,fn])=>actionSheet.appendChild(commandButton(icon,label,fn)));
  document.body.append(actionScrim,actionSheet);
}

function openActions(){buildActionSheet();actionScrim.hidden=false;actionSheet.hidden=false;moreButton?.setAttribute('aria-expanded','true');}
function closeActions(){if(actionScrim)actionScrim.hidden=true;if(actionSheet)actionSheet.hidden=true;moreButton?.setAttribute('aria-expanded','false');}
function toggleActions(){actionSheet&&!actionSheet.hidden?closeActions():openActions();}

function addMoreButton(){
  if(moreButton||!document.getElementById('topbar'))return;
  moreButton=document.createElement('button');moreButton.type='button';moreButton.className='mobile-more-btn';
  moreButton.textContent='⋯';moreButton.title='More project actions';moreButton.setAttribute('aria-label','More project actions');
  moreButton.setAttribute('aria-expanded','false');moreButton.addEventListener('click',toggleActions);
  document.getElementById('topbar').appendChild(moreButton);
}

function buildSidebarScrim(){
  if(sidebarScrim)return;
  sidebarScrim=document.createElement('button');sidebarScrim.type='button';sidebarScrim.className='mobile-sidebar-scrim';
  sidebarScrim.setAttribute('aria-label','Close tracks panel');sidebarScrim.addEventListener('click',closeSidebar);document.body.appendChild(sidebarScrim);
}
function openSidebar(){if(window.innerWidth>=MOBILE_MAX)return;buildSidebarScrim();document.body.classList.add('mobile-sidebar-open');}
function closeSidebar(){document.body.classList.remove('mobile-sidebar-open');}
function toggleSidebar(){document.body.classList.contains('mobile-sidebar-open')?closeSidebar():openSidebar();}

function patchSidebarToggle(){
  const original=window.toggleSidebar;
  window.toggleSidebar=function(){if(window.innerWidth<MOBILE_MAX){toggleSidebar();return;}return original?.();};
}

function drawerGesture(){
  const handle=document.getElementById('drawer-handle');if(!handle||handle.dataset.mobileGesture)return;
  handle.dataset.mobileGesture='true';
  handle.addEventListener('click',event=>{
    if(handle.dataset.swiped!=='true')return;
    event.preventDefault();event.stopImmediatePropagation();delete handle.dataset.swiped;
  },true);
  handle.addEventListener('pointerdown',event=>{
    if(window.innerWidth>=MOBILE_MAX||event.button!==0)return;
    const startY=event.clientY,startOpen=Boolean(S.drawerOpen);let currentY=startY;
    handle.setPointerCapture?.(event.pointerId);
    const move=e=>{currentY=e.clientY;};
    const end=()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);
      const delta=currentY-startY;
      if(Math.abs(delta)>42){
        handle.dataset.swiped='true';
        if(delta>0&&startOpen)window.toggleDrawer?.();
        if(delta<0&&!startOpen)window.toggleDrawer?.();
      }
    };
    window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true});
  });
}

function keyboardSafety(){
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeActions();closeSidebar();}
  });
}

function init(){
  loadCss();markSecondaryControls();addMoreButton();buildActionSheet();buildSidebarScrim();patchSidebarToggle();drawerGesture();keyboardSafety();updateViewport();
  window.addEventListener('resize',updateViewport,{passive:true});window.visualViewport?.addEventListener('resize',updateViewport,{passive:true});
  window.visualViewport?.addEventListener('scroll',updateViewport,{passive:true});
  window.NeusicMobile={version:'2.0.0',openActions,closeActions,openSidebar,closeSidebar,updateViewport};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
