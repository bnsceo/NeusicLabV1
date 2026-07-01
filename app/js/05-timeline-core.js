/* ═══════════════════════════════════════════════
   Timeline zoom/scroll, ruler, overview, playhead, track/clip rendering, waveform canvases, drag & drop
═══════════════════════════════════════════════ */
/* ── TIMELINE ZOOM & SCROLL ── */
const ARR_BEATS=128;
function pxPerBeat(){ return 40*S.zoom; }
function beatToX(beat){ return beat*pxPerBeat()-S.scrollX; }
function beatToContentX(beat){ return beat*pxPerBeat(); }
function xToBeat(x){ return x/pxPerBeat(); }
function viewportXToBeat(x){ return (x+S.scrollX)/pxPerBeat(); }
function arrangementWidth(){ return Math.max(ARR_BEATS*pxPerBeat(),document.getElementById('tracks-area')?.clientWidth||0); }
function updateZoomReadout(){
  const zr=document.getElementById('zoom-read');
  if(zr)zr.textContent=S.zoom.toFixed(1)+'×';
}
function syncTimelineMetrics(){
  const root=document.documentElement;
  root.style.setProperty('--beat-w',pxPerBeat()+'px');
  root.style.setProperty('--timeline-w',arrangementWidth()+'px');
  updateZoomReadout();
}
// Canonical tempo conversions — clip start/len are always in BEATS (quarter notes).
function secPerBeat(){ return 60/S.bpm; }
function beatToSec(beat){ return beat*secPerBeat(); }
function secToBeat(sec){ return sec/secPerBeat(); }
// Snaps UP to the next 16th-note grid line at or after nowBeat. Must be "at or
// after", never "nearest" or "floor" — scheduling something at a beat that's
// already in the past produces a negative AudioParam time and throws.
function nextStepBeatAtOrAfter(nowBeat){ return Math.ceil(nowBeat*4)/4; }

function zoom(dir){
  const scroll=document.getElementById('tracks-scroll');
  const hdrW=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-w'))||0;
  const centerBeat=scroll?viewportXToBeat(Math.max(0,(scroll.clientWidth-hdrW)/2)):secToBeat(S.sec);
  S.zoom=Math.max(0.25,Math.min(8,S.zoom*(dir>0?1.35:1/1.35)));
  syncTimelineMetrics();
  if(scroll){
    scroll.scrollLeft=Math.max(0,centerBeat*pxPerBeat()-(scroll.clientWidth-hdrW)/2);
    S.scrollX=scroll.scrollLeft;
  }
  renderTracks();drawRuler();drawAutoCanvas();updateOverview();toast(`Zoom: ${S.zoom.toFixed(1)}×`);
}

/* Pinch-to-zoom on tracks scroll */
let pinchDist=0;
document.getElementById('tracks-scroll').addEventListener('touchstart',e=>{
  if(e.touches.length===2){
    pinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  }
},{passive:true});
document.getElementById('tracks-scroll').addEventListener('touchmove',e=>{
  if(e.touches.length===2){
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const delta=d-pinchDist;
    if(Math.abs(delta)>5){zoom(delta>0?1:-1);pinchDist=d;}
    e.preventDefault();
  }
},{passive:false});

/* Scroll wheel zoom */
document.getElementById('tracks-area').addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(e.deltaY<0?1:-1);}
},{passive:false});

document.getElementById('tracks-scroll').addEventListener('scroll',e=>{
  S.scrollX=e.currentTarget.scrollLeft;
  drawRuler();
  posPlayhead();
  updateOverview();
  drawAllLaneWaveforms();
},{passive:true});

