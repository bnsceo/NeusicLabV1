/* ═══════════════════════════════════════════════
   MPC pad colors, hover slice preview, chop-to-MIDI
═══════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   PHASE 7B — MPC: PAD COLORS / CHOP-TO-MIDI / SLICE PREVIEW
════════════════════════════════════════════════════════════════ */
const PAD_COLORS=['#f87171','#fb923c','#fbbf24','#4ade80','#34d399','#2dd4bf','#60a5fa','#a78bfa',
  '#f472b6','#e879f9','#818cf8','#38bdf8','#86efac','#fde68a','#fca5a5','#c4b5fd'];

function initPadColors(){
  Object.values(S.padBanks).forEach(bank=>{
    bank.forEach((slot,i)=>{if(slot&&!slot.color)slot.color=PAD_COLORS[i%PAD_COLORS.length];});
  });
}

window.buildMpcPadGrid=function(){
  const grid=document.getElementById('mpc-pad-grid');if(!grid)return;
  initPadColors();
  const asgns=S.padBanks[S.padBank];
  const trackCol=(S.tracks[S.activeTrack]||{color:'#b06ef3'}).color;
  if(S.padBank==='A'&&(!asgns||!asgns.length)&&S.samplerSlices.length){
    S.padBanks.A=S.samplerSlices.slice(0,16).map((_,i)=>({sliceIdx:i,vel:100,pitch:0,color:PAD_COLORS[i%PAD_COLORS.length]}));
  }
  grid.innerHTML=Array.from({length:16},(_,i)=>{
    const asgn=asgns?asgns[i]:null;
    const has=asgn!=null&&S.samplerSlices[asgn?.sliceIdx]!=null;
    const col=has?(asgn.color||PAD_COLORS[i%PAD_COLORS.length]):trackCol;
    const sl=has?S.samplerSlices[asgn.sliceIdx]:null;
    const dur=sl?(sl.end-sl.start).toFixed(2)+'s':'';
    return `<div class="mpc-pad${has?'':' empty'}" style="background:${col}22;border-color:${col}55;" id="mpc-pad-${i}"
      ontouchstart="hitMpcPad(${i},event)" onclick="hitMpcPad(${i},event)"
      onmouseenter="sbPreviewSlice(${i})" onmouseleave="sbStopPreviewSlice()"
      oncontextmenu="event.preventDefault();openPadColorPicker(${i},event)">
      <span class="mpc-pad-num" style="color:${col};">${S.padBank}${i+1}</span>
      <span class="mpc-pad-lbl" style="color:${col}cc;">${has?i+1:'—'}</span>
      ${has?`<span class="mpc-pad-vel" style="color:${col}88;">${dur}</span>`:''}
    </div>`;
  }).join('');
};

let _slicePreviewSrc=null;
function sbPreviewSlice(padIdx){
  if(_slicePreviewSrc){try{_slicePreviewSrc.stop();}catch(e){}}_slicePreviewSrc=null;
  const asgn=S.padBanks[S.padBank][padIdx];if(!asgn)return;
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  const sl=S.samplerSlices[asgn.sliceIdx];
  if(!entry||!sl)return;
  Audio_.ensure();
  const src=Audio_.ctx.createBufferSource();src.buffer=entry.buffer;
  const g=Audio_.ctx.createGain();g.gain.value=0.5;
  src.connect(g);g.connect(Audio_.master);
  src.start(Audio_.ctx.currentTime,sl.start,Math.min(0.5,sl.end-sl.start));
  _slicePreviewSrc=src;
  src.onended=()=>{if(_slicePreviewSrc===src)_slicePreviewSrc=null;};
}
function sbStopPreviewSlice(){if(_slicePreviewSrc){try{_slicePreviewSrc.stop();}catch(e){}}_slicePreviewSrc=null;}

function openPadColorPicker(padIdx,e){
  document.getElementById('pad-color-pop')?.remove();
  const pop=document.createElement('div');pop.id='pad-color-pop';
  pop.style.cssText=`position:fixed;z-index:9300;background:var(--bg1);border:1px solid var(--acc2);
    border-radius:10px;padding:10px;box-shadow:0 8px 32px rgba(0,0,0,.7);
    top:${Math.min(e.clientY,window.innerHeight-160)}px;left:${Math.min(e.clientX,window.innerWidth-180)}px;`;
  pop.innerHTML=`<div style="font-size:10px;color:var(--txt2);margin-bottom:7px;">Pad ${S.padBank}${padIdx+1} color</div>
    <div style="display:grid;grid-template-columns:repeat(8,22px);gap:4px;">
      ${PAD_COLORS.map(c=>`<div style="width:22px;height:22px;border-radius:4px;background:${c};cursor:pointer;border:2px solid transparent;"
        onclick="setPadColor(${padIdx},'${c}');document.getElementById('pad-color-pop').remove()"></div>`).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
      <label style="font-size:10px;color:var(--txt2);">Custom</label>
      <input type="color" value="${S.padBanks[S.padBank][padIdx]?.color||'#b06ef3'}"
        oninput="setPadColor(${padIdx},this.value)" style="width:30px;height:22px;border:none;background:none;cursor:pointer;border-radius:4px;">
    </div>`;
  document.body.appendChild(pop);
  setTimeout(()=>document.addEventListener('click',e=>{if(!pop.contains(e.target))pop.remove();},{once:true}),50);
}
function setPadColor(padIdx,color){
  const asgn=S.padBanks[S.padBank][padIdx];if(asgn)asgn.color=color;
  buildMpcPadGrid();
}

function chopToMidi(){
  if(!S.samplerSlices.length){toast('Chop a sample first');return;}
  const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;
  if(!entry){toast('No sample loaded');return;}
  const bpm=S.bpm||120;
  const notes=[];let cursor=0;
  S.samplerSlices.forEach((sl,i)=>{
    const durSec=sl.end-sl.start;const durBeats=durSec/(60/bpm);
    notes.push({midi:48+i,beat:cursor,len:Math.max(0.125,durBeats),vel:100});
    cursor+=durBeats;
  });
  snapshot();
  const newTi=S.tracks.length;
  const trackName=entry.name.replace(/\.[^.]+$/,'')+'_midi';
  S.tracks.push({
    id:newTi+1,name:trackName.slice(0,12),icon:'🎹',color:PAD_COLORS[newTi%PAD_COLORS.length],
    type:'midi',m:false,s:false,arm:false,
    clips:[{id:'clip_ctm_'+Date.now(),start:Math.round(secToBeat(S.sec)),len:cursor,
      label:trackName.slice(0,16),notes:notes.map(n=>({...n}))}],
  });
  S.seqSteps[newTi+1]=Array(16).fill(0);
  renderTracks();
  toast(`Chop→MIDI: ${notes.length} notes on "${trackName.slice(0,16)}"`);
  openClipInPianoRoll(newTi,0);
}

const _origBuildSampler7=window.buildSampler;
window.buildSampler=function(el){
  _origBuildSampler7(el);
  requestAnimationFrame(()=>{
    const btns=el.querySelector('.chop-btns');
    if(btns&&!btns.querySelector('.ctm-btn')){
      const b=document.createElement('button');
      b.className='chop-btn sec ctm-btn';b.textContent='🎹 Chop→MIDI';b.onclick=chopToMidi;
      btns.appendChild(b);
    }
  });
};
