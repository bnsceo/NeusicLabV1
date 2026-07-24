import {workspace} from './src/audio/AudioWorkspace.js';
import {LookAheadScheduler} from './src/audio/Scheduler.js?v=2';
import {TapeDelay} from './src/audio/effects/TapeDelay.js?v=2';
import {SpatialReverb} from './src/audio/effects/SpatialReverb.js?v=2';
import {PerformanceFx} from './src/audio/effects/PerformanceFx.js';
import {PolySynth} from './src/audio/instruments/Synth.js';
import {MidiRouter} from './src/midi/MidiRouter.js';
import {FiveTrackLooper,STATES} from './src/audio/Looper.js?v=2';
import {sendToForge,downloadBuffer} from './src/storage/ForgeBridge.js?v=2';
import {clearSession,hasRecoverableAudio,loadSession,restoreSession,saveSession} from './src/storage/LiveLoopSessionStore.js?v=2';
import {planImportTargets} from './src/ui/importPlan.js?v=2';

const $=id=>document.getElementById(id);
const trackGrid=$('trackGrid');
const template=$('trackTemplate');
const keyMap={a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71};
const heldKeys=new Set();
const sendingTracks=new Set();

let looper=null;
let synth=null;
let midi=null;
let delay=null;
let reverb=null;
let performanceFx=null;
let enginePromise=null;
let selected=0;
let fxBypassed=false;
let spaceFrozen=false;
let pendingRecovery=null;
let saveTimer=0;

function status(message){
  const output=$('statusMessage');
  if(output)output.textContent=message;
  window.dispatchEvent(new CustomEvent('neusic:live-loop-status',{detail:{message}}));
}
function format(seconds){return seconds?`${seconds.toFixed(2)}s`:'—';}
function outputFor(control,value){
  if(control==='pan')return Math.abs(value)<.03?'C':value<0?`L${Math.round(Math.abs(value)*100)}`:`R${Math.round(value*100)}`;
  return Math.round(value*100);
}

function hideRecovery(){
  const panel=$('sessionRecovery');
  if(panel)panel.hidden=true;
}

function showRecovery(record){
  pendingRecovery=record;
  const panel=$('sessionRecovery');
  const summary=$('sessionRecoverySummary');
  if(!panel||!summary)return;
  const lanes=record.tracks.filter(track=>track?.buffer?.length).length;
  summary.textContent=`${lanes} saved lane${lanes===1?'':'s'} · ${format(record.masterLength)} master loop`;
  panel.hidden=false;
}

async function checkRecovery(){
  try{
    const record=await loadSession();
    if(hasRecoverableAudio(record))showRecovery(record);
  }catch(error){
    console.warn('Live Loop recovery is unavailable.',error);
  }
}

function scheduleSessionSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    if(!looper||looper.activeRecording||looper.arming)return;
    try{await saveSession(looper);}
    catch(error){console.warn('Live Loop recovery save failed.',error);}
  },500);
}

function primeMicrophoneFromGesture(){
  if(window.NeusicMobileMicPrimer?.prime)return window.NeusicMobileMicPrimer.prime();
  if(!navigator.mediaDevices?.getUserMedia)return Promise.reject(new Error('Microphone capture is unavailable in this browser.'));
  return navigator.mediaDevices.getUserMedia({audio:true});
}

async function startRecordFromGesture(index,button){
  if(button.dataset.recordBusy==='1')return;
  button.dataset.recordBusy='1';
  selectTrack(index);
  status(`Preparing LOOP ${index+1}… Keep this page open.`);

  const microphonePromise=primeMicrophoneFromGesture();
  const audioEnginePromise=ensureEngine();

  try{
    const [readyLooper,stream]=await Promise.all([audioEnginePromise,microphonePromise]);
    if(stream?.getAudioTracks?.().length){
      workspace.micStream=stream;
      await workspace.initMic();
    }
    await workspace.resume({required:true});
    await readyLooper.toggleRecord(index);
  }catch(error){
    console.error(error);
    status(error.message||'The iPhone could not start this lane.');
  }finally{
    delete button.dataset.recordBusy;
  }
}

