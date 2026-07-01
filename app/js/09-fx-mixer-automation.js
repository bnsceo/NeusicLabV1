/* ═══════════════════════════════════════════════
   Effects rack, base mixer, automation lanes
═══════════════════════════════════════════════ */
/* ── EFFECTS ── */
const FX_TYPES=[
  {type:'reverb',label:'Reverb',wetLabel:'Mix'},
  {type:'delay',label:'Delay',wetLabel:'Mix'},
  {type:'chorus',label:'Chorus',wetLabel:'Mix'},
  {type:'eq',label:'EQ Tilt',wetLabel:'Tone'},
  {type:'compressor',label:'Compressor',wetLabel:'Amount'},
];

function buildFX(el){
  const t=S.tracks[S.activeTrack];
  if(!t){el.innerHTML='<div class="fx-name">No track selected</div>';return;}
  if(!S.trackFx[t.id])S.trackFx[t.id]=[];
  const rack=S.trackFx[t.id];

  const slots=rack.map((f,i)=>{
    const meta=FX_TYPES.find(x=>x.type===f.type)||{label:f.type,wetLabel:'Mix'};
    const deg=(f.wet*270)-135;
    return `<div class="fx-slot">
      <div class="fx-name">${meta.label}</div>
      <input type="range" class="fx-wet-slider" min="0" max="100" value="${Math.round(f.wet*100)}" data-idx="${i}" title="${meta.wetLabel}">
      <div class="fx-val">${Math.round(f.wet*100)}%</div>
      <button class="fx-toggle${f.on?' on':''}" onclick="toggleFX(${i},this)"></button>
      <button class="fx-remove-btn" onclick="removeFX(${i})" title="Remove">✕</button>
    </div>`;
  }).join('');

  el.innerHTML=`
    <div class="ctrl-group" style="margin-bottom:10px;">
      <select class="auto-param" id="fxTrackSelect">
        ${S.tracks.map((tt,i)=>`<option value="${i}"${i===S.activeTrack?' selected':''}>${tt.name}</option>`).join('')}
      </select>
    </div>
    ${slots||'<div class="fx-name" style="opacity:.5;margin-bottom:8px;">No effects on this track yet</div>'}
    <div class="fx-add-row">
      ${FX_TYPES.map(meta=>`<button class="fx-add-chip" onclick="addFX('${meta.type}')">＋ ${meta.label}</button>`).join('')}
    </div>`;

  document.getElementById('fxTrackSelect').addEventListener('change',e=>{
    S.activeTrack=parseInt(e.target.value,10);buildPanelContent('fx');
  });
  el.querySelectorAll('.fx-wet-slider').forEach(slider=>{
    slider.addEventListener('input',()=>{
      const idx=parseInt(slider.dataset.idx,10);
      const v=parseInt(slider.value,10)/100;
      rack[idx].wet=v;
      slider.parentElement.querySelector('.fx-val').textContent=Math.round(v*100)+'%';
      const liveNode=(Audio_.trackFxNodes[t.id]||[])[idx];
      if(liveNode&&liveNode.setWet)liveNode.setWet(v); // live-update without a full rebuild while dragging
    });
    slider.addEventListener('change',()=>{ Audio_.rebuildTrackFxRack(t.id); }); // settle into a clean rebuild on release
  });
}

function toggleFX(i,btn){
  const t=S.tracks[S.activeTrack];
  S.trackFx[t.id][i].on=!S.trackFx[t.id][i].on;
  btn.classList.toggle('on',S.trackFx[t.id][i].on);
  Audio_.rebuildTrackFxRack(t.id);
}
function addFX(type){
  const t=S.tracks[S.activeTrack];if(!t)return;
  if(!S.trackFx[t.id])S.trackFx[t.id]=[];
  S.trackFx[t.id].push({type,on:true,wet:0.35});
  Audio_.rebuildTrackFxRack(t.id);
  buildPanelContent('fx');
  const meta=FX_TYPES.find(x=>x.type===type);
  toast((meta?meta.label:type)+' added to '+t.name);
}
function removeFX(i){
  const t=S.tracks[S.activeTrack];if(!t)return;
  S.trackFx[t.id].splice(i,1);
  Audio_.rebuildTrackFxRack(t.id);
  buildPanelContent('fx');
}

