/* ═══════════════════════════════════════════════
   Transport playback scheduling + offline WAV bounce/export
═══════════════════════════════════════════════ */
/* ── PLAYBACK ──
   Two separate concerns, on purpose:
   1) The CLOCK: where is the playhead right now? Always derived from
      AudioContext.currentTime via an anchor pair, never accumulated per-frame.
   2) The SCHEDULER: a recurring look-ahead pass (~33ms tick, ~150ms lookahead)
      that queues anything due soon — sequencer steps, metronome clicks — using
      real ctx.currentTime-based "when" values. Jitter in *when the pass runs*
      doesn't matter because the sounds themselves are scheduled precisely;
      only "did we queue it before its time arrived" matters, and a 150ms
      window comfortably covers any setInterval delay you'd see in a browser.
   Clip playback is scheduled once per play/seek (see scheduleClipPlayback) —
   AudioBufferSourceNode.start(when) can be scheduled arbitrarily far ahead,
   so clips don't need a recurring pass the way step-sequenced hits do.
*/
let raf=null;
const LOOKAHEAD_SEC=0.15;   // how far into the future the scheduler queues sounds
const SCHED_INTERVAL_MS=33; // how often the scheduler pass runs

// Re-anchor the clock: "right now, song position is secAtAnchor".
// Call this on play, pause, seek/scrub, and rewind — anywhere S.sec is set directly.
function anchorClock(secAtAnchor){
  Audio_.ensure();
  S.clockCtxAnchor=Audio_.ctx.currentTime;
  S.clockSecAnchor=secAtAnchor;
  S.sec=secAtAnchor;
}
// Read the current song position from the audio clock. While playing this
// advances continuously with ctx.currentTime; while stopped it's just the anchor.
function readClockSec(){
  if(!S.playing) return S.clockSecAnchor;
  return S.clockSecAnchor+(Audio_.ctx.currentTime-S.clockCtxAnchor);
}
// Convert a song-position-in-seconds to the real AudioContext time it will occur at.
function songSecToCtxTime(songSec){
  return S.clockCtxAnchor+(songSec-S.clockSecAnchor);
}

function togglePlay(){
  S.playing=!S.playing;
  const btn=document.getElementById('btn-play');
  btn.textContent=S.playing?'⏸':'▶';
  btn.classList.toggle('play-active',S.playing);
  if(S.playing){
    Audio_.ensure();
    Audio_.refreshAllTrackGains();
    anchorClock(S.sec);
    const nowBeat=secToBeat(S.sec);
    S.nextSeqStepBeat=nextStepBeatAtOrAfter(nowBeat); // first 16th at or after now — never in the past
    S.nextMetroBeat=Math.ceil(nowBeat);
    applyAllTrackAutomation();
    uiLoop();
    startScheduler();
    scheduleClipPlayback();
  }
  else{
    cancelAnimationFrame(raf);
    stopScheduler();
    stopAllScheduled();
    document.querySelectorAll('.step').forEach(b=>b.classList.remove('cur'));
  }
  if(S.activePanel==='mixer') updateMeterAnim();
  if(S.activePanel==='rec') animateVU();
}
function rewind(){
  S.seqStep=-1;
  anchorClock(0);
  updateTime();posPlayhead();
  if(S.playing){
    const nowBeat=secToBeat(S.sec);
    S.nextSeqStepBeat=nextStepBeatAtOrAfter(nowBeat);
    S.nextMetroBeat=Math.ceil(nowBeat);
    stopAllScheduled(); scheduleClipPlayback(); applyAllTrackAutomation();
  }
}

// ── UI-only render loop ──
// Reads the clock and paints the playhead/time display at display refresh
// rate. Critically, this loop never WRITES S.sec from frame deltas — it only
// reads it via readClockSec(), so dropped/throttled frames (background tabs,
// heavy GC pauses, etc.) cause visual stutter at worst, never audio drift.
function uiLoop(){
  raf=requestAnimationFrame(()=>{
    S.sec=readClockSec();
    S.pct=(secToBeat(S.sec)/ARR_BEATS)%1;
    updateTime();posPlayhead();followArrangementPlayhead();
    if(S.playing)uiLoop();
  });
}

