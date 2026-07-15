(() => {
  'use strict';
  if (window.__neusicWaveTransferReceiver) return;
  window.__neusicWaveTransferReceiver = true;

  const transferId = new URLSearchParams(location.search).get('waveTransfer');
  if (!transferId || !window.indexedDB) return;
  const DB_NAME='neusic-wave-loom-v3';
  const DB_VERSION=3;
  const STORE='studioTransfers';

  function status(message,type=''){
    let panel=document.getElementById('waveTransferStatus');
    if(!panel){panel=document.createElement('div');panel.id='waveTransferStatus';panel.style.cssText='position:fixed;z-index:100003;left:50%;top:18px;transform:translateX(-50%);max-width:min(520px,calc(100vw - 28px));padding:10px 14px;border:1px solid #806332;border-radius:6px;background:#090d0ff2;color:#e9edf0;box-shadow:0 16px 45px #000b;font:700 10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;text-align:center';document.body.appendChild(panel);}panel.textContent=message;panel.style.borderColor=type==='error'?'#9b3f4a':'#806332';if(type!=='loading')setTimeout(()=>panel.remove(),7000);
  }

  function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function getTransfer(id){const db=await openDb();const value=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return value;}
  async function removeTransfer(id){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}

  function waitForStudio(frame,timeout=18000){return new Promise((resolve,reject)=>{const started=Date.now();const inspect=()=>{try{const win=frame.contentWindow,bridge=win?.__NeusicStudioBridge;if(bridge?.Audio_&&bridge?.S&&typeof bridge.renderTracks==='function'&&typeof bridge.secToBeat==='function')return resolve({win,bridge});}catch(_){}if(Date.now()-started>timeout)return reject(new Error('Classic Studio did not expose its audio workspace.'));setTimeout(inspect,90);};if(frame.contentDocument?.readyState==='complete')inspect();else frame.addEventListener('load',inspect,{once:true});setTimeout(inspect,120);});}

  function buildBuffer(bridge,pcm){
    if(!pcm?.channels?.length)throw new Error('The Wave Loom transfer contains no PCM audio.');
    const ctx=bridge.Audio_.ensure();
    const channels=pcm.channels.map(channel=>new Float32Array(channel));
    const length=Math.max(1,...channels.map(channel=>channel.length));
    const buffer=ctx.createBuffer(Math.max(1,channels.length),length,pcm.sampleRate||ctx.sampleRate);
    channels.forEach((channel,index)=>buffer.copyToChannel(channel.subarray(0,length),index));
    return buffer;
  }

  function uniqueTrackId(bridge){return Math.max(0,...bridge.S.tracks.map(track=>Number(track.id)||0))+1;}

  function importIntoStudio(win,bridge,record){
    const buffer=buildBuffer(bridge,record.pcm);
    const bufferId=`wave_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    bridge.Audio_.registerBuffer(bufferId,buffer,record.name||'Wave Loom Audio');
    bridge.snapshot?.();
    const id=uniqueTrackId(bridge);
    const color=(bridge.COLORS&&bridge.COLORS[(id-1)%bridge.COLORS.length])||'#29f3ff';
    const track={id,name:record.name||`Wave Loom ${id}`,icon:'≈',color,type:'audio',m:false,s:false,arm:false,clips:[{id:`wave_clip_${Date.now()}`,start:0,len:Math.max(.25,bridge.secToBeat(buffer.duration)),label:record.name||'Wave Loom Audio',bufferId,wavePatch:record.patch||null,waveMetadata:{tempo:record.tempo,root:record.root,scale:record.scale,slices:record.slices||[],...(record.metadata||{})}}]};
    bridge.S.tracks.push(track);
    bridge.S.activeTrack=bridge.S.tracks.length-1;
    bridge.S.trackVol[id]=.85;
    bridge.S.trackFx[id]=[{type:'compressor',on:true,wet:.35}];
    bridge.renderTracks();
    bridge.Audio_.refreshAllTrackGains?.();
    bridge.toast?.(`${track.name} imported from Wave Loom`);
    win.NeusicWaveTransfer={record,trackId:id,bufferId};
    return track;
  }

  (async()=>{
    status('Receiving Wave Loom audio…','loading');
    try{
      const record=await getTransfer(transferId);
      if(!record?.pcm)throw new Error('This Wave Loom transfer is missing or has expired.');
      const frame=document.getElementById('studio');
      if(!frame)throw new Error('The Studio frame is unavailable.');
      const {win,bridge}=await waitForStudio(frame);
      const track=importIntoStudio(win,bridge,record);
      await removeTransfer(transferId);
      const url=new URL(location.href);url.searchParams.delete('waveTransfer');url.searchParams.delete('source');history.replaceState({},'',url);
      status(`${track.name} was added as a real audio track in Classic Studio.`);
    }catch(error){console.error(error);status(error.message||'Wave Loom audio could not be imported.','error');}
  })();
})();