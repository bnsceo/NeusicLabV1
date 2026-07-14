/* Neusic Recording & Mix Workflow v1: take management, routing and bounce-in-place. */
(function(){
'use strict';
const META='__recordingMixV1';
const clone=value=>JSON.parse(JSON.stringify(value));
const uid=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
let recordSession=null,bounceBusy=false;

function data(){
  S.recOpts=S.recOpts||{};
  const value=S.recOpts[META]||(S.recOpts[META]={version:1,routing:{},takes:{},takeCounter:0,sends:{},returnStates:{}});
  value.routing=value.routing||{};value.takes=value.takes||{};value.takeCounter=Number(value.takeCounter)||0;value.sends=value.sends||{};value.returnStates=value.returnStates||{};
  return value;
}
function trackById(id){return (S.tracks||[]).find(track=>Number(track.id)===Number(id));}
function buses(){return (S.tracks||[]).filter(track=>track.type==='bus');}
function userReturns(){return (S.tracks||[]).filter(track=>track.type==='return');}
function routeFor(trackId){return String(data().routing[trackId]||'master');}
function returnKey(trackId){return `RT${trackId}`;}
function queueSave(){window.NeusicSafety?.queueSave?.();}
function restoreStoredMixState(){const meta=data();S.sends=clone(meta.sends||{});Object.entries(meta.returnStates||{}).forEach(([key,on])=>{if(S.returns?.[key])S.returns[key].on=!!on;});}
function refreshAudio(){if(S.playing){window.stopAllScheduled?.();window.scheduleClipPlayback?.();window.applyAllTrackAutomation?.();}}

function syncReturnTracks(){
  S.returns=S.returns||{};restoreStoredMixState();
  const valid=new Set();
  userReturns().forEach(track=>{
    const key=returnKey(track.id);valid.add(key);
    const previous=S.returns[key]||{},saved=data().returnStates[key];
    S.returns[key]={...previous,name:track.name,color:track.color,on:saved==null?previous.on!==false:!!saved,trackId:track.id,userTrack:true};
  });
  Object.keys(S.returns).filter(key=>S.returns[key]?.userTrack&&!valid.has(key)).forEach(key=>{
    delete S.returns[key];
    Object.values(Audio_.sendGains||{}).forEach(map=>{const node=map?.[key];if(node){try{node.disconnect();}catch(_){}delete map[key];}});
  });
}

function destinationFor(track){
  if(!track||track.type==='bus'||track.type==='return')return Audio_.master;
  const target=trackById(routeFor(track.id));
  return target&&target.type==='bus'&&target.id!==track.id?Audio_.trackInput(target.id):Audio_.master;
}
function rebuildTrackRoute(trackId){
  const track=trackById(trackId);if(!track)return;
  const gain=Audio_.trackGains?.[track.id]||Audio_.ensureTrackGain(track.id);
  Audio_._neusicRouteDest=Audio_._neusicRouteDest||{};Audio_._neusicRouteGain=Audio_._neusicRouteGain||{};
  const fresh=Audio_._neusicRouteGain[track.id]!==gain;
  const previous=fresh?Audio_.master:(Audio_._neusicRouteDest[track.id]||Audio_.master);
  const next=destinationFor(track);
  Audio_._neusicRouteGain[track.id]=gain;
  if(!fresh&&previous===next)return;
  try{gain.disconnect(previous);}catch(_){try{gain.disconnect(Audio_.master);}catch(__){}}
  try{gain.connect(next);Audio_._neusicRouteDest[track.id]=next;}catch(error){console.warn('Neusic route connection failed',error);}
}
function rebuildRouting(){
  syncReturnTracks();
  const valid=new Set((S.tracks||[]).map(track=>String(track.id)));
  Object.keys(data().routing).forEach(id=>{if(!valid.has(String(id)))delete data().routing[id];});
  (S.tracks||[]).forEach(track=>rebuildTrackRoute(track.id));
}
function setRoute(trackId,target){
  const track=trackById(trackId);if(!track||['bus','return'].includes(track.type))return;
  const bus=target==='master'?null:trackById(target);
  if(target!=='master'&&(!bus||bus.type!=='bus'||bus.id===track.id)){window.toast?.('Choose a valid bus');return;}
  window.snapshot?.();data().routing[track.id]=target==='master'?'master':String(bus.id);rebuildTrackRoute(track.id);queueSave();
  if(S.activePanel==='mixer')window.buildMixer?.(document.getElementById('dp-mixer'));
  window.toast?.(`${track.name} → ${bus?bus.name:'Master'}`);
}

function patchAudioRouting(){
  if(Audio_._neusicRoutingPatched)return;Audio_._neusicRoutingPatched=true;
  const ensureGain=Audio_.ensureTrackGain.bind(Audio_);
  Audio_.ensureTrackGain=function(trackId){const existed=!!this.trackGains?.[Number(trackId)],gain=ensureGain(trackId);if(!existed)queueMicrotask(()=>rebuildTrackRoute(trackId));return gain;};
  const ensureReturn=Audio_.ensureReturn?.bind(Audio_);
  if(ensureReturn)Audio_.ensureReturn=function(retId){const cfg=S.returns?.[retId];if(cfg?.trackId)return this.trackInput(cfg.trackId);return ensureReturn(retId);};
  const setSend=Audio_.setSend?.bind(Audio_);
  if(setSend)Audio_.setSend=function(trackId,retId,value){const result=setSend(trackId,retId,value);data().sends=clone(S.sends||{});queueSave();return result;};
}

function soloFeeds(track){
  if(!track)return false;
  if(track.type==='bus')return (S.tracks||[]).some(source=>source.s&&routeFor(source.id)===String(track.id));
  if(track.type==='return'){const key=returnKey(track.id);return (S.tracks||[]).some(source=>source.s&&Number(S.sends?.[source.id]?.[key]||0)>0);}
  return false;
}
function patchSoloPropagation(){
  if(Audio_._neusicSoloPatched)return;Audio_._neusicSoloPatched=true;
  const refresh=Audio_.refreshTrackGain.bind(Audio_);
  Audio_.refreshTrackGain=function(trackId){const track=trackById(trackId),anySolo=(S.tracks||[]).some(item=>item.s);if(!track||!anySolo||!['bus','return'].includes(track.type))return refresh(trackId);const gain=this.ensureTrackGain(trackId),dry=this.trackDry[trackId]??.85,silent=track.m||(!track.s&&!soloFeeds(track));gain.gain.setTargetAtTime(silent?0:dry,this.ctx.currentTime,.01);};
  const render=window.renderProjectOfflineToBuffer;
  if(typeof render==='function'&&!render._neusicSolo){const wrapped=async function(...args){const anySolo=(S.tracks||[]).some(track=>track.s),changed=[];if(anySolo)(S.tracks||[]).forEach(track=>{if(['bus','return'].includes(track.type)&&!track.s&&soloFeeds(track)){changed.push(track);track.s=true;}});try{return await render.apply(this,args);}finally{changed.forEach(track=>track.s=false);}};wrapped._neusicSolo=true;window.renderProjectOfflineToBuffer=wrapped;}
}

function patchOfflineRouting(){
  const base=window.buildOfflineTrackGraph;if(typeof base!=='function'||base._neusicRouting)return;
  const wrapped=function(offlineCtx,masterGain){
    syncReturnTracks();const graph=base(offlineCtx,masterGain);
    (S.tracks||[]).forEach(track=>{
      const gain=graph.trackGains?.[track.id];if(!gain)return;
      try{gain.disconnect(masterGain);}catch(_){}
      const target=trackById(routeFor(track.id));
      const destination=!['bus','return'].includes(track.type)&&target?.type==='bus'&&graph.trackInputs?.[target.id]?graph.trackInputs[target.id]:masterGain;
      gain.connect(destination);
    });
    Object.entries(S.sends||{}).forEach(([trackId,sendMap])=>{
      const source=graph.trackGains?.[trackId];if(!source)return;
      Object.entries(sendMap||{}).forEach(([retId,value])=>{
        const cfg=S.returns?.[retId];const amount=Math.max(0,Math.min(1,Number(value)||0));if(!cfg?.on||amount<=0)return;
        const send=offlineCtx.createGain();send.gain.value=amount;source.connect(send);
        if(cfg.trackId&&graph.trackInputs?.[cfg.trackId])send.connect(graph.trackInputs[cfg.trackId]);else send.connect(masterGain);
      });
    });
    return graph;
  };wrapped._neusicRouting=true;window.buildOfflineTrackGraph=wrapped;
}

function withMutedTakesHidden(fn,args){
  const hidden=[];(S.tracks||[]).forEach(track=>(track.clips||[]).forEach(clip=>{if(clip.takeMuted&&clip.bufferId){hidden.push([clip,clip.bufferId]);clip.bufferId=null;}}));
  try{return fn.apply(this,args);}finally{hidden.forEach(([clip,id])=>clip.bufferId=id);}
}
function patchTakePlayback(){
  const live=window.scheduleClipPlayback;if(typeof live==='function'&&!live._neusicTakes){const wrapped=function(...args){return withMutedTakesHidden(live,args);};wrapped._neusicTakes=true;window.scheduleClipPlayback=wrapped;}
  const offline=window.scheduleOfflineClips;if(typeof offline==='function'&&!offline._neusicTakes){const wrapped=function(...args){return withMutedTakesHidden(offline,args);};wrapped._neusicTakes=true;window.scheduleOfflineClips=wrapped;}
}

function takesFor(trackId){return data().takes[trackId]||(data().takes[trackId]=[]);}
function takeRange(take){return{start:Number(take.start)||0,end:Number(take.end)||0};}
function overlaps(a,b){return Math.min(a.end,b.end)-Math.max(a.start,b.start)>.125;}
function clipFor(track,clipId){return (track?.clips||[]).find(clip=>clip.id===clipId);}
function registerRecordedTakes(){
  if(!recordSession)return;const meta=data();
  recordSession.trackIds.forEach(trackId=>{
    const track=trackById(trackId);if(!track)return;
    const before=recordSession.before[trackId]||new Set();
    const clips=(track.clips||[]).filter(clip=>!before.has(clip.id)&&clip.bufferId);
    if(!clips.length)return;
    meta.takeCounter+=1;const takeId=uid('take'),start=Math.min(...clips.map(clip=>Number(clip.start)||0)),end=Math.max(...clips.map(clip=>(Number(clip.start)||0)+(Number(clip.len)||0)));
    clips.forEach(clip=>{clip.takeId=takeId;clip.takeMuted=false;});
    takesFor(track.id).push({id:takeId,name:`Take ${meta.takeCounter}`,trackId:track.id,clipIds:clips.map(clip=>clip.id),start,end,createdAt:new Date().toISOString(),active:false});
  });
  recordSession=null;queueSave();window.renderTracks?.();if(S.activePanel==='rec')window.buildPanelContent?.('rec');
}
function patchRecording(){
  const base=window.toggleRecord;if(typeof base!=='function'||base._neusicTakes)return;
  const wrapped=async function(...args){
    const starting=!S.recording;
    if(starting){const armed=(S.tracks||[]).filter(track=>track.arm);recordSession={trackIds:armed.map(track=>track.id),before:Object.fromEntries(armed.map(track=>[track.id,new Set((track.clips||[]).map(clip=>clip.id))]))};}
    const result=await base.apply(this,args);
    if(!starting)registerRecordedTakes();
    return result;
  };wrapped._neusicTakes=true;window.toggleRecord=wrapped;
}

function useTake(trackId,takeId){
  const track=trackById(trackId),takes=takesFor(trackId),target=takes.find(take=>take.id===takeId);if(!track||!target)return;
  window.snapshot?.();const targetRange=takeRange(target);
  takes.forEach(take=>{const competing=take.id!==target.id&&overlaps(takeRange(take),targetRange);take.active=take.id===target.id;(take.clipIds||[]).forEach(id=>{const clip=clipFor(track,id);if(clip)clip.takeMuted=competing||take.id!==target.id&&clip.takeMuted;});});
  (target.clipIds||[]).forEach(id=>{const clip=clipFor(track,id);if(clip)clip.takeMuted=false;});
  queueSave();window.renderTracks?.();refreshAudio();if(S.activePanel==='rec')window.buildPanelContent?.('rec');window.toast?.(`${target.name} is the active take`);
}
function previewTake(trackId,takeId){
  const track=trackById(trackId),take=takesFor(trackId).find(item=>item.id===takeId),clip=take&&clipFor(track,take.clipIds?.[0]),entry=clip?.bufferId&&S.buffers?.[clip.bufferId];if(!entry){window.toast?.('Take audio is unavailable');return;}
  Audio_.playBuffer(entry.buffer,{offset:clip.trimStart||0,duration:Math.min(entry.duration,window.beatToSec?.(clip.len)||entry.duration),gain:.85});
}
function renameTake(trackId,takeId){const take=takesFor(trackId).find(item=>item.id===takeId),name=take&&prompt('Take name',take.name);if(!name?.trim())return;window.snapshot?.();take.name=name.trim();queueSave();if(S.activePanel==='rec')window.buildPanelContent?.('rec');}
function deleteTake(trackId,takeId){
  const track=trackById(trackId),takes=takesFor(trackId),index=takes.findIndex(item=>item.id===takeId);if(!track||index<0)return;const take=takes[index];if(!confirm(`Delete “${take.name}” and its recorded clip${take.clipIds.length===1?'':'s'}?`))return;
  window.snapshot?.();const ids=new Set(take.clipIds||[]),buffers=new Set((track.clips||[]).filter(clip=>ids.has(clip.id)&&clip.bufferId).map(clip=>clip.bufferId));track.clips=(track.clips||[]).filter(clip=>!ids.has(clip.id));takes.splice(index,1);buffers.forEach(bufferId=>{const used=(S.tracks||[]).some(item=>(item.clips||[]).some(clip=>clip.bufferId===bufferId));if(!used)delete S.buffers?.[bufferId];});queueSave();window.renderTracks?.();refreshAudio();if(S.activePanel==='rec')window.buildPanelContent?.('rec');
}
function renderTakes(el){
  const track=S.tracks?.[S.activeTrack],section=document.createElement('section');section.className='take-rack';
  if(!track||track.type!=='audio'){section.innerHTML='<header><div><small>TAKE LANES</small><h3>Select an audio track</h3></div></header><p class="take-empty">Take management appears here for audio tracks.</p>';el.appendChild(section);return;}
  const takes=takesFor(track.id).slice().reverse();
  section.innerHTML=`<header><div><small>TAKE LANES · ${escapeHtml(track.name)}</small><h3>${takes.length} recorded take${takes.length===1?'':'s'}</h3></div><span>Quick comp</span></header><div class="take-list">${takes.length?takes.map(take=>`<article class="take-card${take.active?' active':''}"><div class="take-card-main"><i></i><div><b>${escapeHtml(take.name)}</b><small>${formatBars(take.start,take.end)} · ${(take.clipIds||[]).length} clip${take.clipIds?.length===1?'':'s'}</small></div></div><div class="take-actions"><button data-preview="${take.id}">PREVIEW</button><button data-use="${take.id}">USE</button><button data-rename="${take.id}">RENAME</button><button class="danger" data-delete="${take.id}">DELETE</button></div></article>`).join(''):'<p class="take-empty">Arm this track and record. Every completed pass will appear as a take.</p>'}</div>`;
  section.onclick=event=>{const button=event.target.closest('button');if(!button)return;const id=button.dataset.preview||button.dataset.use||button.dataset.rename||button.dataset.delete;if(button.dataset.preview)previewTake(track.id,id);if(button.dataset.use)useTake(track.id,id);if(button.dataset.rename)renameTake(track.id,id);if(button.dataset.delete)deleteTake(track.id,id);};
  el.appendChild(section);
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));}
function formatBars(start,end){const bars=Math.max(.25,(end-start)/4);return `${bars.toFixed(bars%1?1:0)} bars`;}
function patchRecordPanel(){const base=window.buildRec;if(typeof base!=='function'||base._neusicTakes)return;const wrapped=function(el){const result=base(el);renderTakes(el);return result;};wrapped._neusicTakes=true;window.buildRec=wrapped;}