function buildTracks(){
  if(!trackGrid||!template){
    status('Live Loop interface could not initialize. Reload the page.');
    return;
  }
  trackGrid.innerHTML='';
  for(let index=0;index<5;index++){
    const card=template.content.firstElementChild.cloneNode(true);
    card.dataset.index=String(index);
    card.querySelector('.track-number').textContent=String(index+1).padStart(2,'0');
    card.querySelector('.track-name').textContent=`LOOP ${index+1}`;
    card.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',async event=>{
      event.stopPropagation();
      await handleTrackAction(index,button.dataset.action);
    }));
    const recordButton=card.querySelector('[data-action="record"]');
    recordButton.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse')return;
      event.preventDefault();
      event.stopImmediatePropagation();
      startRecordFromGesture(index,recordButton);
    },{passive:false});
    card.querySelectorAll('[data-control]').forEach(input=>input.addEventListener('input',async()=>{
      const key=input.dataset.control;
      const raw=Number(input.value);
      const value=raw/100;
      input.nextElementSibling.textContent=outputFor(key,value);
      try{await ensureEngine();looper.setTrackValue(index,key,value);}catch(error){status(error.message||'Audio could not start. Tap again.');}
    }));
    card.addEventListener('click',()=>selectTrack(index));
    trackGrid.appendChild(card);
  }
  selectTrack(0,{announce:false});
  window.dispatchEvent(new CustomEvent('neusic:live-loop-lanes-visible',{detail:{count:5}}));
}

function selectTrack(index,{announce=true}={}){
  selected=index;
  document.querySelectorAll('.loop-track').forEach((card,item)=>card.classList.toggle('selected',item===index));
  if(announce)status(`Track ${index+1} selected. Touch REC to capture; MIDI is optional.`);
  window.dispatchEvent(new CustomEvent('neusic:live-loop-select',{detail:{index}}));
}

async function handleTrackAction(index,action){
  selectTrack(index);
  if(action==='select')return;
  try{
    if(action==='record'){
      const microphonePromise=primeMicrophoneFromGesture();
      const readyLooper=await ensureEngine();
      const stream=await microphonePromise;
      if(stream?.getAudioTracks?.().length){workspace.micStream=stream;await workspace.initMic();}
      await workspace.resume({required:true});
      await readyLooper.toggleRecord(index);
      return;
    }
    await ensureEngine();
    if(action==='mute')looper.toggleMute(index);
    if(action==='clear')looper.clear(index);
    if(action==='upload')$('fileInput').click();
    if(action==='forge')await sendTrack(index);
  }catch(error){
    console.error(error);
    status(error.message||'That action could not be completed. Tap REC again to retry.');
  }
}

async function downloadTrack(index=selected){
  await ensureEngine();
  const track=looper.tracks[index];
  if(!track.buffer){status('The selected track is empty. Record or load audio before downloading.');return false;}
  downloadBuffer(track.buffer,`${track.name.toLowerCase().replace(/\s+/g,'-')}.wav`);
  status(`${track.name} downloaded as WAV.`);
  return true;
}

async function sendTrack(index){
  if(sendingTracks.has(index)){status(`LOOP ${index+1} is already being sent to Neusic Wave.`);return;}
  sendingTracks.add(index);
  const globalButton=$('sendSelectedBtn');
  if(selected===index&&globalButton)globalButton.disabled=true;
  try{
    await ensureEngine();
    const track=looper.tracks[index];
    if(!track.buffer){status('Record or load audio into this track before sending it to Wave.');return;}
    renderTrack(index);
    status(`Preparing ${track.name} for Neusic Wave…`);
    const mobileHandoff=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
    await sendToForge(track.buffer,`${track.name} · Live Loop`,{beforeNavigate:async()=>{
      if(mobileHandoff&&workspace.context?.state==='running')await workspace.context.suspend();
    }});
    status(`${track.name} was sent to Neusic Wave.`);
  }finally{
    sendingTracks.delete(index);
    if(selected===index&&globalButton)globalButton.disabled=false;
    if(looper)renderTrack(index);
  }
}

