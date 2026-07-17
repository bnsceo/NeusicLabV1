/* Neusic Lab mobile app shell v5 — touch navigation and native-style actions. */
(() => {
  'use strict';
  if (window.__neusicMobileAppShell || !matchMedia('(max-width:860px)').matches) return;
  const boot = () => {
    if (window.__neusicMobileAppShell) return;
    const api=window.NeusicStudioV4;
    const mobile=document.getElementById('studio-v4-mobile-nav');
    const left=document.querySelector('.studio-v4-left');
    const inspector=document.querySelector('.studio-v4-inspector');
    if(!api||!mobile||!left||!inspector){setTimeout(boot,80);return;}
    window.__neusicMobileAppShell=true;
    document.body.classList.add('neusic-mobile-app');

    mobile.innerHTML=`
      <button class="active" type="button" data-mobile-app-stage="arrange" aria-label="Arrange workspace"><i>ARR</i><span>Arrange</span></button>
      <button type="button" data-mobile-app-stage="capture" aria-label="Record and capture"><i>REC</i><span>Record</span></button>
      <button type="button" data-mobile-app-stage="create" aria-label="Create music"><i>CRT</i><span>Create</span></button>
      <button type="button" data-mobile-app-stage="mix" aria-label="Mix project"><i>MIX</i><span>Mix</span></button>
      <button type="button" data-mobile-app-more aria-label="More production actions"><i>•••</i><span>More</span></button>`;

    const backdrop=document.createElement('div');
    backdrop.className='lab-mobile-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    const sheet=document.createElement('section');
    sheet.className='lab-mobile-sheet';
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-label','Neusic Lab actions');
    sheet.innerHTML=`
      <span class="lab-mobile-sheet-handle" aria-hidden="true"></span>
      <header><div><small>NEUSIC LAB</small><b>Project actions</b></div><button class="lab-mobile-sheet-close" type="button" aria-label="Close actions">✕</button></header>
      <div class="lab-mobile-actions">
        <button class="lab-mobile-action" type="button" data-lab-action="edit"><i>EDT</i><span>Edit<small>Clips, MIDI, FX and automation</small></span></button>
        <button class="lab-mobile-action" type="button" data-lab-action="deliver"><i>DLV</i><span>Deliver<small>Master check and final export</small></span></button>
        <button class="lab-mobile-action" type="button" data-lab-action="tracks"><i>TRK</i><span>Tracks<small>Track rack and routing</small></span></button>
        <button class="lab-mobile-action" type="button" data-lab-action="inspector"><i>INF</i><span>Inspector<small>Project and stage details</small></span></button>
        <button class="lab-mobile-action" type="button" data-lab-action="save"><i>SAV</i><span>Save<small>Download the complete project</small></span></button>
        <button class="lab-mobile-action primary" type="button" data-lab-action="export"><i>WAV</i><span>Export<small>Render the current full mix</small></span></button>
        <button class="lab-mobile-action" type="button" data-lab-action="live"><i>LOOP</i><span>Live Loop<small>Capture a new performance</small></span></button>
        <button class="lab-mobile-action" type="button" data-lab-action="wave"><i>WAVE</i><span>Neusic Wave<small>Shape and resample audio</small></span></button>
      </div>`;
    document.body.append(backdrop,sheet);

    const more=mobile.querySelector('[data-mobile-app-more]');
    const closeSheet=()=>{sheet.classList.remove('open');backdrop.classList.remove('open');more?.classList.remove('active');document.body.classList.remove('lab-sheet-open');};
    const openSheet=()=>{left.classList.remove('open');inspector.classList.remove('open');sheet.classList.add('open');backdrop.classList.add('open');more?.classList.add('active');document.body.classList.add('lab-sheet-open');sheet.querySelector('.lab-mobile-sheet-close')?.focus({preventScroll:true});};
    const syncNav=stage=>{
      mobile.querySelectorAll('[data-mobile-app-stage]').forEach(button=>button.classList.toggle('active',button.dataset.mobileAppStage===stage));
      if(!['edit','deliver'].includes(stage))more?.classList.remove('active');
    };
    const activate=stage=>{closeSheet();api.activate(stage);syncNav(stage);};

    mobile.addEventListener('click',event=>{
      const stage=event.target.closest('[data-mobile-app-stage]')?.dataset.mobileAppStage;
      if(stage){activate(stage);return;}
      if(event.target.closest('[data-mobile-app-more]')){sheet.classList.contains('open')?closeSheet():openSheet();}
    });
    backdrop.addEventListener('click',closeSheet);
    sheet.querySelector('.lab-mobile-sheet-close').addEventListener('click',closeSheet);
    sheet.addEventListener('click',event=>{
      const action=event.target.closest('[data-lab-action]')?.dataset.labAction;
      if(!action)return;
      if(action==='edit'||action==='deliver'){activate(action);return;}
      closeSheet();
      if(action==='tracks')left.classList.add('open');
      if(action==='inspector')inspector.classList.add('open');
      if(action==='save')window.saveProjectToFile?.();
      if(action==='export')window.exportWavFile?.();
      if(action==='live')window.top.location.href='../live-loop/';
      if(action==='wave')window.top.location.href='../wave-loom/';
    });

    /* A backdrop closes side sheets and prevents accidental timeline edits behind them. */
    const sideBackdrop=document.createElement('div');
    sideBackdrop.className='lab-mobile-backdrop lab-side-backdrop';
    document.body.appendChild(sideBackdrop);
    const syncSideBackdrop=()=>sideBackdrop.classList.toggle('open',left.classList.contains('open')||inspector.classList.contains('open'));
    sideBackdrop.addEventListener('click',()=>{left.classList.remove('open');inspector.classList.remove('open');syncSideBackdrop();});
    new MutationObserver(syncSideBackdrop).observe(left,{attributes:true,attributeFilter:['class']});
    new MutationObserver(syncSideBackdrop).observe(inspector,{attributes:true,attributeFilter:['class']});

    document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeSheet();left.classList.remove('open');inspector.classList.remove('open');syncSideBackdrop();}});
    window.addEventListener('neusic:studio-stage',event=>syncNav(event.detail?.stage));
    const state=api.state?.();syncNav(state?.stage||'arrange');

    /* Keep the app sized correctly when Safari's address bar changes height. */
    const setViewport=()=>document.documentElement.style.setProperty('--lab-vh',`${window.innerHeight}px`);
    setViewport();window.addEventListener('resize',setViewport,{passive:true});window.visualViewport?.addEventListener('resize',setViewport,{passive:true});
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