/* ── RULER ── */
function drawRuler(){
  const canvas=document.getElementById('ruler-canvas');
  const area=document.getElementById('tracks-area');
  const laneW=area.offsetWidth-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-w'));
  canvas.width=Math.max(laneW,100);canvas.height=32;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const ppb=pxPerBeat();
  const totalBeats=Math.ceil((canvas.width+S.scrollX)/ppb)+2;
  const startBeat=Math.floor(S.scrollX/ppb);
  for(let b=startBeat;b<=startBeat+totalBeats;b++){
    const x=beatToX(b);
    if(x<0||x>canvas.width)continue;
    const isBar=b%4===0;
    const isHalf=b%2===0;
    ctx.strokeStyle=isBar?'rgba(255,255,255,0.34)':isHalf?'rgba(255,255,255,0.13)':'rgba(255,255,255,0.07)';
    ctx.beginPath();ctx.moveTo(x,isBar?0:isHalf?12:18);ctx.lineTo(x,32);ctx.stroke();
    if(isBar){
      ctx.fillStyle='rgba(255,255,255,0.58)';ctx.font='700 10px system-ui';
      ctx.fillText(`${b/4+1}`,x+5,13);
    }
  }
}

/* ── OVERVIEW ── */
function updateOverview(){
  const ov=document.getElementById('overview');
  const win=document.getElementById('ov-win');
  const cur=document.getElementById('ov-cur');
  const scroll=document.getElementById('tracks-scroll');
  if(!ov||!win||!cur||!scroll)return;
  const total=Math.max(1,arrangementWidth());
  const hdrW=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-w'))||0;
  const visible=Math.max(1,scroll.clientWidth-hdrW);
  win.style.left=(Math.min(1,S.scrollX/total)*100)+'%';
  win.style.width=(Math.min(1,visible/total)*100)+'%';
  cur.style.left=(Math.min(1,Math.max(0,secToBeat(S.sec)/ARR_BEATS))*100)+'%';
}
function seekToPct(pct){
  S.pct=Math.max(0,Math.min(1,pct));
  const targetSec=beatToSec(S.pct*ARR_BEATS);
  if(S.playing){
    anchorClock(targetSec);
    const nowBeat=secToBeat(S.sec);
    S.nextSeqStepBeat=nextStepBeatAtOrAfter(nowBeat);
    S.nextMetroBeat=Math.ceil(nowBeat);
    stopAllScheduled(); scheduleClipPlayback(); applyAllTrackAutomation();
  } else {
    S.sec=targetSec;
    S.clockSecAnchor=targetSec; // keep anchor consistent even while paused
  }
  updateTime();posPlayhead();
}
function seekOv(e){
  const rect=e.currentTarget.getBoundingClientRect();
  seekToPct((e.clientX-rect.left)/rect.width);
}
function seekOvT(e){
  const rect=e.currentTarget.getBoundingClientRect();
  seekToPct((e.touches[0].clientX-rect.left)/rect.width);
}
function buildOv(){
  const rows=Math.max(1,S.tracks.length);
  document.getElementById('ov-segs').innerHTML=S.tracks.flatMap((t,ti)=>{
    if(!t.clips.length)return [`<div class="ov-seg" style="left:0%;width:2%;top:${(ti+.35)/rows*100}%;background:${t.color};color:${t.color}"></div>`];
    return t.clips.map(clip=>{
      const left=Math.max(0,Math.min(100,(clip.start/ARR_BEATS)*100));
      const width=Math.max(.8,Math.min(100-left,(clip.len/ARR_BEATS)*100));
      const top=(ti+.25)/rows*100;
      return `<div class="ov-seg" style="left:${left}%;width:${width}%;top:${top}%;background:${t.color};color:${t.color}"></div>`;
    });
  }).join('');
  updateOverview();
}

/* ── PLAYHEAD ── */
function posPlayhead(){
  const ph=document.getElementById('playhead');
  const hdrW=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-w'));
  const nowBeat=secToBeat(S.sec);
  S.pct=Math.min(1,Math.max(0,nowBeat/ARR_BEATS));
  ph.style.left=(hdrW+beatToContentX(nowBeat))+'px';
  ph.style.height=document.getElementById('tracks-inner').scrollHeight+'px';
  updateOverview();
  // PR playhead
  const prPh=document.getElementById('pr-ph');
  if(prPh){const prG=document.getElementById('pr-canvas');if(prG)prPh.style.left=(S.pct*prG.width)+'px';}
  drawAutoCanvas();
}