function renderTrack(index){
  const card=trackGrid?.querySelector(`[data-index="${index}"]`);
  if(!card)return;
  if(!looper){
    card.dataset.state=STATES.EMPTY;
    card.querySelector('.track-state').textContent='READY';
    return;
  }
  const track=looper.tracks[index];
  card.dataset.state=track.state;
  card.querySelector('.track-name').textContent=track.name;
  card.querySelector('.track-state').textContent=`${track.state.toUpperCase()}${track.rate===.5?' · 2× CYCLE':''}`;
  const record=card.querySelector('[data-action="record"]');
  record.textContent=track.state===STATES.QUEUED?'CANCEL':track.state===STATES.RECORDING||track.state===STATES.OVERDUBBING?'STOP':track.buffer?'OVERDUB':'REC';
  record.setAttribute('aria-pressed',String([STATES.QUEUED,STATES.RECORDING,STATES.OVERDUBBING].includes(track.state)));
  const mute=card.querySelector('[data-action="mute"]');
  mute.textContent=track.muted?'UNMUTE':'MUTE';
  mute.setAttribute('aria-pressed',String(track.muted));
  const forge=card.querySelector('[data-action="forge"]');
  const sending=sendingTracks.has(index);
  forge.textContent=sending?'SENDING…':'WAVE';
  forge.disabled=!track.buffer||sending;
  card.querySelector('[data-action="clear"]').disabled=!track.buffer;
  window.dispatchEvent(new CustomEvent('neusic:live-loop-track',{detail:{index,state:track.state,muted:track.muted,hasAudio:Boolean(track.buffer),rate:track.rate,reverse:track.reverse}}));
}

function renderAll(){
  for(let index=0;index<5;index++)renderTrack(index);
  if(!looper)return;
  $('masterLength').textContent=format(looper.masterLength);
  $('globalState').textContent=looper.activeRecording?'CAPTURING':looper.playing?'PLAYING':'READY';
  $('playBtn').classList.toggle('active',looper.playing);
  $('playBtn').setAttribute('aria-pressed',String(looper.playing));
  $('playBtn').querySelector('b').textContent=looper.playing?'RUNNING':'START';
}

function updateProgress(){
  if(looper){
    const progress=looper.progress();
    const circumference=270.2;
    document.querySelectorAll('.loop-track').forEach((card,index)=>{
      const track=looper.tracks[index];
      const ring=card.querySelector('.progress-ring');
      const time=card.querySelector('.progress-time');
      const laneProgress=looper.trackProgress(index),laneCycle=looper.masterLength/(track.rate||1);
      if(ring)ring.style.strokeDashoffset=String(circumference*(1-(track.buffer?laneProgress:0)));
      if(time)time.textContent=track.buffer?(laneProgress*laneCycle).toFixed(1):'00.0';
    });
    const level=workspace.meterLevel();
    const masterMeter=$('masterMeter');
    if(masterMeter)masterMeter.style.width=`${level*100}%`;
    window.dispatchEvent(new CustomEvent('neusic:live-loop-progress',{detail:{progress,level}}));
  }
  requestAnimationFrame(updateProgress);
}

