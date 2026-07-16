/* Neusic Lab Workspace V4 — preserve the engines, replace the competing shells. */
(() => {
  'use strict';
  if (window.__neusicStudioV4) return;
  const app=document.getElementById('app'),topbar=document.getElementById('topbar'),main=document.getElementById('main'),sidebar=document.getElementById('sidebar'),drawer=document.getElementById('drawer');
  if(!app||!topbar||!main||!sidebar||!drawer)return;
  window.__neusicStudioV4=true;
  document.body.classList.add('neusic-studio-v4');

  const originalOpenDrawer=typeof window.openDrawer==='function'?window.openDrawer.bind(window):null;
  const STAGES={
    arrange:{code:'ARR',label:'Arrange',eyebrow:'SONG FORM · TRACKS · TIMELINE',note:'Build the full record in the dedicated timeline while the track rack remains visible.',tools:[['timeline','Timeline']]},
    capture:{code:'CAP',label:'Capture',eyebrow:'AUDIO · MIDI · TAKE MANAGEMENT',note:'Choose an input, arm a track, record, review takes, and preserve alternate performances.',tools:[['rec','Recording']]},
    create:{code:'CRT',label:'Create',eyebrow:'DRUMS · KEYS · SAMPLER · NEUSIC SOURCES',note:'Create musical material without leaving the project. Live Loop and Wave remain connected source instruments.',tools:[['drums','Drums'],['piano','Piano Roll'],['sampler','Sampler'],['live-loop','Live Loop'],['wave','Wave']]},
    edit:{code:'EDT',label:'Edit',eyebrow:'AUDIO · MIDI · EFFECTS · AUTOMATION',note:'Refine clips, notes, timing, effects, automation, and project media in a focused editor.',tools:[['piano','MIDI'],['fx','Effects'],['auto','Automation'],['browser','Browser']]},
    mix:{code:'MIX',label:'Mix',eyebrow:'CHANNELS · BUSES · RETURNS · MASTER',note:'Balance levels, pan, routing, inserts, sends, returns, and the master path.',tools:[['mixer','Mixer']]},
    deliver:{code:'DLV',label:'Deliver',eyebrow:'MASTER CHECK · STEMS · PROJECT PACKAGE',note:'Verify the final project, save a portable session, render the mix, and prepare delivery.',tools:[['deliver','Delivery']]}
  };
  const panelStage={rec:'capture',drums:'create',sampler:'create',piano:'edit',fx:'edit',auto:'edit',browser:'edit',mixer:'mix'};
  let activeStage='arrange',activeTool='timeline',previousTool='piano';

  const shell=document.createElement('section');shell.id='studio-v4-shell';shell.setAttribute('aria-label','Neusic Lab workspace');
  const left=document.createElement('aside');left.className='studio-v4-left';left.innerHTML=`<nav class="studio-v4-stage-rail" aria-label="Production stages"><a class="studio-v4-home" href="../" target="_top" aria-label="Neusic home">N</a>${Object.entries(STAGES).map(([id,stage])=>`<button class="studio-v4-stage-button${id==='arrange'?' active':''}" type="button" data-studio-stage="${id}"><i>${stage.code}</i><span>${stage.label}</span></button>`).join('')}<span class="studio-v4-stage-spacer"></span><button class="studio-v4-stage-button" type="button" data-open-agent><i>AI</i><span>Agent</span></button></nav><section class="studio-v4-track-column"><header class="studio-v4-track-head"><div><small>PROJECT TRACK RACK</small><b>Tracks & routing</b></div><button type="button" data-v4-add aria-label="Create track">＋</button></header><div class="studio-v4-track-rack"></div></section>`;
  const center=document.createElement('section');center.className='studio-v4-center';center.innerHTML=`<header class="studio-v4-center-head"><button class="studio-v4-mobile-toggle" type="button" data-v4-tracks aria-label="Open tracks">☰</button><div class="studio-v4-center-title"><small id="studio-v4-eyebrow">${STAGES.arrange.eyebrow}</small><b id="studio-v4-title">Arrange</b></div><div class="studio-v4-subtools" id="studio-v4-subtools"></div><div class="studio-v4-center-actions"><button type="button" data-v4-save>SAVE</button><button class="primary" type="button" data-v4-export>EXPORT</button></div><button class="studio-v4-mobile-toggle studio-v4-inspector-toggle" type="button" data-v4-inspector aria-label="Open inspector">ⓘ</button></header><div class="studio-v4-workspace arrange-active" id="studio-v4-workspace"></div>`;
  const inspector=document.createElement('aside');inspector.className='studio-v4-inspector';inspector.innerHTML=`<header class="studio-v4-inspector-head"><small>CONTEXT INSPECTOR</small><b id="studio-v4-inspector-title">Arrange</b></header><div class="studio-v4-inspector-body"><section class="studio-v4-inspector-card"><small>PROJECT STATE</small><div class="studio-v4-inspector-grid"><div class="studio-v4-readout"><small>TRACKS</small><b id="studio-v4-track-count">00</b></div><div class="studio-v4-readout"><small>CLIPS</small><b id="studio-v4-clip-count">00</b></div><div class="studio-v4-readout"><small>TEMPO</small><b id="studio-v4-tempo">120</b></div><div class="studio-v4-readout"><small>STAGE</small><b id="studio-v4-stage-code">ARR</b></div></div></section><section class="studio-v4-inspector-card"><small>STAGE GUIDANCE</small><p class="studio-v4-inspector-note" id="studio-v4-note">${STAGES.arrange.note}</p></section><section class="studio-v4-inspector-card"><small>PROJECT ACTIONS</small><div class="studio-v4-inspector-actions"><button class="accent" type="button" data-v4-add>CREATE TRACK</button><button type="button" data-v4-save>SAVE PROJECT</button><button type="button" data-v4-export>EXPORT MIX</button><a href="../live-loop/" target="_top">OPEN LIVE LOOP</a><a href="../wave-loom/" target="_top">OPEN WAVE</a><button type="button" data-open-agent>OPEN NEUSIC AGENT</button></div></section></div>`;
  shell.append(left,center,inspector);topbar.after(shell);
  const workspace=center.querySelector('#studio-v4-workspace'),rack=left.querySelector('.studio-v4-track-rack');
  rack.appendChild(sidebar);workspace.append(main,drawer);

  const deliver=document.createElement('section');deliver.id='studio-v4-deliver';deliver.innerHTML=`<div class="studio-v4-deliver-grid"><article class="studio-v4-deliver-card"><small>PROJECT PACKAGE</small><h3>Save the complete session.</h3><p>Preserve tracks, clips, MIDI, mixer state, routing, recovery metadata, and available audio in the existing Neusic project format.</p><button type="button" data-v4-save>SAVE PROJECT</button></article><article class="studio-v4-deliver-card"><small>FULL MIX</small><h3>Render the record.</h3><p>Use the established Studio renderer to create the current full mix as a WAV file.</p><button type="button" data-v4-export>EXPORT WAV</button></article><article class="studio-v4-deliver-card"><small>MASTER CHECK</small><h3>Review before delivery.</h3><p>Open the existing producer-flow master check when available, or inspect the master channel in Mix.</p><button type="button" data-v4-master>OPEN MASTER CHECK</button></article><article class="studio-v4-deliver-card"><small>CONNECTED PROJECT</small><h3>Bring in more source material.</h3><p>Continue creating in Live Loop or Wave and transfer the result back into this Lab project.</p><button type="button" data-v4-wave>OPEN NEUSIC WAVE</button></article></div>`;workspace.appendChild(deliver);

  const mobile=document.createElement('nav');mobile.id='studio-v4-mobile-nav';mobile.setAttribute('aria-label','Mobile production stages');mobile.innerHTML=`<button class="active" type="button" data-mobile-stage="arrange"><i>ARR</i>Arrange</button><button type="button" data-mobile-stage="capture"><i>CAP</i>Capture</button><button type="button" data-mobile-stage="create"><i>CRT</i>Create</button><button type="button" data-mobile-stage="mix"><i>MIX</i>Mix</button><button type="button" data-mobile-stage="more"><i>•••</i>More</button>`;document.body.appendChild(mobile);

  function projectState(){const S=window.S||{};const tracks=Array.isArray(S.tracks)?S.tracks:[];return{tracks,clips:tracks.reduce((sum,track)=>sum+(Array.isArray(track.clips)?track.clips.length:0),0),tempo:S.bpm||document.getElementById('bpm-disp')?.textContent||120};}
  function syncInspector(){const state=projectState();document.getElementById('studio-v4-track-count').textContent=String(state.tracks.length).padStart(2,'0');document.getElementById('studio-v4-clip-count').textContent=String(state.clips).padStart(2,'0');document.getElementById('studio-v4-tempo').textContent=String(state.tempo).trim();}
  function setPanel(panel){if(!panel)return;if(originalOpenDrawer)originalOpenDrawer(panel);drawer.classList.add('open','studio-v4-panel-visible');drawer.querySelectorAll('.dpanel').forEach(item=>item.classList.toggle('active',item.id===`dp-${panel}`));previousTool=panel;}
  function renderTools(stage,preferred){const config=STAGES[stage],tools=document.getElementById('studio-v4-subtools');tools.innerHTML=config.tools.map(([id,label])=>`<button class="studio-v4-subtool${id===preferred?' active':''}" type="button" data-studio-tool="${id}">${label}</button>`).join('');}
  function externalTool(tool){if(tool==='live-loop')location.href='../live-loop/';if(tool==='wave')location.href='../wave-loom/';}

  function activate(stage='arrange',tool=null,{quiet=false}={}){
    if(stage==='more')stage='edit';if(!STAGES[stage])stage='arrange';const config=STAGES[stage];activeStage=stage;activeTool=tool||config.tools[0][0];
    document.body.dataset.studioV4Stage=stage;workspace.classList.toggle('arrange-active',stage==='arrange');workspace.classList.toggle('panel-active',!['arrange','deliver'].includes(stage));deliver.classList.toggle('active',stage==='deliver');
    if(stage==='arrange'){main.style.display='';drawer.classList.remove('studio-v4-panel-visible');}
    else if(stage==='deliver'){main.style.display='none';drawer.classList.remove('studio-v4-panel-visible');}
    else{main.style.display='none';setPanel(activeTool);}
    document.getElementById('studio-v4-title').textContent=config.label;document.getElementById('studio-v4-eyebrow').textContent=config.eyebrow;document.getElementById('studio-v4-inspector-title').textContent=config.label;document.getElementById('studio-v4-note').textContent=config.note;document.getElementById('studio-v4-stage-code').textContent=config.code;
    left.querySelectorAll('[data-studio-stage]').forEach(button=>button.classList.toggle('active',button.dataset.studioStage===stage));mobile.querySelectorAll('[data-mobile-stage]').forEach(button=>button.classList.toggle('active',button.dataset.mobileStage===stage||(button.dataset.mobileStage==='more'&&['edit','deliver'].includes(stage))));
    renderTools(stage,activeTool);left.classList.remove('open');inspector.classList.remove('open');syncInspector();
    try{localStorage.setItem('neusic-studio-v4',JSON.stringify({stage,tool:activeTool}))}catch(_){}
    window.dispatchEvent(new CustomEvent('neusic:studio-stage',{detail:{stage,tool:activeTool}}));if(!quiet)window.toast?.(`${config.label} workspace`);
  }

  left.addEventListener('click',event=>{const stage=event.target.closest('[data-studio-stage]')?.dataset.studioStage;if(stage)activate(stage);if(event.target.closest('[data-v4-add]'))window.addTrack?.();if(event.target.closest('[data-open-agent]'))window.top?.NeusicAgent?.open?.()||window.NeusicAgent?.open?.();});
  center.querySelector('#studio-v4-subtools').addEventListener('click',event=>{const tool=event.target.closest('[data-studio-tool]')?.dataset.studioTool;if(!tool)return;if(['live-loop','wave'].includes(tool))return externalTool(tool);activate(activeStage,tool);});
  mobile.addEventListener('click',event=>{const stage=event.target.closest('[data-mobile-stage]')?.dataset.mobileStage;if(!stage)return;activate(stage==='more'?'edit':stage);});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-v4-tracks]'))left.classList.toggle('open');if(event.target.closest('[data-v4-inspector]'))inspector.classList.toggle('open');
    if(event.target.closest('[data-v4-add]'))window.addTrack?.();if(event.target.closest('[data-v4-save]'))window.saveProjectToFile?.();if(event.target.closest('[data-v4-export]'))window.exportWavFile?.();
    if(event.target.closest('[data-v4-master]')){if(typeof window.openMasterCheck==='function')window.openMasterCheck();else activate('mix','mixer');}
    if(event.target.closest('[data-v4-wave]'))location.href='../wave-loom/';if(event.target.closest('[data-open-agent]'))window.top?.NeusicAgent?.open?.()||window.NeusicAgent?.open?.();
  });
  document.addEventListener('keydown',event=>{if(event.target?.matches?.('input,textarea,select,[contenteditable="true"]'))return;if(event.key==='Escape'){left.classList.remove('open');inspector.classList.remove('open');return;}const map={'1':'arrange','2':'capture','3':'create','4':'edit','5':'mix','6':'deliver'};if(map[event.key])activate(map[event.key]);});

  window.openDrawer=panel=>{const stage=panelStage[panel];if(stage)return activate(stage,panel,{quiet:true});return originalOpenDrawer?.(panel);};
  window.toggleDrawer=()=>activeStage==='arrange'?activate(panelStage[previousTool]||'edit',previousTool):activate('arrange');
  window.toggleSidebar=()=>matchMedia('(max-width:860px)').matches?left.classList.toggle('open'):left.classList.toggle('collapsed');
  window.NeusicStudioV4={activate,state:()=>({stage:activeStage,tool:activeTool}),sync:syncInspector};

  const observer=new MutationObserver(()=>requestAnimationFrame(syncInspector));observer.observe(rack,{subtree:true,childList:true,attributes:true});
  let restored={};try{restored=JSON.parse(localStorage.getItem('neusic-studio-v4')||'{}')}catch(_){}activate(restored.stage||'arrange',restored.tool||null,{quiet:true});
  setTimeout(syncInspector,250);
})();
