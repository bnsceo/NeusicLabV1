/* ═══════════════════════════════════════════════
   88-key scrollable piano roll: grid, keys, velocity lane, minimap, tools
═══════════════════════════════════════════════ */
const PR={
  NOTE_H:12,        // px per semitone row
  TOTAL_NOTES:88,   // A0 (MIDI 21) → C8 (MIDI 108)
  MIDI_TOP:108,     // highest note displayed at top
  PPB:60,           // pixels per beat (horizontal zoom)
  BARS:32,          // total bars in the roll
  BEATS_PER_BAR:4,
  quantise:0.25,    // beats (1/16 note default)
  activeTool:'draw',// draw | select | erase
  notes:[],         // [{midi, beat, len, vel}]
  selNotes:new Set(),
  drag:null,        // active drag state
  prScrollSync:0,   // last vertical scroll position
};

// Demo notes seeded when the panel opens (one octave of a Cm scale over 4 bars)
const PR_DEMO_NOTES=[
  {midi:60,beat:0,   len:1,  vel:100},
  {midi:62,beat:1,   len:0.5,vel:90 },
  {midi:63,beat:1.5, len:0.5,vel:88 },
  {midi:65,beat:2,   len:1,  vel:95 },
  {midi:67,beat:3,   len:1,  vel:92 },
  {midi:67,beat:4,   len:2,  vel:98 },
  {midi:65,beat:6,   len:0.5,vel:85 },
  {midi:63,beat:6.5, len:0.5,vel:82 },
  {midi:62,beat:7,   len:1,  vel:88 },
  {midi:60,beat:8,   len:2,  vel:100},
  {midi:55,beat:0,   len:4,  vel:70 },
  {midi:55,beat:4,   len:4,  vel:68 },
  {midi:58,beat:0,   len:8,  vel:60 },
  {midi:72,beat:2,   len:0.25,vel:95},
  {midi:74,beat:2.5, len:0.25,vel:88},
  {midi:75,beat:3,   len:0.25,vel:92},
  {midi:77,beat:3.5, len:0.25,vel:90},
];

function buildPiano(el){
  if(PR.notes.length===0)PR.notes=PR_DEMO_NOTES.map(n=>({...n}));
  const t=S.tracks[S.activeTrack];
  const col=t?t.color:'#a78bfa';

  el.innerHTML=`<div class="pr-section">
    <div class="pr-minimap-wrap" id="pr-minimap-wrap">
      <canvas id="pr-minimap"></canvas>
      <div class="pr-minimap-window" id="pr-mm-win"></div>
      <div class="pr-minimap-ph" id="pr-mm-ph"></div>
    </div>

    <div class="pr-toolbar">
      <button class="pr-tool-btn${PR.activeTool==='draw'?' active':''}"   id="prt-draw"   onclick="setPRTool('draw')">✏️ Draw</button>
      <button class="pr-tool-btn${PR.activeTool==='select'?' active':''}" id="prt-select" onclick="setPRTool('select')">⬚ Select</button>
      <button class="pr-tool-btn${PR.activeTool==='erase'?' active':''}"  id="prt-erase"  onclick="setPRTool('erase')">⌫ Erase</button>
      <select class="pr-quant-select" id="pr-quant" onchange="setPRQuant(this.value)">
        <option value="2">1/2</option>
        <option value="1">1/4</option>
        <option value="0.5">1/8</option>
        <option value="0.25" selected>1/16</option>
        <option value="0.125">1/32</option>
        <option value="0">Free</option>
      </select>
      <div class="pr-zoom-grp">
        <button class="pr-tool-btn" onclick="prZoom(1.25)" title="Zoom in">＋</button>
        <button class="pr-tool-btn" onclick="prZoom(0.8)"  title="Zoom out">－</button>
        <button class="pr-tool-btn" onclick="prZoomFit()"  title="Fit">⊡</button>
      </div>
    </div>

    <div class="pr-grid-container" id="pr-grid-container">
      <div class="pr-keys-col" id="pr-keys-col">
        <canvas id="pr-keys-canvas"></canvas>
      </div>
      <div class="pr-grid-scroll" id="pr-grid-scroll">
        <canvas id="pr-canvas"></canvas>
      </div>
    </div>

    <div class="pr-vel-wrap">
      <canvas id="pr-vel-canvas"></canvas>
    </div>

    <div class="pr-knobs">
      ${[['Pitch','0 st',160],['Pan','C',180],['Gain','0 dB',175],['Tune','0%',180]].map(([l,v,d])=>`
      <div class="knob-wrap">
        <div class="knob"><div class="knob-dot" style="transform:translateX(-50%) rotate(${d}deg)"></div></div>
        <div class="knob-lbl">${l}</div><div class="knob-val">${v}</div>
      </div>`).join('')}
    </div>
  </div>`;

  requestAnimationFrame(()=>prInit(col));
}