function followArrangementPlayhead(){
  const scroll=document.getElementById('tracks-scroll');
  if(!scroll||!S.playing)return;
  const hdrW=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-w'))||0;
  const phX=secToBeat(S.sec)*pxPerBeat();
  const viewW=Math.max(1,scroll.clientWidth-hdrW);
  const left=scroll.scrollLeft;
  if(phX<left+viewW*.08||phX>left+viewW*.82){
    scroll.scrollLeft=Math.max(0,phX-viewW*.18);
  }
}

function centerArrangementOnPlayhead(){
  const scroll=document.getElementById('tracks-scroll');
  if(!scroll)return;
  const hdrW=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-w'))||0;
  const viewW=Math.max(1,scroll.clientWidth-hdrW);
  const phX=secToBeat(S.sec)*pxPerBeat();
  scroll.scrollLeft=Math.max(0,phX-viewW*.35);
  S.scrollX=scroll.scrollLeft;
}

/* ── TRACKS ── */
function renderTracks(){
  syncTimelineMetrics();
  const inner=document.getElementById('tracks-inner');
  const ph=document.getElementById('playhead');
  inner.style.minWidth=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-w'))+arrangementWidth())+'px';
  inner.querySelectorAll('.track-row').forEach(r=>r.remove());
  S.tracks.forEach((t,ti)=>{
    const row=document.createElement('div');
    row.className='track-row'+(ti===S.activeTrack?' selected':'');
    row.dataset.ti=ti;
    // Header
    const hdr=document.createElement('div');
    hdr.className='track-hdr';
    hdr.innerHTML=`
      <div class="track-color-bar" style="background:${t.color}"></div>
      <div class="track-icon" style="background:${t.color}22">${t.icon}</div>
      <div class="track-meta">
        <div class="track-num">Track ${String(t.id).padStart(2,'0')}</div>
        <div class="track-name">${t.name}</div>
        <div class="track-kind">${(t.type||'audio').toUpperCase()}</div>
      </div>
      <div class="track-ctrls">
        <div class="ms-row">
          <button class="btn-ms m${t.m?' on':''}" data-ti="${ti}" onclick="event.stopPropagation();toggleM(${ti})">M</button>
          <button class="btn-ms s${t.s?' on':''}" data-ti="${ti}" onclick="event.stopPropagation();toggleS(${ti})">S</button>
        </div>
        <button class="btn-arm${t.arm?' on':''}" style="color:${t.color}" onclick="event.stopPropagation();toggleArm(${ti})"></button>
      </div>`;
    hdr.onclick=()=>selectTrack(ti);
    row.appendChild(hdr);
    // Clip lane
    const lane=document.createElement('div');
    lane.className='clip-lane'+(S.recording&&t.arm?' recording-lane':'');
    lane.dataset.ti=ti;
    // Canvas for waveform background
    const cvs=document.createElement('canvas');
    cvs.className='lane-canvas';
    cvs.style.width='100%';cvs.style.height='100%';
    lane.appendChild(cvs);
    // Draw clips
    t.clips.forEach((clip,ci)=>{
      const clipEl=buildClipEl(t,ti,clip,ci);
      lane.appendChild(clipEl);
    });
    setupLaneFileDrop(lane,t,ti);
    row.appendChild(lane);
    inner.insertBefore(row,inner.querySelector('.add-track-row')||null);
  });
  inner.insertBefore(ph,inner.firstChild);
  requestAnimationFrame(()=>{
    drawAllLaneWaveforms();
    drawRuler();
    posPlayhead();
    buildOv();
  });
  buildSidebar();
}

