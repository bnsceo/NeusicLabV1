/* Neusic Phase A: playback/export parity, 16-pad velocity sequencing, real stereo meters. */
(function(){
'use strict';
const STEP_COUNT=16,DEFAULT_VEL=.85,MIN_SEC=.005;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
let meterRaf=0;

function normStep(raw){
  if(!raw)return 0;
  if(typeof raw==='object')return{
    active:raw.active!==false,
    velocity:clamp(num(raw.velocity,DEFAULT_VEL),.05,1),
    probability:clamp(num(raw.probability,1),0,1),
    repeats:clamp(Math.round(num(raw.repeats,1)),1,8),
    timingOffset:clamp(num(raw.timingOffset,0),-.12,.12),
    pitch:clamp(num(raw.pitch,0),-24,24)
  };
  const v=clamp(num(raw,DEFAULT_VEL),.05,1);
  return{active:true,velocity:v===1?DEFAULT_VEL:v,probability:1,repeats:1,timingOffset:0,pitch:0};
}
const stepOn=s=>Boolean(s&&(typeof s!=='object'||s.active!==false));
function migrateSteps(){
  S.seqSteps||={};
  PADS.forEach(p=>{const src=Array.isArray(S.seqSteps[p.id])?S.seqSteps[p.id]:[];S.seqSteps[p.id]=Array.from({length:STEP_COUNT},(_,i)=>normStep(src[i]));});
}
function paintStep(btn,raw,col){
  if(!btn)return;const s=normStep(raw),on=stepOn(s),v=on?s.velocity:0;
  btn.classList.toggle('on',on);btn.style.setProperty('--step-color',col);btn.style.setProperty('--step-velocity',v);
  btn.style.background=on?`color-mix(in srgb, ${col} ${Math.round(22+v*38)}%, #121220)`:'';
  btn.style.color=on?col:'';btn.setAttribute('aria-pressed',String(on));btn.setAttribute('aria-valuenow',String(Math.round(v*100)));
  btn.title=on?`Velocity ${Math.round(v*100)}% · click off · drag vertically`:`Step off · click for ${Math.round(DEFAULT_VEL*100)}%`;
}
function snap(){if(typeof window.snapshot==='function')window.snapshot();}
function wireStep(btn,pad,index){
  btn.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();snap();
    const start=normStep(S.seqSteps[pad.id][index]),y=e.clientY;let moved=false;
    btn.setPointerCapture?.(e.pointerId);
    const move=ev=>{if(!stepOn(start))return;const d=(y-ev.clientY)/90;if(Math.abs(d)<.025)return;moved=true;const next={...start,active:true,velocity:clamp(start.velocity+d,.05,1)};S.seqSteps[pad.id][index]=next;paintStep(btn,next,pad.col);};
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);if(!moved){const next=stepOn(start)?0:normStep(DEFAULT_VEL);S.seqSteps[pad.id][index]=next;paintStep(btn,next,pad.col);}};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});window.addEventListener('pointercancel',up,{once:true});
  });
  btn.addEventListener('dblclick',e=>{e.preventDefault();snap();S.seqSteps[pad.id][index]=normStep(DEFAULT_VEL);paintStep(btn,S.seqSteps[pad.id][index],pad.col);});
}
function touchVelocity(e){if(e.pointerType==='touch')return clamp(.35+Math.max(num(e.width,1),num(e.height,1))/70,.35,1);return e.shiftKey?.55:.9;}
function playPad(pad,vel,when,dest,ctxOverride){
  const ctx=ctxOverride||Audio_.ensure(),target=dest||Audio_.master,t=when??ctx.currentTime,g=ctx.createGain();
  g.gain.setValueAtTime(clamp(vel,.01,1),Math.max(0,t));g.connect(target);Audio_.synthDrum(pad.n,g,t);
  if(!ctxOverride)setTimeout(()=>{try{g.disconnect();}catch(_){}},2200);
}
window.hitPad=function(id,name,vel=.9){const p=PADS.find(x=>x.id===Number(id))||{id,n:name};const b=document.getElementById(`pad-${p.id}`);b?.classList.add('hit');if(b)setTimeout(()=>b.classList.remove('hit'),110);Audio_.ensure();playPad(p,vel,Audio_.ctx.currentTime);};
window.toggleStep=function(id,i,btn,col){migrateSteps();const s=normStep(S.seqSteps[id][i]);S.seqSteps[id][i]=stepOn(s)?0:normStep(DEFAULT_VEL);paintStep(btn,S.seqSteps[id][i],col);};
window.buildDrums=function(el){
  migrateSteps();
  const pads=PADS.map(p=>`<button class="pad-btn" id="pad-${p.id}" type="button" style="color:${p.col};background:${p.bg}" aria-label="${p.n} pad"><span>${p.n}</span><small>${p.id}</small></button>`).join('');
  const rows=PADS.map(p=>`<div class="seq-row" data-pad-id="${p.id}"><button type="button" class="seq-lbl phase-a-seq-label" style="color:${p.col}" data-preview="${p.id}">${p.n}</button><div class="seq-steps">${S.seqSteps[p.id].map((s,i)=>`${[4,8,12].includes(i)?'<div class="step-gap"></div>':''}<button class="step${stepOn(s)?' on':''}" type="button" data-pad="${p.id}" data-step="${i}" aria-label="${p.n} step ${i+1}"></button>`).join('')}</div></div>`).join('');
  el.innerHTML=`<div class="pad-section phase-a-drum-workspace"><div class="phase-a-seq-toolbar"><div><strong>16-pad sequencer</strong><span>Click to toggle · drag active steps vertically for velocity</span></div><span class="phase-a-badge">VELOCITY</span></div><div class="pad-grid">${pads}</div><div class="seq-area phase-a-seq-area">${rows}</div></div>`;
  PADS.forEach(p=>{const pb=el.querySelector(`#pad-${p.id}`);pb?.addEventListener('pointerdown',e=>{e.preventDefault();window.hitPad(p.id,p.n,touchVelocity(e));});el.querySelector(`[data-preview="${p.id}"]`)?.addEventListener('click',()=>window.hitPad(p.id,p.n,.75));S.seqSteps[p.id].forEach((s,i)=>{const b=el.querySelector(`.step[data-pad="${p.id}"][data-step="${i}"]`);paintStep(b,s,p.col);wireStep(b,p,i);});});
};
function scheduleVoices(p,raw,base,dest,ctx){const s=normStep(raw);if(!stepOn(s)||Math.random()>s.probability)return;const spacing=beatToSec(.25)/(s.repeats||1);for(let i=0;i<(s.repeats||1);i++){const t=base+s.timingOffset+i*spacing;if(t>=0)playPad(p,s.velocity,t,dest,ctx);}}
window.scheduleSeqSteps=function(horizon){const len=.25;while(S.nextSeqStepBeat<horizon){const beat=S.nextSeqStepBeat,index=Math.round(beat/len)%STEP_COUNT,when=songSecToCtxTime(beatToSec(beat));PADS.forEach(p=>scheduleVoices(p,S.seqSteps[p.id]?.[index],when));setTimeout(()=>window.flashSeqStep(index),Math.max(0,(when-Audio_.ctx.currentTime)*1000));S.nextSeqStepBeat+=len;}};
window.flashSeqStep=function(i){if(!S.playing)return;S.seqStep=i;document.querySelectorAll('.seq-row').forEach(r=>r.querySelectorAll('.step').forEach((b,n)=>b.classList.toggle('cur',n===i)));PADS.forEach(p=>{if(!stepOn(S.seqSteps[p.id]?.[i]))return;const b=document.getElementById(`pad-${p.id}`);if(b){b.style.filter='brightness(2.1)';setTimeout(()=>b.style.filter='',80);}});};
window.scheduleOfflineSequencer=function(ctx,_inputs,duration){migrateSteps();const stepSec=beatToSec(.25),count=Math.ceil(duration/stepSec);for(let n=0;n<count;n++){const i=n%STEP_COUNT,t=n*stepSec;PADS.forEach(p=>scheduleVoices(p,S.seqSteps[p.id]?.[i],t,ctx.__masterGain,ctx));}};