// ── Look-ahead scheduler ──
// Runs on a plain interval, but only ever uses it to decide WHAT to queue —
// every sound it triggers gets an exact ctx.currentTime-derived "when", so the
// interval's own timing slop never reaches the audible output.
function startScheduler(){
  stopScheduler();
  schedulerTick(); // run once immediately so the very next 16th isn't missed
  S.schedTimer=setInterval(schedulerTick,SCHED_INTERVAL_MS);
}
function stopScheduler(){
  clearInterval(S.schedTimer);
  S.schedTimer=null;
}
function schedulerTick(){
  if(!S.playing)return;
  const nowSec=readClockSec();
  const horizon=secToBeat(nowSec+LOOKAHEAD_SEC);
  scheduleSeqSteps(horizon);
  scheduleMetronome(horizon);
}

// Steps a fixed 16-step grid at 16th-note resolution, looping every 4 beats.
// Each due step is scheduled with an exact "when" rather than fired live, so
// the kick/snare/hat/clap stay locked to the grid regardless of UI load.
function scheduleSeqSteps(horizonBeat){
  const stepLenBeat=0.25; // a 16th note
  while(S.nextSeqStepBeat<horizonBeat){
    const stepBeat=S.nextSeqStepBeat;
    const stepIndex=Math.round(stepBeat/stepLenBeat)%16;
    const when=songSecToCtxTime(beatToSec(stepBeat));
    PADS.slice(0,4).forEach(p=>{
      if((S.seqSteps[p.id]||[])[stepIndex]){
        Audio_.synthDrum(p.n,null,when);
      }
    });
    // Visually flag the step a hair after it actually sounds, scheduled via
    // setTimeout against real elapsed ms so the UI lights up in sync with audio.
    const delayMs=Math.max(0,(when-Audio_.ctx.currentTime)*1000);
    setTimeout(()=>flashSeqStep(stepIndex),delayMs);
    S.nextSeqStepBeat+=stepLenBeat;
  }
}
function flashSeqStep(stepIndex){
  if(!S.playing)return;
  S.seqStep=stepIndex;
  document.querySelectorAll('.seq-row').forEach(row=>{
    const rowSteps=row.querySelectorAll('.step');
    rowSteps.forEach((b,si)=>b.classList.toggle('cur',si===stepIndex));
  });
  PADS.slice(0,4).forEach(p=>{
    if((S.seqSteps[p.id]||[])[stepIndex]){
      const padBtn=document.getElementById('pad-'+p.id);
      if(padBtn){padBtn.style.filter='brightness(2.5)';setTimeout(()=>{if(padBtn)padBtn.style.filter='';},80);}
    }
  });
}

// One click per beat, scheduled the same look-ahead way. Wired to the
// recOpts.metronome toggle in the Record panel.
function scheduleMetronome(horizonBeat){
  if(!S.recOpts.metronome)return;
  while(S.nextMetroBeat<horizonBeat){
    const beat=S.nextMetroBeat;
    const when=songSecToCtxTime(beatToSec(beat));
    const isBar=Math.round(beat)%4===0;
    metronomeClick(when,isBar);
    S.nextMetroBeat+=1;
  }
}
function metronomeClick(when,accent){
  const ctx=Audio_.ensure();
  const osc=ctx.createOscillator();osc.type='square';
  osc.frequency.value=accent?1500:1000;
  const g=ctx.createGain();
  g.gain.setValueAtTime(accent?0.22:0.14,when);
  g.gain.exponentialRampToValueAtTime(0.0001,when+0.05);
  osc.connect(g);g.connect(Audio_.master);
  osc.start(when);osc.stop(when+0.06);
}