/* ── MIXER ── */
function buildMixer(el){
  Audio_.ensure();
  const all=[...S.tracks,{name:'Master',icon:'M',color:'#22c55e',id:'master',isMaster:true}];
  el.innerHTML=`<div class="mix-strips">
    ${all.map((t,i)=>{
      const lvl=t.isMaster?S.masterVol*100:(S.trackVol[t.id]??0.85)*100;
      return `<div class="mix-ch${t.isMaster?' mix-master':''}">
        <span class="mix-ico" style="color:${t.color}">${t.icon}</span>
        <div style="display:flex;gap:5px;align-items:flex-end">
          <div class="mix-fader-t">
            <div class="mix-thumb" id="mth-${i}" style="top:${100-lvl}%" data-idx="${i}" data-track-id="${t.id}" data-is-master="${!!t.isMaster}"></div>
          </div>
          <div class="mix-meter">
            <div class="mix-fill" id="mf-${i}" style="height:2%;background:${t.color}"></div>
          </div>
        </div>
        <div class="mix-lbl" style="color:${t.color}">${t.name.slice(0,4).toUpperCase()}</div>
      </div>`;
    }).join('')}
  </div>`;
  setupFaderDrags();
}

function setupFaderDrags(){
  document.querySelectorAll('.mix-thumb').forEach(thumb=>{
    const trackId=thumb.dataset.isMaster==='true'?null:Number(thumb.dataset.trackId);
    const isMaster=thumb.dataset.isMaster==='true';
    const onDown=e=>{
      e.stopPropagation();
      const startY=e.touches?e.touches[0].clientY:e.clientY;
      const startTop=parseFloat(thumb.style.top);
      const onMove=ev=>{
        const cy=ev.touches?ev.touches[0].clientY:ev.clientY;
        const newTop=Math.max(0,Math.min(86,startTop+(cy-startY)));
        thumb.style.top=newTop+'%';
        const gainVal=Math.max(0,Math.min(1,(100-newTop)/100));
        if(isMaster)Audio_.setMasterVol(gainVal);
        else Audio_.setTrackFader(trackId,gainVal);
      };
      const onUp=()=>{
        window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);
        window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);
      };
      window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
      window.addEventListener('touchmove',onMove,{passive:true});window.addEventListener('touchend',onUp);
    };
    thumb.addEventListener('mousedown',onDown);
    thumb.addEventListener('touchstart',onDown,{passive:true});
  });
}

let meterRaf;
function updateMeterAnim(){
  cancelAnimationFrame(meterRaf);
  if(S.activePanel!=='mixer')return;
  function tick(){
    S.tracks.forEach((t,i)=>{
      const m=document.getElementById('mf-'+i);if(!m)return;
      const lvl=S.playing?Audio_.readLevel(Audio_.ensureTrackAnalyser(t.id)):0;
      m.style.height=Math.min(100,2+lvl*180)+'%';
    });
    const masterEl=document.getElementById('mf-'+S.tracks.length);
    if(masterEl){
      const lvl=S.playing?Audio_.readLevel(Audio_.ensureMasterAnalyser()):0;
      masterEl.style.height=Math.min(100,2+lvl*180)+'%';
    }
    meterRaf=requestAnimationFrame(tick);
  }
  tick();
}
function cancelMeterAnim(){cancelAnimationFrame(meterRaf);}

