/* ═══════════════════════════════════════════════
   Timeline fade handles, slip editing, magnetic clip snapping
═══════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   PHASE 7C — TIMELINE: FADE HANDLES / SLIP EDIT / CLIP SNAPPING
════════════════════════════════════════════════════════════════ */
Object.assign(S,{snapOn:true,snapDiv:0.5,slipMode:false});

function snapBeat(beat){if(!S.snapOn)return beat;return Math.round(beat/S.snapDiv)*S.snapDiv;}

window.buildClipEl=function(t,ti,clip,ci){
  const ppb=pxPerBeat();const x=clip.start*ppb;const w=clip.len*ppb;
  const el=document.createElement('div');
  el.className='clip-el'+(S.selectedClip?.ci===ci&&S.selectedClip?.ti===ti?' selected':'');
  el.style.left=x+'px';el.style.width=w+'px';
  el.style.background=`linear-gradient(135deg,${t.color}55,${t.color}22 58%,rgba(255,255,255,.08))`;
  el.style.border=`1px solid ${t.color}88`;
  el.dataset.ci=ci;el.dataset.ti=ti;

  const fadeInBeats=clip.fadeIn||0;const fadeOutBeats=clip.fadeOut||0;
  const fadeInPx=fadeInBeats*ppb;const fadeOutPx=fadeOutBeats*ppb;

  el.innerHTML=`
    <canvas class="clip-fade-canvas" width="${Math.max(1,Math.round(w))}" height="44" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:6px;"></canvas>
    <div class="clip-label" style="color:#fff;position:relative;z-index:1;">${clip.label||clip.id}</div>
    <div class="clip-sub" style="position:relative;z-index:1;">${clip.start.toFixed(1)}b · ${clip.len.toFixed(1)}b${clip.pitchShift?` · ${clip.pitchShift>0?'+':''}${clip.pitchShift}st`:''}${clip.playbackRate&&clip.playbackRate!==1?` · ×${clip.playbackRate}`:''}${clip.gain&&clip.gain!==1?` · ${Math.round(clip.gain*100)}%`:''}</div>
    ${fadeInBeats>0?`<div class="clip-fade-handle clip-fade-in" data-ci="${ci}" data-ti="${ti}" style="left:${fadeInPx-5}px;" title="Drag to adjust fade in"></div>`:''}
    ${fadeOutBeats>0?`<div class="clip-fade-handle clip-fade-out" data-ci="${ci}" data-ti="${ti}" style="right:${fadeOutPx-5}px;" title="Drag to adjust fade out"></div>`:''}
    <div class="clip-fade-in-zone" data-ci="${ci}" data-ti="${ti}" title="Drag to add fade in" style="left:0;"></div>
    <div class="clip-fade-out-zone" data-ci="${ci}" data-ti="${ti}" title="Drag to add fade out" style="right:0;"></div>
    <div class="clip-resize-r" data-ci="${ci}" data-ti="${ti}"></div>
    ${clip.bufferId?'<div class="clip-slip-btn" title="Slip edit (move audio inside clip)">↔</div>':''}
    <div class="clip-midi-hint" style="display:${t.type==='midi'||t.type==='beat'?'block':'none'}">🎹</div>`;

  requestAnimationFrame(()=>{
    const cvs=el.querySelector('.clip-fade-canvas');if(!cvs)return;
    const ctx=cvs.getContext('2d'),cw=cvs.width,ch=cvs.height;
    ctx.clearRect(0,0,cw,ch);
    if(fadeInPx>1){
      const grad=ctx.createLinearGradient(0,0,fadeInPx,0);
      grad.addColorStop(0,'rgba(0,0,0,0.65)');grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad;ctx.fillRect(0,0,fadeInPx,ch);
      ctx.strokeStyle=t.color+'cc';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(0,ch);ctx.quadraticCurveTo(fadeInPx*0.5,ch*0.5,fadeInPx,0);ctx.stroke();
    }
    if(fadeOutPx>1){
      const grad=ctx.createLinearGradient(cw-fadeOutPx,0,cw,0);
      grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,0.65)');
      ctx.fillStyle=grad;ctx.fillRect(cw-fadeOutPx,0,fadeOutPx,ch);
      ctx.strokeStyle=t.color+'cc';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(cw-fadeOutPx,0);ctx.quadraticCurveTo(cw-fadeOutPx*0.5,ch*0.5,cw,ch);ctx.stroke();
    }
  });

  el.onclick=e=>{e.stopPropagation();selectClip(ti,ci);};
  el.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();selectClip(ti,ci);showCtxMenu(e.clientX,e.clientY);};
  setupClipDragSnap(el,ti,ci);
  setupResizeDragSnap(el.querySelector('.clip-resize-r'),ti,ci);
  setupFadeHandles(el,ti,ci);
  const slipBtn=el.querySelector('.clip-slip-btn');
  if(slipBtn)slipBtn.addEventListener('click',e=>{e.stopPropagation();startSlipEdit(el,ti,ci);});
  el.addEventListener('dblclick',ev=>{ev.stopPropagation();if(t.type==='midi'||t.type==='beat')openClipInPianoRoll(ti,ci);});
  return el;
};

