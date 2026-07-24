const DB='neusic-live-loop-session';
const STORE='sessions';
const CURRENT_SESSION='current';
const VERSION=1;

const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function copyBuffer(buffer){
  if(!buffer||buffer.numberOfChannels<1||buffer.length<1||typeof buffer.getChannelData!=='function')return null;
  return{
    numberOfChannels:buffer.numberOfChannels,
    length:buffer.length,
    sampleRate:buffer.sampleRate,
    channels:Array.from({length:buffer.numberOfChannels},(_,channel)=>Float32Array.from(buffer.getChannelData(channel)))
  };
}

function rebuildBuffer(context,saved){
  if(!saved||!Number.isInteger(saved.numberOfChannels)||saved.numberOfChannels<1||
    !Number.isInteger(saved.length)||saved.length<1||!Number.isFinite(saved.sampleRate)||saved.sampleRate<=0||
    !Array.isArray(saved.channels)||saved.channels.length!==saved.numberOfChannels)return null;
  const buffer=context.createBuffer(saved.numberOfChannels,saved.length,saved.sampleRate);
  for(let channel=0;channel<saved.numberOfChannels;channel++){
    const values=saved.channels[channel];
    if(!values||values.length!==saved.length)return null;
    buffer.copyToChannel(Float32Array.from(values),channel);
  }
  return buffer;
}

export function serializeSession(looper,savedAt=Date.now()){
  return{
    id:CURRENT_SESSION,
    version:VERSION,
    savedAt,
    bpm:finite(looper.bpm,112),
    quantize:Boolean(looper.quantize),
    masterLength:Math.max(0,finite(looper.masterLength,0)),
    tracks:looper.tracks.map(track=>({
      name:String(track.name||`LOOP ${track.index+1}`),
      muted:Boolean(track.muted),
      volume:clamp(finite(track.volume,.9),0,1.25),
      panValue:clamp(finite(track.panValue,0),-1,1),
      delay:clamp(finite(track.delay,.22),0,1),
      reverb:clamp(finite(track.reverb,.18),0,1),
      rate:track.rate===.5?.5:1,
      reverse:Boolean(track.reverse),
      buffer:copyBuffer(track.buffer)
    }))
  };
}

export function hasRecoverableAudio(record){
  return Boolean(record&&record.version===VERSION&&Array.isArray(record.tracks)&&
    record.tracks.some(track=>track?.buffer?.length>0&&Array.isArray(track.buffer.channels)&&track.buffer.channels.length>0));
}

export function restoreSession(looper,record){
  if(!record||record.version!==VERSION||!Array.isArray(record.tracks)){
    throw new Error('This saved Live Loop session is not compatible with the current version.');
  }
  looper.stop();
  looper.bpm=clamp(finite(record.bpm,112),40,220);
  looper.quantize=Boolean(record.quantize);
  let restored=0;
  let longest=0;

  looper.tracks.forEach((track,index)=>{
    looper.stopSource(track);
    const saved=record.tracks[index];
    const buffer=rebuildBuffer(looper.context,saved?.buffer);
    track.buffer=buffer;
    track.name=String(saved?.name||`LOOP ${index+1}`);
    track.muted=Boolean(saved?.muted&&buffer);
    track.volume=clamp(finite(saved?.volume,.9),0,1.25);
    track.panValue=clamp(finite(saved?.panValue,0),-1,1);
    track.delay=clamp(finite(saved?.delay,.22),0,1);
    track.reverb=clamp(finite(saved?.reverb,.18),0,1);
    track.rate=saved?.rate===.5?.5:1;
    track.reverse=Boolean(saved?.reverse);
    track.state=buffer?(track.muted?'Muted':'Stopped'):'Empty';
    track.gain.gain.setTargetAtTime(track.muted?0:track.volume,looper.context.currentTime,.01);
    track.pan.pan.setTargetAtTime(track.panValue,looper.context.currentTime,.01);
    track.delaySend.gain.setTargetAtTime(track.delay,looper.context.currentTime,.01);
    track.reverbSend.gain.setTargetAtTime(track.reverb,looper.context.currentTime,.01);
    if(buffer){restored++;longest=Math.max(longest,buffer.duration);}
    looper.emit('track',{index});
  });

  looper.masterLength=restored?Math.max(.05,finite(record.masterLength,longest)||longest):0;
  looper.emit('change');
  return restored;
}

const openDb=()=>new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){
    reject(new Error('Session recovery is unavailable in this browser.'));
    return;
  }
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
    if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('The Live Loop recovery database could not open.'));
});

export async function saveSession(looper){
  const record=serializeSession(looper);
  const db=await openDb();
  try{
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      transaction.objectStore(STORE).put(record);
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error||new Error('Live Loop could not save the recovery session.'));
      transaction.onabort=()=>reject(transaction.error||new Error('Live Loop session saving was cancelled.'));
    });
  }finally{db.close();}
  return record;
}

export async function loadSession(){
  const db=await openDb();
  try{
    return await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readonly');
      const request=transaction.objectStore(STORE).get(CURRENT_SESSION);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error('Live Loop could not read the recovery session.'));
    });
  }finally{db.close();}
}

export async function clearSession(){
  const db=await openDb();
  try{
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      transaction.objectStore(STORE).delete(CURRENT_SESSION);
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error||new Error('Live Loop could not clear the recovery session.'));
    });
  }finally{db.close();}
}