/* ── AUTOMATION ── */
function buildAuto(el){
  const t=S.tracks[S.activeTrack];
  el.innerHTML=`<div>
    <div class="auto-toolbar">
      <select class="auto-param" id="autoTrackSelect">
        ${S.tracks.map((tt,i)=>`<option value="${i}"${i===S.activeTrack?' selected':''}>${tt.name}</option>`).join('')}
      </select>
      <select class="auto-param" id="autoParamSelect">
        <option value="volume"${S.autoParam==='volume'?' selected':''}>Volume</option>
        <option value="pan"${S.autoParam==='pan'?' selected':''}>Pan</option>
        <option value="filter"${S.autoParam==='filter'?' selected':''}>Filter</option>
        <option value="reverb"${S.autoParam==='reverb'?' selected':''}>Reverb wet (use FX panel instead)</option>
      </select>
      ${['Draw','Select','Erase'].map((m,i)=>`<button class="auto-btn${i===0?' active':''}" onclick="setAutoMode('${m.toLowerCase()}',this)">${m}</button>`).join('')}
      <button class="auto-btn" onclick="clearAuto()">Clear</button>
    </div>
    <div class="auto-wrap"><canvas id="auto-canvas"></canvas></div>
  </div>`;
  setTimeout(()=>{drawAutoCanvas();},30);
  const wrap=el.querySelector('.auto-wrap');
  wrap.addEventListener('mousedown',autoDown);wrap.addEventListener('mousemove',autoMove);
  wrap.addEventListener('touchstart',autoTouchDown,{passive:true});wrap.addEventListener('touchmove',autoTouchMove,{passive:true});
  document.getElementById('autoTrackSelect').addEventListener('change',e=>{
    S.activeTrack=parseInt(e.target.value,10);drawAutoCanvas();
  });
  document.getElementById('autoParamSelect').addEventListener('change',e=>{
    S.autoParam=e.target.value;drawAutoCanvas();
  });
}
function setAutoMode(m,btn){S.autoMode=m;btn.closest('.auto-toolbar').querySelectorAll('.auto-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}

function currentAutoLane(){
  const t=S.tracks[S.activeTrack];if(!t)return null;
  if(!S.automation[t.id])S.automation[t.id]={};
  if(!S.automation[t.id][S.autoParam])S.automation[t.id][S.autoParam]=[];
  return S.automation[t.id][S.autoParam];
}

// Visible automation window mirrors the main timeline's zoom level (pxPerBeat),
// so zooming the timeline in/out also zooms automation editing precision in sync.
// x=0 of the automation canvas always represents beat 0 (S.scrollX is unused/always
// 0 in this build, so there's no horizontal-pan offset to account for yet).
function autoCanvasBeatRange(canvasWidth){
  const visibleBeats=canvasWidth/pxPerBeat();
  return {start:0,end:Math.max(1,visibleBeats)};
}

function drawAutoCanvas(){
  const c=document.getElementById('auto-canvas');if(!c)return;
  const wrap=c.parentElement;
  c.width=wrap.offsetWidth;c.height=Math.max(100,wrap.offsetHeight);
  const ctx=c.getContext('2d'),w=c.width,h=c.height;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;
  [.25,.5,.75].forEach(y=>{ctx.beginPath();ctx.moveTo(0,y*h);ctx.lineTo(w,y*h);ctx.stroke();});

  const {start,end}=autoCanvasBeatRange(w);
  // Bar gridlines (every 4 beats) instead of a fixed 8-column split, so the grid
  // itself reflects real musical time at the current zoom level.
  const firstBar=Math.ceil(start/4)*4;
  for(let beat=firstBar;beat<=end;beat+=4){
    const x=((beat-start)/(end-start))*w;
    const isDownbeat=(beat/4)%4===0;
    ctx.strokeStyle=isDownbeat?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.06)';
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
    if(isDownbeat){
      ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='8px system-ui';
      ctx.fillText(`${beat/4+1}`,x+3,10);
    }
  }

  const lane=currentAutoLane();
  const beatToPx=beat=>((beat-start)/(end-start))*w;
  // value 0..1 maps top(1)->y=0 .. bottom(0)->y=h, matching how draw-mode writes points.
  const valToPx=v=>h-(v*h);

  if(!lane||lane.length<2){
    if(lane&&lane.length===1){
      const x=beatToPx(lane[0].beat),y=valToPx(lane[0].value);
      ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle='#b06ef3';ctx.fill();
    }
    const phX=beatToPx(secToBeat(S.sec));ctx.beginPath();ctx.moveTo(phX,0);ctx.lineTo(phX,h);ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1.5;ctx.stroke();
    return;
  }
  const pts=lane.map(p=>({x:beatToPx(p.beat),y:valToPx(p.value)}));
  ctx.beginPath();ctx.moveTo(pts[0].x,h);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x,h);ctx.closePath();
  ctx.fillStyle='rgba(176,110,243,.12)';ctx.fill();
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.strokeStyle='#b06ef3';ctx.lineWidth=2;ctx.stroke();
  pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#b06ef3';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.stroke();});
  const phX=beatToPx(secToBeat(S.sec));ctx.beginPath();ctx.moveTo(phX,0);ctx.lineTo(phX,h);ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1.5;ctx.stroke();
}
let autoDrag=false;
function autoDown(e){autoDrag=true;const c=document.getElementById('auto-canvas');if(!c)return;const r=c.getBoundingClientRect();addAutoPoint(e.clientX-r.left,e.clientY-r.top);}
function autoMove(e){if(!autoDrag)return;const c=document.getElementById('auto-canvas');if(!c)return;const r=c.getBoundingClientRect();addAutoPoint(e.clientX-r.left,e.clientY-r.top);}
function autoTouchDown(e){autoDrag=true;const c=document.getElementById('auto-canvas');if(!c)return;const r=c.getBoundingClientRect();addAutoPoint(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top);}
function autoTouchMove(e){if(!autoDrag)return;const c=document.getElementById('auto-canvas');if(!c)return;const r=c.getBoundingClientRect();addAutoPoint(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top);}
document.addEventListener('mouseup',()=>autoDrag=false);document.addEventListener('touchend',()=>autoDrag=false);