function setupClipDragSnap(el,ti,ci){
  let startX,startBeat,otherBeats=[];
  const buildOtherBeats=()=>{
    otherBeats=[];
    S.tracks.forEach((t,tii)=>t.clips.forEach((c,cii)=>{
      if(tii===ti&&cii===ci)return;
      otherBeats.push(c.start,c.start+c.len);
    }));
    otherBeats.sort((a,b)=>a-b);
  };
  const magnetSnap=(beat)=>{
    let snapped=snapBeat(beat);
    const magThresh=4/pxPerBeat();
    for(const ob of otherBeats){if(Math.abs(beat-ob)<magThresh){snapped=ob;break;}}
    return snapped;
  };
  const onDown=e=>{
    if(e.target.classList.contains('clip-resize-r')||e.target.classList.contains('clip-fade-handle')||
       e.target.classList.contains('clip-fade-in-zone')||e.target.classList.contains('clip-fade-out-zone')||
       e.target.classList.contains('clip-slip-btn'))return;
    e.stopPropagation();buildOtherBeats();
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    startX=cx;startBeat=S.tracks[ti].clips[ci].start;
    el.classList.add('dragging');snapshot();
    const onMove=ev=>{
      const x=ev.touches?ev.touches[0].clientX:ev.clientX;
      const rawBeat=startBeat+(x-startX)/pxPerBeat();
      const snapped=Math.max(0,magnetSnap(rawBeat));
      S.tracks[ti].clips[ci].start=snapped;
      el.style.left=(snapped*pxPerBeat())+'px';
      showSnapIndicator(snapped);
    };
    const onUp=()=>{
      el.classList.remove('dragging');hideSnapIndicator();renderTracks();
      window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);
    };
    window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
    window.addEventListener('touchmove',onMove,{passive:true});window.addEventListener('touchend',onUp);
  };
  el.addEventListener('mousedown',onDown);el.addEventListener('touchstart',onDown,{passive:true});
}

function setupResizeDragSnap(handle,ti,ci){
  if(!handle)return;
  const onDown=e=>{
    e.stopPropagation();e.preventDefault();
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const startX=cx,startLen=S.tracks[ti].clips[ci].len;
    snapshot();
    const onMove=ev=>{
      const x=ev.touches?ev.touches[0].clientX:ev.clientX;
      const rawLen=startLen+(x-startX)/pxPerBeat();
      const snapped=Math.max(snapBeat(0.5)||0.25,snapBeat(rawLen));
      S.tracks[ti].clips[ci].len=snapped;
      const clipEl=handle.parentElement;if(clipEl)clipEl.style.width=(snapped*pxPerBeat())+'px';
      showSnapIndicator(S.tracks[ti].clips[ci].start+snapped);
    };
    const onUp=()=>{
      hideSnapIndicator();renderTracks();
      window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);
    };
    window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
    window.addEventListener('touchmove',onMove,{passive:true});window.addEventListener('touchend',onUp);
  };
  handle.addEventListener('mousedown',onDown);handle.addEventListener('touchstart',onDown,{passive:true});
}

let _snapIndicatorEl=null;
function showSnapIndicator(beat){
  if(!_snapIndicatorEl){
    _snapIndicatorEl=document.createElement('div');
    _snapIndicatorEl.style.cssText=`position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.6);
      pointer-events:none;z-index:99;box-shadow:0 0 4px rgba(255,255,255,0.4);transition:left .04s;`;
    document.getElementById('tracks-inner')?.appendChild(_snapIndicatorEl);
  }
  _snapIndicatorEl.style.left=(beat*pxPerBeat())+'px';_snapIndicatorEl.style.display='block';
}
function hideSnapIndicator(){if(_snapIndicatorEl)_snapIndicatorEl.style.display='none';}

document.addEventListener('keydown',e=>{
  if(e.key==='n'&&!e.ctrlKey&&!e.metaKey&&document.activeElement.tagName!=='INPUT'){
    S.snapOn=!S.snapOn;toast(S.snapOn?`Snap ON (${S.snapDiv}b)`:'Snap OFF');
  }
});

function setupFadeHandles(clipEl,ti,ci){
  const inZone=clipEl.querySelector('.clip-fade-in-zone');
  const outZone=clipEl.querySelector('.clip-fade-out-zone');
  if(inZone){inZone.addEventListener('mousedown',e=>startFadeDrag(e,'in',clipEl,ti,ci));inZone.addEventListener('touchstart',e=>startFadeDrag(e,'in',clipEl,ti,ci),{passive:true});}
  if(outZone){outZone.addEventListener('mousedown',e=>startFadeDrag(e,'out',clipEl,ti,ci));outZone.addEventListener('touchstart',e=>startFadeDrag(e,'out',clipEl,ti,ci),{passive:true});}
  clipEl.querySelectorAll('.clip-fade-handle').forEach(h=>{
    const isIn=h.classList.contains('clip-fade-in');
    h.addEventListener('mousedown',e=>startFadeDrag(e,isIn?'in':'out',clipEl,ti,ci));
    h.addEventListener('touchstart',e=>startFadeDrag(e,isIn?'in':'out',clipEl,ti,ci),{passive:true});
  });
}

