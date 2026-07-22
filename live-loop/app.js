import {workspace} from './src/audio/AudioWorkspace.js';
import {LookAheadScheduler} from './src/audio/Scheduler.js';
import {TapeDelay} from './src/audio/effects/TapeDelay.js';
import {SpatialReverb} from './src/audio/effects/SpatialReverb.js';
import {PerformanceFx} from './src/audio/effects/PerformanceFx.js';
import {PolySynth} from './src/audio/instruments/Synth.js';
import {MidiRouter} from './src/midi/MidiRouter.js';
import {FiveTrackLooper,STATES} from './src/audio/Looper.js';
import {sendToForge,downloadBuffer} from './src/storage/ForgeBridge.js';

const $=id=>document.getElementById(id);
const trackGrid=$('trackGrid');
const template=$('trackTemplate');
const keyMap={a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71};
const heldKeys=new Set();

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

// Lazy initialization engine wrapper to avoid memory leaks
function ensureEngine() {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    status("Initializing audio engine...");
    await workspace.init();
    
    // Instantiate core modules
    delay = new TapeDelay(workspace.context);
    reverb = new SpatialReverb(workspace.context);
    performanceFx = new PerformanceFx(workspace.context);
    synth = new PolySynth(workspace.context);
    looper = new FiveTrackLooper(workspace.context);
    midi = new MidiRouter();

    // Connect audio node graph routing
    looper.connect(delay);
    synth.connect(delay);
    delay.connect(reverb);
    reverb.connect(performanceFx);
    performanceFx.connect(workspace.destination);

    // Set up state listeners
    looper.onStateChange = () => renderAll();
    
    status("Audio engine ready.");
    return looper;
  })();
  return enginePromise;
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
    status(error.message||'The device could not start this lane.');
  }finally{
    delete button.dataset.recordBusy;
  }
}

function buildTracks(){
  console.log('🔧 buildTracks called');
  if(!trackGrid){console.error('❌ trackGrid not found!');return;}
  if(!template){console.error('❌ template not found!');return;}
  trackGrid.innerHTML='';
  
  for(let index=0;index<5;index++){
    const card=template.content.firstElementChild.cloneNode(true);
    card.classList.add('mobile-active');
    card.dataset.index=String(index);
    card.querySelector('.track-number').textContent=String(index+1).padStart(2,'0');
    card.querySelector('.track-name').textContent=`LOOP ${index+1}`;
    
    card.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',async event=>{
      event.stopPropagation();
      await handleTrackAction(index,button.dataset.action);
    }));
    
    // FIX: Combined unified pointer pointer down strategy preventing multi-trigger race conditions
    const recordButton=card.querySelector('[data-action="record"]');
    const handleRecordTrigger = (event) => {
      event.preventDefault();
      event.stopPropagation();
      startRecordFromGesture(index,recordButton);
    };
    
    recordButton.addEventListener('pointerdown', handleRecordTrigger, {passive:false});

    card.querySelectorAll('[data-control]').forEach(input=>input.addEventListener('input',async()=>{
      const key=input.dataset.control;
      const raw=Number(input.value);
      // Ensure absolute raw translation boundaries match your slider limits (e.g. pan vs gain)
      const value = key === 'pan' ? raw : raw / 100;
      
      const outputLabel = input.nextElementSibling;
      if (outputLabel) outputLabel.textContent=outputFor(key,value);
      
      try{
        await ensureEngine();
        if(looper) looper.setTrackValue(index,key,value);
      }catch(error){
        status(error.message||'Audio adjustment failed.');
      }
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
    if(!looper) return;
    if(action==='mute')looper.toggleMute(index);
    if(action==='clear')looper.clear(index);
    if(action==='upload'){
      const fileInput = $('fileInput');
      if(fileInput) fileInput.click();
    }
    if(action==='forge')await sendTrack(index);
  }catch(error){
    console.error(error);
    status(error.message||'That action could not be completed.');
  }
}

async function sendTrack(index){
  await ensureEngine();
  if(!looper) return;
  const track=looper.tracks[index];
  if(!track || !track.buffer){status('Record or load audio into this track before sending it to Wave.');return;}
  status(`Preparing ${track.name} for Neusic Wave…`);
  await sendToForge(track.buffer,`${track.name} · Live Loop`);
  status(`${track.name} was sent to Neusic Wave.`);
}

function renderTrack(index){
  const card=trackGrid.querySelector(`[data-index="${index}"]`);
  if(!card)return;
  if(!looper){
    card.dataset.state=STATES?.EMPTY || 'empty';
    const stateEl = card.querySelector('.track-state');
    if(stateEl) stateEl.textContent='READY';
    return;
  }
  const track=looper.tracks[index];
  if(!track) return;
  
  card.dataset.state=track.state;
  card.querySelector('.track-name').textContent=track.name;
  card.querySelector('.track-state').textContent=track.state.toUpperCase();
  
  const record=card.querySelector('[data-action="record"]');
  if(record) {
    record.textContent=track.state===STATES.QUEUED?'CANCEL':track.state===STATES.RECORDING||track.state===STATES.OVERDUBBING?'STOP':track.buffer?'OVERDUB':'REC';
  }
  
  const muteBtn = card.querySelector('[data-action="mute"]');
  if(muteBtn) muteBtn.textContent=track.muted?'UNMUTE':'MUTE';
  
  const forgeBtn = card.querySelector('[data-action="forge"]');
  if(forgeBtn) forgeBtn.disabled=!track.buffer;
  
  const clearBtn = card.querySelector('[data-action="clear"]');
  if(clearBtn) clearBtn.disabled=!track.buffer;
  
  window.dispatchEvent(new CustomEvent('neusic:live-loop-track',{detail:{index,state:track.state,muted:track.muted,hasAudio:Boolean(track.buffer),rate:track.rate,reverse:track.reverse}}));
}

function renderAll(){
  for(let index=0;index<5;index++)renderTrack(index);
  if(!looper)return;
  
  const masterLengthEl = $('masterLength');
  if(masterLengthEl) masterLengthEl.textContent=format(looper.masterLength);
  
  const globalStateEl = $('globalState');
  if(globalStateEl) globalStateEl.textContent=looper.activeRecording?'CAPTURING':looper.playing?'PLAYING':'READY';
  
  const playBtn = $('playBtn');
  if(playBtn) {
    playBtn.classList.toggle('active',looper.playing);
    const boldText = playBtn.querySelector('b');
    if(boldText) boldText.textContent=looper.playing?'RUNNING':'START';
  }
}

function updateProgress(){
  if(looper){
    const progress=looper.progress();
    const circumference=270.2;
    document.querySelectorAll('.loop-track').forEach((card,index)=>{
      const track=looper.tracks[index];
      if(!track) return;
      const ring=card.querySelector('.progress-ring');
      const time=card.querySelector('.progress-time');
      if(ring) ring.style.strokeDashoffset=String(circumference*(1-(track.buffer?progress:0)));
      if(time) time.textContent=track.buffer?(progress*looper.masterLength).toFixed(1):'00.0';
    });
    const level=workspace.meterLevel ? workspace.meterLevel() : 0;
    const masterMeter = $('masterMeter');
    if(masterMeter) masterMeter.style.width=`${level*100}%`;