function decorateTimeline(){
  document.querySelectorAll('.clip-el[data-ti][data-ci]').forEach(element=>{const ti=Number(element.dataset.ti),ci=Number(element.dataset.ci),clip=S.tracks?.[ti]?.clips?.[ci];if(!clip?.takeId)return;element.classList.add('take-clip');element.classList.toggle('take-muted',!!clip.takeMuted);const sub=element.querySelector('.clip-sub');if(sub&&!sub.querySelector('.take-badge'))sub.insertAdjacentHTML('beforeend',` <span class="take-badge">${clip.takeMuted?'ALT TAKE':'TAKE'}</span>`);});
}
function patchRender(){const base=window.renderTracks;if(typeof base!=='function'||base._neusicRecordingMix)return;const wrapped=function(...args){const result=base.apply(this,args);requestAnimationFrame(()=>{syncReturnTracks();rebuildRouting();decorateTimeline();installWorkflowButtons();});return result;};wrapped._neusicRecordingMix=true;window.renderTracks=wrapped;}

function enhanceMixer(el){
  if(!el)return;const busList=buses();
  el.querySelectorAll('.pmx-ch[data-tid]').forEach(channel=>{const track=trackById(channel.dataset.tid);if(!track||channel.querySelector('.pmx-route-row'))return;const row=document.createElement('div');row.className='pmx-route-row';
    if(['bus','return'].includes(track.type))row.innerHTML='<span>OUTPUT</span><b>MASTER</b>';
    else row.innerHTML=`<label>OUTPUT<select data-route-track="${track.id}"><option value="master">Master</option>${busList.filter(bus=>bus.id!==track.id).map(bus=>`<option value="${bus.id}">${escapeHtml(bus.name)}</option>`).join('')}</select></label>`;
    const sends=channel.querySelector('.pmx-sends');channel.insertBefore(row,sends||channel.children[1]||null);const select=row.querySelector('select');if(select){select.value=routeFor(track.id);select.onchange=()=>setRoute(track.id,select.value);}
  });
}
function patchMixer(){
  const base=window.buildMixer;if(typeof base!=='function'||base._neusicRouting)return;
  const wrapped=function(el){syncReturnTracks();const result=base(el);enhanceMixer(el);return result;};wrapped._neusicRouting=true;window.buildMixer=wrapped;
  const toggle=window.toggleReturn;if(typeof toggle==='function'&&!toggle._neusicRouting){const next=function(retId,button){const result=toggle(retId,button),cfg=S.returns?.[retId];data().returnStates[retId]=cfg?.on!==false;if(cfg?.trackId){const track=trackById(cfg.trackId);if(track){track.m=!cfg.on;Audio_.refreshTrackGain?.(track.id);window.renderTracks?.();}}else if(Audio_.returnGains?.[retId])Audio_.returnGains[retId].gain.setTargetAtTime(cfg?.on===false?0:.85,Audio_.ctx.currentTime,.01);queueSave();return result;};next._neusicRouting=true;window.toggleReturn=next;}
}