function buildClipEl(t,ti,clip,ci){
  const ppb=pxPerBeat();
  const x=clip.start*ppb;
  const w=clip.len*ppb;
  const el=document.createElement('div');
  el.className='clip-el'+(S.selectedClip&&S.selectedClip.ci===ci&&S.selectedClip.ti===ti?' selected':'');
  el.style.left=x+'px';
  el.style.width=w+'px';
  el.style.background=`linear-gradient(135deg,${t.color}55,${t.color}22 58%,rgba(255,255,255,.08))`;
  el.style.border=`1px solid ${t.color}88`;
  el.innerHTML=`<div class="clip-label" style="color:#fff">${clip.label||clip.id}</div>
    <div class="clip-sub">${clip.start.toFixed(1)} / ${clip.len.toFixed(1)} beats</div>
    <div class="clip-resize-r" data-ci="${ci}" data-ti="${ti}"></div>`;
  el.dataset.ci=ci;el.dataset.ti=ti;
  // Click to select
  el.onclick=e=>{e.stopPropagation();selectClip(ti,ci);};
  el.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();selectClip(ti,ci);showCtxMenu(e.clientX,e.clientY);};
  // Drag to move
  setupClipDrag(el,ti,ci);
  // Resize handle
  const resizeHandle=el.querySelector('.clip-resize-r');
  setupResizeDrag(resizeHandle,ti,ci);
  return el;
}

// ── Drag-and-drop / click-to-browse audio file import onto a track lane ──
let _laneFileInput=null;
function getLaneFileInput(){
  if(_laneFileInput)return _laneFileInput;
  const inp=document.createElement('input');
  inp.type='file';inp.accept='audio/*';inp.style.display='none';
  document.body.appendChild(inp);
  _laneFileInput=inp;
  return inp;
}

function setupLaneFileDrop(lane,t,ti){
  let dragDepth=0;
  lane.addEventListener('dragover',e=>{
    e.preventDefault();
    lane.classList.add('drop-target');
  });
  lane.addEventListener('dragenter',e=>{ e.preventDefault(); dragDepth++; lane.classList.add('drop-target'); });
  lane.addEventListener('dragleave',()=>{ dragDepth=Math.max(0,dragDepth-1); if(dragDepth===0)lane.classList.remove('drop-target'); });
  lane.addEventListener('drop',async e=>{
    e.preventDefault();
    dragDepth=0;lane.classList.remove('drop-target');
    const file=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
    if(!file||!file.type.startsWith('audio')){ if(file)toast('Drop an audio file (wav/mp3/etc.)'); return; }
    const rect=lane.getBoundingClientRect();
    const dropBeat=Math.max(0,Math.floor(xToBeat(e.clientX-rect.left)));
    await importFileToTrack(file,t,ti,dropBeat);
  });

  // Click empty lane space (single click, not the dblclick-to-add-placeholder area) to
  // browse for a file — touch-friendly fallback for devices without OS drag-and-drop.
  lane.addEventListener('click',e=>{
    if(e.target!==lane&&!e.target.classList.contains('lane-canvas'))return;
    const inp=getLaneFileInput();
    const rect=lane.getBoundingClientRect();
    const dropBeat=Math.max(0,Math.floor(xToBeat(e.clientX-rect.left)));
    inp.onchange=async()=>{
      const file=inp.files&&inp.files[0];
      inp.value='';
      if(!file)return;
      await importFileToTrack(file,t,ti,dropBeat);
    };
    inp.click();
  });
}

async function importFileToTrack(file,t,ti,dropBeat){
  toast('Decoding '+file.name+'...');
  let bufferId;
  try{
    bufferId=await Audio_.decodeFile(file);
  }catch(err){
    toast('Could not decode that file');
    return;
  }
  const entry=S.buffers[bufferId];
  const lenBeats=Math.max(0.25,secToBeat(entry.duration));
  snapshot();
  t.clips.push({
    id:'clip_'+Date.now(),
    start:dropBeat,
    len:lenBeats,
    label:file.name.replace(/\.[^.]+$/,''),
    bufferId,
  });
  renderTracks();
  if(S.playing){ stopAllScheduled(); scheduleClipPlayback(); }
  toast('Imported '+file.name);
}

