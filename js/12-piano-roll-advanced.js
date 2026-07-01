/* ═══════════════════════════════════════════════
   Note properties popover, Web Audio MIDI note playback, playhead scroll sync, clip round-trip
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   PHASE 6C — NOTE PROPERTIES POPOVER (right-click on PR note)
═══════════════════════════════════════════════════════════════ */
const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function midiToName(m){return NOTE_NAMES[m%12]+(Math.floor(m/12)-1);}
PR._popoverIdx=-1;

function openNotePopover(idx,sx,sy){
  const n=PR.notes[idx];if(!n)return;
  PR._popoverIdx=idx;
  document.getElementById('np-notename').textContent=midiToName(n.midi);
  document.getElementById('np-midinum').textContent='MIDI '+n.midi;
  document.getElementById('np-beat').value=+n.beat.toFixed(4);
  document.getElementById('np-len').value=+n.len.toFixed(4);
  document.getElementById('np-vel').value=n.vel??100;
  const pop=document.getElementById('note-popover');
  const W=window.innerWidth,H=window.innerHeight;
  pop.style.left=Math.min(sx,W-210)+'px';
  pop.style.top=Math.min(sy,H-200)+'px';
  pop.classList.add('show');
}
function closeNotePopover(){document.getElementById('note-popover').classList.remove('show');PR._popoverIdx=-1;}
function applyNoteEdit(){
  const idx=PR._popoverIdx;if(idx<0||idx>=PR.notes.length)return;
  snapshot();const n=PR.notes[idx];
  const b=parseFloat(document.getElementById('np-beat').value);
  const l=parseFloat(document.getElementById('np-len').value);
  const v=parseInt(document.getElementById('np-vel').value,10);
  if(!isNaN(b))n.beat=Math.max(0,b);
  if(!isNaN(l))n.len=Math.max(0.125,l);
  if(!isNaN(v))n.vel=Math.max(1,Math.min(127,v));
  const col=(S.tracks[S.activeTrack]||{}).color||'#b06ef3';
  prDrawGrid(col);prDrawVelocity(col);prDrawMinimap(col);
}
function deleteNoteFromPopover(){
  const idx=PR._popoverIdx;if(idx<0)return;
  snapshot();PR.notes.splice(idx,1);closeNotePopover();
  const col=(S.tracks[S.activeTrack]||{}).color||'#b06ef3';
  prDrawGrid(col);prDrawVelocity(col);prDrawMinimap(col);
}
function prPlayNoteFromPopover(){if(PR._popoverIdx>=0)prPlayMidiNote(PR.notes[PR._popoverIdx].midi,PR.notes[PR._popoverIdx].vel??100);}

// Right-click delegation on pr-canvas
document.addEventListener('contextmenu',e=>{
  const c=document.getElementById('pr-canvas');if(!c||!c.contains(e.target))return;
  e.preventDefault();
  const scroll=document.getElementById('pr-grid-scroll');
  const rect=c.getBoundingClientRect();
  const cx=e.clientX-rect.left+(scroll?scroll.scrollLeft:0);
  const cy=e.clientY-rect.top+(scroll?scroll.scrollTop:0);
  const midi=PR.MIDI_TOP-Math.floor(cy/PR.NOTE_H);
  const beat=cx/PR.PPB;
  const idx=PR.notes.findIndex(n=>n.midi===midi&&beat>=n.beat&&beat<=n.beat+n.len);
  if(idx>=0)openNotePopover(idx,e.clientX,e.clientY);
});
document.addEventListener('mousedown',e=>{
  const pop=document.getElementById('note-popover');
  if(pop&&pop.classList.contains('show')&&!pop.contains(e.target)){
    const c=document.getElementById('pr-canvas');
    if(!c||!c.contains(e.target))closeNotePopover();
  }
});