/* ── Initialise dimensions & bind events ── */
function prInit(col){
  const scroll=document.getElementById('pr-grid-scroll');
  const keysCol=document.getElementById('pr-keys-col');
  if(!scroll)return;

  // Size the inner canvas to the full virtual size
  prResizeCanvases();

  // Sync vertical scroll: keys column mirrors grid scroll
  scroll.addEventListener('scroll',()=>{
    keysCol.scrollTop=scroll.scrollTop;
    PR.prScrollSync=scroll.scrollTop;
    prDrawKeys(col);
    prDrawMinimap(col);
    prUpdateMinimapWindow();
  });

  // Scroll to around middle C (MIDI 60) on open
  const midCRow=(PR.MIDI_TOP-60)*PR.NOTE_H;
  scroll.scrollTop=Math.max(0,midCRow-scroll.clientHeight/2);
  scroll.scrollLeft=0;

  prDrawKeys(col);
  prDrawGrid(col);
  prDrawVelocity(col);
  prDrawMinimap(col);
  prUpdateMinimapWindow();
  prBindGridEvents(col);
  prBindMinimapEvents();
}

/* ── Canvas sizing ── */
function prResizeCanvases(){
  const container=document.getElementById('pr-grid-container');
  const scroll=document.getElementById('pr-grid-scroll');
  const keysCol=document.getElementById('pr-keys-col');
  const kc=document.getElementById('pr-keys-canvas');
  const gc=document.getElementById('pr-canvas');
  const mm=document.getElementById('pr-minimap');
  const vc=document.getElementById('pr-vel-canvas');
  if(!container||!scroll||!kc||!gc)return;

  const totalH=PR.TOTAL_NOTES*PR.NOTE_H;
  const totalW=PR.BARS*PR.BEATS_PER_BAR*PR.PPB;
  const visH=container.clientHeight||200;
  const keysW=42;

  // Keys column canvas — as tall as the full note range
  keysCol.style.height=visH+'px';
  keysCol.style.overflowY='hidden'; // keys scroll driven by JS not CSS
  kc.width=keysW;kc.height=totalH;
  kc.style.width=keysW+'px';kc.style.height=totalH+'px';

  // Grid canvas — full virtual size, scroll container clips it
  gc.width=totalW;gc.height=totalH;
  gc.style.width=totalW+'px';gc.style.height=totalH+'px';
  scroll.style.height=visH+'px';

  // Minimap
  if(mm){const mmw=mm.parentElement.offsetWidth||300;mm.width=mmw;mm.height=28;}

  // Velocity lane
  if(vc){vc.width=vc.parentElement.offsetWidth||300;vc.height=36;}
}

