/* ═══════════════════════════════════════════════
   Context menu, sidebar track list, drawer panel switching, drum machine
═══════════════════════════════════════════════ */
/* ── CONTEXT MENU ── */
const ctxMenu=document.getElementById('ctx-menu');
function showCtxMenu(x,y){
  ctxMenu.style.display='block';ctxMenu.style.left=x+'px';ctxMenu.style.top=y+'px';
}
document.addEventListener('click',()=>ctxMenu.style.display='none');
document.addEventListener('touchstart',()=>ctxMenu.style.display='none',{passive:true});

function ctxSplit(){
  if(!S.selectedClip)return;
  const {ti,ci}=S.selectedClip;const t=S.tracks[ti];const clip=t.clips[ci];
  const splitAtBeat=secToBeat(S.sec);
  if(splitAtBeat<=clip.start||splitAtBeat>=clip.start+clip.len){toast('Playhead not inside clip');return;}
  snapshot();
  const firstLen=splitAtBeat-clip.start;
  const secondLen=clip.start+clip.len-splitAtBeat;
  const newClip={
    ...clip,
    id:'clip_'+Date.now(),
    start:splitAtBeat,
    len:secondLen,
    label:clip.label+'b',
    // The second half starts further into the same source buffer — carry that
    // forward so it keeps playing the right audio instead of restarting from 0.
    trimStart:(clip.trimStart||0)+(clip.reverse?0:beatToSec(firstLen)),
  };
  clip.len=firstLen;
  t.clips.splice(ci+1,0,newClip);
  renderTracks();
  if(S.playing){ stopAllScheduled(); scheduleClipPlayback(); }
  toast('Split');
}
function ctxDuplicate(){
  if(!S.selectedClip)return;
  const {ti,ci}=S.selectedClip;const t=S.tracks[ti];const clip=t.clips[ci];
  snapshot();
  t.clips.push({...clip,id:'clip_'+Date.now(),start:clip.start+clip.len,label:clip.label+'_copy'});
  renderTracks();
  if(S.playing){ stopAllScheduled(); scheduleClipPlayback(); }
  toast('Duplicated');
}

// Reverse just flips a flag — actual reversed-buffer generation happens lazily
// (and is cached) inside reversedBuffer(), same engine used by the Sampler panel.
function ctxReverse(){
  if(!S.selectedClip){ctxMenu.style.display='none';return;}
  const {ti,ci}=S.selectedClip;const clip=S.tracks[ti].clips[ci];
  if(!clip.bufferId){toast('No audio on this clip to reverse');ctxMenu.style.display='none';return;}
  snapshot();
  clip.reverse=!clip.reverse;
  renderTracks();
  if(S.playing){ stopAllScheduled(); scheduleClipPlayback(); }
  toast(clip.reverse?'Reversed':'Un-reversed');
  ctxMenu.style.display='none';
}

// Normalize analyzes the clip's actual audio region for its true peak sample value,
// then stores a per-clip gain multiplier so playback boosts/attenuates it to ~0dB
// (peak = 1.0) without touching the shared source buffer (other clips may reuse it).
function ctxNormalize(){
  if(!S.selectedClip){ctxMenu.style.display='none';return;}
  const {ti,ci}=S.selectedClip;const clip=S.tracks[ti].clips[ci];
  const entry=clip.bufferId?S.buffers[clip.bufferId]:null;
  if(!entry){toast('No audio on this clip to normalize');ctxMenu.style.display='none';return;}
  const sr=entry.buffer.sampleRate;
  const startSample=Math.max(0,Math.floor((clip.trimStart||0)*sr));
  const endSample=Math.min(entry.buffer.length,Math.floor(((clip.trimStart||0)+beatToSec(clip.len))*sr));
  let peak=0;
  for(let c=0;c<entry.buffer.numberOfChannels;c++){
    const data=entry.buffer.getChannelData(c);
    for(let i=startSample;i<endSample;i+=4){ // sample every 4th frame — plenty for a peak estimate
      const v=Math.abs(data[i]);if(v>peak)peak=v;
    }
  }
  if(peak<0.001){toast('Clip region is silent, nothing to normalize');ctxMenu.style.display='none';return;}
  snapshot();
  clip.gain=Math.min(8,0.98/peak); // cap the boost so a near-silent region can't scream
  renderTracks();
  if(S.playing){ stopAllScheduled(); scheduleClipPlayback(); }
  toast(`Normalized (×${clip.gain.toFixed(2)})`);
  ctxMenu.style.display='none';
}
function ctxDelete(){
  if(!S.selectedClip)return;
  snapshot();
  const {ti,ci}=S.selectedClip;
  S.tracks[ti].clips.splice(ci,1);
  S.selectedClip=null;renderTracks();
  if(S.playing){ stopAllScheduled(); scheduleClipPlayback(); }
  toast('Deleted');
}

/* ── SIDEBAR ── */
function buildSidebar(){
  document.getElementById('sb-list').innerHTML=S.tracks.map((t,i)=>`
    <div class="sb-item${i===S.activeTrack?' active':''}" onclick="selectTrack(${i})">
      <div class="sb-dot" style="background:${t.color}"></div>
      <span class="sb-name">${t.name}</span>
    </div>`).join('');
  document.getElementById('sb-nav').innerHTML=['Drums','Piano Roll','Sampler','Effects','Mixer','Automation'].map((n,i)=>{
    const ids=['drums','piano','sampler','fx','mixer','auto'];
    const icons=['🥁','🎹','✂️','🎚️','🎛️','〜'];
    return `<button class="sb-nav-btn${S.activePanel===ids[i]?' active':''}" onclick="openDrawer('${ids[i]}')">
      <span class="ni-icon">${icons[i]}</span>${n}</button>`;
  }).join('');
}

