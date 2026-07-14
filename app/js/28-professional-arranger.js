/* Neusic Professional Arranger: sections, loop regions, patterns, multi-clip editing, ripple time and dynamic timeline. */
(function(){
'use strict';
const VERSION='1.0.0';
const STORAGE_KEY='neusic-professional-arranger-v1';
const SECTION_COLORS=['#6f8795','#9a7b4f','#6f806d','#81718d','#8d6868','#687d8f','#8b8063','#6f777e'];
const PATTERN_IDS=['A','B','C','D','E','F','G','H'];
const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const uid=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const isEditable=target=>target?.matches?.('input,textarea,select,[contenteditable="true"]');
const snap=value=>typeof window.snapBeat==='function'?window.snapBeat(value):Math.round(value*2)/2;
let selectedSectionId=null;
let selectedClips=new Set();
let clipClipboard=[];
let toolbar=null;
let structureContent=null;
let loopRaf=0;
let lastProjectToken='';
let extendLock=false;

function defaultPattern(){
  const source=S.seqSteps||{};
  return clone(source);
}
function blankPattern(){
  const out={};
  PADS.forEach(p=>out[p.id]=Array.from({length:16},()=>0));
  return out;
}
function defaultArranger(){
  return{
    arrangementBeats:256,
    sections:[],
    loop:{enabled:false,start:0,end:16},
    drumPatterns:{A:defaultPattern()},
    activePatternId:'A'
  };
}
function projectToken(){return `${S.projectMeta?.createdAt||'legacy'}:${S.projectMeta?.template||'legacy'}`;}
function importArranger(raw){
  const data=raw&&typeof raw==='object'?raw:{};
  S.arrangementBeats=Math.max(64,Number(data.arrangementBeats)||256);
  S.arrangerSections=Array.isArray(data.sections)?clone(data.sections):[];
  S.loopRegion=Object.assign({enabled:false,start:0,end:16},clone(data.loop||{}));
  S.loopRegion.start=Math.max(0,Number(S.loopRegion.start)||0);
  S.loopRegion.end=Math.max(S.loopRegion.start+.5,Number(S.loopRegion.end)||16);
  S.drumPatterns=data.drumPatterns&&typeof data.drumPatterns==='object'?clone(data.drumPatterns):{A:defaultPattern()};
  S.activePatternId=String(data.activePatternId||'A');
  if(!S.drumPatterns[S.activePatternId])S.drumPatterns[S.activePatternId]=blankPattern();
  S.seqSteps=clone(S.drumPatterns[S.activePatternId]);
}
function exportArranger(){
  syncActivePattern();
  return{
    arrangementBeats:Math.max(64,Number(S.arrangementBeats)||256),
    sections:clone(S.arrangerSections||[]),
    loop:clone(S.loopRegion||{enabled:false,start:0,end:16}),
    drumPatterns:clone(S.drumPatterns||{}),
    activePatternId:S.activePatternId||'A'
  };
}
function persist(){
  const data=exportArranger();
  S.projectMeta=S.projectMeta||{};
  S.projectMeta.arranger=data;
  S.recOpts=S.recOpts||{};S.recOpts.__arranger=clone(data);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(_){ }
  window.NeusicSafety?.queueSave?.();
}
function restore(){
  let raw=S.recOpts?.__arranger||S.projectMeta?.arranger||null;
  if(!raw){try{raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch(_){raw=null;}}
  importArranger(raw||defaultArranger());
  lastProjectToken=projectToken();
  persist();
}
function resetForProject(){
  selectedSectionId=null;selectedClips.clear();clipClipboard=[];
  importArranger(defaultArranger());
  lastProjectToken=projectToken();
  persist();renderAll();
}
function syncActivePattern(){
  if(!S.drumPatterns||!S.activePatternId)return;
  S.drumPatterns[S.activePatternId]=clone(S.seqSteps||blankPattern());
}
function loadPattern(id){
  syncActivePattern();
  S.activePatternId=id;
  if(!S.drumPatterns[id])S.drumPatterns[id]=blankPattern();
  S.seqSteps=clone(S.drumPatterns[id]);
  const select=document.getElementById('arr-pattern-select');if(select)select.value=id;
  if(S.activePanel==='drums')window.buildPanelContent?.('drums');
  persist();updateToolbar();window.toast?.(`Pattern ${id} loaded`);
}
function maxClipBeat(){let max=0;(S.tracks||[]).forEach(t=>(t.clips||[]).forEach(c=>max=Math.max(max,(Number(c.start)||0)+(Number(c.len)||0))));return max;}
function contentBeats(){
  const sectionEnd=Math.max(0,...(S.arrangerSections||[]).map(s=>Number(s.end)||0));
  const loopEnd=Number(S.loopRegion?.end)||0;
  return Math.max(64,Number(S.arrangementBeats)||256,maxClipBeat()+32,sectionEnd+16,loopEnd+16);
}
function headerWidth(){return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-w'))||0;}
function laneWidth(){return Math.max(1,(document.getElementById('tracks-area')?.clientWidth||window.innerWidth)-headerWidth());}
function contentPixels(){return Math.max(laneWidth(),contentBeats()*window.pxPerBeat());}

window.arrangementWidth=function(){return contentPixels();};
window.updateOverview=function(){
  const ov=document.getElementById('overview'),win=document.getElementById('ov-win'),cur=document.getElementById('ov-cur'),scroll=document.getElementById('tracks-scroll');
  if(!ov||!win||!cur||!scroll)return;
  const total=Math.max(1,contentPixels()),visible=Math.max(1,scroll.clientWidth-headerWidth());
  win.style.left=`${Math.min(1,S.scrollX/total)*100}%`;
  win.style.width=`${Math.min(1,visible/total)*100}%`;
  cur.style.left=`${Math.min(1,Math.max(0,window.secToBeat(S.sec)/contentBeats()))*100}%`;
};
window.buildOv=function(){
  const rows=Math.max(1,S.tracks.length),total=contentBeats(),segments=document.getElementById('ov-segs');if(!segments)return;
  segments.innerHTML=S.tracks.flatMap((track,ti)=>{
    if(!(track.clips||[]).length)return[];
    return track.clips.map(clip=>{const left=clamp((clip.start/total)*100,0,100),width=Math.max(.35,Math.min(100-left,(clip.len/total)*100)),top=(ti+.25)/rows*100;return`<div class="ov-seg" style="left:${left}%;width:${width}%;top:${top}%;background:${track.color};color:${track.color}"></div>`;});
  }).join('');
  window.updateOverview();
};
window.seekToPct=function(pct){
  S.pct=clamp(pct,0,1);const targetSec=window.beatToSec(S.pct*contentBeats());
  if(S.playing){window.anchorClock(targetSec);const beat=window.secToBeat(S.sec);S.nextSeqStepBeat=window.nextStepBeatAtOrAfter(beat);S.nextMetroBeat=Math.ceil(beat);window.stopAllScheduled?.();window.scheduleClipPlayback?.();window.applyAllTrackAutomation?.();}
  else{S.sec=targetSec;S.clockSecAnchor=targetSec;}
  window.updateTime?.();window.posPlayhead?.();
};
window.posPlayhead=function(){
  const ph=document.getElementById('playhead');if(!ph)return;const beat=window.secToBeat(S.sec);S.pct=clamp(beat/contentBeats(),0,1);ph.style.left=`${headerWidth()+window.beatToContentX(beat)}px`;ph.style.height=`${document.getElementById('tracks-inner')?.scrollHeight||0}px`;window.updateOverview();
  const prPh=document.getElementById('pr-ph'),prG=document.getElementById('pr-canvas');if(prPh&&prG)prPh.style.left=`${S.pct*prG.width}px`;window.drawAutoCanvas?.();
};

function buildToolbar(){
  if(document.getElementById('arranger-toolbar')){toolbar=document.getElementById('arranger-toolbar');return;}
  const center=document.getElementById('center'),overview=document.getElementById('overview');if(!center||!overview)return;
  toolbar=document.createElement('div');toolbar.id='arranger-toolbar';toolbar.innerHTML=`
    <div class="arr-title"><strong>ARRANGER</strong><span id="arr-status">Song timeline</span></div>
    <button type="button" data-arr="map">Song Map</button>
    <button type="button" data-arr="section">+ Section</button>
    <button type="button" data-arr="duplicate-section">Duplicate Section</button>
    <button type="button" data-arr="loop">Loop</button>
    <select id="arr-pattern-select" aria-label="Active drum pattern">${PATTERN_IDS.map(id=>`<option value="${id}">Pattern ${id}</option>`).join('')}</select>
    <button type="button" data-arr="place-pattern">Place Pattern</button>
    <button type="button" data-arr="insert">Insert Time</button>
    <button type="button" data-arr="delete-time">Delete Time</button>
    <button type="button" data-arr="fit">Fit</button>
    <button type="button" data-arr="extend">+16 Bars</button>`;
  center.insertBefore(toolbar,overview);
  toolbar.addEventListener('click',handleToolbar);
  toolbar.querySelector('#arr-pattern-select').addEventListener('change',event=>loadPattern(event.target.value));
}
function buildStructureLane(){
  if(document.getElementById('arranger-lane')){structureContent=document.getElementById('arranger-content');return;}
  const ruler=document.getElementById('ruler');if(!ruler)return;
  const lane=document.createElement('div');lane.id='arranger-lane';lane.innerHTML='<div class="arranger-pad">STRUCTURE</div><div class="arranger-viewport"><div id="arranger-content"></div></div>';
  ruler.before(lane);structureContent=lane.querySelector('#arranger-content');
}
function updateToolbar(){
  if(!toolbar)return;const section=(S.arrangerSections||[]).find(s=>s.id===selectedSectionId),status=toolbar.querySelector('#arr-status');
  if(status)status.textContent=section?`${section.name} · ${((section.end-section.start)/4).toFixed(1)} bars`:`${Math.ceil(contentBeats()/4)} bars · ${selectedClips.size} clips selected`;
  const loopButton=toolbar.querySelector('[data-arr="loop"]');if(loopButton){loopButton.classList.toggle('active',Boolean(S.loopRegion?.enabled));loopButton.textContent=S.loopRegion?.enabled?'Loop On':'Loop';}
  const dup=toolbar.querySelector('[data-arr="duplicate-section"]');if(dup)dup.disabled=!section;
  const select=toolbar.querySelector('#arr-pattern-select');if(select)select.value=S.activePatternId||'A';
}
function syncStructureScroll(){if(structureContent)structureContent.style.transform=`translateX(${-Math.max(0,S.scrollX||0)}px)`;}
function renderStructure(){
  if(!structureContent)return;const ppb=window.pxPerBeat(),width=contentPixels();structureContent.style.width=`${width}px`;structureContent.innerHTML='';
  const loop=S.loopRegion||{enabled:false,start:0,end:16};
  const loopEl=document.createElement('div');loopEl.className=`arr-loop-region${loop.enabled?' enabled':''}`;loopEl.style.left=`${loop.start*ppb}px`;loopEl.style.width=`${Math.max(2,(loop.end-loop.start)*ppb)}px`;loopEl.innerHTML='<span>LOOP</span><i data-loop-handle="start"></i><i data-loop-handle="end"></i>';structureContent.appendChild(loopEl);wireLoop(loopEl);
  (S.arrangerSections||[]).sort((a,b)=>a.start-b.start).forEach(section=>{
    const el=document.createElement('button');el.type='button';el.className=`arr-section${section.id===selectedSectionId?' selected':''}`;el.dataset.sectionId=section.id;el.style.left=`${section.start*ppb}px`;el.style.width=`${Math.max(8,(section.end-section.start)*ppb)}px`;el.style.setProperty('--section-color',section.color||SECTION_COLORS[0]);el.innerHTML=`<span>${escapeHtml(section.name)}</span><small>${Math.round(section.start/4)+1}–${Math.ceil(section.end/4)}</small><i class="arr-section-handle left" data-section-edge="left"></i><i class="arr-section-handle right" data-section-edge="right"></i>`;structureContent.appendChild(el);wireSection(el,section);
  });
  syncStructureScroll();updateToolbar();
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function wireSection(el,section){
  el.addEventListener('click',event=>{event.stopPropagation();selectedSectionId=section.id;renderStructure();});
  el.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();const name=prompt('Section name',section.name);if(name?.trim()){window.snapshot?.();section.name=name.trim();persist();renderStructure();}});
  el.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();selectedSectionId=section.id;const edge=event.target.dataset.sectionEdge||'move',startX=event.clientX,start={start:section.start,end:section.end};window.snapshot?.();el.setPointerCapture?.(event.pointerId);
    const move=ev=>{const delta=snap((ev.clientX-startX)/window.pxPerBeat());if(edge==='left')section.start=clamp(snap(start.start+delta),0,section.end-.5);else if(edge==='right')section.end=Math.max(section.start+.5,snap(start.end+delta));else{const len=start.end-start.start;section.start=Math.max(0,snap(start.start+delta));section.end=section.start+len;}S.arrangementBeats=Math.max(S.arrangementBeats,section.end+16);renderStructure();};
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);persist();renderAll();};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
  });
}
function wireLoop(el){
  el.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();const edge=event.target.dataset.loopHandle||'move',startX=event.clientX,start=clone(S.loopRegion);window.snapshot?.();el.setPointerCapture?.(event.pointerId);
    const move=ev=>{const delta=snap((ev.clientX-startX)/window.pxPerBeat());if(edge==='start')S.loopRegion.start=clamp(snap(start.start+delta),0,S.loopRegion.end-.5);else if(edge==='end')S.loopRegion.end=Math.max(S.loopRegion.start+.5,snap(start.end+delta));else{const len=start.end-start.start;S.loopRegion.start=Math.max(0,snap(start.start+delta));S.loopRegion.end=S.loopRegion.start+len;}renderStructure();};
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);persist();};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
  });
}
function playheadBeat(){return Math.max(0,snap(window.secToBeat(S.sec)));}
function createSongMap(){
  if((S.arrangerSections||[]).length&&!confirm('Replace the current section map?'))return;window.snapshot?.();let cursor=0;const form=[['Intro',4],['Verse 1',8],['Pre-Chorus',4],['Chorus 1',8],['Verse 2',8],['Chorus 2',8],['Bridge',4],['Final Chorus',8],['Outro',4]];
  S.arrangerSections=form.map(([name,bars],index)=>{const start=cursor,end=start+bars*4;cursor=end;return{id:uid('section'),name,start,end,color:SECTION_COLORS[index%SECTION_COLORS.length]};});S.arrangementBeats=Math.max(256,cursor+32);selectedSectionId=S.arrangerSections[0]?.id||null;persist();renderAll();window.toast?.('Professional song map created');
}
function addSection(){
  const start=Math.floor(playheadBeat()/4)*4,name=prompt('Section name','Verse');if(!name?.trim())return;const bars=clamp(Number(prompt('Length in bars','8'))||8,1,64);window.snapshot?.();const section={id:uid('section'),name:name.trim(),start,end:start+bars*4,color:SECTION_COLORS[(S.arrangerSections||[]).length%SECTION_COLORS.length]};S.arrangerSections.push(section);selectedSectionId=section.id;S.arrangementBeats=Math.max(S.arrangementBeats,section.end+16);persist();renderAll();
}
function duplicateSection(){
  const section=(S.arrangerSections||[]).find(s=>s.id===selectedSectionId);if(!section){window.toast?.('Select a section first');return;}window.snapshot?.();const len=section.end-section.start;
  const copies=S.tracks.map(track=>(track.clips||[]).filter(c=>c.start>=section.start&&c.start<section.end).map(c=>({...clone(c),id:uid('clip'),start:c.start+len,label:`${c.label||'Clip'} copy`})));
  S.tracks.forEach((track,index)=>{track.clips.forEach(c=>{if(c.start>=section.end)c.start+=len;});track.clips.push(...copies[index]);});
  S.arrangerSections.forEach(s=>{if(s.start>=section.end){s.start+=len;s.end+=len;}});const copy={...clone(section),id:uid('section'),name:`${section.name} Copy`,start:section.end,end:section.end+len};S.arrangerSections.push(copy);selectedSectionId=copy.id;S.arrangementBeats+=len;persist();renderAll();window.toast?.(`${section.name} duplicated`);
}
function setLoop(){
  if(S.loopRegion?.enabled){S.loopRegion.enabled=false;persist();renderStructure();return;}
  const section=(S.arrangerSections||[]).find(s=>s.id===selectedSectionId);if(section){S.loopRegion.start=section.start;S.loopRegion.end=section.end;}else{const start=Math.floor(playheadBeat()/4)*4;S.loopRegion.start=start;S.loopRegion.end=start+16;}S.loopRegion.enabled=true;const beat=window.secToBeat(S.sec);if(beat<S.loopRegion.start||beat>=S.loopRegion.end){window.anchorClock?.(window.beatToSec(S.loopRegion.start));window.updateTime?.();window.posPlayhead?.();}persist();renderStructure();
}
function insertTime(){
  const bars=clamp(Number(prompt('Bars to insert','4'))||4,1,64),amount=bars*4,at=Math.floor(playheadBeat()/4)*4;window.snapshot?.();S.tracks.forEach(t=>(t.clips||[]).forEach(c=>{if(c.start>=at)c.start+=amount;}));S.arrangerSections.forEach(s=>{if(s.start>=at){s.start+=amount;s.end+=amount;}else if(s.end>at)s.end+=amount;});if(S.loopRegion.start>=at){S.loopRegion.start+=amount;S.loopRegion.end+=amount;}else if(S.loopRegion.end>at)S.loopRegion.end+=amount;S.arrangementBeats+=amount;persist();renderAll();window.toast?.(`${bars} bars inserted`);
}
function adjustTrim(clip,beats){if(clip.bufferId&&!clip.reverse)clip.trimStart=(clip.trimStart||0)+window.beatToSec(Math.max(0,beats));}
function deleteTime(){
  const bars=clamp(Number(prompt('Bars to delete','4'))||4,1,64),amount=bars*4,start=Math.floor(playheadBeat()/4)*4,end=start+amount;window.snapshot?.();
  S.tracks.forEach(track=>{const next=[];(track.clips||[]).forEach(clip=>{const cStart=clip.start,cEnd=clip.start+clip.len;if(cEnd<=start){next.push(clip);return;}if(cStart>=end){clip.start-=amount;next.push(clip);return;}if(cStart>=start&&cEnd<=end)return;if(cStart<start&&cEnd>end){const right={...clone(clip),id:uid('clip'),start:start,len:cEnd-end,label:`${clip.label||'Clip'} B`};adjustTrim(right,end-cStart);clip.len=start-cStart;next.push(clip,right);return;}if(cStart<start){clip.len=Math.max(.5,start-cStart);next.push(clip);return;}clip.start=start;clip.len=Math.max(.5,cEnd-end);adjustTrim(clip,end-cStart);next.push(clip);});track.clips=next;});
  S.arrangerSections=S.arrangerSections.flatMap(section=>{if(section.end<=start)return[section];if(section.start>=end){section.start-=amount;section.end-=amount;return[section];}if(section.start<start&&section.end>end){section.end-=amount;return[section];}if(section.start<start){section.end=start;return section.end-section.start>=.5?[section]:[];}if(section.end>end){section.start=start;section.end-=amount;return section.end-section.start>=.5?[section]:[];}return[];});
  if(S.loopRegion.start>=end){S.loopRegion.start-=amount;S.loopRegion.end-=amount;}else if(S.loopRegion.end>start){S.loopRegion.enabled=false;S.loopRegion.start=start;S.loopRegion.end=start+16;}
  S.arrangementBeats=Math.max(64,S.arrangementBeats-amount);persist();renderAll();window.toast?.(`${bars} bars removed`);
}
function fitProject(){const scroll=document.getElementById('tracks-scroll'),available=Math.max(240,(scroll?.clientWidth||window.innerWidth)-headerWidth()-12);S.zoom=clamp(available/(Math.max(16,contentBeats())*40),.25,2);window.syncTimelineMetrics?.();if(scroll)scroll.scrollLeft=0;S.scrollX=0;window.renderTracks?.();window.drawRuler?.();renderStructure();window.toast?.('Arrangement fitted');}
function extendTimeline(){S.arrangementBeats+=64;persist();window.renderTracks?.();window.toast?.('Timeline extended by 16 bars');}
function ensureBeatTrack(){let index=S.tracks.findIndex(t=>t.type==='beat');if(index<0){window.snapshot?.();const id=Math.max(0,...S.tracks.map(t=>Number(t.id)||0))+1;const track={id,name:'Drums',icon:'DRM',color:SECTION_COLORS[S.tracks.length%SECTION_COLORS.length],type:'beat',m:false,s:false,arm:false,clips:[]};S.tracks.push(track);S.trackVol[id]=.85;S.trackFx[id]=[];Audio_.rebuildTrackFxRack?.(id);Audio_.refreshTrackGain?.(id);index=S.tracks.length-1;}return index;}
function placePattern(){syncActivePattern();const ti=S.activeTrack>=0&&S.tracks[S.activeTrack]?.type==='beat'?S.activeTrack:ensureBeatTrack(),start=Math.floor(playheadBeat()/4)*4;window.snapshot?.();const clip={id:uid('pattern'),start,len:4,label:`Pattern ${S.activePatternId}`,patternId:S.activePatternId};S.tracks[ti].clips.push(clip);selectedClips=new Set([clipKey(S.tracks[ti],clip)]);S.activeTrack=ti;S.arrangementBeats=Math.max(S.arrangementBeats,start+32);persist();window.renderTracks?.();window.toast?.(`Pattern ${S.activePatternId} placed`);}
function handleToolbar(event){const action=event.target.closest('[data-arr]')?.dataset.arr;if(!action)return;({map:createSongMap,section:addSection,'duplicate-section':duplicateSection,loop:setLoop,'place-pattern':placePattern,insert:insertTime,'delete-time':deleteTime,fit:fitProject,extend:extendTimeline}[action])?.();}

