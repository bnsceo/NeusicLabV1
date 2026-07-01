/* ═══════════════════════════════════════════════
   MPC pad banks A-D, note repeat, 16 levels, swing, velocity lane drag editing
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   PHASE 6A — MPC PAD BANKS + NOTE REPEAT + 16 LEVELS + SWING
   Upgrades the sampler's slice-marker row into a full
   4×4 MPC-style pad grid with banks A/B/C/D (64 pads total),
   velocity-sensitive hit detection, note-repeat toggling,
   16-Levels mode, and swing offset on even-numbered pads.
═══════════════════════════════════════════════════════════════ */
Object.assign(S,{
  padBank:'A',
  padBanks:{A:[],B:[],C:[],D:[]},
  noteRepeat:false,
  noteRepeatRate:0.25,
  mpc16Levels:false,
  mpcSwing:0,
  mpcQuantise:0.25,
});

/* Replace buildSampler to inject the MPC grid beneath the existing waveform UI */
const _origBuildSampler=window.buildSampler;
window.buildSampler=function(el){
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  const fnameText=entry
    ?`${entry.name} · ${entry.duration.toFixed(2)}s · ${S.bpm} BPM`
    :'No sample loaded — drop a file below or tap to browse';
  el.innerHTML=`<div class="sampler-section">
    <div class="samp-filename">${fnameText}</div>
    <div class="samp-wave" id="samp-drop"><canvas id="samp-canvas"></canvas></div>
    <div class="samp-modes">
      <button class="samp-mode${S.samplerMode==='slice'?' active':''}"   onclick="setSampMode(this,'slice')">Slice</button>
      <button class="samp-mode${S.samplerMode==='chop'?' active':''}"    onclick="setSampMode(this,'chop')">Chop</button>
      <button class="samp-mode${S.samplerMode==='trim'?' active':''}"    onclick="setSampMode(this,'trim')">Trim</button>
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

    <!-- MPC pad bank selector -->
    <div class="mpc-bank-row" style="margin-top:8px;">
      ${['A','B','C','D'].map(b=>`<button class="mpc-bank-btn${S.padBank===b?' active':''}"
        onclick="switchPadBank('${b}',this)">${b}</button>`).join('')}
      <div style="flex:1"></div>
      <button class="mpc-feat-btn${S.noteRepeat?' active':''}" id="mpc-nr"  onclick="toggleNoteRepeat(this)">♾ Repeat</button>
      <button class="mpc-feat-btn${S.mpc16Levels?' active':''}" id="mpc-16" onclick="toggle16Levels(this)">16 Lv</button>
    </div>
    <!-- Swing control -->
    <div class="mpc-swing-row">
      <span>Swing</span>
      <input type="range" min="0" max="50" value="${S.mpcSwing}" step="1" id="mpc-swing-sl"
        oninput="S.mpcSwing=+this.value;document.getElementById('mpc-swing-v').textContent=this.value+'%'">
      <span id="mpc-swing-v">${S.mpcSwing}%</span>
    </div>
    <!-- 4×4 pad grid -->
    <div id="mpc-pad-grid" class="mpc-pad-grid"></div>
  </div>`;
  requestAnimationFrame(()=>{drawSampler();buildMpcPadGrid();setupSamplerDrop();});
};

function buildMpcPadGrid(){
  const grid=document.getElementById('mpc-pad-grid');if(!grid)return;
  const asgns=S.padBanks[S.padBank];
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  const col=(S.tracks[S.activeTrack]||{color:'#b06ef3'}).color;
  // Auto-populate bank A from current slices if empty
  if(S.padBank==='A'&&asgns.length===0&&S.samplerSlices.length){
    S.padBanks.A=S.samplerSlices.slice(0,16).map((_,i)=>({sliceIdx:i,vel:100,pitch:0}));
  }
  grid.innerHTML=Array.from({length:16},(_,i)=>{
    const asgn=asgns[i];
    const has=asgn!=null&&S.samplerSlices[asgn?.sliceIdx]!=null;
    return `<div class="mpc-pad${has?'':' empty'}"
      style="background:${col}${has?'22':'0d'};border-color:${col}${has?'55':'22'};"
      id="mpc-pad-${i}"
      ontouchstart="hitMpcPad(${i},event)" onclick="hitMpcPad(${i},event)">
      <span class="mpc-pad-num">${S.padBank}${i+1}</span>
      <span class="mpc-pad-lbl">${has?(i+1):'—'}</span>
      ${has?`<span class="mpc-pad-vel">${asgns[i].vel}</span>`:''}
    </div>`;
  }).join('');
}

/* Auto-sync pad grid after every chop */
const _origAutoChop=window.autoChop;
window.autoChop=function(){
  _origAutoChop();
  // After chopTransient finishes (it's synchronous), rebuild pads
  setTimeout(()=>{
    S.padBanks.A=S.samplerSlices.slice(0,16).map((_,i)=>({sliceIdx:i,vel:100,pitch:0}));
    buildMpcPadGrid();
  },50);
};
const _origChopEqual=window.chopEqual;
window.chopEqual=function(){
  _origChopEqual();
  setTimeout(()=>{
    S.padBanks.A=S.samplerSlices.slice(0,16).map((_,i)=>({sliceIdx:i,vel:100,pitch:0}));
    buildMpcPadGrid();
  },50);
};

