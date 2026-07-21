(() => {
  'use strict';
  if (window.__neusicLiveLoopMobile) return;
  window.__neusicLiveLoopMobile = true;

  const COLORS=['#4de7ee','#9e7cff','#69d994','#f2bd5b','#ed6f89'];
  const MOBILE_QUERY=matchMedia('(max-width:760px)');
  let initialized=false,touchStartX=0;
  const cards=()=>[...document.querySelectorAll('#trackGrid .loop-track')];
  const currentIndex=()=>{const selected=cards().findIndex(card=>card.classList.contains('selected'));return selected>=0?selected:0;};

  function activateLane(index){
    const list=cards(),next=Math.max(0,Math.min(list.length-1,index)),card=list[next];
    if(!card)return;
    card.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    list.forEach((item,itemIndex)=>item.classList.toggle('mobile-active',itemIndex===next));
    sync();
  }

  function sync(){
    const nav=document.getElementById('mobileLaneNav'),controls=document.getElementById('mobilePerformanceControls'),list=cards(),active=currentIndex();
    if(!nav||!list.length)return;
    list.forEach((card,index)=>card.classList.toggle('mobile-active',index===active));
    nav.querySelectorAll('.mobile-lane-button').forEach((button,index)=>{
      const card=list[index],state=card?.dataset.state||'Empty',label=card?.querySelector('.track-name')?.textContent?.trim()||`Loop ${index+1}`;
      button.dataset.state=state;button.classList.toggle('active',index===active);button.setAttribute('aria-current',index===active?'true':'false');button.querySelector('small').textContent=state.toUpperCase();button.setAttribute('aria-label',`Select ${label}. ${state}.`);
    });
    nav.querySelector('[data-mobile-lane-readout]').textContent=`LANE ${active+1} OF ${list.length}`;
    if(!controls)return;
    const state=list[active]?.dataset.state||'Empty',recordSource=list[active]?.querySelector('[data-action="record"]');
    const record=controls.querySelector('[data-mobile-action="record"]'),mic=controls.querySelector('[data-mobile-action="mic"]'),play=controls.querySelector('[data-mobile-action="transport"]'),midi=controls.querySelector('[data-mobile-action="midi"]');
    record.textContent=recordSource?.textContent?.trim()||'REC';record.dataset.state=state;record.classList.toggle('active',['Queued','Recording','Overdubbing'].includes(state));
    mic.classList.toggle('active',document.getElementById('micBtn')?.classList.contains('active'));mic.textContent=mic.classList.contains('active')?'MIC READY':'ENABLE MIC';
    play.classList.toggle('active',document.getElementById('playBtn')?.classList.contains('active'));play.textContent=play.classList.contains('active')?'PAUSE':'PLAY';
    midi.classList.toggle('active',document.getElementById('midiBtn')?.classList.contains('active'));midi.textContent=midi.classList.contains('active')?'MIDI ON':'MIDI OPTIONAL';
    const bpm=controls.querySelector('[data-mobile-bpm]'),quantize=controls.querySelector('[data-mobile-quantize]');
    if(document.activeElement!==bpm)bpm.value=document.getElementById('bpmInput')?.value||112;
    quantize.checked=Boolean(document.getElementById('quantizeToggle')?.checked);
    controls.querySelector('[data-mobile-status]').textContent=state==='Empty'?'Touch REC to capture. No MIDI required.':state==='Queued'?'Waiting for the synchronized boundary…':state==='Recording'?'Recording. Touch STOP when the first loop is complete.':state==='Overdubbing'?'Overdubbing one synchronized cycle…':`${state.toUpperCase()} · TOUCH CONTROLS ACTIVE`;
  }

  function buildControls(nav){
    const controls=document.createElement('section');controls.id='mobilePerformanceControls';controls.className='mobile-performance-controls';controls.setAttribute('aria-label','Touch performance controls');
    controls.innerHTML=`<div class="mobile-performance-primary"><button type="button" data-mobile-action="mic">ENABLE MIC</button><button class="mobile-record" type="button" data-mobile-action="record">REC</button><button type="button" data-mobile-action="transport">PLAY</button><button type="button" data-mobile-action="next">NEXT LANE</button></div><div class="mobile-performance-secondary"><label>BPM<input data-mobile-bpm type="number" min="40" max="220" value="112"></label><label class="mobile-sync"><input data-mobile-quantize type="checkbox" checked><span>SYNC</span></label><button type="button" data-mobile-action="midi">MIDI OPTIONAL</button></div><p data-mobile-status>Touch REC to capture. No MIDI required.</p>`;
    nav.after(controls);
    controls.addEventListener('click',event=>{
      const action=event.target.closest('[data-mobile-action]')?.dataset.mobileAction;if(!action)return;
      if(action==='mic')document.getElementById('micBtn')?.click();
      if(action==='record')cards()[currentIndex()]?.querySelector('[data-action="record"]')?.click();
      if(action==='transport')document.getElementById('playBtn')?.click();
      if(action==='next')activateLane((currentIndex()+1)%Math.max(1,cards().length));
      if(action==='midi')document.getElementById('midiBtn')?.click();
      setTimeout(sync,40);
    });
    controls.querySelector('[data-mobile-bpm]').addEventListener('change',event=>{const original=document.getElementById('bpmInput');if(!original)return;original.value=event.target.value;original.dispatchEvent(new Event('change',{bubbles:true}));sync();});
    controls.querySelector('[data-mobile-quantize]').addEventListener('change',event=>{const original=document.getElementById('quantizeToggle');if(!original)return;original.checked=event.target.checked;original.dispatchEvent(new Event('change',{bubbles:true}));sync();});
  }

  function install(){
    if(initialized)return;const grid=document.getElementById('trackGrid');if(!grid||cards().length<5)return;initialized=true;
    const nav=document.createElement('section');nav.id='mobileLaneNav';nav.className='mobile-lane-nav';nav.setAttribute('aria-label','Select one of five synchronized loop lanes');
    nav.innerHTML=`<div class="mobile-lane-nav-head"><span>ALL FIVE LANES · TOUCH FIRST</span><b data-mobile-lane-readout>LANE 1 OF 5</b></div><div class="mobile-lane-buttons" role="tablist" aria-label="Loop lanes">${COLORS.map((color,index)=>`<button class="mobile-lane-button" type="button" role="tab" data-lane-index="${index}" style="--lane-color:${color}"><span>${String(index+1).padStart(2,'0')}</span><small>EMPTY</small></button>`).join('')}</div>`;
    grid.before(nav);buildControls(nav);
    nav.addEventListener('click',event=>{const button=event.target.closest('[data-lane-index]');if(button)activateLane(Number(button.dataset.laneIndex));});
    grid.addEventListener('touchstart',event=>{touchStartX=event.changedTouches[0]?.clientX||0},{passive:true});
    grid.addEventListener('touchend',event=>{const delta=(event.changedTouches[0]?.clientX||0)-touchStartX;if(Math.abs(delta)>55)activateLane(currentIndex()+(delta<0?1:-1));},{passive:true});
    const observer=new MutationObserver(sync);observer.observe(grid,{subtree:true,attributes:true,attributeFilter:['class','data-state','disabled'],childList:true,characterData:true});
    ['micBtn','playBtn','midiBtn','bpmInput','quantizeToggle'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>setTimeout(sync,30)));
    MOBILE_QUERY.addEventListener?.('change',()=>activateLane(currentIndex()));
    requestAnimationFrame(()=>activateLane(currentIndex()));
  }

  function waitForTracks(){install();if(initialized)return;const observer=new MutationObserver(()=>{install();if(initialized)observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),12000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForTracks,{once:true});else waitForTracks();
})();