function toggleSidebar(){
  S.sidebarOpen=!S.sidebarOpen;
  document.getElementById('sidebar').classList.toggle('collapsed',!S.sidebarOpen);
}

/* ── DRAWER ── */
const PANELS=['drums','piano','sampler','browser','fx','mixer','auto','rec'];
const PANEL_LABELS={drums:'Drums',piano:'Piano Roll',sampler:'Sampler',browser:'Browser',fx:'Effects',mixer:'Mixer',auto:'Automation',rec:'Record'};

function openDrawer(id){
  S.activePanel=id;S.drawerOpen=true;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer').classList.remove('closed');
  rebuildDrawer(id);
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
  const tb=document.getElementById('tb-'+id);if(tb)tb.classList.add('active');
  buildSidebar();
  if(id==='mixer')updateMeterAnim();else cancelMeterAnim();
  if(id==='rec')animateVU();
}

function rebuildDrawer(active){
  document.getElementById('dtabs').innerHTML=PANELS.map(p=>`
    <button class="dtab${p===active?' active':''}" onclick="switchPanel('${p}')">${PANEL_LABELS[p]}</button>`).join('');
  PANELS.forEach(p=>{
    const el=document.getElementById('dp-'+p);
    el.classList.toggle('active',p===active);
    if(p===active)buildPanelContent(p);
  });
}

function switchPanel(id){S.activePanel=id;rebuildDrawer(id);if(id==='mixer')updateMeterAnim();else cancelMeterAnim();if(id==='rec')animateVU();}

function toggleDrawer(){
  S.drawerOpen=!S.drawerOpen;
  document.getElementById('drawer').classList.toggle('open',S.drawerOpen);
  document.getElementById('drawer').classList.toggle('closed',!S.drawerOpen);
}

function buildPanelContent(id){
  const el=document.getElementById('dp-'+id);
  switch(id){
    case 'drums':  buildDrums(el);  break;
    case 'piano':  buildPiano(el);  break;
    case 'sampler':buildSampler(el);break;
    case 'fx':     buildFX(el);     break;
    case 'mixer':  buildMixer(el);  break;
    case 'auto':   buildAuto(el);   break;
    case 'rec':    buildRec(el);    break;
    case 'browser': buildBrowser(el); break;
  }
}

/* ── DRUM MACHINE ── */
function buildDrums(el){
  const padHTML=PADS.map(p=>`
    <button class="pad-btn" id="pad-${p.id}" style="color:${p.col};background:${p.bg};"
      onmousedown="hitPad(${p.id},'${p.n}')" ontouchstart="hitPad(${p.id},'${p.n}')">${p.n}</button>`).join('');
  const seqHTML=PADS.slice(0,4).map(p=>{
    const steps=S.seqSteps[p.id]||Array(16).fill(0);
    let stHTML='';
    steps.forEach((on,i)=>{
      if(i===4||i===8||i===12)stHTML+=`<div class="step-gap"></div>`;
      stHTML+=`<button class="step${on?' on':''}" style="${on?`background:${p.col}44;color:${p.col};box-shadow:2px 2px 4px var(--nsd),0 0 5px ${p.col}`:''}"
        onclick="toggleStep(${p.id},${i},this,'${p.col}')"></button>`;
    });
    return `<div class="seq-row"><div class="seq-lbl" style="color:${p.col}">${p.n}</div><div class="seq-steps">${stHTML}</div></div>`;
  }).join('');
  el.innerHTML=`<div class="pad-section">
    <div class="pad-grid">${padHTML}</div>
    <div class="seq-area">${seqHTML}</div>
  </div>`;
}

function hitPad(id,name){
  const btn=document.getElementById('pad-'+id);
  if(btn){btn.classList.add('hit');setTimeout(()=>btn.classList.remove('hit'),110);}
  Audio_.synthDrum(name);
}
function toggleStep(id,i,btn,col){
  const steps=S.seqSteps[id]||(S.seqSteps[id]=Array(16).fill(0));
  steps[i]=steps[i]?0:1;const on=steps[i];
  btn.classList.toggle('on',!!on);
  btn.style.background=on?col+'44':'';btn.style.color=on?col:'';
  btn.style.boxShadow=on?`2px 2px 4px var(--nsd),0 0 5px ${col}`:'';
}
// NOTE: the step sequencer is no longer driven by its own setInterval timer —
// see scheduleSeqSteps()/flashSeqStep() in the PLAYBACK section above, which
// schedule each 16th-note hit with a precise look-ahead "when" instead of
// firing live from a timer callback (the classic source of audible drum jitter).


/* ══════════════════════════════════════════════════════
   PIANO ROLL — full 88-key scrollable grid
   ══════════════════════════════════════════════════════
   Layout:
     pr-minimap-wrap  — song-position mini-map (top)
     pr-toolbar       — tool buttons + quantise selector
     pr-grid-container
       pr-keys-col    — 88 piano keys, synced vertical scroll
       pr-grid-scroll — 2-D scrollable note grid canvas
     pr-vel-wrap      — velocity lane (bottom strip)
     pr-knobs         — pitch/pan/gain/tune knobs
   ═══════════════════════════════════════════════════════ */