function hitMpcPad(i,e){
  e&&e.stopPropagation();
  // Auto-assign if slot empty and slice exists
  if(!S.padBanks[S.padBank][i]){
    if(S.samplerSlices[i]){
      S.padBanks[S.padBank][i]={sliceIdx:i,vel:100,pitch:0};
      buildMpcPadGrid();
    }
    return;
  }
  const asgn=S.padBanks[S.padBank][i];
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  const sl=S.samplerSlices[asgn.sliceIdx];
  if(!entry||!sl)return;

  // 16 Levels: each row is a different velocity tier (0-3 = soft, 4-7 = med-soft, etc.)
  const vel=S.mpc16Levels?Math.round(((i+1)/16)*127):(asgn.vel??100);

  // Swing: even pads (2nd/4th of each beat) get a slight onset delay
  const swingDelay=(S.mpcSwing>0&&i%2===1)?beatToSec(S.mpcSwing/200*S.mpcQuantise):0;

  const pad=document.getElementById('mpc-pad-'+i);
  if(pad){pad.classList.add('hit');setTimeout(()=>pad?.classList.remove('hit'),110);}

  const doPlay=()=>{
    Audio_.ensure();
    Audio_.playBuffer(entry.buffer,{
      offset:sl.start,duration:sl.end-sl.start,
      gain:vel/127,reverse:S.samplerMode==='reverse',
    });
  };
  if(swingDelay>0)setTimeout(doPlay,swingDelay*1000); else doPlay();

  // Note repeat: schedule additional hits while pad held
  if(S.noteRepeat&&!pad._repeatTmr){
    const intervalMs=beatToSec(S.noteRepeatRate)*1000;
    pad._repeatTmr=setInterval(doPlay,intervalMs);
    const stopRepeat=()=>{clearInterval(pad._repeatTmr);delete pad._repeatTmr;};
    pad.addEventListener('mouseup',stopRepeat,{once:true});
    pad.addEventListener('touchend',stopRepeat,{once:true});
  }
}

function switchPadBank(bank,btn){
  S.padBank=bank;
  btn.closest('.mpc-bank-row').querySelectorAll('.mpc-bank-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  buildMpcPadGrid();
}
function toggleNoteRepeat(btn){S.noteRepeat=!S.noteRepeat;btn.classList.toggle('active',S.noteRepeat);toast(S.noteRepeat?'Note Repeat ON':'Note Repeat OFF');}
function toggle16Levels(btn){S.mpc16Levels=!S.mpc16Levels;btn.classList.toggle('active',S.mpc16Levels);toast(S.mpc16Levels?'16 Levels ON':'16 Levels OFF');}


/* ═══════════════════════════════════════════════════════════════
   PHASE 6B — VELOCITY LANE DRAG EDITING
═══════════════════════════════════════════════════════════════ */
(function initVelEditor(){
  let drag=null;
  const observer=new MutationObserver(attachVelEditor);
  const dp=document.getElementById('dp-piano');
  if(dp)observer.observe(dp,{childList:true,subtree:true});

  function attachVelEditor(){
    const wrap=document.getElementById('pr-vel-canvas')?.parentElement;
    if(!wrap||wrap._velWired)return;
    wrap._velWired=true;

    const posVel=(py,h)=>Math.max(1,Math.min(127,Math.round((1-py/h)*127)));
    const nearestNote=(px,w)=>{
      const beatsTotal=PR.BARS*PR.BEATS_PER_BAR;
      const beat=(px/w)*beatsTotal;
      let best=-1,bd=Infinity;
      PR.notes.forEach((n,i)=>{const d=Math.abs(n.beat-beat);if(d<bd&&d<0.75){bd=d;best=i;}});
      return best;
    };
    const redraw=()=>{const col=(S.tracks[S.activeTrack]||{}).color||'#b06ef3';prDrawGrid(col);prDrawVelocity(col);};

    wrap.addEventListener('mousedown',e=>{
      const r=wrap.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
      if(e.shiftKey){drag={range:true,x0:px,y:py,h:r.height,w:r.width};return;}
      const idx=nearestNote(px,r.width);if(idx<0)return;
      snapshot();PR.notes[idx].vel=posVel(py,r.height);redraw();
      drag={idx,h:r.height,w:r.width};e.preventDefault();
    });
    window.addEventListener('mousemove',e=>{
      if(!drag)return;
      const r=wrap.getBoundingClientRect(),py=e.clientY-r.top;
      if(drag.range){
        const x0=Math.min(drag.x0,e.clientX-r.left),x1=Math.max(drag.x0,e.clientX-r.left);
        const beatsTotal=PR.BARS*PR.BEATS_PER_BAR;
        const b0=(x0/drag.w)*beatsTotal,b1=(x1/drag.w)*beatsTotal;
        const vel=posVel(py,drag.h);
        PR.notes.forEach(n=>{if(n.beat>=b0&&n.beat<=b1)n.vel=vel;});
      } else {PR.notes[drag.idx].vel=posVel(py,drag.h);}
      redraw();
    });
    window.addEventListener('mouseup',()=>{drag=null;});
    wrap.addEventListener('touchstart',e=>{
      const r=wrap.getBoundingClientRect(),t=e.touches[0];
      const idx=nearestNote(t.clientX-r.left,r.width);if(idx<0)return;
      snapshot();drag={idx,h:r.height,w:r.width};e.preventDefault();
    },{passive:false});
    wrap.addEventListener('touchmove',e=>{
      if(!drag||drag.range)return;
      const r=wrap.getBoundingClientRect(),py=e.touches[0].clientY-r.top;
      PR.notes[drag.idx].vel=Math.max(1,Math.min(127,Math.round((1-py/drag.h)*127)));
      redraw();e.preventDefault();
    },{passive:false});
    wrap.addEventListener('touchend',()=>{drag=null;});
  }
})();
