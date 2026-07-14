/* Neusic Producer Flow: project templates, guided workflow, BPM analysis, pad mapping, .neusic files. */
(function(){
'use strict';
const VERSION='1.0.0';
const FLOW_KEY='neusic-producer-flow-v1';
const TEMPLATE_KEY='neusic-flow-onboarded';
const BANKS=['A','B','C','D'];
let panel=null,scrim=null,modal=null,selectedBpm=null,captureIntent=null,knownBuffers=new Set();
const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const clone=value=>JSON.parse(JSON.stringify(value));
const nowIso=()=>new Date().toISOString();
const isStepOn=value=>Boolean(value&&(typeof value!=='object'||value.active!==false));

const TEMPLATES={
  'sample-flip':{name:'Sample Flip',bpm:92,description:'Capture or import a sample, analyze it, chop it, map it, and build a complete record.',tracks:[['Sample','audio','SMP'],['Drums','beat','DRM'],['Bass','midi','BAS'],['Keys','midi','KEY'],['Vocals','audio','VOX']]},
  'beat-production':{name:'Beat Production',bpm:140,description:'A focused beat workspace for drums, 808, bass, harmony, melody, and vocals.',tracks:[['Drums','beat','DRM'],['808','midi','808'],['Bass','midi','BAS'],['Chords','midi','CHD'],['Melody','midi','MEL'],['Vocals','audio','VOX']]},
  'vocal-session':{name:'Vocal Session',bpm:120,description:'Recording-first layout for an instrumental, lead, doubles, harmonies, and ad-libs.',tracks:[['Instrumental','audio','INST'],['Lead Vocal','audio','LEAD'],['Doubles','audio','DBL'],['Harmonies','audio','HARM'],['Ad-libs','audio','ADLB']]},
  'blank':{name:'Blank Studio',bpm:120,description:'Start clean with a single audio track and build only what the project needs.',tracks:[['Audio 1','audio','A1']]}
};

function defaultMeta(){return{name:'Untitled Project',template:'legacy',createdAt:nowIso(),updatedAt:nowIso(),analysis:{},flow:{visited:{},composed:{},activeCompositionTarget:null,masterReady:false,exportedAt:null}};}
function ensureState(){
  S.projectMeta=Object.assign(defaultMeta(),S.projectMeta||{});
  S.projectMeta.analysis=Object.assign({},S.projectMeta.analysis||{});
  S.projectMeta.flow=Object.assign({visited:{},composed:{},activeCompositionTarget:null,masterReady:false,exportedAt:null},S.projectMeta.flow||{});
  S.projectMeta.flow.visited=Object.assign({},S.projectMeta.flow.visited||{});
  S.projectMeta.flow.composed=Object.assign({},S.projectMeta.flow.composed||{});
  S.padBanks=S.padBanks||{A:[],B:[],C:[],D:[]};BANKS.forEach(bank=>S.padBanks[bank]=Array.isArray(S.padBanks[bank])?S.padBanks[bank]:[]);
  S.padBank=S.padBank||'A';
}
function persistExtra(){
  ensureState();
  try{localStorage.setItem(FLOW_KEY,JSON.stringify({projectMeta:S.projectMeta,padBanks:S.padBanks,padBank:S.padBank,noteRepeat:S.noteRepeat,mpc16Levels:S.mpc16Levels,mpcSwing:S.mpcSwing}));}catch(_){ }
}
function restoreExtra(){
  try{const raw=JSON.parse(localStorage.getItem(FLOW_KEY)||'null');if(!raw)return;if(raw.projectMeta)S.projectMeta=raw.projectMeta;if(raw.padBanks)S.padBanks=raw.padBanks;if(raw.padBank)S.padBank=raw.padBank;['noteRepeat','mpc16Levels','mpcSwing'].forEach(k=>{if(raw[k]!=null)S[k]=raw[k];});}catch(_){ }
  ensureState();
}
function markUpdated(){ensureState();S.projectMeta.updatedAt=nowIso();persistExtra();window.NeusicSafety?.queueSave?.();renderAll();}

function makeTrack(name,type,index,icon){return{id:index+1,name,icon:icon||type.toUpperCase().slice(0,3),color:(window.COLORS||['#5f8fa8','#b18b52','#8878a2','#678c76','#a76f6f','#7d8891'])[index%((window.COLORS||[]).length||6)],type,m:false,s:false,arm:false,clips:[]};}
function clearAudioGraph(){
  try{window.stopAllScheduled?.();}catch(_){ }
  ['trackGains','trackPanners','trackFilters'].forEach(key=>Object.values(Audio_[key]||{}).forEach(node=>{try{node.disconnect();}catch(_){}}));
  Audio_.trackGains={};Audio_.trackPanners={};Audio_.trackFilters={};Audio_.trackDry={};Audio_.trackFxChainInput={};Audio_.trackFxNodes={};Audio_._stereoMeters={};
}
function applyTemplate(id,name){
  const template=TEMPLATES[id]||TEMPLATES.blank;
  if(S.playing)window.togglePlay?.();
  clearAudioGraph();
  S.bpm=template.bpm;S.sec=0;S.pct=0;S.scrollX=0;S.zoom=1;S.activeTrack=0;S.selectedClip=null;
  S.tracks=template.tracks.map((t,i)=>makeTrack(t[0],t[1],i,t[2]));
  S.trackVol=Object.fromEntries(S.tracks.map(t=>[t.id,.85]));S.trackFx=Object.fromEntries(S.tracks.map(t=>[t.id,[]]));S.automation={};
  S.seqSteps={};PADS.forEach(p=>S.seqSteps[p.id]=Array(16).fill(0));
  S.buffers={};S.samplerBufferId=null;S.samplerSlices=[];S.padBanks={A:[],B:[],C:[],D:[]};S.padBank='A';S.slices=8;
  S.undoStack=[];S.redoStack=[];
  S.projectMeta={name:(name||template.name).trim()||template.name,template:id,createdAt:nowIso(),updatedAt:nowIso(),analysis:{},flow:{visited:{},composed:{},activeCompositionTarget:null,masterReady:false,exportedAt:null}};
  S.tracks.forEach(track=>{Audio_.rebuildTrackFxRack?.(track.id);Audio_.refreshTrackGain?.(track.id);});
  document.getElementById('bpm-disp')&&(document.getElementById('bpm-disp').textContent=S.bpm);
  window.rewind?.();window.renderTracks?.();window.buildSidebar?.();window.buildOv?.();window.openDrawer?.(id==='vocal-session'?'rec':'sampler');window.updateUndoBadges?.();
  localStorage.setItem(TEMPLATE_KEY,'1');persistExtra();window.NeusicSafety?.saveNow?.();closeModal();window.toast?.(`${template.name} project created`);renderAll();
}
function nextTrackId(){return Math.max(0,...(S.tracks||[]).map(t=>Number(t.id)||0))+1;}
function ensureTrack(name,type){
  let index=S.tracks.findIndex(t=>String(t.name).toLowerCase().includes(name.toLowerCase()));
  if(index<0){window.snapshot?.();const id=nextTrackId();const track=makeTrack(name,type,id-1,type==='audio'?'A':type==='beat'?'D':'M');track.id=id;S.tracks.push(track);S.trackVol[id]=.85;S.trackFx[id]=[];index=S.tracks.length-1;Audio_.rebuildTrackFxRack?.(id);Audio_.refreshTrackGain?.(id);window.renderTracks?.();}
  S.activeTrack=index;window.selectTrack?.(index);return S.tracks[index];
}
function armOnly(track){S.tracks.forEach(t=>t.arm=t.id===track.id);window.renderTracks?.();}

function hasBufferedClip(match){return S.tracks.some(t=>(!match||match.test(t.name||''))&&(t.clips||[]).some(c=>c.bufferId&&S.buffers[c.bufferId]));}
function hasBeat(){return Object.values(S.seqSteps||{}).some(row=>(row||[]).some(isStepOn));}
function hasMappedPads(){return BANKS.some(bank=>(S.padBanks?.[bank]||[]).some(Boolean));}
function arrangementReady(){const populated=S.tracks.filter(t=>(t.clips||[]).length>0);return populated.length>=2||S.tracks.reduce((sum,t)=>sum+(t.clips||[]).length,0)>=3;}
function stepDefs(){return[
  {id:'project',title:'New Project',desc:'Choose a focused production template.',action:'Templates',done:()=>Boolean(S.projectMeta?.template&&S.projectMeta.template!=='legacy'),run:openNewProject},
  {id:'capture',title:'Capture a Sample',desc:'Record from the microphone or import audio.',action:'Capture',done:()=>Boolean(S.samplerBufferId)||hasBufferedClip(/sample/i),run:openCapture},
  {id:'tempo',title:'Detect Tempo',desc:'Analyze the sample and apply a confident BPM.',action:'Analyze',done:()=>Boolean(S.projectMeta?.analysis?.bpmDetected),run:analyzeCurrentSample},
  {id:'slice',title:'Slice the Sample',desc:'Detect transients or create an equal grid.',action:'Chop',done:()=>S.samplerSlices?.length>=2,run:()=>{window.openDrawer?.('sampler');if(S.samplerBufferId)window.autoChop?.();}},
  {id:'pads',title:'Map the Pads',desc:'Assign up to 64 slices across banks A–D.',action:'Assign',done:hasMappedPads,run:assignAllPads},
  {id:'beat',title:'Build the Beat',desc:'Finger-drum or program the 16-step sequencer.',action:'Drums',done:hasBeat,run:()=>window.openDrawer?.('drums')},
  {id:'vocals',title:'Record Vocals',desc:'Create, arm, monitor, and record a vocal track.',action:'Record',done:()=>hasBufferedClip(/vocal|lead|vox/i),run:recordVocals},
  {id:'bass',title:'Add Bass',desc:'Create a bass MIDI track and write the part.',action:'Bass',done:()=>Boolean(S.projectMeta?.flow?.composed?.bass),run:()=>addMusicalTrack('Bass','bass')},
  {id:'keys',title:'Add Keys',desc:'Create piano or chord material in the piano roll.',action:'Keys',done:()=>Boolean(S.projectMeta?.flow?.composed?.keys),run:()=>addMusicalTrack('Piano','keys')},
  {id:'arrange',title:'Arrange the Song',desc:'Build sections and place clips on the timeline.',action:'Arrange',done:arrangementReady,run:()=>{S.drawerOpen&&window.toggleDrawer?.();document.getElementById('tracks-scroll')?.focus?.();}},
  {id:'mix',title:'Mix',desc:'Balance levels, pan, dynamics, effects, and sends.',action:'Mixer',done:()=>Boolean(S.projectMeta?.flow?.visited?.mixer),run:()=>window.openDrawer?.('mixer')},
  {id:'master',title:'Master Check',desc:'Verify loudness, peaks, width, and final headroom.',action:'Check',done:()=>Boolean(S.projectMeta?.flow?.masterReady),run:openMasterCheck},
  {id:'export',title:'Export',desc:'Render the final WAV or save the complete project.',action:'Export',done:()=>Boolean(S.projectMeta?.flow?.exportedAt),run:exportProject}
];}
function workflow(){const steps=stepDefs(),complete=steps.filter(step=>{try{return step.done();}catch(_){return false;}}).length,current=steps.find(step=>{try{return !step.done();}catch(_){return true;}})||steps[steps.length-1];return{steps,complete,current,pct:Math.round(complete/steps.length*100)};}

function buildBar(){
  if(document.getElementById('producer-flow-bar'))return;
  const bar=document.createElement('div');bar.id='producer-flow-bar';bar.innerHTML='<span class="flow-bar-label">Producer Flow</span><div class="flow-bar-progress"><i></i></div><span class="flow-bar-status"></span><button class="flow-bar-next" type="button"></button>';
  document.getElementById('main')?.before(bar);bar.addEventListener('click',event=>{if(event.target.closest('.flow-bar-next'))runNext();else openPanel();});
}
function buildPanel(){
  if(panel)return;
  scrim=document.createElement('button');scrim.className='flow-scrim';scrim.hidden=true;scrim.type='button';scrim.setAttribute('aria-label','Close Producer Flow');scrim.onclick=closePanel;
  panel=document.createElement('aside');panel.id='producer-flow-panel';panel.hidden=true;panel.innerHTML='<header class="flow-panel-head"><div class="flow-panel-title"></div><button class="flow-close" type="button" aria-label="Close">×</button></header><div class="flow-panel-body"></div>';
  panel.querySelector('.flow-close').onclick=closePanel;document.body.append(scrim,panel);
}
function addFooterButton(){
  const footer=document.getElementById('neusic-system-footer');if(!footer||footer.querySelector('[data-flow]'))return;
  const button=document.createElement('button');button.className='system-footer-btn flow-launch-btn';button.dataset.flow='true';button.innerHTML='<span class="system-footer-icon">FLOW</span><span>Flow</span>';button.onclick=openPanel;footer.appendChild(button);
}
function renderBar(){const bar=document.getElementById('producer-flow-bar');if(!bar)return;const w=workflow();bar.querySelector('i').style.width=`${w.pct}%`;bar.querySelector('.flow-bar-status').textContent=`${w.complete}/${w.steps.length}`;bar.querySelector('.flow-bar-next').textContent=w.complete===w.steps.length?'Review Project':w.current.title;}
function renderPanel(){
  if(!panel||panel.hidden)return;ensureState();const w=workflow();const body=panel.querySelector('.flow-panel-body');panel.querySelector('.flow-panel-title').innerHTML=`<strong>${esc(S.projectMeta.name)}</strong><span>${esc(TEMPLATES[S.projectMeta.template]?.name||'Studio Project')} · ${w.pct}% complete</span>`;
  body.innerHTML=`<div class="flow-project-strip"><div class="flow-project-meta"><span>BPM <b>${Math.round(S.bpm)}</b></span><span>Tracks <b>${S.tracks.length}</b></span><span>Buffers <b>${Object.keys(S.buffers||{}).length}</b></span></div><button class="flow-new-project" data-new-project>New Project</button></div>
  <div class="flow-section-title">Production Journey</div><div class="flow-steps">${w.steps.map((step,index)=>{const done=step.done(),current=step.id===w.current.id;return`<button class="flow-step${done?' is-complete':''}${current?' is-current':''}" data-step="${step.id}" type="button"><span class="flow-step-num">${done?'✓':String(index+1).padStart(2,'0')}</span><span class="flow-step-copy"><strong>${esc(step.title)}</strong><span>${esc(step.desc)}</span></span><span class="flow-step-action">${done?'Open':esc(step.action)}</span></button>`;}).join('')}</div>
  <div class="flow-section-title">Quick Actions</div><div class="flow-quick-grid"><button class="flow-quick" data-quick="import"><strong>Import Sample</strong><span>Load audio directly into the sampler.</span></button><button class="flow-quick" data-quick="record"><strong>Record Sample</strong><span>Arm a sample track and capture microphone audio.</span></button><button class="flow-quick" data-quick="bpm"><strong>Analyze BPM</strong><span>Detect tempo from the current sample.</span></button><button class="flow-quick" data-quick="save"><strong>Save .neusic</strong><span>Download a portable project with audio.</span></button></div>
  <div class="flow-section-title">Platform Architecture</div><div class="flow-cap-grid"><div class="flow-cap now"><b>Working Now</b><span>Recording, sampler, transient chop, 64-pad banks, timeline, MIDI, mixer, effects, autosave, WAV export.</span></div><div class="flow-cap next"><b>Next Native Layer</b><span>Take lanes, comping, routing buses, project package storage, waveform virtualization, deeper mastering.</span></div><div class="flow-cap future"><b>Desktop Roadmap</b><span>VST3/AU hosting, Kontakt, hardware drivers, multi-device sync, marketplace, advanced collaboration.</span></div></div>`;
  body.querySelector('[data-new-project]').onclick=openNewProject;body.querySelectorAll('[data-step]').forEach(btn=>btn.onclick=()=>runStep(btn.dataset.step));
  body.querySelector('[data-quick="import"]').onclick=importSample;body.querySelector('[data-quick="record"]').onclick=recordSample;body.querySelector('[data-quick="bpm"]').onclick=analyzeCurrentSample;body.querySelector('[data-quick="save"]').onclick=()=>window.saveProjectToFile?.();
}
function renderAll(){buildBar();buildPanel();addFooterButton();renderBar();renderPanel();injectSamplerTools();}
function openPanel(){buildPanel();panel.hidden=false;scrim.hidden=false;renderPanel();}
function closePanel(){if(panel)panel.hidden=true;if(scrim)scrim.hidden=true;}
function runStep(id){const step=stepDefs().find(item=>item.id===id);closePanel();step?.run?.();}
function runNext(){const w=workflow();if(w.complete===w.steps.length){openPanel();return;}runStep(w.current.id);}

function buildModal(content){
  if(modal)modal.remove();modal=document.createElement('section');modal.className='flow-modal';modal.innerHTML=content;document.body.appendChild(modal);if(scrim)scrim.hidden=false;return modal;
}
function closeModal(){modal?.remove();modal=null;if(panel?.hidden&&scrim)scrim.hidden=true;}
function openNewProject(){
  closePanel();const root=buildModal(`<header class="flow-modal-head"><div><strong>Create a New Project</strong><span>Choose a workflow, not a pile of empty tracks.</span></div><button class="flow-close" data-close type="button">×</button></header><div class="flow-modal-body"><label class="flow-name-field">Project Name<input id="flow-project-name" value="${esc(S.projectMeta?.name==='Untitled Project'?'':S.projectMeta?.name||'') }" placeholder="Untitled Project"></label><div class="flow-template-grid">${Object.entries(TEMPLATES).map(([id,t])=>`<button class="flow-template" type="button" data-template="${id}"><b>${esc(t.name)}</b><p>${esc(t.description)}</p><small>${t.tracks.length} starter tracks · ${t.bpm} BPM</small></button>`).join('')}</div></div>`);
  root.querySelector('[data-close]').onclick=closeModal;root.querySelectorAll('[data-template]').forEach(button=>button.onclick=()=>{const name=root.querySelector('#flow-project-name').value;if((Object.keys(S.buffers||{}).length||S.tracks.some(t=>(t.clips||[]).length))&&!confirm('Start a new project? The current project remains available only if it has been saved.'))return;applyTemplate(button.dataset.template,name);});
}
function openCapture(){closePanel();const root=buildModal(`<header class="flow-modal-head"><div><strong>Capture a Sample</strong><span>Start from a file or record directly into the project.</span></div><button class="flow-close" data-close type="button">×</button></header><div class="flow-modal-body"><div class="flow-template-grid"><button class="flow-template" data-capture="import"><b>Import Audio</b><p>Load WAV, MP3, AAC, M4A, OGG, or another browser-supported audio file into the sampler.</p><small>Fastest path to chopping</small></button><button class="flow-template" data-capture="record"><b>Record Microphone</b><p>Create and arm a Sample track, then record with monitoring and the existing transport.</p><small>Capture original material</small></button></div></div>`);root.querySelector('[data-close]').onclick=closeModal;root.querySelector('[data-capture="import"]').onclick=()=>{closeModal();importSample();};root.querySelector('[data-capture="record"]').onclick=()=>{closeModal();recordSample();};}
function importSample(){window.openDrawer?.('sampler');setTimeout(()=>window.getSamplerFileInput?.().click(),80);}
function recordSample(){const track=ensureTrack('Sample','audio');armOnly(track);captureIntent='sample';knownBuffers=new Set(Object.keys(S.buffers||{}));window.openDrawer?.('rec');window.toast?.('Sample track armed — press Record when ready');}
function recordVocals(){const track=ensureTrack('Lead Vocal','audio');armOnly(track);captureIntent='vocal';knownBuffers=new Set(Object.keys(S.buffers||{}));window.openDrawer?.('rec');window.toast?.('Lead Vocal armed — press Record when ready');}
function addMusicalTrack(name,target){ensureTrack(name,'midi');ensureState();S.projectMeta.flow.activeCompositionTarget=target;window.openDrawer?.('piano');markUpdated();window.toast?.(`Draw or record the ${name} part to complete this step`);}

function normalizedBpm(raw){let bpm=raw;while(bpm<70)bpm*=2;while(bpm>180)bpm/=2;return bpm;}
function detectBpm(buffer){
  const onsets=typeof window.detectTransients==='function'?window.detectTransients(buffer,{sensitivity:.12,minSpacingSec:.1}):[];
  if(onsets.length<4)return null;
  const histogram=new Map();let total=0;
  for(let i=0;i<onsets.length-1;i++)for(let span=1;span<=4&&i+span<onsets.length;span++){
    const interval=(onsets[i+span]-onsets[i])/span;if(interval<.2||interval>1.8)continue;
    const bpm=normalizedBpm(60/interval),bin=Math.round(bpm*2)/2,weight=1/span;histogram.set(bin,(histogram.get(bin)||0)+weight);total+=weight;
  }
  if(!histogram.size)return null;
  const scored=[...histogram.keys()].map(bpm=>({bpm,score:(histogram.get(bpm)||0)+.55*(histogram.get(bpm-.5)||0)+.55*(histogram.get(bpm+.5)||0)})).sort((a,b)=>b.score-a.score);
  const best=scored[0],confidence=Math.max(.08,Math.min(.99,best.score/Math.max(1,total)*5));
  const candidates=[best.bpm,best.bpm/2,best.bpm*2].map(v=>Math.round(v*10)/10).filter((v,i,a)=>v>=45&&v<=220&&a.indexOf(v)===i);
  return{bpm:Math.round(best.bpm*10)/10,confidence,onsets:onsets.length,candidates};
}
function analyzeCurrentSample(){
  closePanel();const entry=S.samplerBufferId?S.buffers[S.samplerBufferId]:null;if(!entry){window.toast?.('Load or record a sample first');window.openDrawer?.('sampler');return;}
  window.toast?.('Analyzing sample tempo…');setTimeout(()=>{const result=detectBpm(entry.buffer);if(!result){window.toast?.('Tempo could not be detected confidently');return;}showBpmResult(result);},30);
}
function showBpmResult(result){selectedBpm=result.bpm;const root=buildModal(`<header class="flow-modal-head"><div><strong>Tempo Analysis</strong><span>${result.onsets} onsets analyzed · ${Math.round(result.confidence*100)}% confidence</span></div><button class="flow-close" data-close type="button">×</button></header><div class="flow-modal-body"><div class="flow-bpm-result"><div class="flow-bpm-main" id="flow-bpm-main">${result.bpm.toFixed(1)}</div><div class="flow-bpm-unit">Beats per minute</div><div class="flow-bpm-confidence"><i style="width:${Math.round(result.confidence*100)}%"></i></div><div class="flow-bpm-candidates">${result.candidates.map((bpm,i)=>`<button class="flow-bpm-candidate${i===0?' active':''}" data-bpm="${bpm}">${bpm.toFixed(1)}</button>`).join('')}</div></div><div class="flow-modal-actions"><button class="flow-modal-btn" data-close-bottom>Cancel</button><button class="flow-modal-btn primary" data-apply>Apply Tempo</button></div></div>`);root.querySelector('[data-close]').onclick=closeModal;root.querySelector('[data-close-bottom]').onclick=closeModal;root.querySelectorAll('[data-bpm]').forEach(btn=>btn.onclick=()=>{root.querySelectorAll('[data-bpm]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');selectedBpm=Number(btn.dataset.bpm);root.querySelector('#flow-bpm-main').textContent=selectedBpm.toFixed(1);});root.querySelector('[data-apply]').onclick=()=>applyBpm(selectedBpm,result.confidence);}
function applyBpm(bpm,confidence){window.snapshot?.();S.bpm=Math.round(Number(bpm)*10)/10;ensureState();S.projectMeta.analysis={...S.projectMeta.analysis,bpmDetected:true,bpm:S.bpm,bpmConfidence:confidence,analyzedAt:nowIso()};document.getElementById('bpm-disp')&&(document.getElementById('bpm-disp').textContent=S.bpm);window.syncTimelineMetrics?.();window.renderTracks?.();window.drawRuler?.();markUpdated();closeModal();window.toast?.(`Tempo set to ${S.bpm} BPM`);}
function assignAllPads(){
  if(!S.samplerBufferId||!S.samplerSlices?.length){window.toast?.('Slice a sample before assigning pads');window.openDrawer?.('sampler');return;}
  window.snapshot?.();S.padBanks={A:[],B:[],C:[],D:[]};S.samplerSlices.slice(0,64).forEach((slice,index)=>{const bank=BANKS[Math.floor(index/16)],slot=index%16;S.padBanks[bank][slot]={sliceIdx:index,vel:100,pitch:0};});S.padBank='A';window.openDrawer?.('sampler');setTimeout(()=>window.buildMpcPadGrid?.(),40);markUpdated();window.toast?.(`${Math.min(64,S.samplerSlices.length)} slices assigned across pad banks`);
}
function openMasterCheck(){closePanel();window.openDrawer?.('mixer');const root=buildModal(`<header class="flow-modal-head"><div><strong>Master Check</strong><span>Confirm the project is ready for final rendering.</span></div><button class="flow-close" data-close type="button">×</button></header><div class="flow-modal-body"><div class="flow-cap-grid"><div class="flow-cap now"><b>Peak</b><span>Keep the final output below 0 dBFS. A ceiling near −1 dBFS is a practical streaming target.</span></div><div class="flow-cap next"><b>Loudness</b><span>Use the integrated loudness estimate as guidance, not as an absolute mastering decision.</span></div><div class="flow-cap future"><b>Translation</b><span>Check headphones, speakers, mono compatibility, and low-volume balance before export.</span></div></div><div class="flow-modal-actions"><button class="flow-modal-btn" data-close-bottom>Keep Mixing</button><button class="flow-modal-btn primary" data-ready>Mark Master Ready</button></div></div>`);root.querySelector('[data-close]').onclick=closeModal;root.querySelector('[data-close-bottom]').onclick=closeModal;root.querySelector('[data-ready]').onclick=()=>{ensureState();S.projectMeta.flow.masterReady=true;markUpdated();closeModal();window.toast?.('Master marked ready');};}
function exportProject(){ensureState();S.projectMeta.flow.exportedAt=nowIso();persistExtra();renderAll();window.exportWavFile?.();}

function injectSamplerTools(){const section=document.querySelector('#dp-sampler .sampler-section');if(!section||section.querySelector('.sampler-flow-tools'))return;const tools=document.createElement('div');tools.className='sampler-flow-tools';const analysis=S.projectMeta?.analysis?.bpmDetected?`${S.projectMeta.analysis.bpm} BPM detected`:'Tempo not analyzed';tools.innerHTML=`<button type="button" data-bpm>Detect BPM</button><button type="button" data-map>Assign Pads</button><button type="button" data-flow>Producer Flow</button><span>${esc(analysis)}</span>`;section.querySelector('.samp-filename')?.after(tools);tools.querySelector('[data-bpm]').onclick=analyzeCurrentSample;tools.querySelector('[data-map]').onclick=assignAllPads;tools.querySelector('[data-flow]').onclick=openPanel;}
function patchDrawer(){const original=window.openDrawer;if(typeof original!=='function'||original._producerFlow)return;const wrapped=function(id){const result=original(id);ensureState();S.projectMeta.flow.visited[id]=true;persistExtra();setTimeout(()=>{injectSamplerTools();renderAll();},0);return result;};wrapped._producerFlow=true;window.openDrawer=wrapped;}
function patchRecording(){const original=window.toggleRecord;if(typeof original!=='function'||original._producerFlow)return;const wrapped=async function(){const wasRecording=S.recording;const result=await original();if(wasRecording&&!S.recording&&captureIntent==='sample'){const fresh=Object.keys(S.buffers||{}).filter(id=>!knownBuffers.has(id));if(fresh.length){S.samplerBufferId=fresh[fresh.length-1];S.samplerSlices=[];S.padBanks={A:[],B:[],C:[],D:[]};window.toast?.('Recording loaded into sampler');}}if(wasRecording&&!S.recording)captureIntent=null;markUpdated();return result;};wrapped._producerFlow=true;window.toggleRecord=wrapped;}
function patchProjectFiles(){
  const originalSerialize=window.serializeProject;if(typeof originalSerialize==='function'&&!originalSerialize._producerFlow){const wrapped=async function(){const data=await originalSerialize();ensureState();return{...data,version:Math.max(2,Number(data.version)||1),projectMeta:clone(S.projectMeta),padBanks:clone(S.padBanks),padBank:S.padBank,noteRepeat:S.noteRepeat,mpc16Levels:S.mpc16Levels,mpcSwing:S.mpcSwing};};wrapped._producerFlow=true;window.serializeProject=wrapped;}
  window.saveProjectToFile=async function(){window.toast?.('Packaging .neusic project…');try{const data=await window.serializeProject();const blob=new Blob([JSON.stringify(data)],{type:'application/x-neusic+json'}),url=URL.createObjectURL(blob),a=document.createElement('a'),safe=(S.projectMeta?.name||'project').replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'project';a.href=url;a.download=`${safe}.neusic`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);window.toast?.('Neusic project saved');}catch(error){console.error(error);window.toast?.('Project save failed');}};
  const input=document.getElementById('project-file-input');if(input)input.accept='.neusic,.json,application/json,application/x-neusic+json';
  const originalLoad=window.loadProjectFromFile;if(typeof originalLoad==='function'&&!originalLoad._producerFlow){const wrapped=async function(file){let extras=null;try{extras=JSON.parse(await file.text());}catch(_){ }const result=await originalLoad(file);if(extras?.projectMeta)S.projectMeta=extras.projectMeta;if(extras?.padBanks)S.padBanks=extras.padBanks;if(extras?.padBank)S.padBank=extras.padBank;['noteRepeat','mpc16Levels','mpcSwing'].forEach(key=>{if(extras?.[key]!=null)S[key]=extras[key];});ensureState();persistExtra();renderAll();return result;};wrapped._producerFlow=true;window.loadProjectFromFile=wrapped;}
}
function patchSafety(){const safety=window.NeusicSafety;if(!safety||safety._producerFlow)return;const original=safety.saveNow;safety.saveNow=async function(...args){persistExtra();return original?.apply(this,args);};safety._producerFlow=true;}
function patchExport(){const original=window.exportWavFile;if(typeof original!=='function'||original._producerFlow)return;const wrapped=async function(...args){ensureState();S.projectMeta.flow.exportedAt=nowIso();persistExtra();renderAll();return original.apply(this,args);};wrapped._producerFlow=true;window.exportWavFile=wrapped;}
function compositionTracking(){document.addEventListener('pointerup',event=>{if(event.target?.id!=='pr-canvas')return;ensureState();const target=S.projectMeta.flow.activeCompositionTarget;if(!target)return;S.projectMeta.flow.composed[target]=true;S.projectMeta.flow.activeCompositionTarget=null;markUpdated();window.toast?.(`${target==='bass'?'Bass':'Keys'} part added`);});}
function keyboard(){document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.code==='KeyF'){event.preventDefault();openPanel();}if(event.key==='Escape'){closeModal();closePanel();}});}
function init(){
  if(typeof S==='undefined'||typeof PADS==='undefined')return;restoreExtra();buildBar();buildPanel();patchDrawer();patchRecording();patchProjectFiles();patchSafety();patchExport();compositionTracking();keyboard();renderAll();
  new MutationObserver(()=>{addFooterButton();injectSamplerTools();}).observe(document.body,{subtree:true,childList:true});
  ['change','pointerup','touchend'].forEach(type=>document.addEventListener(type,()=>setTimeout(()=>{persistExtra();renderAll();},0),{passive:true}));setInterval(renderBar,1200);
  window.NeusicFlow={version:VERSION,open:openPanel,newProject:openNewProject,applyTemplate,analyzeCurrentSample,detectBpm,assignAllPads,workflow};
  if(!localStorage.getItem(TEMPLATE_KEY))setTimeout(openNewProject,650);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
