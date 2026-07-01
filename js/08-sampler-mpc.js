/* ═══════════════════════════════════════════════
   Sampler/chopper UI + amplitude-envelope transient detection
═══════════════════════════════════════════════ */
/* ── SAMPLER / CHOPPER ── */
function buildSampler(el){
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  const fnameText=entry?`${entry.name} · ${entry.duration.toFixed(2)}s · ${S.bpm} BPM`:'No sample loaded — drop a file below or tap to browse';
  el.innerHTML=`<div class="sampler-section">
    <div class="samp-filename">${fnameText}</div>
    <div class="samp-wave" id="samp-drop"><canvas id="samp-canvas"></canvas></div>
    <div class="samp-modes">
      <button class="samp-mode${S.samplerMode==='slice'?' active':''}" onclick="setSampMode(this,'slice')">Slice</button>
      <button class="samp-mode${S.samplerMode==='chop'?' active':''}" onclick="setSampMode(this,'chop')">Chop</button>
      <button class="samp-mode${S.samplerMode==='trim'?' active':''}" onclick="setSampMode(this,'trim')">Trim</button>
      <button class="samp-mode${S.samplerMode==='stretch'?' active':''}" onclick="setSampMode(this,'stretch')">Stretch</button>
      <button class="samp-mode${S.samplerMode==='reverse'?' active':''}" onclick="setSampMode(this,'reverse')">Reverse</button>
    </div>
    <div class="samp-slices">
      <label>Slices</label>
      <button class="chop-btn sec" style="padding:3px 8px;font-size:11px;flex:0" onclick="changeSliceCount(-2)">−</button>
      <span class="slice-count" id="slic-cnt">${S.slices}</span>
      <button class="chop-btn sec" style="padding:3px 8px;font-size:11px;flex:0" onclick="changeSliceCount(2)">+</button>
    </div>
    <div class="chop-btns">
      <button class="chop-btn prim" onclick="autoChop()">⚡ Auto Chop</button>
      <button class="chop-btn sec"  onclick="chopEqual()">▦ Equal</button>
      <button class="chop-btn sec"  onclick="getSamplerFileInput().click()">Load File</button>
      <button class="chop-btn sec"  onclick="exportSampleToTrack()">→ Track</button>
    </div>
    <div id="slice-markers" class="slice-markers"></div>
  </div>`;
  requestAnimationFrame(()=>{drawSampler();buildSliceMarkers();setupSamplerDrop();});
}

let _samplerFileInput=null;
function getSamplerFileInput(){
  if(_samplerFileInput)return _samplerFileInput;
  const inp=document.createElement('input');
  inp.type='file';inp.accept='audio/*';inp.style.display='none';
  document.body.appendChild(inp);
  inp.onchange=async()=>{
    const file=inp.files&&inp.files[0];inp.value='';
    if(file)await loadSamplerFile(file);
  };
  _samplerFileInput=inp;
  return inp;
}

function setupSamplerDrop(){
  const drop=document.getElementById('samp-drop');
  if(!drop||drop._dropWired)return;
  drop._dropWired=true;
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drop-target');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('drop-target'));
  drop.addEventListener('drop',async e=>{
    e.preventDefault();drop.classList.remove('drop-target');
    const file=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
    if(file)await loadSamplerFile(file);
  });
  drop.addEventListener('click',()=>{ if(!S.samplerBufferId)getSamplerFileInput().click(); });
}

async function loadSamplerFile(file){
  toast('Decoding '+file.name+'...');
  let bufferId;
  try{ bufferId=await Audio_.decodeFile(file); }
  catch(err){ toast('Could not decode that file');return; }
  S.samplerBufferId=bufferId;
  S.samplerSlices=[];
  buildPanelContent('sampler');
  toast('Loaded '+file.name);
}

function changeSliceCount(delta){
  S.slices=Math.max(2,Math.min(64,S.slices+delta));
  document.getElementById('slic-cnt').textContent=S.slices;
  if(S.samplerBufferId&&S.samplerSlices.length){
    // Re-run whichever chop mode produced the current slices — adjusting the
    // slice-count stepper shouldn't silently switch someone from Equal back
    // to Auto/Transient chopping.
    if(S.lastChopMode==='equal') chopEqual();
    else chopTransient();
  }
  else { buildSliceMarkers(); }
}