function clipKey(track,clip){return`${track.id}:${clip.id}`;}
function descriptors(){const out=[];S.tracks.forEach((track,ti)=>(track.clips||[]).forEach((clip,ci)=>{if(selectedClips.has(clipKey(track,clip)))out.push({track,ti,clip,ci,key:clipKey(track,clip)});}));return out;}
function selectOnly(track,clip){selectedClips=new Set([clipKey(track,clip)]);applyClipSelection();updateToolbar();}
function toggleClip(track,clip){const key=clipKey(track,clip);selectedClips.has(key)?selectedClips.delete(key):selectedClips.add(key);applyClipSelection();updateToolbar();}
function applyClipSelection(){document.querySelectorAll('.clip-el').forEach(el=>{const track=S.tracks[Number(el.dataset.ti)],clip=track?.clips?.[Number(el.dataset.ci)],on=Boolean(track&&clip&&selectedClips.has(clipKey(track,clip)));el.classList.toggle('arr-selected',on);});}
function enhanceClips(){
  document.querySelectorAll('.clip-el').forEach(el=>{if(el.dataset.arrangerWired)return;el.dataset.arrangerWired='true';const ti=Number(el.dataset.ti),ci=Number(el.dataset.ci),track=S.tracks[ti],clip=track?.clips?.[ci];if(!track||!clip)return;
    const grip=document.createElement('button');grip.type='button';grip.className='arr-clip-grip';grip.textContent='⋮⋮';grip.title='Move selected clips across tracks';el.appendChild(grip);wireClipGrip(grip,track,clip,ti);
    el.addEventListener('click',event=>{if(event.shiftKey||event.metaKey||event.ctrlKey){event.preventDefault();event.stopImmediatePropagation();toggleClip(track,clip);}else selectOnly(track,clip);},true);
    el.addEventListener('dblclick',event=>{if(track.type==='beat'&&clip.patternId){event.preventDefault();event.stopImmediatePropagation();loadPattern(clip.patternId);window.openDrawer?.('drums');}},true);
  });applyClipSelection();
}
function wireClipGrip(grip,track,clip,primaryTi){
  grip.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();if(!selectedClips.has(clipKey(track,clip)))selectOnly(track,clip);const items=descriptors();if(!items.length)return;const startX=event.clientX,scroll=document.getElementById('tracks-scroll');let deltaBeat=0,deltaTrack=0;grip.setPointerCapture?.(event.pointerId);
    const move=ev=>{deltaBeat=snap((ev.clientX-startX)/window.pxPerBeat());const row=document.elementsFromPoint(ev.clientX,ev.clientY).map(node=>node.closest?.('.track-row')).find(Boolean);if(row)deltaTrack=Number(row.dataset.ti)-primaryTi;items.forEach(item=>{const node=document.querySelector(`.clip-el[data-ti="${item.ti}"][data-ci="${item.ci}"]`);if(node)node.style.transform=`translate(${deltaBeat*window.pxPerBeat()}px,${deltaTrack*parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--track-h')||72)}px)`;});if(scroll){const rect=scroll.getBoundingClientRect();if(ev.clientX>rect.right-48)scroll.scrollLeft+=18;if(ev.clientX<rect.left+headerWidth()+48)scroll.scrollLeft=Math.max(0,scroll.scrollLeft-18);}};
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);if(!deltaBeat&&!deltaTrack){window.renderTracks?.();return;}window.snapshot?.();const moved=items.map(item=>({clip:item.clip,oldTi:item.ti,newTi:clamp(item.ti+deltaTrack,0,S.tracks.length-1),start:Math.max(0,item.clip.start+deltaBeat)}));items.slice().sort((a,b)=>b.ci-a.ci).forEach(item=>S.tracks[item.ti].clips.splice(item.ci,1));moved.forEach(item=>{item.clip.start=item.start;S.tracks[item.newTi].clips.push(item.clip);});selectedClips=new Set(moved.map(item=>clipKey(S.tracks[item.newTi],item.clip)));S.arrangementBeats=Math.max(S.arrangementBeats,maxClipBeat()+32);persist();window.renderTracks?.();if(S.playing){window.stopAllScheduled?.();window.scheduleClipPlayback?.();}window.toast?.(`${moved.length} clip${moved.length===1?'':'s'} moved`);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
  });
}
function copySelected(){const items=descriptors();if(!items.length)return false;const minStart=Math.min(...items.map(i=>i.clip.start)),minTrack=Math.min(...items.map(i=>i.ti));clipClipboard=items.map(item=>({trackOffset:item.ti-minTrack,startOffset:item.clip.start-minStart,clip:clone(item.clip)}));window.toast?.(`${items.length} clips copied`);return true;}
function pasteSelected(){if(!clipClipboard.length)return false;window.snapshot?.();const baseTrack=clamp(S.activeTrack||0,0,S.tracks.length-1),baseBeat=playheadBeat(),keys=[];clipClipboard.forEach(item=>{const ti=clamp(baseTrack+item.trackOffset,0,S.tracks.length-1),clip={...clone(item.clip),id:uid('clip'),start:Math.max(0,baseBeat+item.startOffset),label:`${item.clip.label||'Clip'} copy`};S.tracks[ti].clips.push(clip);keys.push(clipKey(S.tracks[ti],clip));});selectedClips=new Set(keys);S.arrangementBeats=Math.max(S.arrangementBeats,maxClipBeat()+32);persist();window.renderTracks?.();window.toast?.(`${keys.length} clips pasted`);return true;}
function duplicateSelected(){if(!copySelected())return false;const span=Math.max(4,Math.max(...descriptors().map(i=>i.clip.start+i.clip.len))-Math.min(...descriptors().map(i=>i.clip.start)));const oldSec=S.sec;S.sec=window.beatToSec(Math.min(...descriptors().map(i=>i.clip.start))+snap(span));pasteSelected();S.sec=oldSec;window.updateTime?.();window.posPlayhead?.();return true;}
function deleteSelected(){const items=descriptors();if(!items.length)return false;window.snapshot?.();items.slice().sort((a,b)=>b.ci-a.ci).forEach(item=>S.tracks[item.ti].clips.splice(item.ci,1));selectedClips.clear();S.selectedClip=null;persist();window.renderTracks?.();if(S.playing){window.stopAllScheduled?.();window.scheduleClipPlayback?.();}window.toast?.(`${items.length} clips deleted`);return true;}