function startFadeDrag(e,dir,clipEl,ti,ci){
  e.stopPropagation();e.preventDefault();
  const sx=e.touches?e.touches[0].clientX:e.clientX;
  const clip=S.tracks[ti].clips[ci];
  const startFade=dir==='in'?(clip.fadeIn||0):(clip.fadeOut||0);
  snapshot();
  const onMove=ev=>{
    const cx=ev.touches?ev.touches[0].clientX:ev.clientX;
    const delta=(cx-sx)/pxPerBeat()*(dir==='out'?-1:1);
    const newFade=Math.max(0,Math.min(clip.len*0.5,startFade+delta));
    if(dir==='in')clip.fadeIn=newFade;else clip.fadeOut=newFade;
    const cvs=clipEl.querySelector('.clip-fade-canvas');
    if(cvs){
      const t=S.tracks[ti];const ppb=pxPerBeat();const w=clip.len*ppb;
      cvs.width=Math.max(1,Math.round(w));
      const ctx=cvs.getContext('2d'),cw=cvs.width,ch=cvs.height;
      ctx.clearRect(0,0,cw,ch);
      const fiPx=(clip.fadeIn||0)*ppb,foPx=(clip.fadeOut||0)*ppb;
      if(fiPx>1){const g=ctx.createLinearGradient(0,0,fiPx,0);g.addColorStop(0,'rgba(0,0,0,0.65)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,fiPx,ch);ctx.strokeStyle=t.color+'cc';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,ch);ctx.quadraticCurveTo(fiPx*0.5,ch*0.5,fiPx,0);ctx.stroke();}
      if(foPx>1){const g=ctx.createLinearGradient(cw-foPx,0,cw,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.65)');ctx.fillStyle=g;ctx.fillRect(cw-foPx,0,foPx,ch);ctx.strokeStyle=t.color+'cc';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cw-foPx,0);ctx.quadraticCurveTo(cw-foPx*0.5,ch*0.5,cw,ch);ctx.stroke();}
    }
  };
  const onUp=()=>{
    renderTracks();if(S.playing){stopAllScheduled();scheduleClipPlayback();}
    window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);
    window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);
  };
  window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
  window.addEventListener('touchmove',onMove,{passive:true});window.addEventListener('touchend',onUp);
}

function startSlipEdit(clipEl,ti,ci){
  const clip=S.tracks[ti].clips[ci];
  if(!clip.bufferId){toast('No audio to slip');return;}
  const entry=S.buffers[clip.bufferId];if(!entry)return;
  snapshot();toast('Slip: drag left/right to offset audio inside clip');
  clipEl.style.cursor='ew-resize';clipEl.style.outline='2px solid var(--yel)';
  const startTrimStart=clip.trimStart||0;let startX=null;
  const onMove=ev=>{
    const cx=ev.touches?ev.touches[0].clientX:ev.clientX;
    if(startX===null){startX=cx;return;}
    const delta=(cx-startX)/pxPerBeat()*(60/S.bpm);
    const maxTrim=Math.max(0,entry.duration-beatToSec(clip.len));
    clip.trimStart=Math.max(0,Math.min(maxTrim,startTrimStart-delta));
    const sub=clipEl.querySelector('.clip-sub');
    if(sub)sub.textContent=`${clip.start.toFixed(1)}b · ${clip.len.toFixed(1)}b · ⊢${clip.trimStart.toFixed(2)}s`;
    drawAllLaneWaveforms();
  };
  const onUp=()=>{
    clipEl.style.cursor='';clipEl.style.outline='';
    renderTracks();if(S.playing){stopAllScheduled();scheduleClipPlayback();}
    window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);
    window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);
  };
  window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
  window.addEventListener('touchmove',onMove,{passive:true});window.addEventListener('touchend',onUp);
}

/* Timeline pro CSS now static: css/timeline-pro.css */

requestAnimationFrame(()=>{
  const topbar=document.getElementById('topbar');
  if(topbar&&!document.getElementById('snap-toggle')){
    const btn=document.createElement('button');
    btn.id='snap-toggle';btn.textContent='⊞ Snap';btn.title='Toggle snap to grid (N)';
    btn.style.borderColor=S.snapOn?'var(--acc)':'var(--txt3)';
    btn.style.background=S.snapOn?'rgba(176,110,243,0.18)':'transparent';
    btn.style.color=S.snapOn?'var(--acc)':'var(--txt2)';
    btn.onclick=()=>{
      S.snapOn=!S.snapOn;
      btn.style.borderColor=S.snapOn?'var(--acc)':'var(--txt3)';
      btn.style.background=S.snapOn?'rgba(176,110,243,0.18)':'transparent';
      btn.style.color=S.snapOn?'var(--acc)':'var(--txt2)';
      toast(S.snapOn?`Snap ON (${S.snapDiv}b)`:'Snap OFF');
    };
    topbar.appendChild(btn);
  }
});

renderTracks();