function clipInfo(c){const rate=clamp(num(c.playbackRate,1),.1,4),pitch=clamp(num(c.pitchShift,0),-24,24);return{rate,pitch,effective:rate*Math.pow(2,pitch/12),gain:clamp(num(c.gain,1),0,8),fadeIn:Math.max(0,beatToSec(num(c.fadeIn,0))),fadeOut:Math.max(0,beatToSec(num(c.fadeOut,0)))};}
function gainEnvelope(param,info,when,duration,elapsed){const end=when+duration,fi=Math.min(info.fadeIn,duration),fo=Math.min(info.fadeOut,duration);let start=info.gain;if(fi&&elapsed<fi)start=info.gain*elapsed/fi;if(fo){const full=duration+elapsed,foStart=Math.max(0,full-fo);if(elapsed>foStart)start=Math.min(start,info.gain*(full-elapsed)/fo);}param.cancelScheduledValues(when);param.setValueAtTime(clamp(start,0,info.gain),when);if(fi>elapsed)param.linearRampToValueAtTime(info.gain,Math.min(end,when+fi-elapsed));if(fo){const at=when+Math.max(0,duration-fo);if(at>when)param.setValueAtTime(info.gain,at);param.linearRampToValueAtTime(0,end);}}
function scheduleClip(ctx,clip,entry,dest,when,elapsed,remaining){const info=clipInfo(clip),sourceOffset=(clip.trimStart||0)+elapsed*info.effective,available=Math.max(0,entry.duration-sourceOffset),output=Math.min(remaining,available/info.effective);if(output<=MIN_SEC)return null;const sourceDur=output*info.effective,src=ctx.createBufferSource();src.buffer=clip.reverse?reversedBuffer(entry.buffer):entry.buffer;src.playbackRate.value=info.rate;src.detune.value=info.pitch*100;const g=ctx.createGain();gainEnvelope(g.gain,info,when,output,elapsed);src.connect(g);g.connect(dest);const offset=clip.reverse?Math.max(0,entry.duration-sourceOffset-sourceDur):sourceOffset;try{src.start(when,offset,sourceDur);src.stop(when+output+.01);}catch(_){return null;}return src;}
window.scheduleClipPlayback=function(){stopAllScheduled();if(!S.playing)return;Audio_.ensure();const nowCtx=Audio_.ctx.currentTime,nowBeat=secToBeat(S.sec);S.tracks.forEach(t=>{const dest=Audio_.trackInput(t.id);(t.clips||[]).forEach(c=>{if(!c.bufferId||c.recording)return;const e=S.buffers[c.bufferId];if(!e)return;const end=c.start+c.len;if(end<=nowBeat)return;const start=Math.max(c.start,nowBeat),src=scheduleClip(Audio_.ctx,c,e,dest,nowCtx+beatToSec(start-nowBeat),beatToSec(start-c.start),beatToSec(end-start));if(src)S.scheduled.push(src);});});};
window.scheduleOfflineClips=function(ctx,inputs){S.tracks.forEach(t=>(t.clips||[]).forEach(c=>{if(!c.bufferId||c.recording)return;const e=S.buffers[c.bufferId];if(e)scheduleClip(ctx,c,e,inputs[t.id],beatToSec(c.start),0,beatToSec(c.len));}));};

