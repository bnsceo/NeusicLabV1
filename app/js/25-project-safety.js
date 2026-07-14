/* Neusic Phase B: IndexedDB autosave, crash recovery, migrations, and broad undo state. */
(function(){
'use strict';
const DB_NAME='neusic-studio';
const DB_VERSION=1;
const PROJECT_STORE='projects';
const AUDIO_STORE='audio';
const AUTOSAVE_ID='autosave';
const PROJECT_VERSION=2;
const HISTORY_LIMIT=80;
const AUTOSAVE_DELAY=900;
const POLL_MS=1400;
let dbPromise=null,saveTimer=0,saveBusy=false,lastFingerprint='',historyHash='',suspend=false,statusEl=null;
const clone=value=>JSON.parse(JSON.stringify(value));

function loadCss(){
  if(document.querySelector('link[data-neusic-project-safety]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='css/16-project-safety.css';link.dataset.neusicProjectSafety='true';document.head.appendChild(link);
}

function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));});}
function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB'in window)){reject(new Error('IndexedDB unavailable'));return;}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(PROJECT_STORE))db.createObjectStore(PROJECT_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(AUDIO_STORE))db.createObjectStore(AUDIO_STORE,{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}

async function getRecord(store,key){const db=await openDb(),tx=db.transaction(store,'readonly'),done=txDone(tx);const value=await request(tx.objectStore(store).get(key));await done;return value;}
async function putRecord(store,value){const db=await openDb(),tx=db.transaction(store,'readwrite'),done=txDone(tx);tx.objectStore(store).put(value);await done;return value;}

function historyState(){
  return{
    bpm:S.bpm,masterVol:S.masterVol,trackVol:clone(S.trackVol||{}),tracks:clone(S.tracks||[]),seqSteps:clone(S.seqSteps||{}),
    automation:clone(S.automation||{}),trackFx:clone(S.trackFx||{}),recOpts:clone(S.recOpts||{}),
    samplerSlices:clone(S.samplerSlices||[]),samplerBufferId:S.samplerBufferId||null,slices:S.slices||8,activeTrack:S.activeTrack||0
  };
}

function projectState(){
  return Object.assign({id:AUTOSAVE_ID,version:PROJECT_VERSION,savedAt:new Date().toISOString()},historyState(),{
    activePanel:S.activePanel||'drums',zoom:S.zoom||1,scrollX:S.scrollX||0,
    audioIds:Object.keys(S.buffers||{}),appVersion:'phase-b-mobile-1'
  });
}

function migrateProject(raw){
  const data=clone(raw||{});const from=Number(data.version||1);
  data.version=PROJECT_VERSION;
  data.trackVol=data.trackVol||{};data.tracks=Array.isArray(data.tracks)?data.tracks:[];data.seqSteps=data.seqSteps||{};
  data.automation=data.automation||{};data.trackFx=data.trackFx||{};
  data.recOpts=Object.assign({metronome:true,countIn:false,overdub:false,loop:false},data.recOpts||{});
  data.samplerSlices=Array.isArray(data.samplerSlices)?data.samplerSlices:[];
  data.audioIds=Array.isArray(data.audioIds)?data.audioIds:[];
  if(from<2){data.activePanel=data.activePanel||'drums';data.zoom=Number(data.zoom)||1;data.scrollX=Number(data.scrollX)||0;}
  if(window.NeusicPhaseA?.migrateSteps){const previous=S.seqSteps;S.seqSteps=data.seqSteps;window.NeusicPhaseA.migrateSteps();data.seqSteps=clone(S.seqSteps);S.seqSteps=previous;}
  return data;
}

function fingerprint(){
  try{const state=projectState();delete state.savedAt;return JSON.stringify(state);}catch(_){return'';}
}

function setStatus(state,text){
  if(!statusEl)return;statusEl.dataset.state=state;statusEl.textContent=text;statusEl.title=text==='Saved'?'Saved safely on this device':text;
}

function buildStatus(){
  if(statusEl)return statusEl;
  statusEl=document.createElement('div');statusEl.className='neusic-save-status';statusEl.dataset.state='saved';statusEl.textContent='Local save';
  const top=document.getElementById('topbar');const more=top?.querySelector('.mobile-more-btn');if(top)top.insertBefore(statusEl,more||null);
  return statusEl;
}

