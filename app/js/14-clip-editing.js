/* ═══════════════════════════════════════════════
   Non-destructive clip editing: fade in/out, gain, pitch shift, stretch, crossfade, bounce
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   PHASE 6G — CLIP EDITING: FADE, PITCH, STRETCH, CROSSFADE, BOUNCE
   All non-destructive. Metadata on clip; scheduler reads it.
═══════════════════════════════════════════════════════════════ */
function ctxFadeIn(){
  if(!S.selectedClip){ctxMenu.style.display='none';return;}
  const {ti,ci}=S.selectedClip,clip=S.tracks[ti].clips[ci];
  snapshot();clip.fadeIn=Math.min(clip.len,1);renderTracks();
  if(S.playing){stopAllScheduled();scheduleClipPlayback();}
  toast('Fade in applied');ctxMenu.style.display='none';
}
function ctxFadeOut(){
  if(!S.selectedClip){ctxMenu.style.display='none';return;}
  const {ti,ci}=S.selectedClip,clip=S.tracks[ti].clips[ci];
  snapshot();clip.fadeOut=Math.min(clip.len,1);renderTracks();
  if(S.playing){stopAllScheduled();scheduleClipPlayback();}
  toast('Fade out applied');ctxMenu.style.display='none';
}
function ctxClipGain(){
  if(!S.selectedClip){ctxMenu.style.display='none';return;}
  const {ti,ci}=S.selectedClip,clip=S.tracks[ti].clips[ci];
  ctxMenu.style.display='none';
  showInlineEdit('Clip gain (%)',Math.round((clip.gain||1)*100),v=>{
    clip.gain=Math.max(0,Math.min(8,parseInt(v,10)||100)/100);
    renderTracks();if(S.playing){stopAllScheduled();scheduleClipPlayback();}
    toast(`Gain: ${Math.round(clip.gain*100)}%`);
  });
}
function ctxPitchShift(){
  if(!S.selectedClip){ctxMenu.style.display='none';return;}
  const {ti,ci}=S.selectedClip,clip=S.tracks[ti].clips[ci];
  ctxMenu.style.display='none';
  showInlineEdit('Pitch shift (semitones, e.g. −5 to +12)',clip.pitchShift||0,v=>{
    snapshot();clip.pitchShift=Math.max(-24,Math.min(24,parseFloat(v)||0));
    patchSchedulerForClipOpts();
    if(S.playing){stopAllScheduled();scheduleClipPlayback();}
    toast(`Pitch: ${clip.pitchShift>0?'+':''}${clip.pitchShift} st`);
  });
}
function ctxStretch(){
  if(!S.selectedClip){ctxMenu.style.display='none';return;}
  const {ti,ci}=S.selectedClip,clip=S.tracks[ti].clips[ci];
  ctxMenu.style.display='none';
  showInlineEdit('Playback rate (1=normal, 0.5=half speed, 2=double)',clip.playbackRate||1,v=>{
    snapshot();clip.playbackRate=Math.max(0.1,Math.min(4,parseFloat(v)||1));
    patchSchedulerForClipOpts();
    if(S.playing){stopAllScheduled();scheduleClipPlayback();}
    toast(`Stretch ×${clip.playbackRate}`);
  });
}
function ctxCrossfade(){
  if(!S.selectedClip){ctxMenu.style.display='none';return;}
  const {ti,ci}=S.selectedClip,t=S.tracks[ti],clip=t.clips[ci],next=t.clips[ci+1];
  if(!next){toast('No next clip');ctxMenu.style.display='none';return;}
  snapshot();
  const xl=Math.min(0.5,clip.len/2,next.len/2);
  clip.fadeOut=xl;next.fadeIn=xl;next.start=clip.start+clip.len-xl;
  renderTracks();if(S.playing){stopAllScheduled();scheduleClipPlayback();}
  toast('Crossfade applied');ctxMenu.style.display='none';
}
async function ctxBounce(){
  if(!S.selectedClip){ctxMenu.style.display='none';return;}
  const {ti,ci}=S.selectedClip,clip=S.tracks[ti].clips[ci];
  if(!clip.bufferId){toast('No audio to bounce');ctxMenu.style.display='none';return;}
  const entry=S.buffers[clip.bufferId];ctxMenu.style.display='none';
  if(!entry)return;
  toast('Bouncing…');
  const sr=entry.buffer.sampleRate;
  const s0=Math.floor((clip.trimStart||0)*sr);
  const s1=Math.min(entry.buffer.length,Math.floor(((clip.trimStart||0)+beatToSec(clip.len))*sr));
  const len=s1-s0;if(len<=0){toast('Nothing to bounce');return;}
  const off=new OfflineAudioContext(entry.buffer.numberOfChannels,len,sr);
  const src=off.createBufferSource();src.buffer=entry.buffer;
  if(clip.playbackRate)src.playbackRate.value=clip.playbackRate;
  if(clip.pitchShift)src.detune.value=clip.pitchShift*100;
  const g=off.createGain();g.gain.value=clip.gain||1;
  src.connect(g);g.connect(off.destination);
  src.start(0,clip.trimStart||0,beatToSec(clip.len));
  let rendered;
  try{rendered=await off.startRendering();}catch(e){toast('Bounce failed');return;}
  const id='buf_bounce_'+Date.now();
  Audio_.registerBuffer(id,rendered,clip.label+'_bnc');
  snapshot();clip.bufferId=id;clip.trimStart=0;clip.gain=1;
  delete clip.pitchShift;delete clip.playbackRate;delete clip.fadeIn;delete clip.fadeOut;
  renderTracks();if(S.playing){stopAllScheduled();scheduleClipPlayback();}
  toast('Bounced to new clip');
}