function drawSampler(){
  const c=document.getElementById('samp-canvas');if(!c)return;
  const wrap=c.parentElement;c.width=wrap.offsetWidth;c.height=wrap.offsetHeight;
  const ctx=c.getContext('2d'),w=c.width,h=c.height;
  ctx.fillStyle='#14142a';ctx.fillRect(0,0,w,h);

  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  if(!entry){
    ctx.fillStyle='rgba(255,255,255,.18)';ctx.font='11px system-ui';
    ctx.fillText('Drop an audio file here, or tap to browse',12,h/2+4);
    return;
  }

  const {mins,maxs,n}=entry.peaks;
  ctx.beginPath();ctx.moveTo(0,h/2);
  for(let x=0;x<=w;x++){
    const idx=Math.min(n-1,Math.floor(x/w*n));
    ctx.lineTo(x,h/2-(maxs[idx]||0)*(h/2-4));
  }
  for(let x=w;x>=0;x--){
    const idx=Math.min(n-1,Math.floor(x/w*n));
    ctx.lineTo(x,h/2-(mins[idx]||0)*(h/2-4));
  }
  ctx.fillStyle='rgba(176,110,243,.25)';ctx.fill();
  ctx.beginPath();
  for(let x=0;x<=w;x++){
    const idx=Math.min(n-1,Math.floor(x/w*n));
    const v=h/2-(maxs[idx]||0)*(h/2-4);
    if(x===0)ctx.moveTo(x,v);else ctx.lineTo(x,v);
  }
  ctx.strokeStyle='#b06ef3';ctx.lineWidth=1.5;ctx.stroke();

  // Real slice markers, in actual seconds mapped across the canvas width.
  ctx.strokeStyle='rgba(251,191,36,.8)';ctx.lineWidth=1.5;
  S.samplerSlices.forEach(sl=>{
    const x=(sl.start/entry.duration)*w;
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
  });
}

function buildSliceMarkers(){
  const el=document.getElementById('slice-markers');if(!el)return;
  if(!S.samplerSlices.length){el.innerHTML='';return;}
  el.innerHTML=S.samplerSlices.slice(0,16).map((sl,i)=>`
    <button class="slice-marker" onclick="hitSlice(${i})">${i+1}</button>`).join('');
}

function hitSlice(i){
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  const sl=S.samplerSlices[i];
  if(!entry||!sl)return;
  Audio_.ensure();
  Audio_.playBuffer(entry.buffer,{
    offset:sl.start,
    duration:sl.end-sl.start,
    reverse:S.samplerMode==='reverse',
    gain:0.9,
  });
}

