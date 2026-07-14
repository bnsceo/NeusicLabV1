/* Neusic unified workspace navigation. */
(function(){
'use strict';
const ITEMS=[
  ['drums','🥁','Drum Pads','Pads, patterns and velocity'],
  ['sampler','✂️','Sampler','Chop, trim and map samples'],
  ['piano','🎹','Piano Roll','Notes, chords and velocity'],
  ['mixer','🎛️','Mixer','Levels, pan, sends and metering'],
  ['fx','🎚️','Effects','Track insert processing'],
  ['auto','〜','Automation','Draw parameter movement']
];
const META=Object.fromEntries(ITEMS.map(x=>[x[0],x]));
let active='drums';
function loadCss(){if(document.querySelector('link[data-neusic-workspace]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='css/13-workspace-ux.css';l.dataset.neusicWorkspace='true';document.head.appendChild(l);}
function currentTrack(){return S.tracks?.[S.activeTrack]||S.tracks?.[0]||null;}
function contextBar(){let el=document.getElementById('workspace-context-bar');if(!el){el=document.createElement('div');el.id='workspace-context-bar';el.className='workspace-context-bar';document.getElementById('drawer')?.prepend(el);}return el;}
function renderContext(id){const m=META[id]||[id,'•',id,id==='browser'?'Find and import sounds':'Record and monitor audio'];const t=currentTrack();const el=contextBar();if(!el)return;el.innerHTML=`<div class="workspace-context-main"><span class="workspace-context-icon">${m[1]}</span><div><strong class="workspace-context-title">${m[2]}</strong><span class="workspace-context-hint">${m[3]}</span></div></div><div class="workspace-context-actions">${t?`<span class="workspace-track-chip" style="--track-color:${t.color||'#a78bfa'}">${t.name||'Track'}</span>`:''}<button class="workspace-hide-btn" type="button" title="Hide workspace">⌄</button></div>`;el.querySelector('.workspace-hide-btn')?.addEventListener('click',()=>window.toggleDrawer?.());}
function tabs(){const root=document.getElementById('dtabs');if(!root)return;root.innerHTML=ITEMS.map(([id,icon,label,hint])=>`<button type="button" class="dtab smart-workspace-tab${id===active?' active':''}" data-panel="${id}" title="${hint}"><span>${icon}</span><b>${label}</b></button>`).join('');root.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>window.openDrawer(b.dataset.panel)));}
function footer(){if(document.getElementById('neusic-system-footer'))return;const f=document.createElement('nav');f.id='neusic-system-footer';f.className='neusic-system-footer';f.setAttribute('aria-label','Primary tools');f.innerHTML=`<button class="system-footer-btn" data-open="browser"><span class="system-footer-icon">📁</span><span>Browser</span></button><button class="system-footer-btn" data-open="drums"><span class="system-footer-icon">▦</span><span>Patterns</span></button><button class="system-footer-btn" data-open="rec"><span class="system-footer-icon">●</span><span>Record</span></button>`;document.getElementById('app')?.appendChild(f);f.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>window.openDrawer(b.dataset.open)));}
function sidebar(){const nav=document.getElementById('sb-nav');if(!nav)return;const m=META[active]||[active,'•',active,''];const t=currentTrack();nav.innerHTML=`<div class="sidebar-context-card"><span class="sidebar-context-eyebrow">ACTIVE WORKSPACE</span><strong>${m[1]} ${m[2]}</strong><span>${m[3]}</span>${t?`<small>Track: ${t.name||'Untitled'}</small>`:''}</div>`;}
function select(id){active=id;document.querySelectorAll('.smart-workspace-tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));document.querySelectorAll('.system-footer-btn').forEach(b=>b.classList.toggle('active',b.dataset.open===id||(id==='drums'&&b.dataset.open==='drums')));renderContext(id);sidebar();}
function precision(){document.querySelectorAll('.knob,[role="slider"]').forEach(k=>{if(k.dataset.precisionReady)return;k.dataset.precisionReady='true';k.setAttribute('tabindex',k.getAttribute('tabindex')||'0');k.addEventListener('dblclick',()=>{const input=k.closest('.knob-wrap,.pmx-strip,.fx-card')?.querySelector('input[type="range"]');if(input){input.value=input.defaultValue||input.min||0;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}});});}
const originalOpen=window.openDrawer;
window.openDrawer=function(id){active=id;if(typeof originalOpen==='function')originalOpen(id);tabs();select(id);setTimeout(precision,0);};
const originalBuildSidebar=window.buildSidebar;
window.buildSidebar=function(){if(typeof originalBuildSidebar==='function')originalBuildSidebar();sidebar();};
function init(){loadCss();document.getElementById('toolbar')?.setAttribute('aria-hidden','true');tabs();footer();select(S.activePanel||active);precision();new MutationObserver(()=>precision()).observe(document.body,{subtree:true,childList:true});window.NeusicWorkspace={version:'1.1.0',items:ITEMS,select};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
