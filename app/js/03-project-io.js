/* ═══════════════════════════════════════════════
   Project save/load: full JSON serialization incl. AudioBuffer encoding
═══════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════
   PROJECT SAVE / LOAD — full JSON serialization
   AudioBuffers aren't JSON-safe, so every buffer in S.buffers gets encoded to
   a standard 16-bit PCM WAV and base64'd inline into the same JSON file. On
   load we decode each one back with decodeAudioData and re-register it under
   its ORIGINAL bufferId, so every clip.bufferId reference resolves correctly
   without rewriting a single clip.
═══════════════════════════════════════════════════════ */

// AudioBuffer -> WAV (16-bit PCM, interleaved, any channel count) -> base64 string.
function audioBufferToWavBase64(buffer){
  const numCh=buffer.numberOfChannels;
  const sr=buffer.sampleRate;
  const numFrames=buffer.length;
  const bytesPerSample=2;
  const blockAlign=numCh*bytesPerSample;
  const dataSize=numFrames*blockAlign;
  const headerSize=44;
  const ab=new ArrayBuffer(headerSize+dataSize);
  const dv=new DataView(ab);
  const writeStr=(off,str)=>{ for(let i=0;i<str.length;i++)dv.setUint8(off+i,str.charCodeAt(i)); };
  writeStr(0,'RIFF');
  dv.setUint32(4,36+dataSize,true);
  writeStr(8,'WAVE');
  writeStr(12,'fmt ');
  dv.setUint32(16,16,true);          // fmt chunk size
  dv.setUint16(20,1,true);           // PCM
  dv.setUint16(22,numCh,true);
  dv.setUint32(24,sr,true);
  dv.setUint32(28,sr*blockAlign,true); // byte rate
  dv.setUint16(32,blockAlign,true);
  dv.setUint16(34,16,true);          // bits per sample
  writeStr(36,'data');
  dv.setUint32(40,dataSize,true);

  const channels=[];
  for(let c=0;c<numCh;c++) channels.push(buffer.getChannelData(c));
  let off=headerSize;
  for(let i=0;i<numFrames;i++){
    for(let c=0;c<numCh;c++){
      const s=Math.max(-1,Math.min(1,channels[c][i]));
      dv.setInt16(off,s<0?s*0x8000:s*0x7FFF,true);
      off+=2;
    }
  }
  // Chunked base64 conversion — doing this in one giant String.fromCharCode
  // call on a large buffer can blow the call-stack / arg-length limit.
  const bytes=new Uint8Array(ab);
  let binary='';
  const CHUNK=0x8000;
  for(let i=0;i<bytes.length;i+=CHUNK){
    binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+CHUNK));
  }
  return btoa(binary);
}