function bindGlobal(){
  $('recoverSessionBtn').addEventListener('click',async()=>{
    if(!pendingRecovery)return;
    try{
      await ensureEngine();
      const restored=restoreSession(looper,pendingRecovery);
      $('bpmInput').value=String(looper.bpm);
      $('quantizeToggle').checked=looper.quantize;
      pendingRecovery=null;
      hideRecovery();
      renderAll();
      window.dispatchEvent(new CustomEvent('neusic:live-loop-session-restored'));
      status(`Recovered ${restored} saved lane${restored===1?'':'s'}. Press START when you are ready.`);
    }catch(error){status(error.message||'The saved Live Loop session could not be recovered.');}
  });
  $('discardSessionBtn').addEventListener('click',async()=>{
    try{
      await clearSession();
      pendingRecovery=null;
      hideRecovery();
      status('Saved recovery session discarded.');
    }catch(error){status(error.message||'The saved session could not be discarded.');}
  });
  $('micBtn').addEventListener('click',async()=>{
    try{
      const microphonePromise=primeMicrophoneFromGesture();
      await ensureEngine();
      const stream=await microphonePromise;
      if(stream?.getAudioTracks?.().length)workspace.micStream=stream;
      await workspace.initMic();
      workspace.setMonitor(!$('micBtn').classList.contains('active'));
      $('micBtn').classList.toggle('active');
      $('micBtn').setAttribute('aria-pressed',String($('micBtn').classList.contains('active')));
      status($('micBtn').classList.contains('active')?'Microphone enabled. Use headphones when monitoring.':'Microphone remains available; direct monitoring is muted.');
    }catch(error){status(error.message||'Microphone access failed. Check browser permission and tap MIC again.');}
  });
  $('playBtn').addEventListener('click',async()=>{try{await ensureEngine();looper.playing?looper.stop():looper.start();}catch(error){status(error.message);}});
  $('stopBtn').addEventListener('click',async()=>{try{await ensureEngine();if(looper.activeRecording)await looper.stopRecording();looper.stop();}catch(error){status(error.message);}});
  $('bpmInput').addEventListener('change',async event=>{try{await ensureEngine();looper.setBpm(event.target.value);}catch(error){status(error.message);}});
  $('quantizeToggle').addEventListener('change',async event=>{try{await ensureEngine();looper.setQuantize(event.target.checked);}catch(error){status(error.message);}});
  $('uploadBtn').addEventListener('click',()=>$('fileInput').click());
  $('fileInput').addEventListener('change',async event=>{
    try{await ensureEngine();}catch(error){status(error.message);return;}
    const files=[...event.target.files];
    const targets=planImportTargets(selected,files.length,looper.tracks.length);
    let loaded=0;
    let lastTarget=selected;
    for(let item=0;item<targets.length;item++){
      const file=files[item],target=targets[item];
      try{status(`Decoding ${file.name}…`);await looper.importFile(target,file);loaded++;lastTarget=target;}
      catch(error){console.error(error);status(`${file.name} could not be loaded: ${error.message||'unsupported audio file'}.`);}
    }
    if(loaded){
      selectTrack(lastTarget,{announce:false});
      status(`${loaded} audio file${loaded===1?'':'s'} loaded into distinct loop lanes.${files.length>targets.length?' Only the first five files were accepted.':''}`);
    }
    event.target.value='';
  });
  $('sendSelectedBtn').addEventListener('click',()=>sendTrack(selected).catch(error=>status(error.message)));
  $('downloadSelectedBtn').addEventListener('click',()=>downloadTrack(selected).catch(error=>status(error.message)));
  $('clearAllBtn').addEventListener('click',async()=>{try{await ensureEngine();if(confirm('Clear all five loop tracks?'))looper.clearAll();}catch(error){status(error.message);}});
  $('bypassFxBtn').addEventListener('click',async()=>{try{await ensureEngine();fxBypassed=!fxBypassed;looper.setFxBypass(fxBypassed);$('bypassFxBtn').textContent=fxBypassed?'FX BYPASSED':'FX ACTIVE';}catch(error){status(error.message);}});
  $('reverseBtn').addEventListener('click',async()=>{try{await ensureEngine();looper.reverse(selected);status(`Reverse toggled on track ${selected+1}.`);}catch(error){status(error.message);}});
  $('warpDownBtn').addEventListener('click',async()=>{try{await ensureEngine();looper.halfSpeed(selected);status(`Half-speed tape toggled on track ${selected+1}. Half speed uses an explicit 2× lane cycle.`);}catch(error){status(error.message);}});
  $('freezeBtn').addEventListener('click',async()=>{try{await ensureEngine();spaceFrozen=!spaceFrozen;reverb.freeze(spaceFrozen);$('freezeBtn').classList.toggle('active',spaceFrozen);$('freezeBtn').textContent=spaceFrozen?'RELEASE BOOST':'TAIL BOOST';}catch(error){status(error.message);}});
  const bindRange=(id,handler,formatValue)=>$(id).addEventListener('input',async event=>{
    const value=Number(event.target.value);
    event.target.nextElementSibling.textContent=formatValue(value);
    try{await ensureEngine();handler(value);}catch(error){status(error.message);}
  });
  bindRange('delayTime',value=>delay.setTime(value/1000),value=>`${value}ms`);
  bindRange('delayFeedback',value=>delay.setFeedback(value/100),value=>`${value}%`);
  bindRange('delayMix',value=>delay.setMix(value/100),value=>`${value}%`);
  bindRange('reverbSize',value=>reverb.setSize(value/100),value=>`${(value/100).toFixed(1)}s`);
  bindRange('reverbTone',value=>reverb.setTone(value),value=>`${(value/1000).toFixed(1)}k`);
  bindRange('reverbMix',value=>reverb.setMix(value/100),value=>`${value}%`);
  $('synthWave').addEventListener('change',async event=>{try{await ensureEngine();synth.setWave(event.target.value);}catch(error){status(error.message);}});
  bindRange('synthCutoff',value=>synth.setCutoff(value),value=>`${(value/1000).toFixed(1)}k`);
  bindRange('synthAttack',value=>synth.setAttack(value/100),value=>`${(value/100).toFixed(2)}s`);
  bindRange('synthRelease',value=>synth.setRelease(value/100),value=>`${(value/100).toFixed(2)}s`);
  $('midiBtn').addEventListener('click',async()=>{
    try{await ensureEngine();const count=await midi.enable();$('midiBtn').classList.add('active');status(`MIDI active · ${count} input${count===1?'':'s'} connected.`);}
    catch(error){status(`${error.message} Touch controls remain fully available.`);}
  });
}