/* ═══════════════════════════════════════════════════════════════
   PHASE 6D — WEB AUDIO MIDI NOTE PLAYBACK IN PIANO ROLL
═══════════════════════════════════════════════════════════════ */
function prPlayMidiNote(midi,vel=100,durSec=0.3){
  Audio_.ensure();
  const ctx=Audio_.ctx,t0=ctx.currentTime;
  const freq=440*Math.pow(2,(midi-69)/12);
  const gv=(vel/127)*0.5;
  const g=ctx.createGain();
  g.gain.setValueAtTime(0,t0);
  g.gain.linearRampToValueAtTime(gv,t0+0.008);
  g.gain.exponentialRampToValueAtTime(gv*0.55,t0+0.06);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+durSec);
  const osc=ctx.createOscillator();
  osc.type=midi<48?'sine':midi<72?'sawtooth':'triangle';
  if(midi>=48&&midi<72){
    const lp=ctx.createBiquadFilter();lp.type='lowpass';
    lp.frequency.setValueAtTime(freq*4,t0);lp.frequency.exponentialRampToValueAtTime(freq*1.5,t0+durSec);
    osc.connect(lp);lp.connect(g);
  } else {osc.connect(g);}
  // Sub oscillator for body
  if(midi>=48){
    const sub=ctx.createOscillator();sub.type='sine';sub.frequency.value=freq/2;
    const sg=ctx.createGain();sg.gain.value=0.12;sub.connect(sg);sg.connect(g);
    sub.start(t0);sub.stop(t0+durSec+0.01);
  }
  g.connect(Audio_.master);
  osc.frequency.value=freq;osc.start(t0);osc.stop(t0+durSec+0.01);
  prFlashKey(midi);
}

function prFlashKey(midi){
  const kc=document.getElementById('pr-keys-col');if(!kc)return;
  const row=PR.MIDI_TOP-midi;
  const flash=document.createElement('div');
  flash.className='pr-note-flash';
  flash.style.cssText=`top:${row*PR.NOTE_H}px;height:${PR.NOTE_H}px;`;
  kc.appendChild(flash);setTimeout(()=>flash.remove(),400);
}

// Wire playback on note grid mousedown
document.addEventListener('mousedown',e=>{
  const c=document.getElementById('pr-canvas');if(!c||!c.contains(e.target)||e.button!==0)return;
  const scroll=document.getElementById('pr-grid-scroll');
  const rect=c.getBoundingClientRect();
  const cy=e.clientY-rect.top+(scroll?scroll.scrollTop:0);
  const midi=PR.MIDI_TOP-Math.floor(cy/PR.NOTE_H);
  if(midi>=0&&midi<=127&&PR.activeTool!=='erase')prPlayMidiNote(midi,100,PR.quantise>0?Math.max(0.08,beatToSec(PR.quantise)):0.25);
});


/* ═══════════════════════════════════════════════════════════════
   PHASE 6E — PIANO ROLL PLAYHEAD SCROLL SYNC
   Follow playhead during playback; "⏩ Follow" toggle button.
═══════════════════════════════════════════════════════════════ */
let _prFollowOn=true;
let _prLastBeat=-1;

// Patch uiLoop to call our sync on every frame
const _origUiLoop=window.uiLoop;
window.uiLoop=function(){
  _origUiLoop&&_origUiLoop();
  syncPRPlayhead();
};

function syncPRPlayhead(){
  const gc=document.getElementById('pr-canvas');
  const scroll=document.getElementById('pr-grid-scroll');
  if(!gc||!scroll)return;
  const nowBeat=secToBeat(S.sec);
  if(Math.abs(nowBeat-_prLastBeat)<0.02)return;
  _prLastBeat=nowBeat;
  if(S.playing&&_prFollowOn){
    const phX=Math.min(nowBeat,PR.BARS*PR.BEATS_PER_BAR)*PR.PPB;
    const vw=scroll.clientWidth,sl=scroll.scrollLeft;
    if(phX<sl+vw*0.1||phX>sl+vw*0.8)scroll.scrollLeft=Math.max(0,phX-vw*0.25);
    prUpdateMinimapWindow();
  }
  const col=(S.tracks[S.activeTrack]||{}).color||'#b06ef3';
  prDrawGrid(col);
}

