/* Neusic Premium Studio personalization: accent, chrome and density. */
(function(){
'use strict';
const STORE='neusic-theme-v1';
const presets={
  gold:{name:'Studio Gold',copy:'Warm high-end hardware',accent:'#d4a354',bright:'#f0c77d'},
  electric:{name:'Electric Blue',copy:'Clean digital focus',accent:'#3fa7ff',bright:'#8fd3ff'},
  emerald:{name:'Emerald',copy:'Calm performance mode',accent:'#44d18f',bright:'#8de9ba'},
  violet:{name:'Violet',copy:'Creative night session',accent:'#9f7aea',bright:'#c4b5fd'},
  crimson:{name:'Crimson',copy:'Bold recording energy',accent:'#ff5d73',bright:'#ff9baa'},
  ice:{name:'Ice',copy:'Bright modern console',accent:'#68d8ff',bright:'#c4f1ff'}
};
const chrome={
  graphite:{s0:'#080a0b',s1:'#101416',s2:'#1a2023',s3:'#262d31',line:'#3a4348',bg:'#111416',bg1:'#171b1e',bg2:'#1d2225',bg3:'#282f33',bgd:'#07090a'},
  obsidian:{s0:'#030405',s1:'#090b0c',s2:'#111416',s3:'#1c2124',line:'#30383d',bg:'#090a0b',bg1:'#101214',bg2:'#15181a',bg3:'#202428',bgd:'#020303'},
  slate:{s0:'#0d1114',s1:'#171d21',s2:'#20282d',s3:'#303a40',line:'#4a565d',bg:'#161b1f',bg1:'#20262b',bg2:'#262e33',bg3:'#333c42',bgd:'#090c0e'}
};
let state={preset:'gold',accent:presets.gold.accent,bright:presets.gold.bright,chrome:'graphite',density:'comfortable'};
function rgba(hex,a){const n=parseInt(hex.replace('#',''),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`}
function read(){try{state={...state,...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch(_){}}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(_){}}
function apply(next=state){
  state={...state,...next};const root=document.documentElement,c=chrome[state.chrome]||chrome.graphite;
  root.style.setProperty('--studio-accent',state.accent);
  root.style.setProperty('--studio-accent-bright',state.bright||state.accent);
  root.style.setProperty('--studio-accent-soft',rgba(state.accent,.18));
  root.style.setProperty('--acc',state.accent);root.style.setProperty('--acc2',state.accent);root.style.setProperty('--acc3',state.bright||state.accent);root.style.setProperty('--accg',rgba(state.accent,.35));
  root.style.setProperty('--studio-surface-0',c.s0);root.style.setProperty('--studio-surface-1',c.s1);root.style.setProperty('--studio-surface-2',c.s2);root.style.setProperty('--studio-surface-3',c.s3);root.style.setProperty('--studio-line',c.line);
  root.style.setProperty('--bg',c.bg);root.style.setProperty('--bg1',c.bg1);root.style.setProperty('--bg2',c.bg2);root.style.setProperty('--bg3',c.bg3);root.style.setProperty('--bgd',c.bgd);
  root.dataset.neusicChrome=state.chrome;root.dataset.neusicDensity=state.density;
  document.querySelectorAll('.theme-preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===state.preset));
  document.querySelectorAll('.theme-dot').forEach(dot=>dot.style.background=state.accent);
  save();
}
function close(){document.querySelector('.theme-backdrop')?.remove()}
function open(){
  close();const back=document.createElement('div');back.className='theme-backdrop';
  back.innerHTML=`<section class="theme-panel" role="dialog" aria-modal="true" aria-label="Neusic theme settings">
    <header><div><small>NEUSIC VISUAL SYSTEM</small><h2>Make the studio yours.</h2><p>Choose the accent, console finish and workspace density. Changes apply immediately and stay on this device.</p></div><button class="theme-close" aria-label="Close theme settings">×</button></header>
    <div class="theme-body">
      <div class="theme-group"><small>Accent presets</small><div class="theme-presets">${Object.entries(presets).map(([id,p])=>`<button class="theme-preset${state.preset===id?' active':''}" data-preset="${id}"><i style="--preset:${p.accent}"></i><span><b>${p.name}</b><small>${p.copy}</small></span></button>`).join('')}</div></div>
      <div class="theme-controls">
        <label>Custom accent<input id="theme-custom" type="color" value="${state.accent}"></label>
        <label>Console finish<select id="theme-chrome"><option value="graphite">Graphite</option><option value="obsidian">Obsidian</option><option value="slate">Slate</option></select></label>
        <label>Interface density<select id="theme-density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      </div>
    </div>
    <footer class="theme-footer"><button data-reset>Restore default</button><button class="primary" data-done>Done</button></footer>
  </section>`;
  document.body.appendChild(back);back.querySelector('#theme-chrome').value=state.chrome;back.querySelector('#theme-density').value=state.density;
  back.querySelectorAll('[data-preset]').forEach(btn=>btn.onclick=()=>{const p=presets[btn.dataset.preset];apply({preset:btn.dataset.preset,accent:p.accent,bright:p.bright});back.querySelector('#theme-custom').value=p.accent});
  back.querySelector('#theme-custom').oninput=e=>apply({preset:'custom',accent:e.target.value,bright:e.target.value});
  back.querySelector('#theme-chrome').onchange=e=>apply({chrome:e.target.value});
  back.querySelector('#theme-density').onchange=e=>apply({density:e.target.value});
  back.querySelector('.theme-close').onclick=close;back.querySelector('[data-done]').onclick=close;
  back.querySelector('[data-reset]').onclick=()=>{state={preset:'gold',accent:presets.gold.accent,bright:presets.gold.bright,chrome:'graphite',density:'comfortable'};apply();close();open()};
  back.onclick=e=>{if(e.target===back)close()};document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',esc)}});
}
function install(){
  read();apply();
  const top=document.getElementById('topbar');if(top&&!document.getElementById('theme-studio-trigger')){
    const sep=document.createElement('div');sep.className='tb-sep theme-sep';
    const btn=document.createElement('button');btn.id='theme-studio-trigger';btn.className='tb-btn';btn.title='Customize studio theme';btn.innerHTML='<span class="theme-dot"></span><span class="theme-label">THEME</span>';btn.onclick=open;
    const sidebarButton=document.getElementById('btn-sb');if(sidebarButton){top.insertBefore(sep,sidebarButton);top.insertBefore(btn,sidebarButton)}else{top.append(sep,btn)}
  }
  window.NeusicTheme={open,apply,get:()=>({...state}),presets};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