function buildKeyboard(){
  const notes=[60,61,62,63,64,65,66,67,68,69,70,71,72];
  const black=new Set([1,3,6,8,10]);
  const labels=['A','W','S','E','D','F','T','G','Y','H','U','J',''];
  const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  notes.forEach((note,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=black.has(note%12)?'key-black':'key-white';
    button.dataset.note=String(note);
    const noteName=`${names[note%12]}${Math.floor(note/12)-1}`;
    button.setAttribute('aria-label',`Play ${noteName}${labels[index]?` · computer key ${labels[index]}`:''}`);
    button.setAttribute('aria-pressed','false');
    button.innerHTML=`<small>${labels[index]||noteName}</small>`;
    let keyboardHeld=false;
    const on=async velocity=>{
      try{await ensureEngine();synth.noteOn(note,velocity);button.classList.add('active');button.setAttribute('aria-pressed','true');}catch(error){status(error.message);}
    };
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      on(105);
    });
    const off=()=>{if(synth)synth.noteOff(note);button.classList.remove('active');button.setAttribute('aria-pressed','false');};
    button.addEventListener('pointerup',off);
    button.addEventListener('pointercancel',off);
    button.addEventListener('pointerleave',event=>{if(event.buttons)off();});
    button.addEventListener('keydown',event=>{
      if((event.key==='Enter'||event.key===' ')&&!keyboardHeld){event.preventDefault();keyboardHeld=true;on(105);}
    });
    button.addEventListener('keyup',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();keyboardHeld=false;off();}
    });
    button.addEventListener('blur',()=>{keyboardHeld=false;off();});
    $('keyboard').appendChild(button);
  });
}

function bindKeyboard(){
  document.addEventListener('keydown',async event=>{
    if(event.target.matches('input,select,textarea,button'))return;
    try{
      await ensureEngine();
      if(event.code==='Space'){event.preventDefault();looper.playing?looper.stop():looper.start();return;}
      if(/^[1-5]$/.test(event.key)){event.preventDefault();await looper.toggleRecord(Number(event.key)-1);return;}
      const note=keyMap[event.key.toLowerCase()];
      if(note!==undefined&&!heldKeys.has(event.key)){heldKeys.add(event.key);synth.noteOn(note,100);document.querySelector(`[data-note="${note}"]`)?.classList.add('active');}
    }catch(error){status(error.message);}
  });
  document.addEventListener('keyup',event=>{
    const note=keyMap[event.key.toLowerCase()];
    if(note!==undefined){heldKeys.delete(event.key);if(synth)synth.noteOff(note);document.querySelector(`[data-note="${note}"]`)?.classList.remove('active');}
  });
}