// ── Real audio clip scheduling ──
// Walks every track's clips and schedules an AudioBufferSourceNode for any clip
// (that has a real decoded buffer) whose time range is still ahead of the playhead.
// Re-run whenever playback starts or the playhead jumps (seek/rewind), since the
// Web Audio scheduling is absolute-time and doesn't auto-adjust for seeks.
function scheduleClipPlayback(){
  stopAllScheduled();
  if(!S.playing)return;
  Audio_.ensure();
  const ctxNow=Audio_.ctx.currentTime;
  const nowBeat=secToBeat(S.sec);
  S.tracks.forEach(t=>{
    const gainNode=Audio_.trackInput(t.id);
    t.clips.forEach(clip=>{
      if(!clip.bufferId||clip.recording)return; // decorative/in-progress clips make no sound
      const bufEntry=S.buffers[clip.bufferId];
      if(!bufEntry)return;
      const clipEndBeat=clip.start+clip.len;
      if(clipEndBeat<=nowBeat)return; // fully in the past, skip
      const startBeat=Math.max(clip.start,nowBeat);
      const offsetIntoClipSec=beatToSec(startBeat-clip.start)+(clip.trimStart||0);
      const whenSec=ctxNow+beatToSec(startBeat-nowBeat);
      const remainingSec=Math.max(0.01,beatToSec(clipEndBeat-startBeat));
      const playableSec=Math.min(remainingSec,Math.max(0,bufEntry.duration-offsetIntoClipSec));
      if(playableSec<=0.005)return;
      const src=Audio_.ctx.createBufferSource();
      src.buffer=clip.reverse?reversedBuffer(bufEntry.buffer):bufEntry.buffer;
      const playOffset=clip.reverse?Math.max(0,bufEntry.duration-offsetIntoClipSec-playableSec):offsetIntoClipSec;
      if(clip.gain&&clip.gain!==1){
        const clipGain=Audio_.ctx.createGain();
        clipGain.gain.value=clip.gain;
        src.connect(clipGain);clipGain.connect(gainNode);
      } else {
        src.connect(gainNode);
      }
      try{ src.start(whenSec,playOffset,playableSec); }catch(e){/* offset past buffer end, ignore */}
      S.scheduled.push(src);
    });
  });
}
function stopAllScheduled(){
  S.scheduled.forEach(src=>{ try{src.stop();}catch(e){} });
  S.scheduled=[];
}

function updateTime(){
  const m=Math.floor(S.sec/60).toString().padStart(2,'0');
  const s=(S.sec%60).toFixed(3).padStart(6,'0');
  document.getElementById('time-disp').textContent=`${m}:${s}`;
  const spb=240/S.bpm,bar=Math.floor(S.sec/spb)+1,beat=Math.floor((S.sec%spb)/(spb/4))+1;
  document.getElementById('bar-disp').textContent=`BAR ${bar} · BEAT ${beat}`;
}

/* ══════════════════════════════════════════════════════
   OFFLINE BOUNCE — render the whole song to a WAV file
   Real DAWs don't bounce by recording themselves live; they run the entire
   signal graph through an OfflineAudioContext, which processes every sample
   as fast as the CPU allows rather than in real time. A 4-minute song can
   render in a couple of seconds instead of actually taking 4 minutes.
   This path intentionally does NOT reuse the live Audio_ node registries —
   it builds a second, parallel copy of the per-track graph (FX rack -> filter
   -> panner -> gain -> master) against the offline context, scheduling every
   clip/step/automation point from absolute time zero. That isolation means
   exporting can never corrupt (or be corrupted by) a live playback session.
═══════════════════════════════════════════════════════ */

// How long (in seconds) the rendered file needs to be: far enough to cover
// every clip's end and every active sequencer step, plus a tail so reverb/
// delay decay isn't chopped off abruptly at the last note.
function computeSongDurationSec(){
  let maxBeat=4; // never render less than one bar
  S.tracks.forEach(t=>{
    (t.clips||[]).forEach(clip=>{ maxBeat=Math.max(maxBeat,clip.start+clip.len); });
  });
  // The 16-step drum pattern loops for as long as any track has content —
  // already covered by maxBeat above since it reflects real clip extents.
  const tailSec=2.0; // covers reverb/delay decay after the last sound
  return beatToSec(maxBeat)+tailSec;
}