function patternAtBeat(beat){const clips=[];let hasPatternClips=false;S.tracks.forEach(track=>{if(track.type!=='beat'||track.m)return;(track.clips||[]).forEach(clip=>{if(!clip.patternId)return;hasPatternClips=true;if(beat>=clip.start&&beat<clip.start+clip.len)clips.push(S.drumPatterns?.[clip.patternId]||S.seqSteps);});});return clips.length?clips:(hasPatternClips?[]:[S.seqSteps]);}
function normalizeStep(raw){if(!raw)return null;if(typeof raw!=='object')return{active:true,velocity:raw===1?.85:clamp(Number(raw)||.85,.05,1),probability:1,repeats:1,timingOffset:0};return{active:raw.active!==false,velocity:clamp(Number(raw.velocity)||.85,.05,1),probability:clamp(Number(raw.probability??1),0,1),repeats:clamp(Math.round(Number(raw.repeats)||1),1,8),timingOffset:clamp(Number(raw.timingOffset)||0,-.12,.12)};}
function playDrum(pad,raw,base,dest,ctxOverride){const step=normalizeStep(raw);if(!step?.active||Math.random()>step.probability)return;const ctx=ctxOverride||Audio_.ensure(),target=dest||Audio_.master,spacing=window.beatToSec(.25)/step.repeats;for(let i=0;i<step.repeats;i++){const when=base+step.timingOffset+i*spacing;if(when<0)continue;const gain=ctx.createGain();gain.gain.setValueAtTime(step.velocity,Math.max(0,when));gain.connect(target);Audio_.synthDrum(pad.n,gain,when);if(!ctxOverride)setTimeout(()=>{try{gain.disconnect();}catch(_){}},2200);}}
const originalOfflineSequencer=window.scheduleOfflineSequencer;
window.scheduleSeqSteps=function(horizon){const length=.25;while(S.nextSeqStepBeat<horizon){const beat=S.nextSeqStepBeat,index=Math.round(beat/length)%16,when=window.songSecToCtxTime(window.beatToSec(beat)),patterns=patternAtBeat(beat);patterns.forEach(pattern=>PADS.forEach(pad=>playDrum(pad,pattern?.[pad.id]?.[index],when)));setTimeout(()=>window.flashSeqStep?.(index),Math.max(0,(when-Audio_.ctx.currentTime)*1000));S.nextSeqStepBeat+=length;}};
window.scheduleOfflineSequencer=function(ctx,inputs,duration){const hasPatternClips=S.tracks.some(t=>t.type==='beat'&&(t.clips||[]).some(c=>c.patternId));if(!hasPatternClips)return originalOfflineSequencer?.(ctx,inputs,duration);const stepSec=window.beatToSec(.25),count=Math.ceil(duration/stepSec);for(let n=0;n<count;n++){const beat=n*.25,index=n%16,time=n*stepSec;patternAtBeat(beat).forEach(pattern=>PADS.forEach(pad=>playDrum(pad,pattern?.[pad.id]?.[index],time,ctx.__masterGain,ctx)));}};