async function bounceTrack(index=S.activeTrack){
  if(bounceBusy)return;const track=S.tracks?.[index];if(!track){window.toast?.('Select a track first');return;}if(!track.clips?.length&&track.type!=='bus'){window.toast?.('This track has no clips to bounce');return;}if(!confirm(`Bounce “${track.name}” through its current routing and effects to a new audio track?`))return;
  bounceBusy=true;window.toast?.('Bouncing track offline…');
  const mixState=(S.tracks||[]).map(item=>({id:item.id,m:item.m,s:item.s})),seq=clone(S.seqSteps||{});let rendered=null;
  const included=new Set([track.id]);
  if(track.type==='bus')(S.tracks||[]).forEach(item=>{if(routeFor(item.id)===String(track.id))included.add(item.id);});
  else{const bus=trackById(routeFor(track.id));if(bus?.type==='bus')included.add(bus.id);}
  try{
    (S.tracks||[]).forEach(item=>{item.m=false;item.s=included.has(item.id);});
    if(![...included].some(id=>trackById(id)?.type==='beat'))S.seqSteps={};
    rendered=await window.renderProjectOfflineToBuffer();
  }catch(error){console.error(error);window.toast?.('Bounce failed — see console');}
  finally{mixState.forEach(saved=>{const item=trackById(saved.id);if(item){item.m=saved.m;item.s=saved.s;}});S.seqSteps=seq;Audio_.refreshAllTrackGains?.();bounceBusy=false;}
  if(!rendered)return;
  const bufferId=uid('buf_bounce');Audio_.registerBuffer(bufferId,rendered,`${track.name} Bounce`);
  const bounced=window.NeusicTracks?.create?.({type:'audio',name:`${track.name} Bounce`});if(!bounced)return;
  bounced.clips.push({id:uid('bounce'),start:0,len:Math.max(.25,window.secToBeat?.(rendered.duration)||rendered.duration*2),label:`${track.name} Bounce`,bufferId});
  if(!['bus','return'].includes(track.type))data().routing[bounced.id]=routeFor(track.id);
  queueSave();window.renderTracks?.();window.toast?.(`${track.name} bounced to audio`);
}
function installWorkflowButtons(){
  const actions=document.querySelector('#track-workflow-bar .tw-actions');if(actions&&!actions.querySelector('[data-rm="takes"]')){const divider=document.createElement('span');divider.className='tw-divider recording-mix-divider';const takes=document.createElement('button');takes.dataset.rm='takes';takes.textContent='Take Lanes';const bounce=document.createElement('button');bounce.dataset.rm='bounce';bounce.textContent='Bounce Audio';actions.append(divider,takes,bounce);actions.addEventListener('click',event=>{const action=event.target.closest('[data-rm]')?.dataset.rm;if(action==='takes')window.openDrawer?.('rec');if(action==='bounce')bounceTrack();});}
}