function showInlineEdit(label,def,cb){
  document.getElementById('inline-edit-pop')?.remove();
  const d=document.createElement('div');d.id='inline-edit-pop';
  d.innerHTML=`<div class="iep-lbl">${label}</div>
    <input class="iep-inp" id="iep-inp" type="number" step="any" value="${def}">
    <div class="iep-btns">
      <button class="iep-btn prim" id="iep-ok">Apply</button>
      <button class="iep-btn" onclick="document.getElementById('inline-edit-pop').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(d);
  const inp=document.getElementById('iep-inp');inp.focus();inp.select();
  document.getElementById('iep-ok').onclick=()=>{const v=inp.value;d.remove();cb(v);};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){const v=inp.value;d.remove();cb(v);}});
}

// Patch scheduler for pitchShift / playbackRate / fadeIn / fadeOut
let _schedPatched=false;
function patchSchedulerForClipOpts(){
  if(_schedPatched)return;_schedPatched=true;
  const orig=window.scheduleClipPlayback;
  window.scheduleClipPlayback=function(){
    stopAllScheduled();if(!S.playing)return;
    Audio_.ensure();const ctxNow=Audio_.ctx.currentTime,nowBeat=secToBeat(S.sec);
    S.tracks.forEach(t=>{
      const gn=Audio_.trackInput(t.id);
      t.clips.forEach(clip=>{
        if(!clip.bufferId||clip.recording)return;
        const entry=S.buffers[clip.bufferId];if(!entry)return;
        const endBeat=clip.start+clip.len;if(endBeat<=nowBeat)return;
        const startBeat=Math.max(clip.start,nowBeat);
        const offsetSec=beatToSec(startBeat-clip.start)+(clip.trimStart||0);
        const whenSec=ctxNow+beatToSec(startBeat-nowBeat);
        const remainSec=Math.max(0.01,beatToSec(endBeat-startBeat));
        const playSec=Math.min(remainSec,Math.max(0,entry.duration-offsetSec));
        if(playSec<=0.005)return;
        const src=Audio_.ctx.createBufferSource();
        src.buffer=clip.reverse?reversedBuffer(entry.buffer):entry.buffer;
        if(clip.playbackRate)src.playbackRate.value=clip.playbackRate;
        if(clip.pitchShift)src.detune.value=clip.pitchShift*100;
        const g=Audio_.ctx.createGain();const bg=clip.gain||1;
        if(clip.fadeIn&&clip.fadeIn>0){const fs=beatToSec(clip.fadeIn);g.gain.setValueAtTime(0,whenSec);g.gain.linearRampToValueAtTime(bg,whenSec+fs);}
        else g.gain.setValueAtTime(bg,whenSec);
        if(clip.fadeOut&&clip.fadeOut>0){const fs=beatToSec(clip.fadeOut),ft=whenSec+playSec-fs;if(ft>whenSec){g.gain.setValueAtTime(bg,ft);g.gain.linearRampToValueAtTime(0,whenSec+playSec);}}
        src.connect(g);g.connect(gn);
        const offset=clip.reverse?Math.max(0,entry.duration-offsetSec-playSec):offsetSec;
        try{src.start(whenSec,offset,playSec);}catch(e){}
        S.scheduled.push(src);
      });
    });
  };
}
patchSchedulerForClipOpts();
