(() => {
  'use strict';
  if (window.__neusicAgentClient) return;
  window.__neusicAgentClient = true;
  const path=location.pathname.toLowerCase();
  const product=path.includes('/live-loop/')?'live-loop':path.includes('/wave-loom/')?'wave':path.includes('/studio/')||path.includes('/app/')?'lab':'home';
  document.body.dataset.neusicProduct=document.body.dataset.neusicProduct||product;
  const STORE='neusic-agent-config-v2';
  const POS_STORE='neusic-agent-position-v2';
  const defaults={provider:'guide',endpoint:'http://127.0.0.1:8765/api/neusic-agent'};
  let config={...defaults};
  try{config={...config,...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch(_){}

  const logo=`<svg class="neusic-agent-logo" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="na-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".34" stop-color="#aebbc2"/><stop offset=".63" stop-color="#ffffff"/><stop offset="1" stop-color="#687981"/></linearGradient><filter id="na-glow"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M16 77V23h15l38 38V23h15v54H69L31 39v38z" fill="url(#na-metal)" filter="url(#na-glow)"/><path d="M23 15h54M23 85h54" stroke="currentColor" stroke-width="2" opacity=".45"/><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".35"/></svg>`;

  const launcher=document.createElement('button');
  launcher.className='neusic-agent-launcher';launcher.type='button';launcher.innerHTML=`${logo}<span>NEUSIC AGENT</span>`;launcher.setAttribute('aria-label','Open Neusic Agent');launcher.setAttribute('aria-expanded','false');
  const panel=document.createElement('section');panel.className='neusic-agent-panel';panel.setAttribute('aria-label','Neusic Agent');
  panel.innerHTML=`<header class="neusic-agent-head" data-agent-drag-handle><div class="neusic-agent-mark">${logo}</div><div class="neusic-agent-title"><b>Neusic Agent</b><small>Context-aware creative assistant</small></div><button class="neusic-agent-close" type="button" aria-label="Close">×</button></header><div class="neusic-agent-config"><select aria-label="Agent provider"><option value="guide">Offline Guide</option><option value="hermes">Hermes Agent</option><option value="crewai">CrewAI</option></select><button type="button" data-agent-settings>CONNECT</button><input class="neusic-agent-endpoint" aria-label="Agent endpoint" placeholder="http://127.0.0.1:8765/api/neusic-agent"></div><div class="neusic-agent-log" aria-live="polite"></div><form class="neusic-agent-compose"><textarea aria-label="Message Neusic Agent" placeholder="Ask about this performance, sound, or project…"></textarea><button class="neusic-agent-send" type="submit">SEND</button></form><button class="neusic-agent-credit" type="button" aria-label="Made by Anderson. Click for a surprise.">Made by Anderson</button>`;
  document.body.append(panel,launcher);
  const log=panel.querySelector('.neusic-agent-log'),provider=panel.querySelector('select'),endpoint=panel.querySelector('.neusic-agent-endpoint'),compose=panel.querySelector('form'),textarea=panel.querySelector('textarea'),send=panel.querySelector('.neusic-agent-send'),configBox=panel.querySelector('.neusic-agent-config'),credit=panel.querySelector('.neusic-agent-credit');
  provider.value=config.provider;endpoint.value=config.endpoint;

  function message(text,type='agent'){const item=document.createElement('div');item.className=`neusic-agent-message ${type}`;item.textContent=text;log.appendChild(item);log.scrollTop=log.scrollHeight;return item;}
  function open(value=true){panel.classList.toggle('open',value);launcher.setAttribute('aria-expanded',String(value));if(value)setTimeout(()=>textarea.focus(),80)}

  function clampPosition(el,x,y){const margin=8,w=el.offsetWidth||56,h=el.offsetHeight||56;return{x:Math.max(margin,Math.min(innerWidth-w-margin,x)),y:Math.max(margin,Math.min(innerHeight-h-margin,y))};}
  function applySavedPositions(){try{const pos=JSON.parse(localStorage.getItem(POS_STORE)||'{}');if(pos.launcher){const p=clampPosition(launcher,pos.launcher.x,pos.launcher.y);launcher.style.left=`${p.x}px`;launcher.style.top=`${p.y}px`;launcher.style.right='auto';launcher.style.bottom='auto';}if(pos.panel){const p=clampPosition(panel,pos.panel.x,pos.panel.y);panel.style.left=`${p.x}px`;panel.style.top=`${p.y}px`;panel.style.right='auto';panel.style.bottom='auto';}}catch(_){}}
  function persistPosition(key,el){try{const pos=JSON.parse(localStorage.getItem(POS_STORE)||'{}');pos[key]={x:parseFloat(el.style.left)||el.offsetLeft,y:parseFloat(el.style.top)||el.offsetTop};localStorage.setItem(POS_STORE,JSON.stringify(pos));}catch(_){}}
  function makeDraggable(el,handle,key,{click=true}={}){let drag=null,moved=false;handle.addEventListener('pointerdown',event=>{if(event.button!==undefined&&event.button!==0)return;if(event.target.closest('button,select,input,textarea')&&handle!==el)return;const rect=el.getBoundingClientRect();drag={id:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};moved=false;handle.setPointerCapture?.(event.pointerId);el.classList.add('dragging');event.preventDefault();});handle.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const p=clampPosition(el,event.clientX-drag.dx,event.clientY-drag.dy);if(Math.abs(p.x-el.offsetLeft)>2||Math.abs(p.y-el.offsetTop)>2)moved=true;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;el.style.right='auto';el.style.bottom='auto';});const finish=event=>{if(!drag||event.pointerId!==drag.id)return;handle.releasePointerCapture?.(event.pointerId);drag=null;el.classList.remove('dragging');persistPosition(key,el);if(click&&moved)el.dataset.dragMoved='true';setTimeout(()=>delete el.dataset.dragMoved,0);};handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);}
  makeDraggable(launcher,launcher,'launcher');makeDraggable(panel,panel.querySelector('[data-agent-drag-handle]'),'panel',{click:false});
  requestAnimationFrame(applySavedPositions);window.addEventListener('resize',applySavedPositions,{passive:true});

  launcher.addEventListener('click',()=>{if(launcher.dataset.dragMoved)return;open(!panel.classList.contains('open'));});panel.querySelector('.neusic-agent-close').onclick=()=>open(false);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel.classList.contains('open'))open(false)});
  panel.querySelector('[data-agent-settings]').onclick=()=>configBox.classList.toggle('show-endpoint');
  provider.onchange=()=>{config.provider=provider.value;save();announceProvider()};endpoint.onchange=()=>{config.endpoint=endpoint.value.trim()||defaults.endpoint;save()};
  function save(){try{localStorage.setItem(STORE,JSON.stringify(config))}catch(_){}}

  function launchEasterEgg(){
    document.body.classList.remove('neusic-anderson-mode');void document.body.offsetWidth;document.body.classList.add('neusic-anderson-mode');
    const phrases=['THE FIRST NOTE WAS AN IDEA.','BUILD DIFFERENT. HEAR DIFFERENT.','ANDERSON MODE: UNLOCKED.','NEUSIC WAS MADE TO MOVE.'];
    message(phrases[Math.floor(Math.random()*phrases.length)],'secret');
    const burst=document.createElement('div');burst.className='neusic-agent-burst';burst.innerHTML=Array.from({length:24},(_,i)=>`<i style="--i:${i};--r:${35+Math.random()*75}px;--d:${Math.random()*.35}s"></i>`).join('');document.body.appendChild(burst);const rect=credit.getBoundingClientRect();burst.style.left=`${rect.left+rect.width/2}px`;burst.style.top=`${rect.top+rect.height/2}px`;setTimeout(()=>burst.remove(),1600);setTimeout(()=>document.body.classList.remove('neusic-anderson-mode'),4200);
    try{const AC=window.AudioContext||window.webkitAudioContext;if(AC){const ctx=new AC();const now=ctx.currentTime;[261.63,329.63,392,523.25].forEach((freq,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0,now+i*.08);g.gain.linearRampToValueAtTime(.055,now+i*.08+.02);g.gain.exponentialRampToValueAtTime(.001,now+i*.08+.55);o.connect(g).connect(ctx.destination);o.start(now+i*.08);o.stop(now+i*.08+.58);});setTimeout(()=>ctx.close(),1200);}}catch(_){}
  }
  credit.addEventListener('click',launchEasterEgg);

  function studioWindow(){const frame=document.getElementById('studio');try{return frame?.contentWindow||null}catch(_){return null}}
  function context(){
    const target=product==='lab'?(studioWindow()||window):window;
    const result={product,url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight},timestamp:new Date().toISOString()};
    try{
      if(product==='live-loop'){
        result.bpm=Number(document.getElementById('bpmInput')?.value||0);result.masterLength=document.getElementById('masterLength')?.textContent||'—';result.globalState=document.getElementById('globalState')?.textContent||'READY';result.lanes=[...document.querySelectorAll('.loop-track')].map((card,index)=>({index:index+1,name:card.querySelector('.track-name')?.textContent||`Loop ${index+1}`,state:card.dataset.state||'Empty',selected:card.classList.contains('selected')}));
      }else if(product==='wave'){
        const state=window.NeusicWaveReliability?.state||window.NeusicWaveLoom?.state||{};result.engineMode=state.engineMode||document.getElementById('performanceEngine')?.value||'wave';result.tempo=Number(document.getElementById('tempoInput')?.value||document.getElementById('tempoReadout')?.textContent||0);result.nodes=window.NeusicWaveLoom?.state?.nodes?.length||0;result.samples=document.querySelectorAll('.persistent-sample-card,.uploaded-sample-card').length;result.workspace=document.body.dataset.waveWorkspace||'loom';
      }else if(product==='lab'){
        const S=target.S||target.__NeusicStudioBridge?.S||{};result.bpm=Number(S.bpm||target.document?.getElementById('bpm-disp')?.textContent||0);result.tracks=(S.tracks||[]).map((track,index)=>({index:index+1,name:track.name,type:track.type,clips:(track.clips||[]).length,armed:Boolean(track.arm)}));result.workspace=target.document?.body?.dataset?.studioV4Stage||target.document?.querySelector('[data-studio-stage].active')?.dataset?.studioStage||'arrange';result.project=S.projectMeta?.name||S.projectName||'Untitled Project';
      }
    }catch(error){result.contextWarning=error.message}
    return result;
  }

  function offlineAnswer(prompt,ctx){const q=prompt.toLowerCase();const label={home:'Neusic','live-loop':'Neusic Live Loop',wave:'Neusic Wave',lab:'Neusic Lab'}[product];
    if(q.includes('record')||q.includes('mic'))return product==='live-loop'?'On a phone, select a lane, tap ENABLE MIC, allow microphone access, then tap REC. MIDI is optional. Tap REC again to finish the first loop; later lanes sync to that master cycle.':product==='wave'?'Open Capture, arm NeuCapture or choose Record Full Sample, then send the result into The Forge.':'Open Capture, select or create an audio track, arm it, confirm the input device, and use the main Record control.';
    if(q.includes('midi'))return product==='live-loop'?'MIDI is optional. Touch controls can record, overdub, mute, start, and stop every lane. Connect MIDI only when you want foot-controller or hardware mappings.':'The current page supports its normal touch and mouse workflow without MIDI; MIDI adds hardware control rather than unlocking core features.';
    if(q.includes('transfer')||q.includes('forge'))return product==='live-loop'?'Record or load a lane, select it, then choose FORGE or Send Selected to Forge. Neusic Wave opens with that audio ready to preview and unfold.':product==='wave'?'Use Send to Lab from the export or sample controls. The transfer creates a real audio track in Neusic Lab through the shared local project bridge.':'Use the product journey links to begin in Live Loop or Wave; transferred audio arrives as a playable Lab track.';
    if(q.includes('mix')||q.includes('master')||q.includes('export'))return product==='lab'?'Open Mix for channel balance and routing, then Deliver for master checks, stem options, project packaging, and final WAV export.':'Transfer the material into Neusic Lab when it is ready for arrangement, mixing, mastering, and delivery.';
    if(q.includes('what')||q.includes('next'))return product==='live-loop'?'Build the first master loop, add synchronized layers, then send the strongest lane to Wave for detailed refinement.':product==='wave'?'Choose Sample, Granular, Hybrid, or Wave performance; refine slices and node assignments, then render or send the result to Lab.':product==='lab'?'Keep the track sidebar visible, work in the dedicated center workspace, and move through Arrange → Capture/Create/Edit → Mix → Deliver.':'Start in Live Loop, Wave, or Lab. The recommended path is Live Loop → Wave → Lab.';
    const details=product==='live-loop'?`${ctx.lanes?.filter(l=>l.state!=='Empty').length||0} of 5 lanes currently contain or are capturing material.`:product==='wave'?`${ctx.samples||0} persistent samples and ${ctx.nodes||0} trigger nodes are visible.`:product==='lab'?`${ctx.tracks?.length||0} tracks are in ${ctx.project||'the current project'}.`:'Three connected Neusic products are available.';
    return `${label} guide: ${details} Ask me about recording, MIDI, transfers, arranging, mixing, or export.`;
  }
  function announceProvider(){const name=provider.options[provider.selectedIndex].textContent;message(name==='Offline Guide'?`Offline Guide is active for ${product}. It uses the current page state and does not call an external model.`:`${name} selected. Set the local bridge endpoint, then send a message. GitHub Pages cannot run Hermes or CrewAI by itself.`,'system')}
  announceProvider();

  compose.addEventListener('submit',async event=>{
    event.preventDefault();const prompt=textarea.value.trim();if(!prompt)return;textarea.value='';message(prompt,'user');send.disabled=true;const ctx=context();
    try{
      if(provider.value==='guide'){message(offlineAnswer(prompt,ctx));return}
      const response=await fetch(endpoint.value.trim()||defaults.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:provider.value,message:prompt,context:ctx})});
      if(!response.ok)throw new Error(`Agent bridge returned ${response.status}`);const data=await response.json();message(String(data.reply||data.result||data.message||'The agent returned no text.'));
    }catch(error){console.warn('Neusic Agent bridge unavailable',error);message(`${provider.options[provider.selectedIndex].textContent} is not connected from this browser. ${offlineAnswer(prompt,ctx)}`,'system')}
    finally{send.disabled=false}
  });
  window.NeusicAgent={open:()=>open(true),context,config:()=>({...config}),easterEgg:launchEasterEgg};
})();