function selectClip(ti,ci){
  S.selectedClip={ti,ci};
  document.querySelectorAll('.clip-el').forEach(el=>el.classList.remove('selected'));
  document.querySelectorAll(`[data-ti="${ti}"][data-ci="${ci}"]`).forEach(el=>{
    if(el.classList.contains('clip-el'))el.classList.add('selected');
  });
}

function selectTrack(ti){S.activeTrack=ti;renderTracks();}

function toggleM(ti){snapshot();S.tracks[ti].m=!S.tracks[ti].m;renderTracks();Audio_.refreshAllTrackGains();if(S.playing)applyAllTrackAutomation();}
function toggleS(ti){snapshot();S.tracks[ti].s=!S.tracks[ti].s;renderTracks();Audio_.refreshAllTrackGains();if(S.playing)applyAllTrackAutomation();}
function toggleArm(ti){S.tracks[ti].arm=!S.tracks[ti].arm;renderTracks();}

function addTrack(){
  snapshot();
  const n=S.tracks.length;
  const names=['Synth','Strings','Pad','Perc','Choir','Lead','Arp','Sax'];
  const types=['midi','audio','beat'];
  S.tracks.push({
    id:n+1,
    name:names[n%names.length],
    icon:ICONS[n%ICONS.length],
    color:COLORS[n%COLORS.length],
    type:types[n%types.length],
    m:false,s:false,arm:false,
    clips:[{id:'clip_'+Date.now(),start:0,len:8,label:names[n%names.length]+'_01'}]
  });
  if(!S.seqSteps[n+1])S.seqSteps[n+1]=Array(16).fill(0).map((_,i)=>i%4===0?1:0);
  renderTracks();toast(`Track ${n+1}: ${S.tracks[n].name}`);
}

/* ── CANVAS WAVEFORM PER LANE ── */
function drawAllLaneWaveforms(){
  document.querySelectorAll('.clip-lane').forEach(lane=>{
    const ti=parseInt(lane.dataset.ti);
    const t=S.tracks[ti];
    if(!t)return;
    const cvs=lane.querySelector('.lane-canvas');
    if(!cvs)return;
    cvs.width=lane.scrollWidth||lane.offsetWidth;cvs.height=lane.offsetHeight;
    const ctx=cvs.getContext('2d');
    ctx.clearRect(0,0,cvs.width,cvs.height);
    // Beat grid
    const ppb=pxPerBeat();
    for(let b=0;b<cvs.width/ppb+1;b++){
      const x=b*ppb;
      ctx.strokeStyle=b%4===0?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.025)';
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cvs.height);ctx.stroke();
    }
    // Draw waveform inside each clip
    t.clips.forEach((clip,ci)=>{
      const cx=clip.start*ppb;
      const cw=clip.len*ppb;
      if(cx+cw<0||cx>cvs.width)return;
      ctx.save();
      ctx.beginPath();ctx.rect(cx,5,cw,cvs.height-10);ctx.clip();
      drawClipWaveform(ctx,t,clip,cx,5,cw,cvs.height-10);
      ctx.restore();
    });
    if(t.type==='audio'&&t.clips.length===0){
      ctx.fillStyle='rgba(255,255,255,.18)';ctx.font='10px system-ui';
      ctx.fillText('Drop an audio file here, or click to browse',10,cvs.height/2+3);
    }
  });
}

