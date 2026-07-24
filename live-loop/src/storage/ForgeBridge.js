const DB='neusic-forge-bridge';
const STORE='transfers';

const openDb=()=>new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){
    reject(new Error('This browser cannot store a Neusic Wave transfer. Download the WAV instead.'));
    return;
  }
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
    if(!request.result.objectStoreNames.contains(STORE)){
      request.result.createObjectStore(STORE,{keyPath:'id'});
    }
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('The Neusic Wave transfer database could not open.'));
});

function assertAudioBuffer(buffer){
  if(!buffer||!Number.isInteger(buffer.numberOfChannels)||buffer.numberOfChannels<1||
    !Number.isInteger(buffer.length)||buffer.length<1||!Number.isFinite(buffer.sampleRate)||buffer.sampleRate<=0||
    typeof buffer.getChannelData!=='function'){
    throw new TypeError('A valid non-empty audio buffer is required.');
  }
}

export function encodeWav(buffer){
  assertAudioBuffer(buffer);
  const channels=buffer.numberOfChannels;
  const sampleRate=buffer.sampleRate;
  const frames=buffer.length;
  const blockAlign=channels*2;
  const array=new ArrayBuffer(44+frames*blockAlign);
  const view=new DataView(array);
  const write=(offset,text)=>{
    for(let index=0;index<text.length;index++)view.setUint8(offset+index,text.charCodeAt(index));
  };

  write(0,'RIFF');
  view.setUint32(4,36+frames*blockAlign,true);
  write(8,'WAVE');
  write(12,'fmt ');
  view.setUint32(16,16,true);
  view.setUint16(20,1,true);
  view.setUint16(22,channels,true);
  view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*blockAlign,true);
  view.setUint16(32,blockAlign,true);
  view.setUint16(34,16,true);
  write(36,'data');
  view.setUint32(40,frames*blockAlign,true);

  let offset=44;
  for(let frame=0;frame<frames;frame++){
    for(let channel=0;channel<channels;channel++){
      const sample=Math.max(-1,Math.min(1,buffer.getChannelData(channel)[frame]||0));
      view.setInt16(offset,sample<0?sample*0x8000:sample*0x7fff,true);
      offset+=2;
    }
  }
  return array;
}

export async function storeForForge(buffer,name,source='Neusic Live Loop'){
  const wav=encodeWav(buffer);
  const id=`forge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const blob=new Blob([wav],{type:'audio/wav'});
  const record={
    id,
    name:name||'Live Loop Transfer',
    source,
    mime:'audio/wav',
    duration:buffer.duration,
    createdAt:Date.now(),
    blob
  };
  const db=await openDb();
  try{
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      transaction.objectStore(STORE).put(record);
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error||new Error('The Neusic Wave transfer could not be stored.'));
      transaction.onabort=()=>reject(transaction.error||new Error('The Neusic Wave transfer was cancelled.'));
    });
  }finally{
    db.close();
  }
  return id;
}

export async function sendToForge(buffer,name,{beforeNavigate}={}){
  const popup=window.open('about:blank','_blank');
  try{
    const id=await storeForForge(buffer,name);
    const url=new URL('../wave-loom/',location.href);
    url.searchParams.set('forgeTransfer',id);
    url.searchParams.set('source','live-loop');
    if(beforeNavigate)await beforeNavigate();
    if(popup)popup.location.href=url.href;
    else location.href=url.href;
    return id;
  }catch(error){
    try{popup?.close();}catch(_){}
    throw error;
  }
}

export function downloadBuffer(buffer,name='neusic-live-loop.wav'){
  const blob=new Blob([encodeWav(buffer)],{type:'audio/wav'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  return blob;
}