/* ── Draw the fixed piano key column ── */
function prDrawKeys(col){
  const c=document.getElementById('pr-keys-canvas');if(!c)return;
  const scroll=document.getElementById('pr-grid-scroll');
  const scrollTop=scroll?scroll.scrollTop:0;
  const ctx=c.getContext('2d'),w=c.width;
  const blackPCs=[1,3,6,8,10]; // pitch classes that are black keys

  ctx.fillStyle='#0f0f1e';ctx.fillRect(0,0,w,c.height);

  for(let i=0;i<PR.TOTAL_NOTES;i++){
    const midi=PR.MIDI_TOP-i;
    const pc=(midi)%12;
    const y=i*PR.NOTE_H;
    const isBlack=blackPCs.includes(pc);
    const isC=pc===0;

    // Key background
    ctx.fillStyle=isBlack?'#1a1a2e':isC?'#2a2a42':'#22223a';
    ctx.fillRect(0,y,w,PR.NOTE_H);

    // Subtle divider
    ctx.strokeStyle=isC?'rgba(176,110,243,.35)':'rgba(255,255,255,.05)';
    ctx.lineWidth=isC?1:0.5;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();

    // Black key visual accent
    if(isBlack){
      ctx.fillStyle='rgba(0,0,0,.45)';
      ctx.fillRect(0,y,w*0.72,PR.NOTE_H);
    }

    // Note name labels — C notes and every 12th
    if(isC){
      const oct=Math.floor(midi/12)-1;
      ctx.fillStyle='rgba(176,110,243,.8)';
      ctx.font=`700 8px system-ui`;
      ctx.textAlign='right';
      ctx.fillText(`C${oct}`,w-3,y+PR.NOTE_H-2);
    }
  }

  // Scroll the keys canvas to match grid scroll
  const kc=document.getElementById('pr-keys-col');
  if(kc)kc.style.transform=`translateY(-${scrollTop}px)`;
}

/* ── Draw the note grid ── */
function prDrawGrid(col){
  const c=document.getElementById('pr-canvas');if(!c)return;
  const ctx=c.getContext('2d'),w=c.width,h=c.height;
  const blackPCs=[1,3,6,8,10];
  const beatsTotal=PR.BARS*PR.BEATS_PER_BAR;

  ctx.fillStyle='#14142a';ctx.fillRect(0,0,w,h);

  // Horizontal rows — one per semitone
  for(let i=0;i<PR.TOTAL_NOTES;i++){
    const midi=PR.MIDI_TOP-i;
    const pc=midi%12;
    const y=i*PR.NOTE_H;
    if(blackPCs.includes(pc)){ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(0,y,w,PR.NOTE_H);}
    // Octave C lines
    if(pc===0){ctx.strokeStyle='rgba(176,110,243,.2)';ctx.lineWidth=1;}
    else{ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=0.5;}
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
  }

  // Vertical beat/bar lines
  for(let b=0;b<=beatsTotal;b++){
    const x=b*PR.PPB;
    if(b%PR.BEATS_PER_BAR===0){
      ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;
      // Bar number label
      ctx.fillStyle='rgba(255,255,255,.25)';
      ctx.font='700 9px system-ui';ctx.textAlign='left';
      ctx.fillText(`${b/PR.BEATS_PER_BAR+1}`,x+3,10);
    } else {
      ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=0.5;
    }
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
  }

  // Notes
  PR.notes.forEach((n,idx)=>{
    const row=PR.MIDI_TOP-n.midi;
    if(row<0||row>=PR.TOTAL_NOTES)return;
    const x=n.beat*PR.PPB;
    const y=row*PR.NOTE_H;
    const nw=Math.max(4,n.len*PR.PPB-1);
    const nh=PR.NOTE_H-1;
    const selected=PR.selNotes.has(idx);
    const alpha=selected?'ff':'cc';

    // Note body
    ctx.fillStyle=col+alpha;
    ctx.beginPath();ctx.roundRect(x,y+0.5,nw,nh-1,2);ctx.fill();

    // Highlight sheen on top edge
    ctx.fillStyle='rgba(255,255,255,.22)';
    ctx.beginPath();ctx.roundRect(x,y+0.5,nw,2,1);ctx.fill();

    // Selected outline
    if(selected){
      ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.roundRect(x,y+0.5,nw,nh-1,2);ctx.stroke();
    }

    // Resize handle on right edge (last 4px)
    ctx.fillStyle='rgba(255,255,255,.3)';
    ctx.fillRect(x+nw-3,y+2,2,nh-4);
  });

  // Transport playhead
  const phX=S.pct*beatsTotal*PR.PPB;
  ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(phX,0);ctx.lineTo(phX,h);ctx.stroke();
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.moveTo(phX-4,0);ctx.lineTo(phX+4,0);ctx.lineTo(phX,6);ctx.fill();
}