// Builds one track's offline graph: FX rack -> filter -> panner -> gain -> masterGain.
// Mirrors Audio_.rebuildTrackFxRack/ensureTrackFilter/Panner/Gain exactly, just
// against the offline context and writing into plain local maps instead of
// the live Audio_ registries.
function buildOfflineTrackGraph(offlineCtx,masterGain){
  const trackInputs={};   // trackId -> entry point of that track's chain
  const trackGains={};    // trackId -> GainNode (for automation + final mix level)
  const trackPanners={};
  const trackFilters={};
  S.tracks.forEach(t=>{
    const filter=offlineCtx.createBiquadFilter();
    filter.type='lowpass';filter.frequency.value=20000;
    const panner=offlineCtx.createStereoPanner();
    const gain=offlineCtx.createGain();
    const dry=S.trackVol[t.id]??0.85;
    gain.gain.value=dry;
    filter.connect(panner);panner.connect(gain);gain.connect(masterGain);

    const cfgList=(S.trackFx[t.id]||[]).filter(c=>c.on);
    let chainInput=filter;
    if(cfgList.length){
      const built=cfgList.map(cfg=>Audio_.buildEffectNode(cfg,offlineCtx));
      for(let i=0;i<built.length-1;i++) built[i].output.connect(built[i+1].input);
      built[built.length-1].output.connect(filter);
      chainInput=built[0].input;
    }

    trackInputs[t.id]=chainInput;
    trackGains[t.id]=gain;
    trackPanners[t.id]=panner;
    trackFilters[t.id]=filter;
  });
  return {trackInputs,trackGains,trackPanners,trackFilters};
}

// Schedules one track's automation lane onto an offline AudioParam, from
// absolute time 0 — NOT relative to "now", since offline rendering always
// starts a fresh timeline at sample 0. Mirrors applyTrackAutomation's ramp
// logic but without any "catch up from current transport position" handling.
function scheduleOfflineAutomation(trackId,param,audioParam,baseValueWhenEmpty){
  const lane=S.automation[trackId]&&S.automation[trackId][param];
  if(!lane||lane.length===0){ audioParam.setValueAtTime(baseValueWhenEmpty,0); return; }
  if(lane.length===1){ audioParam.setValueAtTime(valueToParamRange(param,lane[0].value),0); return; }
  const sorted=[...lane].sort((a,b)=>a.beat-b.beat);
  sorted.forEach((p,i)=>{
    const t=Math.max(0,beatToSec(p.beat));
    const v=valueToParamRange(param,p.value);
    if(i===0) audioParam.setValueAtTime(v,t);
    else audioParam.linearRampToValueAtTime(v,t);
  });
}

// Schedules every clip's AudioBufferSourceNode against the offline graph,
// at its absolute beat-derived start time (no "relative to playhead" math —
// offline rendering always covers the whole song from t=0).
function scheduleOfflineClips(offlineCtx,trackInputs){
  S.tracks.forEach(t=>{
    const input=trackInputs[t.id];
    (t.clips||[]).forEach(clip=>{
      if(!clip.bufferId)return;
      const bufEntry=S.buffers[clip.bufferId];
      if(!bufEntry)return;
      const whenSec=beatToSec(clip.start);
      const offsetSec=clip.trimStart||0;
      const durSec=Math.min(beatToSec(clip.len),Math.max(0,bufEntry.duration-offsetSec));
      if(durSec<=0.005)return;
      const src=offlineCtx.createBufferSource();
      src.buffer=clip.reverse?reversedBuffer(bufEntry.buffer):bufEntry.buffer;
      const playOffset=clip.reverse?Math.max(0,bufEntry.duration-offsetSec-durSec):offsetSec;
      if(clip.gain&&clip.gain!==1){
        const clipGain=offlineCtx.createGain();
        clipGain.gain.value=clip.gain;
        src.connect(clipGain);clipGain.connect(input);
      } else {
        src.connect(input);
      }
      try{ src.start(whenSec,playOffset,durSec); }catch(e){/* offset past buffer end, ignore */}
    });
  });
}