async function setupEngine(){
  await workspace.init();
  performanceFx=new PerformanceFx(workspace.context);
  await performanceFx.init();
  try{workspace.master.disconnect(workspace.analyser);}catch(_){ }
  workspace.master.connect(performanceFx.input);
  performanceFx.output.connect(workspace.analyser);
  delay=new TapeDelay(workspace.context);
  reverb=new SpatialReverb(workspace.context);
  delay.output.connect(workspace.master);
  reverb.output.connect(workspace.master);
  const scheduler=new LookAheadScheduler(workspace.context);
  looper=new FiveTrackLooper(workspace,scheduler,delay,reverb);
  synth=new PolySynth(workspace.context,workspace.master);
  midi=new MidiRouter({
    record:index=>looper.toggleRecord(index).catch(error=>status(error.message)),
    mute:index=>looper.toggleMute(index),
    volume:(index,value)=>looper.setTrackValue(index,'volume',value),
    transport:()=>looper.playing?looper.stop():looper.start(),
    noteOn:(note,velocity)=>synth.noteOn(note,velocity),
    noteOff:note=>synth.noteOff(note)
  });
  looper.addEventListener('track',event=>{renderTrack(event.detail.index);scheduleSessionSave();});
  looper.addEventListener('change',()=>{renderAll();scheduleSessionSave();});
  looper.addEventListener('transport',renderAll);
  looper.addEventListener('status',event=>status(event.detail.message));
  renderAll();
  window.NeusicLiveLoop={
    workspace,looper,synth,delay,reverb,performanceFx,
    get selectedTrack(){return selected;},
    selectTrack,
    record:index=>looper.toggleRecord(index),
    toggleLoFi:()=>{const enabled=performanceFx.toggleLoFi();status(enabled?'Global lo-fi crusher engaged.':'Global lo-fi crusher released.');return enabled;},
    toggleOctave:()=>{looper.halfSpeed(selected);status(`Half-speed tape toggled on track ${selected+1}. Half speed uses an explicit 2× lane cycle.`);},
    toggleReverse:()=>{looper.reverse(selected);status(`Reverse toggled on track ${selected+1}.`);},
    toggleFreeze:()=>{$('freezeBtn').click();},
    loadSelected:()=>$('fileInput').click(),
    downloadSelected:()=>downloadTrack(selected),
    sendSelected:()=>sendTrack(selected),
    clearSelected:()=>looper.clear(selected),
    state:()=>({ready:true,selected,bpm:looper.bpm,masterLength:looper.masterLength,playing:looper.playing,lofi:performanceFx.lofi,lanes:looper.tracks.map(track=>({name:track.name,state:track.state,hasAudio:Boolean(track.buffer),muted:track.muted,volume:track.volume,pan:track.panValue,rate:track.rate,reverse:track.reverse}))})
  };
  status('Live Loop ready. All five lanes are touch-ready. MIDI is optional.');
  window.dispatchEvent(new CustomEvent('neusic:live-loop-ready'));
  return looper;
}

async function ensureEngine(){
  if(looper){
    if(workspace.context?.state==='suspended')await workspace.resume({required:true});
    return looper;
  }
  if(!enginePromise){
    enginePromise=setupEngine().catch(error=>{
      enginePromise=null;
      console.error(error);
      status(error.message||'Audio could not initialize. Tap MIC or REC to retry.');
      throw error;
    });
  }
  return enginePromise;
}

function boot(){
  document.body.classList.add('stage-performance');
  buildTracks();
  buildKeyboard();
  bindGlobal();
  bindKeyboard();
  renderAll();
  updateProgress();
  status('Five loop lanes are visible. Tap REC on any lane; MIDI is optional.');
  checkRecovery();
  window.dispatchEvent(new CustomEvent('neusic:live-loop-ui-ready',{detail:{lanes:5}}));
}

boot();