function addAutoPoint(x,y){
  const c=document.getElementById('auto-canvas');if(!c)return;
  const w=c.width,h=c.height;
  const {start,end}=autoCanvasBeatRange(w);
  const beat=start+(x/w)*(end-start);
  const value=Math.max(0,Math.min(1,1-(y/h)));
  let lane=currentAutoLane();if(!lane)return;

  if(S.autoMode==='erase'){
    const lanePts=lane.map(p=>({x:((p.beat-start)/(end-start))*w,y:h-(p.value*h)}));
    const keepIdx=lanePts.map((p,i)=>Math.hypot(p.x-x,p.y-y)>20?i:-1).filter(i=>i>=0);
    const newLane=keepIdx.map(i=>lane[i]);
    S.automation[S.tracks[S.activeTrack].id][S.autoParam]=newLane;
    drawAutoCanvas();
    applyAutomationIfPlaying();
    return;
  }
  lane.push({beat,value});
  lane.sort((a,b)=>a.beat-b.beat);
  if(lane.length>200)lane.splice(0,lane.length-200);
  drawAutoCanvas();
  applyAutomationIfPlaying();
}
function clearAuto(){
  const t=S.tracks[S.activeTrack];if(!t)return;
  if(S.automation[t.id])S.automation[t.id][S.autoParam]=[];
  drawAutoCanvas();
  applyAutomationIfPlaying();
  toast('Automation cleared');
}

// ── Apply automation lanes to real AudioParams ──
// Volume/Pan/Filter each map a lane's normalized 0..1 values onto the matching
// AudioParam's real range, then schedule the whole curve onto the param with
// linearRampToValueAtTime so it actually moves during playback — not just drawn.
function paramRangeFor(param){
  switch(param){
    case'volume':return {min:0,max:1};
    case'pan':return {min:-1,max:1};
    case'filter':return {min:200,max:20000,log:true}; // lowpass cutoff, log-scaled for a musical sweep
    default:return null; // reverb: no real param to automate yet
  }
}
function lerp(a,b,t){return a+(b-a)*t;}
function valueToParamRange(param,norm){
  const r=paramRangeFor(param);if(!r)return null;
  if(r.log){
    const lo=Math.log(r.min),hi=Math.log(r.max);
    return Math.exp(lerp(lo,hi,norm));
  }
  return lerp(r.min,r.max,norm);
}

function applyTrackAutomation(trackId,param,audioParam,baseValueWhenEmpty){
  const lane=S.automation[trackId]&&S.automation[trackId][param];
  const ctx=Audio_.ctx;
  audioParam.cancelScheduledValues(ctx.currentTime);
  if(!lane||lane.length===0){
    audioParam.setValueAtTime(baseValueWhenEmpty,ctx.currentTime);
    return;
  }
  if(lane.length===1){
    audioParam.setValueAtTime(valueToParamRange(param,lane[0].value),ctx.currentTime);
    return;
  }
  const nowBeat=secToBeat(S.sec);
  const ctxNow=ctx.currentTime;
  // Hold at (or interpolate to) the correct starting value, then ramp through
  // every future point in the lane relative to the current transport position.
  let started=false;
  for(let i=0;i<lane.length;i++){
    const p=lane[i];
    const pTimeSec=ctxNow+beatToSec(p.beat-nowBeat);
    if(p.beat<nowBeat){
      // Points in the past just set the starting value immediately; the most
      // recent past point "wins" as the value already in effect right now.
      audioParam.setValueAtTime(valueToParamRange(param,p.value),ctxNow);
      continue;
    }
    if(!started){
      audioParam.setValueAtTime(valueToParamRange(param,p.value),Math.max(ctxNow,pTimeSec));
      started=true;
    } else {
      audioParam.linearRampToValueAtTime(valueToParamRange(param,p.value),pTimeSec);
    }
  }
}

// Called whenever a lane is edited while the transport is running, and also
// right when playback starts, so automation takes effect immediately rather
// than only on the next manual re-trigger.
function applyAutomationIfPlaying(){
  if(!S.playing)return;
  applyAllTrackAutomation();
}
function applyAllTrackAutomation(){
  Audio_.ensure();
  const anySolo=S.tracks.some(tt=>tt.s);
  S.tracks.forEach(t=>{
    const gainNode=Audio_.ensureTrackGain(t.id);
    const pannerNode=Audio_.ensureTrackPanner(t.id);
    const filterNode=Audio_.ensureTrackFilter(t.id);
    const silent=t.m||(anySolo&&!t.s);
    const dry=Audio_.trackDry[t.id]??0.85;
    if(silent){
      // Mute/solo silencing wins outright — even an automated volume swell
      // shouldn't be audible on a muted track.
      gainNode.gain.cancelScheduledValues(Audio_.ctx.currentTime);
      gainNode.gain.setValueAtTime(0,Audio_.ctx.currentTime);
    } else {
      applyTrackAutomation(t.id,'volume',gainNode.gain,dry);
    }
    applyTrackAutomation(t.id,'pan',pannerNode.pan,0);
    applyTrackAutomation(t.id,'filter',filterNode.frequency,20000);
  });
}