// Draws the true waveform for a clip backed by a real decoded AudioBuffer, using
// the buffer's precomputed min/max peak pairs. Handles reverse playback and the
// clip's trimmed-in offset so the drawing always matches what will actually play.
function drawRealWaveform(ctx,t,clip,x,y,w,h){
  const entry=S.buffers[clip.bufferId];
  if(!entry){return;}
  const {mins,maxs,n}=entry.peaks;
  const trimStart=clip.trimStart||0;
  const clipDurSec=beatToSec(clip.len);
  const bufDur=entry.duration||1;
  const g=clip.gain||1;
  const clampPeak=v=>Math.max(-1,Math.min(1,v*g));

  ctx.fillStyle=t.color+'40';
  ctx.beginPath();ctx.moveTo(x,y+h/2);
  const mid=h/2;
  for(let px=0;px<=w;px++){
    const fracAcrossClip=px/w;
    const secIntoClip=fracAcrossClip*clipDurSec;
    let secInBuffer=trimStart+secIntoClip;
    if(clip.reverse) secInBuffer=bufDur-secInBuffer;
    const peakIdx=Math.max(0,Math.min(n-1,Math.floor((secInBuffer/bufDur)*n)));
    const mx=clampPeak(maxs[peakIdx]||0);
    ctx.lineTo(x+px,y+mid-mx*(mid-2));
  }
  for(let px=w;px>=0;px--){
    const fracAcrossClip=px/w;
    const secIntoClip=fracAcrossClip*clipDurSec;
    let secInBuffer=trimStart+secIntoClip;
    if(clip.reverse) secInBuffer=bufDur-secInBuffer;
    const peakIdx=Math.max(0,Math.min(n-1,Math.floor((secInBuffer/bufDur)*n)));
    const mn=clampPeak(mins[peakIdx]||0);
    ctx.lineTo(x+px,y+mid-mn*(mid-2));
  }
  ctx.closePath();ctx.fill();

  ctx.strokeStyle=t.color+'dd';ctx.lineWidth=1.2;
  ctx.beginPath();
  for(let px=0;px<=w;px++){
    const fracAcrossClip=px/w;
    const secIntoClip=fracAcrossClip*clipDurSec;
    let secInBuffer=trimStart+secIntoClip;
    if(clip.reverse) secInBuffer=bufDur-secInBuffer;
    const peakIdx=Math.max(0,Math.min(n-1,Math.floor((secInBuffer/bufDur)*n)));
    const mx=clampPeak(maxs[peakIdx]||0);
    if(px===0)ctx.moveTo(x+px,y+mid-mx*(mid-2));else ctx.lineTo(x+px,y+mid-mx*(mid-2));
  }
  ctx.stroke();
  ctx.strokeStyle=t.color+'50';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x,y+mid);ctx.lineTo(x+w,y+mid);ctx.stroke();

  if(clip.reverse){
    ctx.fillStyle='rgba(255,255,255,.55)';ctx.font='8px system-ui';
    ctx.fillText('◀ REV',x+w-30,y+10);
  }
}