/* ── Draw velocity lane ── */
function prDrawVelocity(col){
  const c=document.getElementById('pr-vel-canvas');if(!c)return;
  const ctx=c.getContext('2d'),w=c.width,h=c.height;
  const beatsTotal=PR.BARS*PR.BEATS_PER_BAR;
  ctx.fillStyle='#0f0f1e';ctx.fillRect(0,0,w,h);
  PR.notes.forEach(n=>{
    const x=(n.beat/beatsTotal)*w;
    const bw=Math.max(2,(n.len/beatsTotal)*w-1);
    const bh=((n.vel||80)/127)*(h-4);
    ctx.fillStyle=col+'99';
    ctx.beginPath();ctx.roundRect(x,h-bh-1,bw,bh,2);ctx.fill();
  });
  ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=0.5;
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,0);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.2)';ctx.font='8px system-ui';ctx.textAlign='left';
  ctx.fillText('vel',2,9);
}

/* ── Mini-map ── */
function prDrawMinimap(col){
  const c=document.getElementById('pr-minimap');if(!c)return;
  const ctx=c.getContext('2d'),w=c.width,h=c.height;
  const beatsTotal=PR.BARS*PR.BEATS_PER_BAR;
  const noteRange=PR.TOTAL_NOTES;
  ctx.fillStyle='#0f0f1e';ctx.fillRect(0,0,w,h);
  // Beat grid faint lines
  for(let b=0;b<=PR.BARS;b++){
    const x=(b*PR.BEATS_PER_BAR/beatsTotal)*w;
    ctx.strokeStyle=b%4===0?'rgba(255,255,255,.1)':'rgba(255,255,255,.04)';
    ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
  }
  // Notes as tiny rects
  PR.notes.forEach(n=>{
    const row=PR.MIDI_TOP-n.midi;if(row<0||row>=noteRange)return;
    const x=(n.beat/beatsTotal)*w;
    const y=(row/noteRange)*h;
    const nw=Math.max(1,(n.len/beatsTotal)*w);
    const nh=Math.max(1,h/noteRange*2);
    ctx.fillStyle=col+'cc';
    ctx.fillRect(x,y,nw,nh);
  });
}

function prUpdateMinimapWindow(){
  const scroll=document.getElementById('pr-grid-scroll');
  const win=document.getElementById('pr-mm-win');
  const ph=document.getElementById('pr-mm-ph');
  const mm=document.getElementById('pr-minimap');
  if(!scroll||!win||!mm)return;

  const totalW=PR.BARS*PR.BEATS_PER_BAR*PR.PPB;
  const totalH=PR.TOTAL_NOTES*PR.NOTE_H;
  const visW=scroll.clientWidth;const visH=scroll.clientHeight;
  const mmW=mm.offsetWidth||300;const mmH=mm.offsetHeight||28;

  const left=(scroll.scrollLeft/totalW)*mmW;
  const winW=Math.max(8,(visW/totalW)*mmW);
  win.style.left=left+'px';win.style.width=winW+'px';

  // Playhead in minimap
  if(ph){
    const beatsTotal=PR.BARS*PR.BEATS_PER_BAR;
    ph.style.left=((S.pct*beatsTotal*PR.PPB)/totalW*mmW)+'px';
  }
}

