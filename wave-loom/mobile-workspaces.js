(() => {
  'use strict';
  if (window.__neusicWaveMobileWorkspaces) return;
  window.__neusicWaveMobileWorkspaces = true;

  const R = window.NeusicWaveReliability;
  const QUERY = matchMedia('(max-width:760px)');
  const WORKSPACES = ['capture','loom','forge','inspect'];
  let active = 'loom';
  let holdTimer = 0;
  let holdStart = null;

  function setWorkspace(name, options = {}) {
    if (!WORKSPACES.includes(name)) return;
    active = name;
    document.body.dataset.waveWorkspace = name;
    document.querySelectorAll('[data-wave-workspace-button]').forEach(button => {
      const selected = button.dataset.waveWorkspaceButton === name;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-current',selected ? 'page' : 'false');
    });
    try { localStorage.setItem('neusic-wave-mobile-workspace',name); } catch (_) {}
    if (options.focus !== false && QUERY.matches) {
      const target = name === 'capture' ? document.querySelector('.capture-rail') : name === 'loom' ? document.querySelector('.loom-stage') : name === 'forge' ? document.querySelector('.forge') : document.querySelector('.inspector');
      target?.scrollIntoView({block:'start'});
    }
  }

  function buildNav() {
    if (document.getElementById('waveWorkspaceNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'waveWorkspaceNav';
    nav.className = 'wave-workspace-nav';
    nav.setAttribute('aria-label','Wave Loom mobile workspaces');
    nav.innerHTML = `<button data-wave-workspace-button="capture"><span>●</span><b>CAPTURE</b></button><button data-wave-workspace-button="loom"><span>≈</span><b>LOOM</b></button><button data-wave-workspace-button="forge"><span>✂</span><b>FORGE</b></button><button data-wave-workspace-button="inspect"><span>◇</span><b>INSPECT</b></button>`;
    document.body.appendChild(nav);
    nav.addEventListener('click',event=>{
      const button=event.target.closest('[data-wave-workspace-button]');
      if(button)setWorkspace(button.dataset.waveWorkspaceButton);
    });
    try { const saved=localStorage.getItem('neusic-wave-mobile-workspace');if(WORKSPACES.includes(saved))active=saved; } catch (_) {}
    setWorkspace(active,{focus:false});
  }

  function addMobileLoomTools() {
    const frame=document.getElementById('loomFrame');
    if(!frame||document.getElementById('mobileLoomTools'))return;
    const tools=document.createElement('div');tools.id='mobileLoomTools';tools.className='mobile-loom-tools';
    tools.innerHTML='<button data-add-node type="button">＋ NODE</button><button data-toggle-spectrum type="button">SPECTRUM</button>';
    frame.appendChild(tools);
    tools.querySelector('[data-add-node]').onclick=()=>addNodeAt(.5,.5);
    tools.querySelector('[data-toggle-spectrum]').onclick=()=>{
      frame.classList.toggle('mobile-spectrum-open');
      tools.querySelector('[data-toggle-spectrum]').classList.toggle('active',frame.classList.contains('mobile-spectrum-open'));
    };
  }

  function addNodeAt(x,y) {
    const loom=R.loom;if(!loom?.getPatch||!loom?.applyPatch)return;
    const patch=loom.getPatch();
    const data=patch.data;
    const start=Number(data.loopStart??.055),end=Number(data.loopEnd??.945),steps=Number(data.snapSteps||16);
    let nodeX=Math.max(start+.01,Math.min(end-.01,x));
    if(data.snapGrid!==false){const ratio=(nodeX-start)/Math.max(.001,end-start);nodeX=start+Math.round(ratio*steps)/steps*(end-start);}
    data.nodes.push({id:R.uid('node'),x:nodeX,y:Math.max(.05,Math.min(.95,y)),velocity:96});
    loom.applyPatch(patch);
    navigator.vibrate?.(20);
    R.setStatus(`Node ${data.nodes.length} added from the mobile Loom workspace.`,'live');
  }

  function installLongPress() {
    const canvas=document.getElementById('loomCanvas');if(!canvas)return;
    const cancel=()=>{clearTimeout(holdTimer);holdTimer=0;holdStart=null;};
    canvas.addEventListener('pointerdown',event=>{
      if(!QUERY.matches||event.pointerType==='mouse')return;
      const rect=canvas.getBoundingClientRect();holdStart={x:event.clientX,y:event.clientY,rx:(event.clientX-rect.left)/rect.width,ry:(event.clientY-rect.top)/rect.height};
      holdTimer=setTimeout(()=>{if(holdStart){addNodeAt(holdStart.rx,holdStart.ry);holdStart=null;}},560);
    },{passive:true});
    canvas.addEventListener('pointermove',event=>{if(holdStart&&Math.hypot(event.clientX-holdStart.x,event.clientY-holdStart.y)>14)cancel();},{passive:true});
    ['pointerup','pointercancel','pointerleave'].forEach(type=>canvas.addEventListener(type,cancel,{passive:true}));
  }

  function syncViewport() {
    document.body.classList.toggle('wave-mobile-workspaces',QUERY.matches);
    if(QUERY.matches)setWorkspace(active,{focus:false});
  }

  R.ready.then(value=>{
    if(!value)return;
    buildNav();addMobileLoomTools();installLongPress();syncViewport();
    QUERY.addEventListener?.('change',syncViewport);
    document.querySelector('.wave-mobile-dock')?.setAttribute('aria-hidden','true');
  });

  window.NeusicWaveMobileWorkspaces={setWorkspace,get active(){return active;}};
})();