function silentSink(ctx){if(Audio_._meterSilentSink)return Audio_._meterSilentSink;const g=ctx.createGain();g.gain.value=0;g.connect(ctx.destination);return Audio_._meterSilentSink=g;}
function stereoPair(source,key){Audio_._stereoMeters||={};const old=Audio_._stereoMeters[key];if(old?.source===source)return old;if(old){[old.split,old.l,old.r].forEach(n=>{try{n?.disconnect();}catch(_){}});delete Audio_._stereoMeters[key];}const ctx=Audio_.ensure(),split=ctx.createChannelSplitter(2),l=ctx.createAnalyser(),r=ctx.createAnalyser();l.fftSize=r.fftSize=1024;l.smoothingTimeConstant=r.smoothingTimeConstant=.72;source.connect(split);split.connect(l,0);split.connect(r,1);const sink=silentSink(ctx);l.connect(sink);r.connect(sink);return Audio_._stereoMeters[key]={source,split,l,r,ld:new Float32Array(l.fftSize),rd:new Float32Array(r.fftSize)};}
Audio_.ensureTrackStereoMeters=function(id){return stereoPair(this.ensureTrackGain(id),`track:${id}`);};
Audio_.ensureMasterStereoMeters=function(){return stereoPair(this.masterLimiterNode||this.master,'master');};
function stats(a,d){a.getFloatTimeDomainData(d);let peak=0,sum=0;for(const v of d){peak=Math.max(peak,Math.abs(v));sum+=v*v;}return{peak,ms:sum/d.length};}
function readPair(p){return{l:stats(p.l,p.ld),r:stats(p.r,p.rd)};}
const loud={samples:[],blocks:[],last:0,value:-70};
const toLufs=e=>e>1e-12?-.691+10*Math.log10(e):-70;
function integrated(st){const now=performance.now(),energy=st.l.ms+st.r.ms;loud.samples.push({at:now,energy});loud.samples=loud.samples.filter(x=>now-x.at<=450);const moment=loud.samples.reduce((s,x)=>s+x.energy,0)/Math.max(1,loud.samples.length);if(now-loud.last>=400){loud.last=now;const lu=toLufs(moment);if(lu>-70)loud.blocks.push({energy:moment,lu});if(loud.blocks.length>1800)loud.blocks.shift();const abs=loud.blocks.filter(x=>x.lu>=-70);if(abs.length){const ung=abs.reduce((s,x)=>s+x.energy,0)/abs.length,gate=toLufs(ung)-10,gated=abs.filter(x=>x.lu>=gate);loud.value=toLufs(gated.reduce((s,x)=>s+x.energy,0)/Math.max(1,gated.length));}}return loud.value;}
const pct=peak=>clamp((20*Math.log10(Math.max(1e-6,peak))+60)/60*100,0,100);
function meter(id,val,col){const e=document.getElementById(id);if(!e)return;e.style.height=`${val}%`;e.style.background=val>=98?'var(--red)':val>=86?'var(--yel)':col;}
window.cancelMeterAnim=function(){cancelAnimationFrame(meterRaf);meterRaf=0;};
window.startProMeterAnim=function(){window.cancelMeterAnim();if(S.activePanel!=='mixer')return;const tick=()=>{if(S.activePanel!=='mixer')return;S.tracks.forEach((t,i)=>{const s=readPair(Audio_.ensureTrackStereoMeters(t.id));meter(`pmf-${i}`,pct(s.l.peak),t.color);meter(`pmf-${i}r`,pct(s.r.peak),t.color);});const mi=S.tracks.length,ms=readPair(Audio_.ensureMasterStereoMeters());meter(`pmf-${mi}`,pct(ms.l.peak),'#22c55e');meter(`pmf-${mi}r`,pct(ms.r.peak),'#22c55e');const lu=integrated(ms),le=document.getElementById('lufs-val');if(le){le.textContent=`${lu.toFixed(1)} LUFS-I est.`;le.style.color=lu>S.lufsTarget+2?'var(--red)':lu>S.lufsTarget-1?'var(--yel)':'var(--grn)';}const db=20*Math.log10(Math.max(1e-6,Math.max(ms.l.peak,ms.r.peak))),pe=document.getElementById('peak-val');if(pe){pe.textContent=`${db.toFixed(1)} dBFS`;pe.style.color=db>-1?'var(--red)':db>-6?'var(--yel)':'var(--grn)';}meterRaf=requestAnimationFrame(tick);};meterRaf=requestAnimationFrame(tick);};
window.updateMeterAnim=window.startProMeterAnim;
function labels(root=document){const l=root.querySelector('.pmx-lufs-lbl');if(l){l.textContent='LUFS-I EST.';l.title='Integrated loudness estimate with absolute and relative gating';}root.querySelectorAll('.pmx-meter-col').forEach(e=>e.title='Measured left and right channel peaks');}
const AI_RX=/\b(ai|stem|auto[ -]?eq|detect bpm|detect key|smart sample|chord suggestion)\b/i;
function markAI(root=document){root.querySelectorAll('button,.ai-card,.ai-feature,[data-ai-feature]').forEach(e=>{if(e.dataset.experimentalMarked==='true'||!AI_RX.test(`${e.textContent||''} ${e.title||''}`))return;e.dataset.experimentalMarked='true';e.classList.add('experimental-ai-feature');e.title=`${e.title?e.title+' · ':''}Experimental preview — verify results`;const b=document.createElement('span');b.className='experimental-ai-badge';b.textContent='EXPERIMENTAL';e.appendChild(b);});}
function loadCss(){if(document.querySelector('link[data-neusic-production-integrity]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='css/14-production-integrity.css';l.dataset.neusicProductionIntegrity='true';document.head.appendChild(l);}
function init(){if(typeof S==='undefined'||typeof PADS==='undefined'||typeof Audio_==='undefined')return;migrateSteps();loadCss();labels();markAI();new MutationObserver(rs=>rs.forEach(r=>r.addedNodes.forEach(n=>{if(n instanceof Element){labels(n);markAI(n);}}))).observe(document.body,{childList:true,subtree:true});if(S.activePanel==='drums')window.buildPanelContent?.('drums');window.NeusicPhaseA={version:'1.0.1',normStep,migrateSteps,clipInfo};window.toast?.('Phase A audio integrity loaded');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