// base64 WAV string -> decoded AudioBuffer, via the same decodeAudioData path
// used for regular file imports.
async function wavBase64ToAudioBuffer(base64){
  const binary=atob(base64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  const ctx=Audio_.ensure();
  return await ctx.decodeAudioData(bytes.buffer);
}

const PROJECT_FILE_VERSION=1;

// Builds the full JSON-safe project snapshot. Buffer encoding is async (each
// AudioBuffer is encoded synchronously per-buffer, but we yield between them
// so a project with many long recordings doesn't lock up the UI thread).
async function serializeProject(){
  const bufferEntries={};
  const ids=Object.keys(S.buffers);
  for(let i=0;i<ids.length;i++){
    const id=ids[i];
    const entry=S.buffers[id];
    bufferEntries[id]={
      name:entry.name,
      duration:entry.duration,
      wav:audioBufferToWavBase64(entry.buffer),
    };
    if(i%3===2) await new Promise(r=>setTimeout(r,0)); // yield periodically
  }
  return {
    version:PROJECT_FILE_VERSION,
    savedAt:new Date().toISOString(),
    bpm:S.bpm,
    masterVol:S.masterVol,
    trackVol:S.trackVol,
    tracks:S.tracks,
    seqSteps:S.seqSteps,
    automation:S.automation,
    trackFx:S.trackFx,
    recOpts:S.recOpts,
    buffers:bufferEntries,
  };
}

async function saveProjectToFile(){
  toast('Encoding project…');
  let json;
  try{
    const data=await serializeProject();
    json=JSON.stringify(data);
  }catch(e){
    console.error(e);
    toast('Save failed — see console');
    return;
  }
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  a.href=url;
  a.download=`neusic-project-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast('Project saved');
}

function triggerLoadProject(){
  document.getElementById('project-file-input').click();
}

async function loadProjectFromFile(file){
  if(!file)return;
  toast('Loading project…');
  let data;
  try{
    const text=await file.text();
    data=JSON.parse(text);
  }catch(e){
    console.error(e);
    toast('Load failed — not a valid project file');
    return;
  }
  if(!data||!data.tracks){
    toast('Load failed — missing track data');
    return;
  }

  // Stop playback cleanly before tearing anything down.
  if(S.playing) togglePlay();

  Audio_.ensure();

  // Decode every embedded buffer back into a live AudioBuffer and re-register
  // it under its ORIGINAL id, so existing clip.bufferId references just work.
  S.buffers={};
  const entries=Object.entries(data.buffers||{});
  for(const [id,info] of entries){
    try{
      const buf=await wavBase64ToAudioBuffer(info.wav);
      Audio_.registerBuffer(id,buf,info.name);
    }catch(e){
      console.error('Failed to decode buffer',id,e);
    }
  }

  // Replace core project state.
  S.bpm=data.bpm??120;
  S.masterVol=data.masterVol??0.85;
  S.trackVol=data.trackVol||{};
  S.tracks=data.tracks||[];
  S.seqSteps=data.seqSteps||{};
  S.automation=data.automation||{};
  S.trackFx=data.trackFx||{};
  S.recOpts=Object.assign({metronome:true,countIn:false,overdub:false,loop:false},data.recOpts||{});

  // Reset transport/undo state — loading a project starts a fresh editing session.
  S.undoStack=[];S.redoStack=[];
  S.selectedClip=null;
  rewind(); // also re-anchors the clock at sec=0

  // Re-sync the live audio graph from the freshly-loaded state. Tear down
  // every per-track node registry first — if the new project reuses a track
  // id from the previous one, we don't want it inheriting stale gain/pan/
  // filter/FX state left over from before the load.
  Object.values(Audio_.trackGains).forEach(n=>{ try{n.disconnect();}catch(e){} });
  Object.values(Audio_.trackPanners).forEach(n=>{ try{n.disconnect();}catch(e){} });
  Object.values(Audio_.trackFilters).forEach(n=>{ try{n.disconnect();}catch(e){} });
  Audio_.trackGains={};
  Audio_.trackPanners={};
  Audio_.trackFilters={};
  Audio_.trackDry={};
  Audio_.trackFxChainInput={};
  Audio_.trackFxNodes={};
  S.tracks.forEach(t=>{ Audio_.rebuildTrackFxRack(t.id); Audio_.refreshTrackGain(t.id); });
  Audio_.setMasterVol(S.masterVol);

  document.getElementById('bpm-disp').textContent=S.bpm;
  renderTracks();
  buildSidebar();
  buildOv();
  updateUndoBadges();
  rebuildDrawer(S.activePanel);

  toast(`Project loaded — ${S.tracks.length} tracks`);
}


function snapshot(){ S.undoStack.push(JSON.stringify({tracks:S.tracks,seqSteps:S.seqSteps})); if(S.undoStack.length>50) S.undoStack.shift(); S.redoStack=[]; updateUndoBadges(); }
function undo(){
  if(!S.undoStack.length){toast('Nothing to undo');return;}
  S.redoStack.push(JSON.stringify({tracks:S.tracks,seqSteps:S.seqSteps}));
  const st=JSON.parse(S.undoStack.pop());
  S.tracks=st.tracks; S.seqSteps=st.seqSteps;
  renderTracks(); buildSidebar(); updateUndoBadges(); Audio_.refreshAllTrackGains(); if(S.playing)applyAllTrackAutomation(); toast('Undo');
}
function redo(){
  if(!S.redoStack.length){toast('Nothing to redo');return;}
  S.undoStack.push(JSON.stringify({tracks:S.tracks,seqSteps:S.seqSteps}));
  const st=JSON.parse(S.redoStack.pop());
  S.tracks=st.tracks; S.seqSteps=st.seqSteps;
  renderTracks(); buildSidebar(); updateUndoBadges(); Audio_.refreshAllTrackGains(); if(S.playing)applyAllTrackAutomation(); toast('Redo');
}
function updateUndoBadges(){
  const ub=document.getElementById('undo-badge'),rb=document.getElementById('redo-badge');
  ub.style.display=S.undoStack.length?'flex':'none'; ub.textContent=S.undoStack.length;
  rb.style.display=S.redoStack.length?'flex':'none'; rb.textContent=S.redoStack.length;
}