/* ── Minimap drag to seek horizontal scroll ── */
function prBindMinimapEvents(){
  const mm=document.getElementById('pr-minimap-wrap');
  const win=document.getElementById('pr-mm-win');
  const scroll=document.getElementById('pr-grid-scroll');
  if(!mm||!scroll)return;
  let dragging=false,startX=0,startScrollL=0;
  const seek=cx=>{
    const rect=mm.getBoundingClientRect();
    const frac=Math.max(0,Math.min(1,(cx-rect.left)/rect.width));
    const totalW=PR.BARS*PR.BEATS_PER_BAR*PR.PPB;
    scroll.scrollLeft=frac*totalW;
    prUpdateMinimapWindow();
  };
  mm.addEventListener('mousedown',e=>{dragging=true;startX=e.clientX;startScrollL=scroll.scrollLeft;seek(e.clientX);});
  window.addEventListener('mousemove',e=>{if(!dragging)return;seek(e.clientX);});
  window.addEventListener('mouseup',()=>{dragging=false;});
  mm.addEventListener('touchstart',e=>{dragging=true;seek(e.touches[0].clientX);},{passive:true});
  window.addEventListener('touchmove',e=>{if(!dragging)return;seek(e.touches[0].clientX);},{passive:true});
  window.addEventListener('touchend',()=>{dragging=false;});
}

/* ── Grid interaction: draw / erase / select ── */
function prBindGridEvents(col){
  const c=document.getElementById('pr-canvas');if(!c)return;
  let dragState=null;

  const posFromEvent=e=>{
    const rect=c.getBoundingClientRect();
    const scroll=document.getElementById('pr-grid-scroll');
    const cx=(e.touches?e.touches[0].clientX:e.clientX)-rect.left+scroll.scrollLeft;
    const cy=(e.touches?e.touches[0].clientY:e.clientY)-rect.top+scroll.scrollTop;
    const midi=PR.MIDI_TOP-Math.floor(cy/PR.NOTE_H);
    const rawBeat=cx/PR.PPB;
    const beat=PR.quantise>0?Math.round(rawBeat/PR.quantise)*PR.quantise:rawBeat;
    return {midi,beat:Math.max(0,beat),x:cx,y:cy};
  };

  const noteAt=(x,y)=>{
    const scroll=document.getElementById('pr-grid-scroll');
    const sy=scroll?scroll.scrollTop:0;const sx=scroll?scroll.scrollLeft:0;
    const midi=PR.MIDI_TOP-Math.floor(y/PR.NOTE_H);
    const beat=x/PR.PPB;
    return PR.notes.findIndex(n=>{
      if(n.midi!==midi)return false;
      return beat>=n.beat&&beat<=n.beat+n.len;
    });
  };

  const redraw=()=>{ prDrawGrid(col);prDrawVelocity(col);prDrawMinimap(col);prUpdateMinimapWindow(); };

  c.addEventListener('mousedown',e=>{
    const {midi,beat,x,y}=posFromEvent(e);
    if(PR.activeTool==='draw'){
      const existing=noteAt(x,y);
      if(existing>=0){
        // Check if near right edge (resize)
        const n=PR.notes[existing];
        const nx=(n.beat+n.len)*PR.PPB;
        if(Math.abs(x-nx)<8){dragState={mode:'resize',idx:existing,startX:x,origLen:n.len};return;}
        // Drag existing note
        dragState={mode:'move',idx:existing,startX:x,startBeat:x/PR.PPB,origBeat:n.beat};return;
      }
      snapshot();
      const newIdx=PR.notes.length;
      PR.notes.push({midi,beat,len:PR.quantise||0.25,vel:100});
      dragState={mode:'resize',idx:newIdx,startX:x,origLen:PR.quantise||0.25};
      redraw();
    } else if(PR.activeTool==='erase'){
      const idx=noteAt(x,y);
      if(idx>=0){snapshot();PR.notes.splice(idx,1);redraw();}
    } else if(PR.activeTool==='select'){
      PR.selNotes.clear();
      const idx=noteAt(x,y);
      if(idx>=0){PR.selNotes.add(idx);dragState={mode:'move',idx,startX:x,startBeat:x/PR.PPB,origBeat:PR.notes[idx].beat};}
      redraw();
    }
  });

  window.addEventListener('mousemove',e=>{
    if(!dragState)return;
    const scroll=document.getElementById('pr-grid-scroll');
    const rect=c.getBoundingClientRect();
    const cx=(e.touches?e.touches[0].clientX:e.clientX)-rect.left+(scroll?scroll.scrollLeft:0);
    const n=PR.notes[dragState.idx];if(!n)return;
    if(dragState.mode==='resize'){
      const newLen=Math.max(PR.quantise||0.125,(cx-n.beat*PR.PPB)/PR.PPB);
      n.len=PR.quantise>0?Math.round(newLen/PR.quantise)*PR.quantise:newLen;
    } else if(dragState.mode==='move'){
      const delta=(cx-dragState.startX)/PR.PPB;
      let nb=dragState.origBeat+delta;
      if(PR.quantise>0)nb=Math.round(nb/PR.quantise)*PR.quantise;
      n.beat=Math.max(0,nb);
    }
    redraw();
  });

  window.addEventListener('mouseup',()=>{if(dragState){dragState=null;redraw();}});
  c.addEventListener('touchstart',e=>{e.preventDefault();const {midi,beat,x,y}=posFromEvent(e);if(PR.activeTool==='draw'){const existing=noteAt(x,y);if(existing<0){snapshot();PR.notes.push({midi,beat,len:PR.quantise||0.25,vel:100});redraw();}}},{passive:false});
  c.addEventListener('touchmove',e=>{e.preventDefault();},{passive:false});
  c.addEventListener('dblclick',e=>{
    const {x,y}=posFromEvent(e);
    const idx=noteAt(x,y);
    if(idx>=0){snapshot();PR.notes.splice(idx,1);redraw();}
  });
}

