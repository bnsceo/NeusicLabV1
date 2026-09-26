import {uid, clamp, newProject, makeAsset, makeTrack, makeClip, duration, beatsToSeconds, secondsToBeats, transferLanes, detectSlices, equalSlices, renderSlice, renderSequence, mixLane, encodeWav, validateProject} from './model.js';
import {ProjectStore} from './store.js';
import {SuiteAudio} from './audio.js';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format = n => Number(n).toFixed(3);
const db = new ProjectStore(), audio = new SuiteAudio();
let project = newProject(), assets = new Map(), view = 'live', selectedLane = 0, selectedSlice = 0, selectedTrack = 0, selectedClip = null;
let history = [], future = [], saveTimer, saveChain = Promise.resolve(), sequenceRecording = false, sequenceEpoch = 0, sequenceAsset = null;
let zoom = 10, cursorBeat = 0, importTarget = null, recordingLane = null, busy = false, activeScene = null;
const padKeys = '1234qwerasdfzxcv';
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
async function run(fn) { try { await fn(); } catch (error) {console.error(error); status(error.message || 'Action failed.', true);} }
function checkpoint() { history.push(structuredClone(project)); if (history.length > 40) history.shift(); future = []; }
function changed(message, redraw = true) {
  project.updatedAt = Date.now(); scheduleSave(); if (message) status(message); if (redraw) render();
}
function ensureIdle() {if (audio.captureJob || sequenceRecording || busy || recordingLane !== null) throw new Error('Finish the active recording or operation first.');}
function scheduleSave() {clearTimeout(saveTimer); $('save-state').textContent = 'SAVING…'; saveTimer = setTimeout(saveNow, 450);}
function saveNow() {
  clearTimeout(saveTimer); const snapshot = structuredClone(project), audioAssets = new Map(assets);
  saveChain = saveChain.catch(() => {}).then(() => db.save(snapshot, audioAssets)).then(() => {$('save-state').textContent = 'SAVED ON THIS DEVICE';}).catch(error => {$('save-state').textContent = 'SAVE FAILED'; status(`Local save failed: ${error.message}. Download Save project now.`, true);});
  return saveChain;
}
function download(blob, name) {const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);}
function wavDownload(asset, name = asset.name) {download(new Blob([encodeWav(asset)], {type:'audio/wav'}), `${name.replace(/[^\w .-]/g, '_')}.wav`);}
function stopTransport() {sequenceRecording = false; audio.stop(); render();}
function switchView(next) {
  if (audio.captureJob || recordingLane !== null || sequenceRecording || busy) {status('Finish this recording or operation before changing workspace.'); return;}
  audio.stop(); view = ['live','loom','studio'].includes(next) ? next : 'live'; location.hash = view; render();
}
function waveform(id, color, extra = '') {return `<canvas class="waveform" data-asset="${esc(id || '')}" data-color="${color}" ${extra} aria-hidden="true"></canvas>`;}
function range(control, value, min, max, step, label, output, scope = 'lane') {
  return `<div class="control"><label>${label}<input type="range" data-control="${control}" data-scope="${scope}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"></label><output>${output}</output></div>`;
}
function liveHTML() {
  const lane = project.lanes[selectedLane], hasAudio = project.lanes.some(l => l.layers.length);
  return `<div class="live-layout"><div class="live-main">
    <div class="loop-ruler"><span>INDEPENDENT LOOP LAYERS</span><div class="ruler-numbers">${Array.from({length:project.loopBars + 1},(_,i)=>`<span>${i+1}</span>`).join('')}</div><span style="text-align:right">${project.loopBars} BARS</span></div>
    ${project.lanes.map((l,i)=>`<article class="lane ${i===selectedLane?'selected':''} ${recordingLane===i?'recording-lane':''}" style="--lane:${l.color}" data-lane="${i}" tabindex="0" aria-label="${esc(l.name)} loop lane">
      <div class="lane-head"><div class="lane-title"><i class="lane-dot"></i>${esc(l.name.toUpperCase())}</div><div class="lane-buttons"><button class="record" data-action="record-lane" data-index="${i}" title="Record a separate take on ${esc(l.name)}" aria-label="Record ${esc(l.name)}">●</button><button data-action="mute-lane" data-index="${i}" aria-pressed="${l.muted}" title="Mute ${esc(l.name)}">M</button><button data-action="solo-lane" data-index="${i}" aria-pressed="${l.solo}" title="Solo ${esc(l.name)}">S</button></div></div>
      <div class="lane-wave">${l.layers.length?waveform(l.layers.at(-1),l.color):'<div class="empty-wave">Record or import a sound</div>'}<i class="loop-playhead"></i></div><div class="lane-meta"><span>${recordingLane===i?'CAPTURING':l.layers.length?`${l.layers.length} TAKE${l.layers.length>1?'S':''}`:'EMPTY'}</span><input aria-label="${esc(l.name)} volume" data-lane-volume="${i}" type="range" min="0" max="1.2" step=".01" value="${l.volume}"></div></article>`).join('')}
    <section class="inspector"><div class="inspector-heading"><div><h2>${esc(lane.name.toUpperCase())}</h2><p>${lane.layers.length} independent take${lane.layers.length===1?'':'s'} · ${project.loopBars} bars · overdubs preserve every original</p></div><button class="small" data-action="import-lane">＋ Load audio</button></div>
    <div class="inspector-controls"><div class="record-large"><button data-action="record-lane" data-index="${selectedLane}" aria-label="${lane.layers.length?'Overdub':'Record'} selected lane">●</button><div><strong>${recordingLane!==null?'CANCEL TAKE':lane.layers.length?'RECORD / OVERDUB':'RECORD FIRST TAKE'}</strong><p>Starts on the loop boundary<br>Use headphones to avoid feedback</p></div></div>
    ${range('volume',lane.volume,0,1.2,.01,'Volume',`${(20*Math.log10(lane.volume || .00001)).toFixed(1)} dB`)}${range('pan',lane.pan,-1,1,.01,'Pan',lane.pan===0?'C':`${Math.abs(Math.round(lane.pan*100))}${lane.pan<0?'L':'R'}`)}${range('tone',lane.tone,-12,12,.5,'High-shelf EQ',`${lane.tone} dB`)}</div>
    <div class="take-list">${lane.layers.length?lane.layers.map((id,i)=>`<button data-action="take-to-loom" data-id="${id}" title="Send only this take to Wave Loom">Take ${i+1} → Wave Loom</button>`).join('')+'<button class="danger" data-action="remove-take">Undo last take</button>':'<span class="empty-inline">Your first recording appears here. Nothing is preloaded or simulated.</span>'}</div></section>
    ${!hasAudio?'<div class="empty-state"><p>Start with your voice, an instrument, or an audio file. Want to explore the full workflow first?</p><button data-action="demo">Load synthesized demo session</button></div>':''}
    </div><aside class="live-side"><section class="side-section"><h3>SCENES</h3><p>Recall layer mutes and levels</p><div class="scenes">${['A','B','C'].map(key=>`<div class="scene"><button data-action="scene-launch" data-key="${key}" class="${activeScene===key?'active':''}" ${!project.scenes[key]?'disabled':''}>${key}</button><button data-action="scene-save" data-key="${key}">${project.scenes[key]?'Update':'Save'} ${key}</button></div>`).join('')}</div></section>
    <section class="side-section"><h3>SELECTED LANE EFFECTS</h3><div class="effect-card"><h3>● DELAY · 1/8</h3>${range('delay',lane.delay,0,.6,.01,'Send',`${Math.round(lane.delay*100)}%`)}</div><div class="effect-card"><h3>● REVERB · ROOM</h3>${range('reverb',lane.reverb,0,.6,.01,'Send',`${Math.round(lane.reverb*100)}%`)}</div></section>
    <div class="destinations"><button class="primary" data-action="lane-to-loom" ${!lane.layers.length?'disabled':''}>SEND TO WAVE LOOM <span class="arrow">›</span><span class="sub">Sample this lane · originals kept</span></button><button data-action="live-to-studio" ${!hasAudio?'disabled':''}>SEND TO STUDIO <span class="arrow">›</span><span class="sub">All lanes · every take stays separate</span></button><button data-action="performance" class="${audio.performance?'performance-on':''}">${audio.performance?'■ FINISH PERFORMANCE':'● CAPTURE PERFORMANCE'}<span class="sub">Record your live arrangement to WAV</span></button><button data-action="export-loop" ${!hasAudio?'disabled':''}>EXPORT LOOP MIX<span class="sub">Current loop + effects · stereo WAV</span></button></div><p class="live-hint">One project. Return here at any time to make more sounds. Save project includes every original take.</p></aside></div>`;
}
function loomHTML() {
  const asset = assets.get(project.loom.assetId), slices = project.loom.slices, slice = slices[selectedSlice];
  if (!asset) return `<div class="empty-state" style="min-height:65vh"><span class="eyebrow">WAVE LOOM / YOUR SOUND, REIMAGINED</span><h2>Turn a sound into an instrument.</h2><p>Send a lane or one take from Live Loop, or import audio here. Detect its transients, adjust the slices, and play them across 16 pads.</p><div><button class="primary" data-view="live">← Live Loop</button><button data-action="import-loom">Import a sample</button></div></div>`;
  return `<section class="loom-top"><div class="source-title"><small>SOURCE · ${asset.origin==='import'?'AUDIO IMPORT':'LIVE LOOP'}</small><h2>${esc(asset.name)}</h2><p>${duration(asset).toFixed(2)} s · ${asset.sampleRate/1000} kHz · ${slices.length} slices · original preserved</p></div><button data-action="detect">DETECT TRANSIENTS</button><label>SENSITIVITY<input aria-label="Transient sensitivity" type="range" min=".05" max=".95" step=".05" value="${project.loom.sensitivity}" data-sensitivity></label><button class="small" data-action="equal">16 equal slices</button><button class="small" data-action="import-loom">Import</button></section>
    <section class="loom-wave-container"><div class="time-ruler">${Array.from({length:9},(_,i)=>`<span>${(duration(asset)*i/8).toFixed(3)} s</span>`).join('')}</div><div class="slice-wave" id="slice-wave">${waveform(asset.id,'#32cce2')}${slice?`<div class="slice-selection" style="left:${slice.start/duration(asset)*100}%;width:${(slice.end-slice.start)/duration(asset)*100}%"></div>`:''}${slices.map((s,i)=>`<button class="slice-marker ${i===selectedSlice?'selected':''}" data-marker="${i}" style="left:${s.start/duration(asset)*100}%" aria-label="Slice ${i+1} start; drag to edit" title="Drag slice ${i+1} boundary"><span>${i+1}</span></button>`).join('')}</div></section>
    <div class="loom-middle"><section class="pad-section"><div class="section-heading"><h3>SAMPLE PADS · ${slices.length} SLICES</h3><span class="choke-label">CHOKE ON · ONE VOICE</span></div><div class="pads">${Array.from({length:16},(_,i)=>`<button class="pad ${i===selectedSlice?'active':''} ${slices[i]?'':'empty'}" data-pad="${i}" ${!slices[i]?'disabled':''} aria-label="Play pad ${i+1}"><span>${String(i+1).padStart(2,'0')}</span><span class="pad-key">${padKeys[i].toUpperCase()}</span>${slices[i]?waveform(asset.id,'#b897f1',`data-start="${slices[i].start}" data-end="${slices[i].end}"`):''}</button>`).join('')}</div><p class="loom-hint">Play with touch, mouse, or keys 1–4 / Q–R / A–F / Z–V. Each pad cuts off the previous one.</p></section>
    <section class="slice-inspector"><div class="section-heading"><h3>SLICE EDITOR · PAD ${String(selectedSlice+1).padStart(2,'0')}</h3><button class="small" data-action="audition">▶ Audition</button></div>${slice?`<div class="slice-detail-wave">${waveform(asset.id,'#39cfe4',`data-start="${slice.start}" data-end="${slice.end}"`)}</div><div class="slice-controls"><label class="control">START · SECONDS<input data-slice="start" aria-label="Slice start in seconds" type="number" step=".001" min="0" max="${slice.end-.005}" value="${format(slice.start)}"></label><label class="control">END · SECONDS<input data-slice="end" aria-label="Slice end in seconds" type="number" step=".001" min="${slice.start+.005}" max="${duration(asset)}" value="${format(slice.end)}"></label>${range('pitch',slice.pitch,-12,12,1,'Pitch',`${slice.pitch} st`,'slice')}${range('gain',slice.gain,0,2,.01,'Gain',`${(20*Math.log10(slice.gain||.00001)).toFixed(1)} dB`,'slice')}</div><p class="pitch-note">Trim and gain are non-destructive. Pitch uses playback rate: pitch changes also change slice duration.</p>`:''}</section></div>
    <section class="sequence-section"><div><div class="sequence-toolbar"><h3>PAD SEQUENCE · ${project.loom.bars} BARS · ${project.bpm} BPM</h3><button class="record ${sequenceRecording?'active':''}" data-action="sequence-record">${sequenceRecording?'■ Finish':'● Record pads'}</button><button data-action="sequence-play" ${!project.loom.events.length?'disabled':''}>▶ Play</button><button data-action="sequence-clear" ${!project.loom.events.length?'disabled':''}>Clear</button><select id="sequence-bars" aria-label="Pad sequence bars">${[1,2,4,8].map(n=>`<option value="${n}" ${n===project.loom.bars?'selected':''}>${n} bars</option>`).join('')}</select></div><div class="sequence-grid">${project.loom.events.length?project.loom.events.map(e=>{const i=slices.findIndex(s=>s.id===e.sliceId);return `<i class="sequence-note" style="left:${e.beat/(project.loom.bars*4)*100}%;top:${8+i*5.5}px;width:2%"></i>`;}).join(''):'<div class="empty-inline">Record pads to build a rhythm · 1/16-note quantization</div>'}</div><p class="loom-hint">New pad recordings replace the current pattern. Undo restores the previous one.</p></div><div class="sequence-destinations"><button class="primary" data-action="sequence-to-studio" ${!project.loom.events.length?'disabled':''}>SEND PAD SEQUENCE TO STUDIO<span class="sub">Create an audio clip · pattern preserved</span></button><button data-action="slices-to-studio">SEND SLICES TO STUDIO<span class="sub">Add ${slices.length} sounds to Project Sounds</span></button><button data-view="live">← BACK TO LIVE LOOP<span class="sub">Keep creating in this project</span></button></div></section>`;
}
function clipSelection() {
  for (const track of project.tracks) {const clip = track.clips.find(c=>c.id===selectedClip); if (clip) return {track,clip};} return null;
}
function studioHTML() {
  const total = Math.max(project.songBeats, ...project.tracks.flatMap(t=>t.clips.map(c=>Math.ceil((c.beat+c.length)/4)*4)));
  const selected = clipSelection(), track = project.tracks[selectedTrack];
  return `<div class="studio-layout"><aside class="browser"><h3>PROJECT SOUNDS</h3><button class="destination" data-view="live">＋ ADD FROM LIVE LOOP</button><button class="destination" data-view="loom">＋ ADD FROM WAVE LOOM</button><div class="browser-label">LIVE LOOP · ORIGINAL TAKES</div>${project.lanes.flatMap(l=>l.layers.map((id,i)=>`<button data-add-asset="${id}" draggable="true" data-drag-asset="${id}">${esc(l.name)} · Take ${i+1}<span>＋ add to timeline at playhead</span></button>`)).join('')||'<p class="empty-inline">No recordings yet</p>'}<div class="browser-label">WAVE LOOM · SAMPLES & PATTERNS</div>${project.samples.map(id=>`<button data-add-asset="${id}" draggable="true" data-drag-asset="${id}">${esc(assets.get(id)?.name || 'Sample')}<span>＋ add to timeline at playhead</span></button>`).join('')||'<p class="empty-inline">Send slices or a pad sequence here</p>'}</aside>
    <div class="studio-main"><div class="arrange-toolbar"><h3>SONG ARRANGEMENT</h3><label>ZOOM<input id="zoom" type="range" min="6" max="30" step="1" value="${zoom}" aria-label="Timeline zoom"></label><button data-action="add-track">＋ Track</button><button data-action="import-studio">Import audio</button><button class="primary" data-action="export-song" ${!project.tracks.some(t=>t.clips.length)?'disabled':''}>EXPORT WAV ↓</button></div>
    <div class="timeline-scroll"><div class="timeline-content" style="--timeline-width:${total*zoom}px;--beat-width:${zoom*4}px"><div class="timeline-ruler"><div class="timeline-corner">BAR / BEAT · 1/4 SNAP</div><div class="bar-ruler" id="bar-ruler">${Array.from({length:Math.ceil(total/4)},(_,i)=>`<span class="bar-number" style="left:${i*4*zoom+4}px">${i+1}</span>`).join('')}${project.sections.map((s,i)=>`<span class="section-label" style="left:${s.beat*zoom}px;width:${((project.sections[i+1]?.beat??total)-s.beat)*zoom}px">${esc(s.name.toUpperCase())}</span>`).join('')}</div></div>
    ${project.tracks.length?project.tracks.map((t,i)=>`<div class="timeline-row" data-track="${i}" style="--track:${t.color}"><div class="track-header"><strong>${i+1} &nbsp; ${esc(t.name)}</strong><div><button data-action="mute-track" data-index="${i}" aria-pressed="${t.muted}" aria-label="Mute ${esc(t.name)}">M</button><button data-action="solo-track" data-index="${i}" aria-pressed="${t.solo}" aria-label="Solo ${esc(t.name)}">S</button></div></div><div class="track-lane" data-drop-track="${i}">${t.clips.map((c,j)=>`<div class="clip ${c.id===selectedClip?'selected':''}" tabindex="0" role="button" aria-label="${esc(c.name)}, beat ${c.beat+1}; select to edit" data-clip="${c.id}" style="left:${c.beat*zoom}px;width:${Math.max(10,c.length*zoom-2)}px;${t.clips.some((other,k)=>k<j && other.beat===c.beat)?`top:${7+j%3*3}px;`:''}"><span>${esc(c.name)}</span>${waveform(c.assetId,t.color)}</div>`).join('')}</div></div>`).join(''):'<div class="empty-state studio-empty"><h2>Your song starts here.</h2><p>Send your layers from Live Loop, play a pattern in Wave Loom, or import audio. Drag clips into your arrangement and shape the mix below.</p></div>'}<div class="song-playhead" id="song-playhead"></div></div></div>
    <div class="clip-inspector">${selected?`<strong>${esc(selected.clip.name)}</strong><label>START · BEAT<input data-clip-edit="beat" type="number" step=".25" min="0" value="${selected.clip.beat}" aria-label="Clip start beat"></label><label>LENGTH · BEATS<input data-clip-edit="length" type="number" step=".25" min=".25" max="512" value="${selected.clip.length.toFixed(2)}" aria-label="Clip length in beats"></label><label>SOURCE OFFSET · S<input data-clip-edit="offset" type="number" step=".01" min="0" max="${duration(assets.get(selected.clip.assetId))}" value="${selected.clip.offset.toFixed(2)}" aria-label="Clip source offset"></label><button data-action="duplicate-clip">Duplicate</button><button data-action="split-clip">Split at playhead</button><button class="danger" data-action="delete-clip">Delete clip</button>`:'<span class="empty-inline">Drag clips to move them. Tap a clip to edit; click the ruler to seek. All changes preserve source recordings.</span>'}</div>
    <section class="mixer" aria-label="Mixer">${project.tracks.map((t,i)=>`<div class="channel" style="--track:${t.color}"><span class="channel-name">${esc(t.name)}</span><input aria-label="${esc(t.name)} mixer volume" data-track-volume="${i}" type="range" min="0" max="1.2" step=".01" value="${t.volume}"><output>${(20*Math.log10(t.volume||.00001)).toFixed(1)} dB</output><button data-action="select-track" data-index="${i}" class="${i===selectedTrack?'active':''}">EFFECTS</button></div>`).join('')}<div class="mix-inspector">${track?`<h3>${esc(track.name.toUpperCase())} · CHANNEL EFFECTS</h3><div class="mix-controls">${range('pan',track.pan,-1,1,.01,'Pan',track.pan.toFixed(2),'track')}${range('delay',track.delay,0,.6,.01,'Delay',`${Math.round(track.delay*100)}%`,'track')}${range('reverb',track.reverb,0,.6,.01,'Reverb',`${Math.round(track.reverb*100)}%`,'track')}</div><p>Effects are included in offline WAV export. Leave headroom; master output is not automatically normalized.</p>`:'<h3>MIXER</h3><p>Independent track faders and effects appear when you add audio.</p>'}</div></section></div></div>`;
}
function render() {
  $('project-name').value = project.name; $('bpm').value = project.bpm; $('loop-bars').value = project.loopBars;
  const locked = project.lanes.some(l=>l.layers.length) || project.tracks.some(t=>t.clips.length) || project.loom.events.length;
  $('bpm').disabled = !!locked; $('bpm').title = locked?'Tempo is locked after recording in this preview; time-stretch is not implemented.':'Set the tempo before recording';
  $('loop-bars').disabled = project.lanes.some(l=>l.layers.length) || !!audio.captureJob;
  $('undo').disabled = !history.length || !!audio.captureJob || sequenceRecording;
  $('redo').disabled = !future.length || !!audio.captureJob || sequenceRecording;
  $('record').disabled = view === 'studio'; $('record').title = view==='studio'?'Record in Live Loop, then send the independent takes here.':'Record in the current workspace';
  $('record').classList.toggle('active',!!audio.captureJob||sequenceRecording);
  $('mic').textContent = audio.stream?.active?'MIC ON':'MIC OFF'; $('mic').classList.toggle('active',!!audio.stream?.active);
  document.querySelectorAll('nav [data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view); b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
  $('workspace').innerHTML = view==='live'?liveHTML():view==='loom'?loomHTML():studioHTML();
  requestAnimationFrame(drawWaves);
}
const peakCache = new Map();
function drawWaves() {
  document.querySelectorAll('canvas.waveform').forEach(canvas=>{
    const asset=assets.get(canvas.dataset.asset); if(!asset)return;
    const bounds=canvas.getBoundingClientRect(); if(!bounds.width||!bounds.height)return;
    const dpr=Math.min(devicePixelRatio,2); canvas.width=Math.round(bounds.width*dpr); canvas.height=Math.round(bounds.height*dpr);
    const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr); ctx.fillStyle=canvas.dataset.color || '#28cce5';
    const start=Math.floor(Number(canvas.dataset.start||0)*asset.sampleRate), end=Math.min(asset.channels[0].length,Math.round(Number(canvas.dataset.end||duration(asset))*asset.sampleRate));
    const count=Math.min(450,Math.ceil(bounds.width/2)); const key=`${asset.id}:${start}:${end}:${count}`;
    let peaks=peakCache.get(key);
    if(!peaks){peaks=new Float32Array(count);const pcm=asset.channels[0];for(let x=0;x<count;x++){let peak=0;const a=Math.floor(start+(end-start)*x/count),b=Math.floor(start+(end-start)*(x+1)/count);for(let i=a;i<b;i++)peak=Math.max(peak,Math.abs(pcm[i]));peaks[x]=peak;}peakCache.set(key,peaks);if(peakCache.size>300)peakCache.delete(peakCache.keys().next().value);}
    for(let x=0;x<count;x++){const height=Math.max(1,Math.min(1,peaks[x])*bounds.height*.9);ctx.fillRect(x*bounds.width/count,(bounds.height-height)/2,Math.max(1,bounds.width/count-1),height);}
  });
}
async function recordLane(index) {
  if (busy) return;
  if (audio.captureJob) {audio.cancelCapture(); return;}
  if (recordingLane !== null) {status('Microphone is still opening. Wait for the current lane.'); return;}
  if (sequenceRecording) return;
  selectedLane=index; recordingLane=index; render(); status('Opening microphone. Use headphones; monitoring is off.');
  try {
    const lane=project.lanes[index]; const asset=await audio.recordLoop(project,assets,`${lane.name} · Take ${lane.layers.length+1}`);
    checkpoint(); assets.set(asset.id,asset); lane.layers.push(asset.id); audio.addLane(lane,assets,project.bpm); audio.updateMix(project.lanes);
    changed(`${lane.name} recorded. ${lane.layers.length} separate take${lane.layers.length===1?'':'s'} preserved.`);
  } finally {recordingLane=null; render();}
}
async function openLoomAsset(asset) {
  ensureIdle();
  checkpoint(); assets.set(asset.id,asset); project.loom.assetId=asset.id; project.loom.slices=detectSlices(asset,project.loom.sensitivity); project.loom.events=[]; selectedSlice=0;
  switchView('loom'); changed(`${project.loom.slices.length} transient slices detected. Play a pad or adjust the markers.`);
}
function addAssetToStudio(id, trackIndex = -1, beat = cursorBeat) {
  checkpoint(); const asset=assets.get(id); if(!asset)throw new Error('Audio asset is missing.');
  const track=project.tracks[trackIndex] || makeTrack(asset.name);
  if(!project.tracks.includes(track))project.tracks.push(track);
  const clip=makeClip(asset,project.bpm,Math.max(0,beat));track.clips.push(clip);selectedClip=clip.id;selectedTrack=project.tracks.indexOf(track);
  if(audio.mode==='studio')audio.playStudio(project,assets,cursorBeat);
  changed('Audio added to the timeline. Source recording preserved.');
}
async function sequenceRecord() {
  if(sequenceRecording){sequenceRecording=false;audio.stop();changed(`${project.loom.events.length} pad hits recorded.`);return;}
  if(!project.loom.assetId)throw new Error('Send or import a sample first.');
  await audio.init();audio.stop();checkpoint();project.loom.events=[];sequenceRecording=true;sequenceEpoch=audio.context.currentTime+.15;
  status(`Record ${project.loom.bars} bars with the pads. Timing is quantized to 1/16 notes.`);render();
}
async function playPad(index) {
  const slice=project.loom.slices[index],asset=assets.get(project.loom.assetId);if(!slice||!asset)return;
  selectedSlice=index;await audio.previewPad(asset,slice);
  if(sequenceRecording){const beat=(audio.context.currentTime-sequenceEpoch)*project.bpm/60; if(beat>=0&&beat<project.loom.bars*4){const quantized=clamp(Math.round(beat*4)/4,0,project.loom.bars*4-.25);project.loom.events.push({id:uid(),sliceId:slice.id,beat:quantized});}}
  // Keep pointer capture stable while a pad is held; only update the inspector after release.
  document.querySelectorAll('[data-pad]').forEach(b=>b.classList.toggle('active',Number(b.dataset.pad)===index));
  document.querySelector(`[data-pad="${index}"]`)?.classList.add('hit');
  setTimeout(()=>document.querySelector(`[data-pad="${index}"]`)?.classList.remove('hit'),120);
}
function currentSequence() {
  if(!project.loom.events.length)throw new Error('Record a pad sequence first.');
  return renderSequence(assets.get(project.loom.assetId),project.loom.slices,project.loom.events,project.loom.bars,project.bpm);
}
async function exportAudio(live) {
  if(busy) return; busy=true;status('Rendering stereo WAV with channel effects…');
  try {const asset=await audio.render(project,assets,live);wavDownload(asset,`${project.name} ${live?'loop mix':'song'}`);status('WAV exported · 48 kHz / 16-bit stereo. Check the mix for clipping before release.');}
  finally{busy=false;}
}
async function demo() {
  if(project.lanes.some(l=>l.layers.length)||project.tracks.length)throw new Error('Demo is only available in an empty project; your audio will not be replaced.');
  await audio.init();checkpoint();const sr=audio.context.sampleRate,seconds=beatsToSeconds(project.loopBars*4,project.bpm),frames=Math.round(seconds*sr),beat=60/project.bpm;
  let seed=831;const noise=()=>{seed=(seed*16807)%2147483647;return seed/1073741823.5-1;};
  project.lanes.slice(0,4).forEach((lane,index)=>{
    const pcm=new Float32Array(frames);
    for(let i=0;i<frames;i++){
      const t=i/sr,local=t%beat,b=Math.floor(t/beat),half=t%(beat/2);
      if(index===0){pcm[i]=Math.sin(2*Math.PI*(42*local+4*(1-Math.exp(-local*35))))*Math.exp(-local*21)*.63 + (b%2?noise()*Math.exp(-local*34)*.22:0)+noise()*Math.exp(-half*160)*.11;}
      if(index===1){const f=[65.406,65.406,77.782,58.27][Math.floor(b/4)%4];pcm[i]=Math.sin(2*Math.PI*f*t)*Math.min(1,local*40)*Math.exp(-local*2)*.31;}
      if(index===2){pcm[i]=[130.81,155.56,196].reduce((a,f)=>a+Math.sin(2*Math.PI*f*t),0)*.07*Math.min(1,t*2,(seconds-t)*2);}
      if(index===3){const f=[261.63,311.13,392,349.23][b%4];pcm[i]=Math.sin(2*Math.PI*f*t)*Math.exp(-local*8)*.14;}
    }
    const asset=makeAsset(`${lane.name} · synthesized demo`,sr,[pcm],'demo');assets.set(asset.id,asset);lane.layers.push(asset.id);
  });
  project.name='Sunset Drive · demo';changed('Synthesized demo loaded. These are generated test sounds, not microphone recordings.');
}
const actions = {
  'record-lane': b=>recordLane(Number(b.dataset.index)),
  'mute-lane': b=>{checkpoint();const l=project.lanes[Number(b.dataset.index)];l.muted=!l.muted;audio.updateMix(project.lanes);changed();},
  'solo-lane': b=>{checkpoint();const l=project.lanes[Number(b.dataset.index)];l.solo=!l.solo;audio.updateMix(project.lanes);changed();},
  'import-lane':()=>{importTarget='live';$('audio-file').click();},
  'import-loom':()=>{importTarget='loom';$('audio-file').click();},
  'import-studio':()=>{importTarget='studio';$('audio-file').click();},
  'take-to-loom':b=>openLoomAsset(assets.get(b.dataset.id)),
  'lane-to-loom':async()=>{await audio.init();const lane=project.lanes[selectedLane];await openLoomAsset(mixLane(lane,assets,beatsToSeconds(project.loopBars*4,project.bpm),audio.context.sampleRate));},
  'live-to-studio':()=>{checkpoint();const tracks=transferLanes(project,assets);switchView('studio');changed(`${tracks.length} lanes sent to Studio. Every take remains a separate source clip.`);},
  'remove-take':()=>{checkpoint();project.lanes[selectedLane].layers.pop();if(audio.mode==='live')audio.playLive(project,assets);changed('Last take removed from lane; original kept for Undo.');},
  'scene-save':b=>{checkpoint();project.scenes[b.dataset.key]=project.lanes.map(l=>({muted:l.muted,solo:l.solo,volume:l.volume,pan:l.pan,delay:l.delay,reverb:l.reverb,tone:l.tone}));changed(`Scene ${b.dataset.key} saved.`);},
  'scene-launch':b=>{checkpoint();project.scenes[b.dataset.key].forEach((s,i)=>Object.assign(project.lanes[i],s));activeScene=b.dataset.key;audio.updateMix(project.lanes);changed(`Scene ${activeScene} launched. Level changes use short ramps.`);},
  'export-loop':()=>exportAudio(true), 'export-song':()=>exportAudio(false), demo,
  performance:async()=>{if(audio.performance){status('Preparing performance WAV…');const asset=await audio.finishPerformance();assets.set(asset.id,asset);checkpoint();project.samples.push(asset.id);wavDownload(asset,`${project.name} performance`);changed('Performance exported; separate source takes are still in your project.');}else{await audio.startPerformance();render();status('Capturing the live master output. Perform freely; Finish performance exports WAV.');}},
  detect:()=>{checkpoint();project.loom.slices=detectSlices(assets.get(project.loom.assetId),project.loom.sensitivity);project.loom.events=[];selectedSlice=0;changed('Transients detected. Pattern cleared because slice assignments changed; Undo restores it.');},
  equal:()=>{checkpoint();project.loom.slices=equalSlices(assets.get(project.loom.assetId));project.loom.events=[];selectedSlice=0;changed('16 equal slices created. Pattern cleared; Undo restores it.');},
  audition:()=>playPad(selectedSlice), 'sequence-record':sequenceRecord,
  'sequence-play':async()=>{await audio.init();sequenceAsset=currentSequence();audio.playAsset(sequenceAsset);status('Playing your pad sequence.');},
  'sequence-clear':()=>{checkpoint();project.loom.events=[];changed('Pattern cleared. Undo restores it.');},
  'sequence-to-studio':()=>{const asset=currentSequence();checkpoint();assets.set(asset.id,asset);project.samples.push(asset.id);project.sequences.push({id:uid(),assetId:asset.id,sourceId:project.loom.assetId,slices:structuredClone(project.loom.slices),events:structuredClone(project.loom.events),bars:project.loom.bars,bpm:project.bpm});const track=makeTrack(`Pad Sequence ${project.sequences.length}`,'#a88ee9');track.clips.push(makeClip(asset,project.bpm,cursorBeat));project.tracks.push(track);selectedTrack=project.tracks.length-1;switchView('studio');changed('Pad sequence sent to Studio; the original source, slices, and pattern are preserved.');},
  'slices-to-studio':()=>{checkpoint();const source=assets.get(project.loom.assetId);project.loom.slices.forEach((s,i)=>{const asset=renderSlice(source,s);asset.name=`${source.name} · ${String(i+1).padStart(2,'0')}`;assets.set(asset.id,asset);project.samples.push(asset.id);});switchView('studio');changed('Slices added to Project Sounds. Drag or tap one to add it to the timeline.');},
  'mute-track':b=>{checkpoint();const t=project.tracks[Number(b.dataset.index)];t.muted=!t.muted;audio.updateMix(project.tracks);changed();},
  'solo-track':b=>{checkpoint();const t=project.tracks[Number(b.dataset.index)];t.solo=!t.solo;audio.updateMix(project.tracks);changed();},
  'select-track':b=>{selectedTrack=Number(b.dataset.index);render();},
  'add-track':()=>{checkpoint();project.tracks.push(makeTrack(`Audio ${project.tracks.length+1}`));changed('Empty audio track added. Drop a sound here.');},
  'duplicate-clip':()=>{const s=clipSelection();if(!s)return;checkpoint();const c={...s.clip,id:uid(),beat:s.clip.beat+s.clip.length};s.track.clips.push(c);selectedClip=c.id;stopTransport();changed('Clip duplicated after the original.');},
  'delete-clip':()=>{const s=clipSelection();if(!s)return;checkpoint();s.track.clips=s.track.clips.filter(c=>c.id!==selectedClip);selectedClip=null;stopTransport();changed('Clip removed; original source audio kept.');},
  'split-clip':()=>{const s=clipSelection();if(!s)return;const at=audio.mode==='studio'?audio.beat(project.bpm):cursorBeat;const split=Math.round(at*4)/4;if(split<=s.clip.beat||split>=s.clip.beat+s.clip.length)throw new Error('Place the playhead inside the selected clip first.');checkpoint();const left=split-s.clip.beat,right={...s.clip,id:uid(),beat:split,length:s.clip.length-left,offset:s.clip.offset+beatsToSeconds(left,project.bpm)};s.clip.length=left;s.track.clips.push(right);stopTransport();changed('Clip split. Both pieces reference the original recording.');}
};
document.addEventListener('click',event=>{
  const b=event.target.closest('button');
  if(b?.dataset.view){switchView(b.dataset.view);return;}
  if(b?.dataset.action){if((audio.captureJob||recordingLane!==null||sequenceRecording||busy)&&!['record-lane','sequence-record','mute-lane','solo-lane','scene-launch','performance'].includes(b.dataset.action)){status('Finish the active recording or operation first.');return;}run(()=>actions[b.dataset.action]?.(b));return;}
  if(b?.dataset.addAsset){run(()=>addAssetToStudio(b.dataset.addAsset));return;}
  const lane=event.target.closest('[data-lane]');if(lane&&!event.target.matches('input')){selectedLane=Number(lane.dataset.lane);render();}
  const track=event.target.closest('[data-track]');if(track&&!event.target.closest('.clip')){selectedTrack=Number(track.dataset.track);render();}
});
document.addEventListener('pointerdown',event=>{if(event.target.matches('input[type=range]')&&event.target.id!=='zoom')checkpoint();});
document.addEventListener('input',event=>{
  const input=event.target;let target;
  if(input.dataset.laneVolume!==undefined)target=project.lanes[Number(input.dataset.laneVolume)];
  if(input.dataset.trackVolume!==undefined)target=project.tracks[Number(input.dataset.trackVolume)];
  if(target){target.volume=Number(input.value);audio.updateMix(view==='live'?project.lanes:project.tracks);const output=input.parentElement.querySelector('output');if(output)output.textContent=`${(20*Math.log10(target.volume||.00001)).toFixed(1)} dB`;changed(null,false);return;}
  if(input.dataset.control){const scope=input.dataset.scope;target=scope==='slice'?project.loom.slices[selectedSlice]:scope==='track'?project.tracks[selectedTrack]:project.lanes[selectedLane];if(!target)return;target[input.dataset.control]=Number(input.value);audio.updateMix(view==='live'?project.lanes:project.tracks);const output=input.closest('.control').querySelector('output');if(output)output.textContent=Number(input.value).toFixed(2);changed(null,false);}
  if(input.dataset.sensitivity!==undefined){project.loom.sensitivity=Number(input.value);changed(null,false);}
  if(input.id==='zoom'){zoom=Number(input.value);const scroll=document.querySelector('.timeline-scroll')?.scrollLeft||0;render();document.querySelector('.timeline-scroll').scrollLeft=scroll;}
});
document.addEventListener('change',event=>run(async()=>{
  const input=event.target;
  if(input.dataset.slice){checkpoint();const s=project.loom.slices[selectedSlice],d=duration(assets.get(project.loom.assetId)),n=Number(input.value);if(!Number.isFinite(n))return;s[input.dataset.slice]=input.dataset.slice==='start'?clamp(n,0,s.end-.005):clamp(n,s.start+.005,d);changed('Slice trim updated; original preserved.');}
  if(input.dataset.clipEdit){const selected=clipSelection();if(!selected)return;const n=Number(input.value);if(!Number.isFinite(n))return;checkpoint();selected.clip[input.dataset.clipEdit]=input.dataset.clipEdit==='length'?clamp(n,.25,512):Math.max(0,n);stopTransport();changed('Clip updated.');}
  if(input.id==='sequence-bars'){if(sequenceRecording)return;checkpoint();project.loom.bars=Number(input.value);project.loom.events=project.loom.events.filter(e=>e.beat<project.loom.bars*4);changed();}
  if(input.type==='range')drawWaves();
}));
let gesture=null;
document.addEventListener('pointerdown',event=>{
  const pad=event.target.closest('[data-pad]');if(pad&&!pad.disabled){event.preventDefault();run(()=>playPad(Number(pad.dataset.pad)));return;}
  const marker=event.target.closest('[data-marker]');if(marker){if(sequenceRecording)return;event.preventDefault();checkpoint();selectedSlice=Number(marker.dataset.marker);const box=$('slice-wave').getBoundingClientRect();gesture={type:'marker',index:selectedSlice,box,pointer:event.pointerId};marker.setPointerCapture(event.pointerId);return;}
  const clip=event.target.closest('[data-clip]');if(clip){event.preventDefault();selectedClip=clip.dataset.clip;const selected=clipSelection();selectedTrack=project.tracks.indexOf(selected.track);gesture={type:'clip',id:selectedClip,startX:event.clientX,beat:selected.clip.beat,pointer:event.pointerId,moved:false};clip.setPointerCapture(event.pointerId);return;}
  if(event.target.closest('#bar-ruler')){const rect=$('bar-ruler').getBoundingClientRect();cursorBeat=Math.max(0,Math.round((event.clientX-rect.left)/zoom*4)/4);if(audio.mode==='studio')audio.playStudio(project,assets,cursorBeat);}
});
document.addEventListener('pointermove',event=>{
  if(!gesture)return;
  if(gesture.type==='marker'){
    const slices=project.loom.slices,s=slices[gesture.index],d=duration(assets.get(project.loom.assetId));
    const next=clamp((event.clientX-gesture.box.left)/gesture.box.width*d,gesture.index?slices[gesture.index-1].start+.005:0,s.end-.005);s.start=next;if(gesture.index)slices[gesture.index-1].end=next;
    const marker=document.querySelector(`[data-marker="${gesture.index}"]`);if(marker)marker.style.left=`${next/d*100}%`;
  }else{
    if(Math.abs(event.clientX-gesture.startX)>4&&!gesture.moved){checkpoint();gesture.moved=true;}
    if(gesture.moved){const selected=clipSelection();selected.clip.beat=Math.max(0,Math.round((gesture.beat+(event.clientX-gesture.startX)/zoom)*4)/4);const clip=document.querySelector(`[data-clip="${gesture.id}"]`);clip.style.left=`${selected.clip.beat*zoom}px`;}
  }
});
document.addEventListener('pointerup',event=>{
  if(gesture){
    if(gesture.type==='clip'&&gesture.moved){const over=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-drop-track]');const s=clipSelection();if(over){const target=project.tracks[Number(over.dataset.dropTrack)];if(target!==s.track){s.track.clips=s.track.clips.filter(c=>c.id!==s.clip.id);target.clips.push(s.clip);selectedTrack=project.tracks.indexOf(target);}}audio.stop();}
    changed(gesture.type==='marker'?'Slice boundary updated.':null);gesture=null;
  }else if(event.target.closest('[data-pad]')){render();}
});
document.addEventListener('pointercancel',()=>{if(gesture){gesture=null;changed();}});
document.addEventListener('dragstart',event=>{const b=event.target.closest('[data-drag-asset]');if(b)event.dataTransfer.setData('application/neusical-asset',b.dataset.dragAsset);});
document.addEventListener('dragover',event=>{if(event.target.closest('[data-drop-track]'))event.preventDefault();});
document.addEventListener('drop',event=>{const lane=event.target.closest('[data-drop-track]');if(!lane)return;event.preventDefault();const id=event.dataTransfer.getData('application/neusical-asset');if(!assets.has(id))return;const beat=Math.max(0,Math.round((event.clientX-lane.getBoundingClientRect().left)/zoom*4)/4);run(()=>addAssetToStudio(id,Number(lane.dataset.dropTrack),beat));});
$('play').onclick=()=>run(async()=>{await audio.init();if(view==='live')audio.playLive(project,assets);else if(view==='studio')audio.playStudio(project,assets,cursorBeat);else{sequenceAsset=currentSequence();audio.playAsset(sequenceAsset);}status(`Playing ${view==='live'?'live loops':view==='studio'?'arrangement':'pad sequence'}.`);});
$('stop').onclick=()=>{stopTransport();status('Transport stopped. Recordings and arrangement preserved.');};
$('record').onclick=()=>run(()=>view==='live'?recordLane(selectedLane):sequenceRecord());
$('mic').onclick=()=>run(async()=>{if(audio.stream?.active)audio.releaseMicrophone();else await audio.microphone();render();status(audio.stream?.active?'Microphone ready. Monitoring off; use headphones.':'Microphone released.');});
$('bpm').onchange=()=>{const n=Number($('bpm').value);if(!Number.isFinite(n))return;checkpoint();project.bpm=clamp(n,40,220);changed('Project tempo updated in all workspaces.');};
$('loop-bars').onchange=()=>{checkpoint();project.loopBars=Number($('loop-bars').value);changed();};
$('project-name').onchange=()=>{checkpoint();project.name=$('project-name').value.trim().slice(0,60)||'Untitled session';changed();};
$('undo').onclick=()=>{if(!history.length||audio.captureJob||sequenceRecording)return;audio.stop();future.push(structuredClone(project));project=history.pop();selectedSlice=Math.min(selectedSlice,Math.max(0,project.loom.slices.length-1));selectedTrack=Math.min(selectedTrack,Math.max(0,project.tracks.length-1));changed('Undid last edit.');};
$('redo').onclick=()=>{if(!future.length||audio.captureJob||sequenceRecording)return;audio.stop();history.push(structuredClone(project));project=future.pop();changed('Redid last edit.');};
$('import').onclick=()=>{importTarget=view;$('audio-file').click();};
$('audio-file').onchange=()=>run(async()=>{
  const file=$('audio-file').files[0];$('audio-file').value='';if(!file)return;
  if(audio.captureJob||sequenceRecording)throw new Error('Finish recording before importing audio.');
  if(file.size>100*1024*1024)throw new Error('Preview import limit is 100 MB per file.');
  busy=true;status('Decoding audio…');
  try{const asset=await audio.decode(file);if(importTarget==='loom'){busy=false;await openLoomAsset(asset);}
    else if(importTarget==='studio'){assets.set(asset.id,asset);addAssetToStudio(asset.id);}
    else {checkpoint();const frames=Math.round(beatsToSeconds(project.loopBars*4,project.bpm)*asset.sampleRate);const fitted=makeAsset(asset.name,asset.sampleRate,asset.channels.map(c=>{const out=new Float32Array(frames);out.set(c.subarray(0,frames));return out;}),'import');assets.set(asset.id,asset);assets.set(fitted.id,fitted);project.samples.push(asset.id);project.lanes[selectedLane].layers.push(fitted.id);if(audio.mode==='live')audio.addLane(project.lanes[selectedLane],assets,project.bpm);changed('Loaded into the fixed-length loop; full original preserved in Project Sounds. No time-stretch applied.');}
  }finally{busy=false;render();}
});
$('save-project').onclick=()=>run(async()=>{
  await saveNow();status('Preparing portable project with all original audio…');
  const exported={format:'neusical-suite',project,assets:[...assets.values()].map(a=>({...a,channels:a.channels.map(c=>Array.from(c))}))};
  download(new Blob([JSON.stringify(exported)],{type:'application/json'}),`${project.name.replace(/[^\w .-]/g,'_')}.neusic`);status('Portable project downloaded, including separate takes, slices, patterns, and arrangement.');
});
$('new-project').onclick=()=>run(async()=>{
  ensureIdle(); if(audio.performance)throw new Error('Finish the performance recording before starting a new project.');
  if(!confirm('Start a new session? Your current session will be saved on this device. Download Save project first if you need a portable backup.'))return;
  await saveNow();audio.stop();project=newProject();assets=new Map();history=[];future=[];selectedLane=0;selectedSlice=0;selectedTrack=0;selectedClip=null;cursorBeat=0;view='live';location.hash='live';changed('New session ready. Set your tempo and loop length before recording.');
});
$('open-project').onclick=()=>run(async()=>{
  ensureIdle();if(audio.performance)throw new Error('Finish the performance recording before opening another project.');
  await saveNow();const sessions=await db.list();
  $('session-list').innerHTML=sessions.map(p=>`<button type="button" data-open-local="${esc(p.id)}">${esc(p.name)}${p.id===project.id?' · current':''}<small>${new Date(p.updatedAt).toLocaleString()}</small></button>`).join('')||'<p>No local sessions saved.</p>';
  $('session-dialog').showModal();
});
$('import-project-file').onclick=()=>{$('session-dialog').close();$('project-file').click();};
$('session-list').onclick=event=>run(async()=>{
  const id=event.target.closest('[data-open-local]')?.dataset.openLocal;if(!id)return;
  const saved=await db.restore(id);if(!saved)throw new Error('Saved session could not be found.');validateProject(saved.project,saved.assets);
  audio.stop();project=saved.project;assets=saved.assets;history=[];future=[];selectedLane=0;selectedSlice=0;selectedTrack=0;selectedClip=null;cursorBeat=0;$('session-dialog').close();changed('Local session restored.');
});
$('project-file').onchange=()=>run(async()=>{
  ensureIdle(); if(audio.performance)throw new Error('Finish the performance recording before opening another project.');
  const file=$('project-file').files[0];$('project-file').value='';if(!file)return;if(file.size>250*1024*1024)throw new Error('Preview project-file limit is 250 MB.');
  const data=JSON.parse(await file.text());if(data.format!=='neusical-suite'||!Array.isArray(data.assets))throw new Error('This is not a Neusical Suite project file.');
  const restored=new Map(data.assets.map(a=>[a.id,{...a,channels:a.channels.map(c=>Float32Array.from(c))}]));validateProject(data.project,restored);
  await saveNow();audio.stop();db.persistedIds.clear();project=data.project;assets=restored;history=[];future=[];selectedLane=0;selectedSlice=0;selectedTrack=0;selectedClip=null;cursorBeat=0;changed('Project opened. The previous project remains saved on this device.');
});
document.addEventListener('keydown',event=>{
  if(event.target.matches('input,textarea,select')||event.metaKey||event.ctrlKey||event.altKey||event.repeat)return;
  if(event.code==='Space'){event.preventDefault();audio.mode?$('stop').click():$('play').click();}
  if(view==='loom'&&padKeys.includes(event.key.toLowerCase())){event.preventDefault();run(()=>playPad(padKeys.indexOf(event.key.toLowerCase())));}
  if(event.key==='Enter'&&event.target.dataset.clip){selectedClip=event.target.dataset.clip;render();}
});
document.addEventListener('keyup',event=>{if(view==='loom'&&padKeys.includes(event.key.toLowerCase())&&!event.target.matches('input,select,textarea'))render();});
window.addEventListener('resize',()=>requestAnimationFrame(drawWaves));
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(next!==view)switchView(next);});
window.addEventListener('beforeunload',event=>{if(audio.captureJob||sequenceRecording||audio.performance){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();});
audio.addEventListener('capture',()=>{render();status('Take queued on the audio clock. Recording ends automatically after the selected loop length.');});
audio.addEventListener('mic-ended',()=>{render();status('Microphone disconnected. Existing recordings are safe.',true);});
audio.addEventListener('state',e=>{if(e.detail==='suspended'&&audio.mode)status('Browser suspended audio. Tap Play to resume.',true);});
function tick() {
  const bpm=project.bpm, beat=sequenceRecording?Math.max(0,(audio.context.currentTime-sequenceEpoch)*bpm/60):audio.mode?audio.beat(bpm):cursorBeat;
  $('position').textContent=`${String(Math.floor(beat/4)+1).padStart(2,'0')} : ${Math.floor(beat%4)+1} : ${String(Math.floor(beat%1*100)).padStart(2,'0')}`;
  $('transport-mode').textContent=sequenceRecording?'RECORDING PADS':audio.captureJob?(audio.context.currentTime<audio.captureJob.when?'QUEUED':'RECORDING'):audio.mode?'PLAYING':'STOPPED';
  $('play').classList.toggle('active',!!audio.mode);$('input-level').style.width=`${Math.min(100,audio.meter(true)*160)}%`;
  document.querySelectorAll('.loop-playhead').forEach(p=>{p.style.display=audio.mode==='live'?'block':'none';p.style.left=`${beat%(project.loopBars*4)/(project.loopBars*4)*100}%`;});
  const playhead=$('song-playhead');if(playhead)playhead.style.transform=`translateX(${beat*zoom}px)`;
  if(sequenceRecording&&beat>=project.loom.bars*4){sequenceRecording=false;audio.stop();changed(`${project.loom.events.length} pad hits captured.`);}
  if(audio.mode==='sequence'&&sequenceAsset&&audio.context.currentTime-audio.epoch>=duration(sequenceAsset)){audio.stop();}
  if(audio.mode==='studio'){const end=Math.max(0,...project.tracks.flatMap(t=>t.clips.map(c=>c.beat+c.length)));if(beat>end+6){audio.stop();status('Arrangement playback complete.');}}
  requestAnimationFrame(tick);
}
async function boot() {
  try{const saved=await db.restore();if(saved){validateProject(saved.project,saved.assets);project=saved.project;assets=saved.assets;status('Restored your local project. Audio starts only when you press Play or Record.');}else status('Ready. Record your voice, import audio, or load the clearly labeled demo.');}
  catch(error){status(`Could not restore local project: ${error.message}. Use Open to restore a project file.`,true);}
  view=['live','loom','studio'].includes(location.hash.slice(1))?location.hash.slice(1):'live';render();tick();
}
// Debug access is opt-in on localhost only; browser tests exercise real Web Audio.
if(['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).has('test'))globalThis.__suite={get project(){return project;},get assets(){return assets;},audio,db,saveNow,actions,switchView};
boot();