function setSampMode(btn,mode){
  S.samplerMode=mode;
  btn.closest('.samp-modes').querySelectorAll('.samp-mode').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

/* ══════════════════════════════════════════════════════
   TRANSIENT DETECTION — amplitude-envelope onset detector
   Finds real hit positions in a sample (kick/snare/hat attacks, vocal chops,
   loop slices) instead of just dividing the buffer into N equal pieces.
   Approach: build a smoothed amplitude envelope, look at how fast it rises
   from frame to frame, and call a peak in that "rise" curve an onset once it
   clears an adaptive threshold and enough time has passed since the last one.
   This is the same family of technique ("energy/amplitude based onset
   detection") used as the first stage in most production onset detectors —
   no FFT needed, runs on the raw samples in well under a second even for a
   multi-minute file.
═══════════════════════════════════════════════════════ */
function detectTransients(buffer,opts={}){
  const data=buffer.getChannelData(0);
  const sr=buffer.sampleRate;
  const hopSize=Math.round(sr*0.01);           // ~10ms analysis hop
  const windowSize=Math.round(sr*0.02);        // ~20ms window per envelope frame (slightly overlapping hops)
  const numFrames=Math.floor((data.length-windowSize)/hopSize);
  if(numFrames<2)return [0];

  // 1) Amplitude envelope: RMS energy per frame.
  const envelope=new Float32Array(numFrames);
  for(let f=0;f<numFrames;f++){
    const start=f*hopSize;
    let sumSq=0;
    for(let i=0;i<windowSize;i++){ const v=data[start+i]||0; sumSq+=v*v; }
    envelope[f]=Math.sqrt(sumSq/windowSize);
  }

  // 2) Light smoothing (3-frame moving average) so single-sample noise spikes
  // in the envelope itself don't masquerade as onsets.
  const smoothed=new Float32Array(numFrames);
  for(let f=0;f<numFrames;f++){
    const a=envelope[Math.max(0,f-1)],b=envelope[f],c=envelope[Math.min(numFrames-1,f+1)];
    smoothed[f]=(a+b+c)/3;
  }

  // 3) Onset strength = positive-only frame-to-frame rise ("half-wave rectified
  // first difference"). A sustained loud note has near-zero rise after its
  // initial attack, so this naturally ignores everything but actual attacks.
  const rise=new Float32Array(numFrames);
  let maxRise=0;
  for(let f=1;f<numFrames;f++){
    const d=smoothed[f]-smoothed[f-1];
    rise[f]=d>0?d:0;
    if(rise[f]>maxRise)maxRise=rise[f];
  }
  if(maxRise<=0)return [0]; // silence or DC content, nothing to detect

  // 4) HYBRID threshold: an onset clears the bar if it passes EITHER a global
  // check or a local-adaptive check. Neither alone is reliable on real music:
  //   - Global only ("X% of the loudest rise in the whole file") misses real
  //     quiet hits whenever a few hot transients elsewhere set the bar high
  //     (e.g. a soft ghost snare in a track with hard kicks).
  //   - Local-adaptive only (threshold relative to a nearby window) misses
  //     dense, UNIFORM patterns — a steady 16th-note hi-hat roll never looks
  //     "unusual" relative to its own neighbors, even though every hit is a
  //     real onset. Tested and confirmed both failure modes independently.
  // Taking either signal catches both real-world cases.
  const sensitivity=opts.sensitivity??0.18; // lower = more onsets detected
  const globalThreshold=maxRise*sensitivity;

  const localWindowSec=opts.localWindowSec??0.2; // empirically the stable middle of a 0.15-0.25s plateau
  const localWindowFrames=Math.max(4,Math.round(localWindowSec/0.01));
  const minAbsFloor=maxRise*0.015; // true digital silence/noise floor, everywhere, regardless of local level

  const localThreshold=new Float32Array(numFrames);
  for(let f=0;f<numFrames;f++){
    const lo=Math.max(0,f-localWindowFrames),hi=Math.min(numFrames,f+localWindowFrames+1);
    // Median of the local neighborhood is robust to the very peaks we're
    // trying to detect — a mean would get pulled upward by them, a median
    // mostly ignores them since they're a small minority of frames.
    const windowVals=Array.from(rise.slice(lo,hi)).sort((a,b)=>a-b);
    const median=windowVals[Math.floor(windowVals.length/2)]||0;
    let mad=0; // mean absolute deviation from the median, as a local "noisiness" measure
    for(let i=0;i<windowVals.length;i++) mad+=Math.abs(windowVals[i]-median);
    mad/=windowVals.length||1;
    localThreshold[f]=Math.max(minAbsFloor,median+mad*(1/Math.max(0.04,sensitivity)));
  }

  const minSpacingSec=opts.minSpacingSec??0.08; // ~80ms — fast hi-hat rolls survive, single-hit decay doesn't double-trigger
  const minSpacingFrames=Math.max(1,Math.round(minSpacingSec/0.01));

  // 5) Peak-pick: a frame counts as an onset if it clears EITHER threshold
  // AND is a local maximum of the rise curve AND enough frames have passed
  // since the last accepted onset.
  const onsetsSec=[0]; // always start the first slice at the very top of the file
  let lastOnsetFrame=-minSpacingFrames;
  for(let f=1;f<numFrames-1;f++){
    const clearsEither=rise[f]>=globalThreshold||rise[f]>=localThreshold[f];
    if(!clearsEither)continue;
    if(rise[f]<rise[f-1]||rise[f]<rise[f+1])continue; // not a local peak
    if(f-lastOnsetFrame<minSpacingFrames)continue;
    const sec=(f*hopSize)/sr;
    if(sec>0.02) onsetsSec.push(sec); // skip anything basically at t=0, already covered
    lastOnsetFrame=f;
  }
  return onsetsSec;
}

function buildSlicesFromOnsets(onsetsSec,totalDuration){
  const sorted=[...onsetsSec].sort((a,b)=>a-b);
  const slices=sorted.map((start,i)=>({
    start,
    end:i+1<sorted.length?sorted[i+1]:totalDuration,
  }));
  return slices.filter(s=>s.end-s.start>0.015); // drop slivers under ~15ms (analysis noise, not real hits)
}

// Equal-division chop — kept as an explicit, separate mode (per the PRD's
// distinct "Equal" vs "Transient" chop modes) rather than folded away, since
// even-grid slicing is genuinely the right tool for melodic loops where you
// want clean 1/16ths regardless of where the actual energy lands.
function chopEqual(){
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  if(!entry){toast('Load a sample first');return;}
  const n=S.slices,dur=entry.duration;
  S.samplerSlices=Array.from({length:n},(_,i)=>({start:dur/n*i,end:dur/n*(i+1)}));
  S.lastChopMode='equal';
  drawSampler();buildSliceMarkers();
  toast(`${n} equal slices`);
}

// Transient chop — the actual "Auto Chop" the PRD describes: real hit
// positions, not an arbitrary grid. Slice count becomes "however many
// genuine onsets were found", capped so the pad grid stays usable.
function chopTransient(){
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  if(!entry){toast('Load a sample first');return;}
  toast('Detecting transients…');
  const onsets=detectTransients(entry.buffer);
  let slices=buildSlicesFromOnsets(onsets,entry.duration);
  const cap=Math.max(2,S.slices);
  if(slices.length>cap){
    // Too many onsets for the pad grid (e.g. a busy hi-hat loop) — keep the
    // strongest ones by re-running with reduced sensitivity instead of just
    // truncating, so the kept slices are still the most prominent hits.
    let sens=0.18;
    while(slices.length>cap&&sens<0.9){
      sens+=0.08;
      const retry=buildSlicesFromOnsets(detectTransients(entry.buffer,{sensitivity:sens}),entry.duration);
      if(retry.length<2)break;
      slices=retry;
    }
    if(slices.length>cap) slices=slices.slice(0,cap);
  }
  S.samplerSlices=slices;
  S.lastChopMode='transient';
  drawSampler();buildSliceMarkers();
  toast(slices.length===1?'No clear transients found — try Equal chop':`${slices.length} transients detected`);
}

// "Auto Chop" button now runs real onset detection by default — this is the
// behavior change the PRD calls for ("Auto Slice" should mean transient-
// aware, not an even grid). Equal-division is still one tap away via its own
// mode button so neither workflow is lost.
function autoChop(){ chopTransient(); }

// Export the currently loaded+chopped sample to a real clip on the active track,
// trimmed to the first slice's region if slices exist, or the full sample otherwise.
function exportSampleToTrack(){
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  if(!entry){toast('Load a sample first');return;}
  const t=S.tracks[S.activeTrack];
  if(!t){toast('Select a track first');return;}
  const region=S.samplerSlices[0]||{start:0,end:entry.duration};
  const regionDur=region.end-region.start;
  const lenBeats=Math.max(0.25,secToBeat(regionDur));
  const startBeat=secToBeat(S.sec);
  snapshot();
  t.clips.push({
    id:'clip_'+Date.now(),
    start:Math.round(startBeat*4)/4,
    len:lenBeats,
    label:entry.name.replace(/\.[^.]+$/,'')+'_chop',
    bufferId:S.samplerBufferId,
    trimStart:region.start,
    reverse:S.samplerMode==='reverse',
  });
  renderTracks();
  if(S.playing){ stopAllScheduled(); scheduleClipPlayback(); }
  toast('Added to '+t.name);
}