/* ── Tool / zoom helpers ── */
function setPRTool(t){
  PR.activeTool=t;
  document.querySelectorAll('.pr-tool-btn').forEach(b=>b.classList.remove('active'));
  const tb=document.getElementById('prt-'+t);if(tb)tb.classList.add('active');
  const c=document.getElementById('pr-canvas');
  if(c)c.style.cursor=t==='erase'?'not-allowed':t==='select'?'default':'crosshair';
}

function setPRQuant(v){PR.quantise=parseFloat(v);}

function prZoom(factor){
  PR.PPB=Math.max(10,Math.min(240,Math.round(PR.PPB*factor)));
  const scroll=document.getElementById('pr-grid-scroll');
  const oldScrollLeft=scroll?scroll.scrollLeft:0;
  prResizeCanvases();
  if(scroll)scroll.scrollLeft=oldScrollLeft*factor;
  const col=(S.tracks[S.activeTrack]||{}).color||'#a78bfa';
  prDrawKeys(col);prDrawGrid(col);prDrawVelocity(col);prDrawMinimap(col);prUpdateMinimapWindow();
}

function prZoomFit(){
  const scroll=document.getElementById('pr-grid-scroll');if(!scroll)return;
  const visW=scroll.clientWidth;
  const beatsTotal=PR.BARS*PR.BEATS_PER_BAR;
  PR.PPB=Math.max(10,Math.floor(visW/beatsTotal));
  prResizeCanvases();
  if(scroll){scroll.scrollLeft=0;scroll.scrollTop=Math.max(0,(PR.MIDI_TOP-60)*PR.NOTE_H-scroll.clientHeight/2);}
  const col=(S.tracks[S.activeTrack]||{}).color||'#a78bfa';
  prDrawKeys(col);prDrawGrid(col);prDrawVelocity(col);prDrawMinimap(col);prUpdateMinimapWindow();
}

function drawPR(col){
  /* legacy shim — called from window resize handler */
  if(document.getElementById('pr-canvas')&&document.getElementById('pr-minimap')){
    prResizeCanvases();
    prDrawKeys(col);prDrawGrid(col);prDrawVelocity(col);prDrawMinimap(col);prUpdateMinimapWindow();
  }
}