// Schedules the 16-step drum pattern repeating for the full render duration,
// reusing Audio_.synthDrum's existing per-sound synthesis (it already accepts
// an arbitrary "when" and an arbitrary destination node — see PLAYBACK section).
function scheduleOfflineSequencer(offlineCtx,trackInputs,durationSec){
  // The sequencer isn't tied to a specific track in this app (PADS play
  // through the master in the live engine too), so route it straight to
  // a dedicated gain feeding the same place the live drum pads do: master.
  const stepLenSec=beatToSec(0.25);
  const totalSteps=Math.ceil(durationSec/stepLenSec);
  for(let step=0;step<totalSteps;step++){
    const stepIndex=step%16;
    const when=step*stepLenSec;
    PADS.slice(0,4).forEach(p=>{
      if((S.seqSteps[p.id]||[])[stepIndex]){
        Audio_.synthDrum(p.n,offlineCtx.__masterGain,when);
      }
    });
  }
}

async function renderProjectOfflineToBuffer(){
  Audio_.ensure(); // make sure getImpulseResponse has a live cache to reuse if present
  const durationSec=computeSongDurationSec();
  const sampleRate=Audio_.ctx?Audio_.ctx.sampleRate:44100;
  const numFrames=Math.ceil(durationSec*sampleRate);
  const offlineCtx=new OfflineAudioContext(2,numFrames,sampleRate);

  const masterGain=offlineCtx.createGain();
  masterGain.gain.value=S.masterVol;
  masterGain.connect(offlineCtx.destination);
  offlineCtx.__masterGain=masterGain; // small convenience hook used by scheduleOfflineSequencer

  const {trackInputs,trackGains,trackPanners,trackFilters}=buildOfflineTrackGraph(offlineCtx,masterGain);

  const anySolo=S.tracks.some(tt=>tt.s);
  S.tracks.forEach(t=>{
    const silent=t.m||(anySolo&&!t.s);
    const dry=S.trackVol[t.id]??0.85;
    if(silent){ trackGains[t.id].gain.setValueAtTime(0,0); }
    else { scheduleOfflineAutomation(t.id,'volume',trackGains[t.id].gain,dry); }
    scheduleOfflineAutomation(t.id,'pan',trackPanners[t.id].pan,0);
    scheduleOfflineAutomation(t.id,'filter',trackFilters[t.id].frequency,20000);
  });

  scheduleOfflineClips(offlineCtx,trackInputs);
  scheduleOfflineSequencer(offlineCtx,trackInputs,durationSec);

  return await offlineCtx.startRendering();
}