function loopMonitor(){
  cancelAnimationFrame(loopRaf);const tick=()=>{const loop=S.loopRegion;if(S.playing&&loop?.enabled&&loop.end>loop.start){const now=window.readClockSec?.()??S.sec,endSec=window.beatToSec(loop.end);if(now>=endSec-.003){window.anchorClock?.(window.beatToSec(loop.start));S.nextSeqStepBeat=window.nextStepBeatAtOrAfter(loop.start);S.nextMetroBeat=Math.ceil(loop.start);window.stopAllScheduled?.();window.scheduleClipPlayback?.();window.applyAllTrackAutomation?.();}}loopRaf=requestAnimationFrame(tick);};tick();
}
function patchRender(){const original=window.renderTracks;if(typeof original!=='function'||original._arranger)return;const wrapped=function(...args){const result=original.apply(this,args);requestAnimationFrame(()=>{enhanceClips();renderStructure();window.buildOv?.();});return result;};wrapped._arranger=true;window.renderTracks=wrapped;}
function patchFiles(){
  const originalSerialize=window.serializeProject;if(typeof originalSerialize==='function'&&!originalSerialize._arranger){const wrapped=async function(){const data=await originalSerialize();return{...data,arranger:exportArranger()};};wrapped._arranger=true;window.serializeProject=wrapped;}
  const originalLoad=window.loadProjectFromFile;if(typeof originalLoad==='function'&&!originalLoad._arranger){const wrapped=async function(file){let raw=null;try{raw=JSON.parse(await file.text());}catch(_){ }const result=await originalLoad(file);importArranger(raw?.arranger||S.recOpts?.__arranger||S.projectMeta?.arranger||defaultArranger());persist();renderAll();return result;};wrapped._arranger=true;window.loadProjectFromFile=wrapped;}
}
function patchHistory(){
  ['undo','redo'].forEach(name=>{const original=window[name];if(typeof original!=='function'||original._arranger)return;const wrapped=function(...args){const result=original.apply(this,args);const saved=S.recOpts?.__arranger;if(saved){importArranger(saved);persist();requestAnimationFrame(renderAll);}return result;};wrapped._arranger=true;window[name]=wrapped;});
}
function wireEvents(){
  document.getElementById('tracks-scroll')?.addEventListener('scroll',()=>{syncStructureScroll();if(extendLock)return;const scroll=document.getElementById('tracks-scroll');if(scroll&&scroll.scrollLeft+scroll.clientWidth>scroll.scrollWidth-240){extendLock=true;S.arrangementBeats+=64;persist();window.renderTracks?.();setTimeout(()=>extendLock=false,250);}}, {passive:true});
  document.getElementById('tracks-area')?.addEventListener('click',event=>{if(!event.target.closest('.clip-el')){selectedClips.clear();applyClipSelection();updateToolbar();}});
  document.addEventListener('pointerup',event=>{if(event.target.closest?.('#dp-drums')){syncActivePattern();persist();}},{passive:true});
  document.addEventListener('keydown',event=>{if(isEditable(event.target))return;const mod=event.metaKey||event.ctrlKey;if(mod&&event.code==='KeyC'&&selectedClips.size){event.preventDefault();event.stopImmediatePropagation();copySelected();return;}if(mod&&event.code==='KeyV'&&clipClipboard.length){event.preventDefault();event.stopImmediatePropagation();pasteSelected();return;}if(mod&&event.code==='KeyD'&&selectedClips.size){event.preventDefault();event.stopImmediatePropagation();duplicateSelected();return;}if((event.code==='Delete'||event.code==='Backspace')&&selectedClips.size){event.preventDefault();event.stopImmediatePropagation();deleteSelected();return;}if(event.code==='KeyL'&&!mod){event.preventDefault();setLoop();return;}if(event.code==='Escape'){selectedClips.clear();selectedSectionId=null;applyClipSelection();renderStructure();}},true);
  window.addEventListener('resize',()=>requestAnimationFrame(renderAll));
  setInterval(()=>{const token=projectToken();if(token!==lastProjectToken){if(!S.projectMeta?.arranger)resetForProject();else{importArranger(S.projectMeta.arranger);lastProjectToken=token;renderAll();}}},800);
}
function renderAll(){window.syncTimelineMetrics?.();window.renderTracks?.();window.drawRuler?.();renderStructure();updateToolbar();}
function init(){
  if(typeof S==='undefined'||typeof PADS==='undefined')return;restore();buildToolbar();buildStructureLane();patchRender();patchFiles();patchHistory();wireEvents();loopMonitor();renderAll();
  window.NeusicArranger={version:VERSION,contentBeats,createSongMap,addSection,duplicateSection,setLoop,insertTime,deleteTime,placePattern,loadPattern,copySelected,pasteSelected,deleteSelected,exportState:exportArranger};
  window.toast?.('Professional Arranger ready');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