// Inject Follow + Sync Zoom buttons into the piano toolbar after it builds
const _origBuildPiano=window.buildPiano;
window.buildPiano=function(el){
  _origBuildPiano(el);
  requestAnimationFrame(()=>{
    const tb=el.querySelector('.pr-toolbar');if(!tb||tb.querySelector('#pr-follow-btn'))return;
    const fb=document.createElement('button');
    fb.id='pr-follow-btn';fb.className='pr-tool-btn'+(_prFollowOn?' active':'');
    fb.textContent='⏩ Follow';fb.title='Auto-scroll to playhead';
    fb.onclick=()=>{_prFollowOn=!_prFollowOn;fb.classList.toggle('active',_prFollowOn);toast(_prFollowOn?'Follow on':'Follow off');};
    const sz=document.createElement('button');
    sz.className='pr-tool-btn';sz.textContent='⇔ Sync zoom';sz.title='Match PR zoom to timeline';
    sz.onclick=()=>{
      PR.PPB=Math.max(10,Math.min(240,Math.round(40*S.zoom)));
      prResizeCanvases();const col=(S.tracks[S.activeTrack]||{}).color||'#b06ef3';
      prDrawKeys(col);prDrawGrid(col);prDrawVelocity(col);prDrawMinimap(col);prUpdateMinimapWindow();
      toast('PR zoom synced');
    };
    tb.appendChild(fb);tb.appendChild(sz);
  });
};

// Clip → Piano Roll round-trip: double-click MIDI clips
PR._linkedClip=null;
function openClipInPianoRoll(ti,ci){
  const t=S.tracks[ti];if(!t)return;
  const clip=t.clips[ci];if(!clip)return;
  flushPRToClip();
  if(!clip.notes)clip.notes=[];
  PR.notes=clip.notes.map(n=>({...n}));
  PR._linkedClip={ti,ci};
  PR.BARS=Math.max(4,Math.ceil((clip.len||16)/PR.BEATS_PER_BAR));
  openDrawer('piano');
  requestAnimationFrame(()=>{
    prResizeCanvases();const col=t.color||'#b06ef3';
    prDrawKeys(col);prDrawGrid(col);prDrawVelocity(col);prDrawMinimap(col);prUpdateMinimapWindow();
    const scroll=document.getElementById('pr-grid-scroll');
    if(scroll){
      scroll.scrollLeft=PR.notes.length?Math.min(...PR.notes.map(n=>n.beat))*PR.PPB:0;
      scroll.scrollTop=PR.notes.length
        ?(PR.MIDI_TOP-Math.max(...PR.notes.map(n=>n.midi)))*PR.NOTE_H-scroll.clientHeight/3
        :Math.max(0,(PR.MIDI_TOP-60)*PR.NOTE_H-scroll.clientHeight/2);
    }
    toast(`Editing ${clip.label||'clip'} · ${PR.notes.length} notes`);
  });
}
function flushPRToClip(){
  if(!PR._linkedClip)return;
  const {ti,ci}=PR._linkedClip;
  const t=S.tracks[ti];if(!t)return;
  const clip=t.clips[ci];if(!clip)return;
  clip.notes=PR.notes.map(n=>({...n}));
}
// Wire dblclick on MIDI clips after renderTracks
const _origRenderTracks=window.renderTracks;
window.renderTracks=function(){
  _origRenderTracks();
  requestAnimationFrame(()=>{
    document.querySelectorAll('.clip-el').forEach(el=>{
      if(el._midiWired)return;el._midiWired=true;
      el.addEventListener('dblclick',ev=>{
        ev.stopPropagation();
        const ti=parseInt(el.closest('[data-ti]')?.dataset.ti??el.dataset.ti??'-1',10);
        const ci=parseInt(el.dataset.ci??'-1',10);
        if(ti<0||ci<0)return;
        const t=S.tracks[ti];if(!t)return;
        if(t.type==='midi'||t.type==='beat')openClipInPianoRoll(ti,ci);
      });
      // Add hint on MIDI clips
      const ti=parseInt(el.closest('[data-ti]')?.dataset.ti??el.dataset.ti??'-1',10);
      if(ti>=0){const t=S.tracks[ti];if(t&&(t.type==='midi'||t.type==='beat')&&!el.querySelector('.clip-midi-hint')){const h=document.createElement('div');h.className='clip-midi-hint';h.textContent='🎹';el.appendChild(h);}}
    });
  });
};
// Flush on panel switch
const _origOpenDrawer=window.openDrawer;
window.openDrawer=function(id){if(id!=='piano')flushPRToClip();_origOpenDrawer(id);};
window.addEventListener('beforeunload',flushPRToClip);