function drawClipWaveform(ctx,t,clip,x,y,w,h){
  if(t.type==='audio'&&clip.bufferId&&S.buffers[clip.bufferId]){
    drawRealWaveform(ctx,t,clip,x,y,w,h);
  } else if(t.type==='audio'){
    // Smooth decorative waveform (legacy/demo clips with no real audio attached yet)
    ctx.beginPath();
    ctx.moveTo(x,y+h/2);
    for(let i=0;i<=w;i+=2){
      const progress=i/w;
      const amp=(Math.sin(progress*37+t.id*2.3)*0.5+0.5)*(Math.sin(progress*7+t.id)*0.3+0.7)*(h/2-4);
      if(i===0)ctx.moveTo(x+i,y+h/2-amp);else ctx.lineTo(x+i,y+h/2-amp);
    }
    for(let i=w;i>=0;i-=2){
      const progress=i/w;
      const amp=(Math.sin(progress*37+t.id*2.3)*0.5+0.5)*(Math.sin(progress*7+t.id)*0.3+0.7)*(h/2-4);
      ctx.lineTo(x+i,y+h/2+amp);
    }
    ctx.fillStyle=t.color+'40';ctx.fill();
    ctx.strokeStyle=t.color+'bb';ctx.lineWidth=1.5;
    ctx.beginPath();
    for(let i=0;i<=w;i+=2){
      const progress=i/w;
      const amp=(Math.sin(progress*37+t.id*2.3)*0.5+0.5)*(Math.sin(progress*7+t.id)*0.3+0.7)*(h/2-4);
      if(i===0)ctx.moveTo(x+i,y+h/2-amp);else ctx.lineTo(x+i,y+h/2-amp);
    }
    ctx.stroke();
    ctx.strokeStyle=t.color+'60';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,y+h/2);ctx.lineTo(x+w,y+h/2);ctx.stroke();
  } else if(t.type==='beat'){
    const ppb=pxPerBeat();const steps=16;const stepW=ppb/4;
    for(let s=0;s<Math.ceil(w/stepW)+1;s++){
      const px=x+s*stepW;
      if(px>x+w)break;
      const pat=[1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0];
      const bh=pat[s%16]*(h-10)+Math.random()*8;
      ctx.fillStyle=t.color+'80';
      ctx.beginPath();
      const bw=stepW-2;
      ctx.roundRect(px+1,y+h-bh-4,bw,bh,3);
      ctx.fill();
    }
  } else {
    // MIDI notes
    const noteData=[[0,.08,30],[.09,.06,22],[.16,.1,26],[.28,.07,18],[.36,.12,28],[.5,.06,24],[.58,.1,20],[.7,.07,25],[.78,.14,22]];
    ctx.fillStyle=t.color+'cc';
    noteData.forEach(([xp,wp,yp])=>{
      const nx=x+xp*w,nw=wp*w,ny=y+yp/40*h;
      if(nx+nw>x&&nx<x+w&&nw>1){
        ctx.beginPath();
        ctx.roundRect(Math.max(x,nx),ny,Math.min(nw,nx+nw-x),5,2);
        ctx.fill();
      }
    });
  }
}

/* ── DRAG & DROP CLIPS ── */
function setupClipDrag(el,ti,ci){
  let startX,startBeat,startLeft;
  const onDown=e=>{
    if(e.target.classList.contains('clip-resize-r'))return;
    e.stopPropagation();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    startX=clientX;
    startBeat=S.tracks[ti].clips[ci].start;
    startLeft=parseFloat(el.style.left);
    el.classList.add('dragging');
    snapshot();
    const onMove=ev=>{
      const cx=ev.touches?ev.touches[0].clientX:ev.clientX;
      const dx=cx-startX;
      const newBeat=Math.max(0,Math.round(startBeat+dx/pxPerBeat()*2)/2);
      S.tracks[ti].clips[ci].start=newBeat;
      el.style.left=(newBeat*pxPerBeat())+'px';
    };
    const onUp=()=>{
      el.classList.remove('dragging');
      renderTracks();
      window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);
    };
    window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
    window.addEventListener('touchmove',onMove,{passive:true});window.addEventListener('touchend',onUp);
  };
  el.addEventListener('mousedown',onDown);
  el.addEventListener('touchstart',onDown,{passive:true});
}

function setupResizeDrag(handle,ti,ci){
  const onDown=e=>{
    e.stopPropagation();e.preventDefault();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const startX=clientX,startLen=S.tracks[ti].clips[ci].len;
    snapshot();
    const onMove=ev=>{
      const cx=ev.touches?ev.touches[0].clientX:ev.clientX;
      const dx=cx-startX;
      const newLen=Math.max(0.5,Math.round((startLen+dx/pxPerBeat())*2)/2);
      S.tracks[ti].clips[ci].len=newLen;
      const clipEl=handle.parentElement;
      if(clipEl)clipEl.style.width=(newLen*pxPerBeat())+'px';
    };
    const onUp=()=>{
      renderTracks();
      window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);
    };
    window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
    window.addEventListener('touchmove',onMove,{passive:false});window.addEventListener('touchend',onUp);
  };
  handle.addEventListener('mousedown',onDown);
  handle.addEventListener('touchstart',onDown,{passive:false});
}