function wavBlob(buffer){
  const channels=buffer.numberOfChannels,sr=buffer.sampleRate,frames=buffer.length,align=channels*2,dataSize=frames*align;
  const ab=new ArrayBuffer(44+dataSize),view=new DataView(ab);const write=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+dataSize,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
  view.setUint16(22,channels,true);view.setUint32(24,sr,true);view.setUint32(28,sr*align,true);view.setUint16(32,align,true);view.setUint16(34,16,true);
  write(36,'data');view.setUint32(40,dataSize,true);const arrays=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let offset=44;
  for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channels;channel++){const sample=Math.max(-1,Math.min(1,arrays[channel][frame]));view.setInt16(offset,sample<0?sample*0x8000:sample*0x7fff,true);offset+=2;}
  return new Blob([ab],{type:'audio/wav'});
}

async function persistAudio(){
  const entries=Object.entries(S.buffers||{});
  for(const [id,entry] of entries){
    if(!entry?.buffer)continue;
    const existing=await getRecord(AUDIO_STORE,id);if(existing)continue;
    await putRecord(AUDIO_STORE,{id,name:entry.name||id,duration:entry.duration||entry.buffer.duration,blob:wavBlob(entry.buffer),savedAt:new Date().toISOString()});
  }
}

async function saveNow(options={}){
  if(suspend||saveBusy)return false;saveBusy=true;clearTimeout(saveTimer);setStatus('saving','Saving…');
  try{
    const state=projectState();await putRecord(PROJECT_STORE,state);
    if(options.audio!==false)await persistAudio();
    lastFingerprint=fingerprint();setStatus('saved','Saved');return true;
  }catch(error){console.error('Neusic autosave failed',error);setStatus('error','Save error');showStorageWarning(error);return false;}
  finally{saveBusy=false;}
}

function queueSave(){
  if(suspend)return;clearTimeout(saveTimer);setStatus('saving','Saving…');saveTimer=setTimeout(()=>saveNow(),AUTOSAVE_DELAY);
}

function showStorageWarning(error){
  document.querySelector('.neusic-storage-warning')?.remove();const el=document.createElement('div');el.className='neusic-storage-warning';
  el.textContent=/quota/i.test(String(error?.name||error?.message))?'Local storage is full. Export the project file to protect your work.':'Local autosave is unavailable. Export the project file to protect your work.';
  document.body.appendChild(el);setTimeout(()=>el.remove(),7000);
}

function resetAudioGraph(){
  ['trackGains','trackPanners','trackFilters'].forEach(key=>Object.values(Audio_[key]||{}).forEach(node=>{try{node.disconnect();}catch(_){}}));
  Audio_.trackGains={};Audio_.trackPanners={};Audio_.trackFilters={};Audio_.trackDry={};Audio_.trackFxChainInput={};Audio_.trackFxNodes={};
  if(Audio_._stereoMeters){Object.values(Audio_._stereoMeters).forEach(pair=>[pair.split,pair.l,pair.r].forEach(node=>{try{node?.disconnect();}catch(_){}}));Audio_._stereoMeters={};}
}

function syncUi(){
  document.getElementById('bpm-disp')&&(document.getElementById('bpm-disp').textContent=S.bpm);
  window.renderTracks?.();window.buildSidebar?.();window.buildOv?.();window.updateUndoBadges?.();window.rebuildDrawer?.(S.activePanel);
  Audio_.setMasterVol?.(S.masterVol);Audio_.refreshAllTrackGains?.();
  if(S.playing){window.stopAllScheduled?.();window.scheduleClipPlayback?.();window.applyAllTrackAutomation?.();}
}

function applyHistory(state){
  suspend=true;
  Object.assign(S,clone(state));
  window.NeusicPhaseA?.migrateSteps?.();resetAudioGraph();(S.tracks||[]).forEach(track=>{Audio_.rebuildTrackFxRack?.(track.id);Audio_.refreshTrackGain?.(track.id);});
  syncUi();historyHash='';suspend=false;queueSave();
}

function installHistory(){
  window.snapshot=function(){
    const state=historyState(),hash=JSON.stringify(state);if(hash===historyHash)return;
    historyHash=hash;S.undoStack.push(JSON.stringify(state));if(S.undoStack.length>HISTORY_LIMIT)S.undoStack.shift();S.redoStack=[];window.updateUndoBadges?.();
  };
  window.undo=function(){
    if(!S.undoStack.length){window.toast?.('Nothing to undo');return;}
    S.redoStack.push(JSON.stringify(historyState()));const state=JSON.parse(S.undoStack.pop());applyHistory(state);window.updateUndoBadges?.();window.toast?.('Undo');
  };
  window.redo=function(){
    if(!S.redoStack.length){window.toast?.('Nothing to redo');return;}
    S.undoStack.push(JSON.stringify(historyState()));const state=JSON.parse(S.redoStack.pop());applyHistory(state);window.updateUndoBadges?.();window.toast?.('Redo');
  };
}