function patchTrackApi(){
  const api=window.NeusicTracks;if(!api||api._recordingMix)return;api._recordingMix=true;
  ['create','delete','duplicate','fromPattern','fromPiano'].forEach(key=>{const base=api[key];if(typeof base!=='function')return;api[key]=function(...args){const result=base.apply(this,args);queueMicrotask(()=>{syncReturnTracks();rebuildRouting();if(S.activePanel==='mixer')window.buildMixer?.(document.getElementById('dp-mixer'));});return result;};});
}
function migrate(){
  const meta=data();S.sends=clone(meta.sends||{});
  const valid=new Set((S.tracks||[]).map(track=>String(track.id)));
  Object.keys(meta.takes).forEach(id=>{if(!valid.has(String(id)))delete meta.takes[id];else meta.takes[id]=(meta.takes[id]||[]).filter(take=>take.clipIds?.some(clipId=>clipFor(trackById(id),clipId)));});
  Object.keys(meta.routing).forEach(id=>{const target=String(meta.routing[id]);if(!valid.has(String(id))||target!=='master'&&!valid.has(target))delete meta.routing[id];});
}
function init(){
  if(typeof S==='undefined'||typeof Audio_==='undefined')return;migrate();patchAudioRouting();patchSoloPropagation();patchOfflineRouting();patchTakePlayback();patchRecording();patchRecordPanel();patchMixer();patchRender();patchTrackApi();syncReturnTracks();rebuildRouting();installWorkflowButtons();decorateTimeline();
  window.NeusicRecordingMix={version:'1.0.0',data,routeFor,setRoute,rebuildRouting,takesFor,useTake,previewTake,deleteTake,bounceTrack,syncReturnTracks};
  window.toast?.('Recording and routing workflow ready');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
