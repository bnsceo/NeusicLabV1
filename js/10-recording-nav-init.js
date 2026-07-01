/* ═══════════════════════════════════════════════
   Recording panel, mobile nav, toast, keyboard shortcuts, resize handling, init()
═══════════════════════════════════════════════ */
/* ── RECORDING PANEL ── */
function buildRec(el){
  const opts=[
    ['Metronome','metronome'],
    ['Count-in','countIn'],
    ['Overdub','overdub'],
    ['Loop','loop'],
  ];
  el.innerHTML=`<div class="rec-section">
    <div style="font-size:10px;color:var(--txt2);margin-bottom:6px;">Input Level</div>
    <div class="rec-vu"><canvas id="rec-canvas"></canvas></div>
    <div class="rec-opts" style="margin-top:10px;">
      ${opts.map(([label,key])=>`
      <div class="rec-opt">
        <span class="rec-opt-lbl">${label}</span>
        <button class="toggle-pill${S.recOpts[key]?' on':''}" onclick="toggleRecOpt('${key}',this)"></button>
      </div>`).join('')}
    </div>
    <div style="font-size:10px;color:var(--txt2);margin:10px 0 6px;">Arm tracks first, then:</div>
    <button class="rec-big-btn" onclick="toggleRecord()">⏺ START RECORDING</button>
  </div>`;
  setTimeout(animateVU,50);
}
function toggleRecOpt(key,btn){
  S.recOpts[key]=!S.recOpts[key];
  btn.classList.toggle('on',S.recOpts[key]);
  if(key==='metronome'){
    // Take effect immediately, mid-playback, without waiting for the next bar.
    if(S.playing&&S.recOpts.metronome){
      const nowBeat=secToBeat(S.sec);
      S.nextMetroBeat=Math.ceil(nowBeat);
    }
    toast(S.recOpts.metronome?'Metronome on':'Metronome off');
  }
}

let vuRaf;
function animateVU(){
  cancelAnimationFrame(vuRaf);
  const c=document.getElementById('rec-canvas');if(!c)return;
  c.width=c.parentElement.offsetWidth;c.height=c.parentElement.offsetHeight;
  function tick(){
    const ctx=c.getContext('2d'),w=c.width,h=c.height;
    ctx.fillStyle='#14142a';ctx.fillRect(0,0,w,h);
    const bars=32;
    let levels=null;
    if(S.recording&&S.recAnalyser&&S.recDataArr){
      S.recAnalyser.getByteTimeDomainData(S.recDataArr);
      // Derive a single instantaneous RMS-ish level from the waveform sample, then
      // fan it out across the bar meter with slight per-bar variation for visual life.
      let sumSq=0;
      for(let i=0;i<S.recDataArr.length;i++){ const v=(S.recDataArr[i]-128)/128; sumSq+=v*v; }
      const rms=Math.sqrt(sumSq/S.recDataArr.length);
      S.inputLevel=rms;
      levels=Array.from({length:bars},()=>Math.min(1,rms*(2.2+Math.random()*0.6)));
    }
    for(let i=0;i<bars;i++){
      const lv=levels?levels[i]:(S.playing?(0.2+Math.random()*.8):(0.05+Math.random()*.1));
      const bh=lv*h;const bw=w/bars-1;const x=i*(w/bars);
      const grad=ctx.createLinearGradient(0,h,0,h-bh);
      grad.addColorStop(0,'#4ade80');grad.addColorStop(.6,'#fbbf24');grad.addColorStop(1,'#f87171');
      ctx.fillStyle=grad;
      ctx.beginPath();ctx.roundRect(x+.5,h-bh,bw,bh,2);ctx.fill();
    }
    if(S.activePanel==='rec')vuRaf=requestAnimationFrame(tick);
  }
  tick();
}

/* ── MOBILE NAV ── */
function mobNav(id,btn){
  document.querySelectorAll('.mob-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  toast(id.charAt(0).toUpperCase()+id.slice(1));
}

/* ── TOAST ── */
let toastT;
function toast(msg){
  const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),1700);
}

/* ── KEYBOARD ── */
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
  switch(e.code){
    case'Space':e.preventDefault();togglePlay();break;
    case'KeyR':toggleRecord();break;
    case'Home':rewind();break;
    case'Equal':case'NumpadAdd':if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(1);}break;
    case'Minus':case'NumpadSubtract':if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(-1);}break;
    case'KeyZ':if(e.ctrlKey||e.metaKey){e.preventDefault();e.shiftKey?redo():undo();}break;
    case'KeyY':if(e.ctrlKey||e.metaKey){e.preventDefault();redo();}break;
    case'Delete':case'Backspace':if(S.selectedClip)ctxDelete();break;
    case'Digit1':openDrawer('drums');break;
    case'Digit2':openDrawer('piano');break;
    case'Digit3':openDrawer('sampler');break;
    case'Digit4':openDrawer('fx');break;
    case'Digit5':openDrawer('mixer');break;
    case'Digit6':openDrawer('auto');break;
    case'Digit7':openDrawer('rec');break;
    case'Tab':e.preventDefault();toggleDrawer();break;
  }
});

/* ── RESIZE ── */
window.addEventListener('resize',()=>{
  syncTimelineMetrics();
  drawRuler();
  drawAllLaneWaveforms();
  posPlayhead();
  updateOverview();
  const ac=document.getElementById('auto-canvas');if(ac)initAutoCanvas();
  const sc=document.getElementById('samp-canvas');if(sc)drawSampler();
  const pc=document.getElementById('pr-canvas');if(pc)drawPR(S.tracks[S.activeTrack]?.color||'#a78bfa');
  const rc=document.getElementById('rec-canvas');if(rc){rc.width=rc.parentElement.offsetWidth;rc.height=rc.parentElement.offsetHeight;}
});

/* ── INIT ── */
function init(){
  syncTimelineMetrics();
  buildOv();
  renderTracks();
  centerArrangementOnPlayhead();
  drawRuler();
  posPlayhead();
  openDrawer('drums');
  toast('Welcome to Neusic — Space to play, Ctrl+Z to undo');
}
init();