async function loadAudio(ids){
  S.buffers={};Audio_.ensure();
  for(const id of ids||[]){
    const record=await getRecord(AUDIO_STORE,id);if(!record?.blob)continue;
    try{const buffer=await Audio_.ctx.decodeAudioData(await record.blob.arrayBuffer());Audio_.registerBuffer(id,buffer,record.name);}catch(error){console.warn('Could not restore audio',id,error);}
  }
}

async function restoreAutosave(record){
  const data=migrateProject(record);suspend=true;if(S.playing)window.togglePlay?.();
  Object.assign(S,{
    bpm:data.bpm??120,masterVol:data.masterVol??.85,trackVol:data.trackVol||{},tracks:data.tracks||[],seqSteps:data.seqSteps||{},
    automation:data.automation||{},trackFx:data.trackFx||{},recOpts:data.recOpts||{},samplerSlices:data.samplerSlices||[],
    samplerBufferId:data.samplerBufferId||null,slices:data.slices||8,activeTrack:data.activeTrack||0,activePanel:data.activePanel||'drums',zoom:data.zoom||1,scrollX:data.scrollX||0
  });
  await loadAudio(data.audioIds);S.undoStack=[];S.redoStack=[];S.selectedClip=null;resetAudioGraph();
  (S.tracks||[]).forEach(track=>{Audio_.rebuildTrackFxRack?.(track.id);Audio_.refreshTrackGain?.(track.id);});
  window.rewind?.();syncUi();suspend=false;lastFingerprint=fingerprint();setStatus('saved','Restored');localStorage.setItem('neusic-recovery-seen',data.savedAt||new Date().toISOString());window.toast?.('Autosaved project restored');
}

function recoveryBanner(record){
  const seen=localStorage.getItem('neusic-recovery-seen');if(seen&&new Date(seen)>=new Date(record.savedAt))return;
  const banner=document.createElement('aside');banner.className='neusic-recovery-banner';banner.innerHTML=`<div class="neusic-recovery-icon">↻</div><div class="neusic-recovery-copy"><strong>Recover your last session?</strong><span>Autosaved ${new Date(record.savedAt).toLocaleString()} · ${(record.tracks||[]).length} tracks</span></div><div class="neusic-recovery-actions"><button class="neusic-recovery-btn" data-dismiss>Start fresh</button><button class="neusic-recovery-btn primary" data-restore>Restore</button></div>`;
  banner.querySelector('[data-dismiss]').addEventListener('click',()=>{localStorage.setItem('neusic-recovery-seen',record.savedAt);banner.remove();queueSave();});
  banner.querySelector('[data-restore]').addEventListener('click',async()=>{banner.querySelectorAll('button').forEach(button=>button.disabled=true);await restoreAutosave(record);banner.remove();});
  document.body.appendChild(banner);
}

async function offerRecovery(){try{const record=await getRecord(PROJECT_STORE,AUTOSAVE_ID);if(record?.savedAt&&Array.isArray(record.tracks)&&record.tracks.length)recoveryBanner(record);}catch(error){console.warn('Recovery lookup failed',error);}}

function installChangeDetection(){
  const signal=event=>{if(event.type==='keydown'&&!['Delete','Backspace','Enter'].includes(event.key)&&!event.metaKey&&!event.ctrlKey)return;queueSave();};
  ['change','pointerup','touchend'].forEach(type=>document.addEventListener(type,signal,{passive:true}));document.addEventListener('keydown',signal);
  setInterval(()=>{const next=fingerprint();if(next&&next!==lastFingerprint)queueSave();},POLL_MS);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveNow({audio:false});});
  window.addEventListener('pagehide',()=>saveNow({audio:false}),{capture:true});
}

function wrapProjectLoad(){
  const original=window.loadProjectFromFile;if(typeof original!=='function')return;
  window.loadProjectFromFile=async function(file){const result=await original(file);historyHash='';queueSave();return result;};
}

async function init(){
  if(typeof S==='undefined'||typeof Audio_==='undefined')return;loadCss();buildStatus();installHistory();wrapProjectLoad();installChangeDetection();
  lastFingerprint=fingerprint();historyHash='';await offerRecovery();
  window.NeusicSafety={version:'2.0.0',saveNow,queueSave,restoreAutosave,migrateProject,historyState,projectState};
  setStatus('saved','Autosave');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