async function exportWavFile(){
  toast('Rendering offline…');
  let rendered;
  const t0=performance.now();
  try{
    rendered=await renderProjectOfflineToBuffer();
  }catch(e){
    console.error(e);
    toast('Export failed — see console');
    return;
  }
  const renderMs=Math.round(performance.now()-t0);
  const base64=audioBufferToWavBase64(rendered);
  const binary=atob(base64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  const blob=new Blob([bytes],{type:'audio/wav'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  a.href=url;
  a.download=`neusic-bounce-${stamp}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast(`Exported ${rendered.duration.toFixed(1)}s WAV in ${renderMs}ms`);
}

async function toggleRecord(){
  if(!S.recording){
    const armedTracks=S.tracks.filter(t=>t.arm);
    if(!armedTracks.length){toast('Arm a track first (tap the ⬤ on a track)');return;}
    let stream;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
    }catch(err){
      toast('Mic access denied or unavailable');
      return;
    }
    S.recording=true;
    S.recStream=stream;
    const btn=document.getElementById('btn-rec');
    btn.classList.toggle('rec-active',true);
    if(!S.playing)togglePlay();
    toast('⏺ Recording...');

    // Live input level metering via AnalyserNode (used by the Record panel VU meter).
    Audio_.ensure();
    const srcNode=Audio_.ctx.createMediaStreamSource(stream);
    const analyser=Audio_.ctx.createAnalyser();
    analyser.fftSize=512;
    srcNode.connect(analyser);
    S.recAnalyser=analyser;
    S.recDataArr=new Uint8Array(analyser.frequencyBinCount);
    S._recSrcNode=srcNode; // kept only to avoid GC during recording

    // Real capture via MediaRecorder.
    const mimeCandidates=['audio/webm','audio/ogg','audio/mp4'];
    let mime='';
    for(const m of mimeCandidates){ if(window.MediaRecorder&&MediaRecorder.isTypeSupported(m)){mime=m;break;} }
    const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
    S._mediaRecorder=recorder;
    S.recordedChunks=[];
    recorder.ondataavailable=e=>{ if(e.data&&e.data.size>0)S.recordedChunks.push(e.data); };
    recorder.start();

    // Placeholder clips on armed tracks, in BEAT units (consistent with how clips are positioned/drawn).
    snapshot();
    const startBeat=secToBeat(S.sec);
    S._recStartBeat=startBeat;
    armedTracks.forEach(t=>{
      const clipId='rec_'+Date.now()+'_'+t.id;
      t.clips.push({id:clipId,start:startBeat,len:0.25,label:'REC',recording:true,color:'rgba(248,113,113,0.3)'});
    });
    renderTracks();

  } else {
    S.recording=false;
    const btn=document.getElementById('btn-rec');
    btn.classList.toggle('rec-active',false);
    toast('Recording stopped — decoding...');

    const recorder=S._mediaRecorder;
    const stream=S.recStream;
    const endBeat=secToBeat(S.sec);
    const mime=recorder&&recorder.mimeType?recorder.mimeType:'audio/webm';

    const stopped=new Promise(resolve=>{ if(recorder)recorder.onstop=resolve; else resolve(); });
    if(recorder&&recorder.state!=='inactive')recorder.stop();
    await stopped;
    if(stream)stream.getTracks().forEach(tr=>tr.stop());
    S.recAnalyser=null;S.recDataArr=null;S._recSrcNode=null;

    let bufferId=null,realDurationBeats=null;
    try{
      const blob=new Blob(S.recordedChunks,{type:mime});
      const arrBuf=await blob.arrayBuffer();
      Audio_.ensure();
      const decoded=await Audio_.ctx.decodeAudioData(arrBuf);
      bufferId='buf_rec_'+Date.now();
      Audio_.registerBuffer(bufferId,decoded,'Recording');
      realDurationBeats=secToBeat(decoded.duration);
    }catch(err){
      toast('Could not decode recording (too short or unsupported format)');
    }

    S.tracks.forEach(t=>{
      t.clips.forEach(c=>{
        if(c.recording){
          c.len=Math.max(0.25,realDurationBeats??Math.max(0.25,endBeat-c.start));
          c.label=t.name+'_Rec';
          c.bufferId=bufferId;
          delete c.recording;
          delete c.color;
        }
      });
    });
    renderTracks();
    if(S.playing){ stopAllScheduled(); scheduleClipPlayback(); }
    toast(bufferId?'Recording added':'Recording discarded');
  }
}
function bpmTap(e){
  const rect=e.currentTarget.getBoundingClientRect();
  const x=e.clientX-rect.left,w=rect.width;
  S.bpm=x<w/2?Math.max(40,S.bpm-1):Math.min(240,S.bpm+1);
  document.getElementById('bpm-disp').textContent=S.bpm;
  toast(`BPM: ${S.bpm}`);
  if(S.playing){
    // Beats-per-second mapping just changed; re-anchor at the current second so
    // readClockSec() keeps reporting correct wall-clock-accurate song position,
    // then re-run scheduling so not-yet-played clips/steps use the new tempo.
    anchorClock(S.sec);
    const nowBeat=secToBeat(S.sec);
    S.nextSeqStepBeat=nextStepBeatAtOrAfter(nowBeat);
    S.nextMetroBeat=Math.ceil(nowBeat);
    stopAllScheduled(); scheduleClipPlayback(); applyAllTrackAutomation();
  }
}
