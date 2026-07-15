(() => {
'use strict';
const MODES={
loom:{title:'The Wave Loom',eyebrow:'WAVE-NATIVE INSTRUMENT',panel:null,engine:'loom'},
arrange:{title:'Arrangement',eyebrow:'SONG FORM & TIMELINE',panel:null,engine:'studio'},
perform:{title:'Performance',eyebrow:'PADS & PATTERNS',panel:'drums',engine:'studio'},
piano:{title:'Piano Roll',eyebrow:'MIDI COMPOSITION',panel:'piano',engine:'studio'},
record:{title:'NeuCapture',eyebrow:'AUDIO & MIDI CAPTURE',panel:'rec',engine:'studio'},
mix:{title:'Mixer',eyebrow:'ROUTING & EFFECTS',panel:'mixer',engine:'studio'}
};
const EXT_CSS=['13-workspace-ux.css','14-production-integrity.css','15-mobile-first.css','16-project-safety.css','17a-studio-foundation.css','17b-studio-navigation.css','17c-studio-controls.css','17d-studio-mixer-mobile.css','18-producer-flow.css','19-professional-arranger.css','20a-hyperreal-shell.css','20b-hyperreal-tracks.css','20c-hyperreal-creator.css','21-production-copilot.css','22-premium-studio.css','23-recording-mix-workflow.css','24-piano-roll-v2.css'];
const EXT_JS=['22-workspace-ux.js','23-production-integrity.js','24-mobile-first.js','25-project-safety.js','26-producer-flow.js','27-producer-flow-hardening.js','28-professional-arranger.js','29-arranger-recovery-sync.js','30-track-engine.js','31-midi-clips.js','32-track-workspace.js','33-production-copilot.js','34-theme-personalization.js','35-recording-mix-workflow.js','36-piano-roll-v2.js'];
const $=id=>document.getElementById(id),loom=$('loomFrame'),studio=$('studioFrame'),loader=$('engineLoader');
let current='loom',studioReady=false,studioLoading=false;
function core(){try{return studio.contentWindow||null}catch(_){return null}}
function loadScript(doc,src){return new Promise((resolve,reject)=>{if(doc.querySelector(`script[src$="${src}"]`))return resolve();const s=doc.createElement('script');s.src=`../studio/js/${src}`;s.onload=resolve;s.onerror=reject;doc.body.appendChild(s);});}
async function prepareStudio(){
if(studioReady||studioLoading)return studioReady;
studioLoading=true;loader.classList.remove('hidden','error');$('loaderText').textContent='Loading the full Neusic production engine.';
if(!studio.src)studio.src='../studio/core.html';
await new Promise(resolve=>{if(studio.contentDocument?.readyState==='complete')resolve();else studio.addEventListener('load',resolve,{once:true});});
try{
const win=core(),doc=win.document;
EXT_CSS.forEach(name=>{if(doc.querySelector(`link[href$="${name}"]`))return;const l=doc.createElement('link');l.rel='stylesheet';l.href=`../studio/css/${name}`;doc.head.appendChild(l);});
for(const name of EXT_JS)await loadScript(doc,name);
const style=doc.createElement('style');style.textContent=`#topbar,#toolbar,#sidebar,.creator-credit,[data-neusic-creator]{display:none!important}html,body,#app{height:100%!important;min-height:100%!important}body{overflow:hidden!important}#main{top:0!important;min-height:0!important}#center{width:100%!important}.dpanel{padding-bottom:12px!important}#mobile-nav{display:none!important}.track-header{min-width:0!important}`;doc.head.appendChild(style);
studioReady=true;loader.classList.add('hidden');applyPanel(current);return true;
}catch(error){console.error(error);loader.classList.add('error');$('loaderText').textContent='The production engine could not finish loading on this phone.';return false;}finally{studioLoading=false;}
}
function applyPanel(mode){if(!studioReady)return;const win=core(),panel=MODES[mode].panel;try{if(panel){win.openDrawer?.(panel);win.document.getElementById('drawer')?.classList.add('open');}else if(win.document.getElementById('drawer')?.classList.contains('open'))win.toggleDrawer?.();}catch(_){}}
async function activate(mode){if(!MODES[mode])return;current=mode;const config=MODES[mode];document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('modeTitle').textContent=config.title;$('modeEyebrow').textContent=config.eyebrow;const useLoom=config.engine==='loom';loom.classList.toggle('active',useLoom);studio.classList.toggle('active',!useLoom);$('statusText').textContent=useLoom?'LOOM READY':studioReady?'ENGINE READY':'LOADING';$('statusLed').style.background=useLoom?'var(--green)':'var(--cyan)';if(useLoom){loader.classList.add('hidden');}else{await prepareStudio();applyPanel(mode);}try{localStorage.setItem('neusic-mobile-mode',mode)}catch(_){}}
function call(name,...args){try{const win=core();if(typeof win?.[name]==='function')return win[name](...args)}catch(_){}}
function clickLoom(selector){try{loom.contentDocument?.querySelector(selector)?.click()}catch(_){}}
function action(name){if(current==='loom'){if(name==='play')return clickLoom('#playBtn');if(name==='rewind')return clickLoom('#resetBtn');if(name==='record')return clickLoom('#captureBtn');}const map={play:()=>call('togglePlay'),rewind:()=>call('rewind'),record:()=>call('toggleRecord'),save:()=>call('saveProjectToFile'),export:()=>call('exportWavFile'),undo:()=>call('undo'),redo:()=>call('redo'),theme:()=>call('openThemePanel'),copilot:()=>call('openCopilot')};map[name]?.();}
function create(type){if(!studioReady){activate('arrange');setTimeout(()=>create(type),1000);return}try{const win=core(),names={audio:'New Audio Track',midi:'New Instrument',beat:'New Drum Track',bus:'New Bus'};const track=win.NeusicTracks?.create?.({type,name:names[type]});if(!track&&type==='audio')win.addTrack?.();win.renderTracks?.();win.toast?.(`${names[type]} created`);activate('arrange');closeSheet();}catch(_){}}
function openSheet(){$('toolSheet').classList.add('open');$('sheetBackdrop').classList.add('open');$('toolSheet').setAttribute('aria-hidden','false')}
function closeSheet(){$('toolSheet').classList.remove('open');$('sheetBackdrop').classList.remove('open');$('toolSheet').setAttribute('aria-hidden','true')}
document.addEventListener('click',e=>{const mode=e.target.closest('[data-mode]')?.dataset.mode;if(mode)activate(mode);const act=e.target.closest('[data-action]')?.dataset.action;if(act)action(act);const type=e.target.closest('[data-create]')?.dataset.create;if(type)create(type);});
$('menuButton').addEventListener('click',openSheet);$('closeSheet').addEventListener('click',closeSheet);$('sheetBackdrop').addEventListener('click',closeSheet);
setInterval(()=>{if(!studioReady)return;try{const win=core(),state=win.S||{};$('playButton').textContent=state.playing?'Ⅱ':'▶';$('recordButton').classList.toggle('active',!!state.recording);}catch(_){}},300);
let saved='loom';try{saved=localStorage.getItem('neusic-mobile-mode')||'loom'}catch(_){}activate(MODES[saved]?saved:'loom');
})();