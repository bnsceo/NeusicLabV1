(() => {
  'use strict';
  const MODES={
    loom:{title:'The Wave Loom',eyebrow:'WAVE-NATIVE INSTRUMENT',description:'Sculpt sound, timing and harmony directly. Switch modes without leaving the project.',panel:null,engine:'WAVE',inspector:'Wave controls',copy:'The wave is the instrument. Drag nodes for timing and pitch, sculpt the surface for harmonic shape, then move into Arrange or Mix without rebuilding the idea.'},
    arrange:{title:'Arrangement Field',eyebrow:'SONG FORM & TIMELINE',description:'The complete Neusic arranger, tracks, sections, clips and project workflow—focused into one canvas.',panel:null,engine:'DAW',inspector:'Arrangement context',copy:'Build the full record with real Neusic tracks, clips, sections, ripple editing, buses, autosave and offline export.'},
    perform:{title:'Performance Surface',eyebrow:'PADS, PATTERNS & LIVE PLAY',description:'Trigger drums and patterns through the working Neusic performance engine.',panel:'drums',engine:'DAW',inspector:'Performance context',copy:'Finger-drum, shape patterns and route the result into real timeline tracks without leaving this focus mode.'},
    piano:{title:'Instrument Editor',eyebrow:'MIDI COMPOSITION',description:'Piano Roll v2, scale tools, chords, ghost notes, velocity and clip-aware MIDI editing.',panel:'piano',engine:'MIDI',inspector:'MIDI context',copy:'Write detailed MIDI phrases with the completed Piano Roll while the same clips remain playable in Arrange and export.'},
    record:{title:'NeuCapture Studio',eyebrow:'AUDIO & MIDI CAPTURE',description:'Use the working microphone, managed takes, quick comping and MIDI input systems.',panel:'rec',engine:'AUDIO',inspector:'Capture context',copy:'Record into real Neusic tracks, preserve alternate takes and move directly into arrangement or mixing.'},
    mix:{title:'Spatial Mix Environment',eyebrow:'ROUTING, EFFECTS & HEADROOM',description:'Use real buses, returns, inserts, sends, meters and bounce-to-audio in a focused mixer view.',panel:'mixer',engine:'MIX',inspector:'Mix context',copy:'Balance the same session through the working Neusic mixer. Bus routing, returns, effects and export remain fully connected.'}
  };
  const stage=document.querySelector('.stage'),loomFrame=document.getElementById('loomFrame'),studioFrame=document.getElementById('studioFrame');
  const modeButtons=[...document.querySelectorAll('[data-mode]')];
  let currentMode='loom',studioReady=false,loomReady=false,prepareTimer=0;
  const $=id=>document.getElementById(id);

  function studioCore(){
    try{
      const wrapper=studioFrame.contentWindow;
      const inner=wrapper?.document?.getElementById('studio');
      return inner?.contentWindow || null;
    }catch(_){return null;}
  }
  function injectFrameStyle(win,type){
    try{
      const doc=win.document;if(!doc||doc.getElementById('neusic-v2-host-style'))return;
      const style=doc.createElement('style');style.id='neusic-v2-host-style';
      style.textContent=type==='studio'
        ?`#topbar,#toolbar,#mobile-nav,.creator-credit,[data-neusic-creator]{display:none!important}#app{height:100vh!important}#main{top:0!important}.theme-toggle,.copilot-toggle{z-index:50!important}`
        :`.topbar,.creator-credit,[data-neusic-creator]{display:none!important}body{padding-top:0!important}.shell,.app,.workspace{min-height:100vh!important}`;
      doc.head.appendChild(style);
    }catch(_){ }
  }
  function prepareStudio(){
    const core=studioCore();
    if(!core?.document?.body)return false;
    injectFrameStyle(core,'studio');
    studioReady=true;
    document.getElementById('loadingPanel').classList.add('hidden');
    if(currentMode!=='loom')applyStudioMode(currentMode);
    return true;
  }
  function prepareLoom(){
    try{injectFrameStyle(loomFrame.contentWindow,'loom');loomReady=true;document.getElementById('loadingPanel').classList.add('hidden');return true;}catch(_){return false;}
  }
  function ensurePrepared(){
    clearInterval(prepareTimer);let tries=0;
    prepareTimer=setInterval(()=>{tries++;prepareStudio();prepareLoom();if((studioReady&&loomReady)||tries>80)clearInterval(prepareTimer);},150);
  }

  function drawerIsOpen(core){return !!core?.document?.getElementById('drawer')?.classList.contains('open');}
  function applyStudioMode(mode){
    const core=studioCore();if(!core)return;
    const config=MODES[mode];
    try{
      if(config.panel){
        core.openDrawer?.(config.panel);
        const drawer=core.document.getElementById('drawer');drawer?.classList.add('open');
      }else if(drawerIsOpen(core)){
        core.toggleDrawer?.();
        if(drawerIsOpen(core))core.document.getElementById('drawer')?.classList.remove('open');
      }
      core.dispatchEvent?.(new CustomEvent('neusic:focus-mode',{detail:{mode}}));
    }catch(_){ }
  }

  function activateMode(mode){
    if(!MODES[mode])return;currentMode=mode;const config=MODES[mode];
    modeButtons.forEach(button=>button.classList.toggle('active',button.dataset.mode===mode));
    document.querySelectorAll('[data-mode-target]').forEach(button=>button.classList.toggle('active',button.dataset.modeTarget===mode));
    $('modeTitle').textContent=config.title;$('modeEyebrow').textContent=config.eyebrow;$('modeDescription').textContent=config.description;
    $('contextMode').textContent=mode.toUpperCase();$('engineType').textContent=config.engine;$('inspectorTitle').textContent=config.inspector;$('inspectorCopy').textContent=config.copy;
    const useLoom=mode==='loom';loomFrame.classList.toggle('active',useLoom);studioFrame.classList.toggle('active',!useLoom);
    $('engineState').textContent=useLoom?'LOOM READY':'PRODUCTION ENGINE';$('engineLed').style.background=useLoom?'var(--green)':'var(--cyan)';
    if(!useLoom){prepareStudio();applyStudioMode(mode);}else prepareLoom();
    try{localStorage.setItem('neusic-studio-v2-mode',mode);}catch(_){ }
  }

  function clickInside(frame,selector){try{frame.contentWindow?.document?.querySelector(selector)?.click();return true;}catch(_){return false;}}
  function callCore(name,...args){const core=studioCore();try{if(typeof core?.[name]==='function'){return core[name](...args);}}catch(_){ }return undefined;}
  function command(name){
    if(currentMode==='loom'){
      if(name==='play')return clickInside(loomFrame,'#playBtn');
      if(name==='rewind')return clickInside(loomFrame,'#resetBtn');
      if(name==='record')return clickInside(loomFrame,'#captureBtn, #captureButton, [data-action="capture"]');
    }
    const actions={play:()=>callCore('togglePlay'),rewind:()=>callCore('rewind'),record:()=>callCore('toggleRecord'),save:()=>callCore('saveProjectToFile'),export:()=>callCore('exportWavFile'),undo:()=>callCore('undo'),redo:()=>callCore('redo'),theme:()=>{callCore('openThemePanel')??clickCore('#theme-toggle,[data-theme-toggle]');},copilot:()=>{callCore('openCopilot')??clickCore('[data-copilot-toggle],#copilot-toggle');},effects:()=>{activateMode('mix');setTimeout(()=>callCore('openDrawer','fx'),80);}};
    actions[name]?.();
  }
  function clickCore(selector){try{studioCore()?.document?.querySelector(selector)?.click();}catch(_){ }}
  function createTrack(type){
    const core=studioCore();if(!core){activateMode('arrange');return;}
    try{
      const track=core.NeusicTracks?.create?.({type,name:type==='midi'?'New Instrument':type==='beat'?'New Drum Track':type==='bus'?'New Bus':type==='return'?'New Return':'New Audio Track'});
      if(!track&&type==='audio')core.addTrack?.();
      core.renderTracks?.();core.toast?.(`${type} track created`);activateMode('arrange');
    }catch(error){console.warn('Track creation failed',error);}
  }
  function togglePanel(side){stage.classList.toggle(`${side}-open`);}

  document.addEventListener('click',event=>{
    const mode=event.target.closest('[data-mode]')?.dataset.mode;if(mode)activateMode(mode);
    const target=event.target.closest('[data-mode-target]')?.dataset.modeTarget;if(target)activateMode(target);
    const panel=event.target.closest('[data-panel]')?.dataset.panel;if(panel)togglePanel(panel);
    const action=event.target.closest('[data-command]')?.dataset.command;if(action)command(action);
    const type=event.target.closest('[data-create]')?.dataset.create;if(type)createTrack(type);
  });
  document.addEventListener('keydown',event=>{
    if(event.target?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
    if(event.code==='Space'){event.preventDefault();command('play');return;}
    const mode=['loom','arrange','perform','piano','record','mix'][Number(event.key)-1];if(mode)activateMode(mode);
    if(event.key==='[')togglePanel('left');if(event.key===']')togglePanel('right');
  });

  function syncStatus(){
    const core=studioCore();
    if(core){
      try{
        const doc=core.document,state=core.S||{};
        $('timeDisplay').textContent=doc.getElementById('time-disp')?.textContent||'00:00.000';
        $('bpmDisplay').textContent=doc.getElementById('bpm-disp')?.textContent||state.bpm||120;
        $('projectName').textContent=state.projectName||state.name||'Untitled Neusic Session';
        const tracks=state.tracks||[];$('trackCount').textContent=String(tracks.length).padStart(2,'0');$('clipCount').textContent=String(tracks.reduce((sum,track)=>sum+(track.clips?.length||0),0)).padStart(2,'0');
        $('playButton').textContent=state.playing?'Ⅱ':'▶';$('playButton').classList.toggle('playing',!!state.playing);$('recordButton').classList.toggle('recording',!!state.recording);
      }catch(_){ }
    }
    if(currentMode==='loom'){
      try{
        const doc=loomFrame.contentWindow.document;$('bpmDisplay').textContent=doc.getElementById('tempoReadout')?.textContent||$('bpmDisplay').textContent;
        const playing=doc.getElementById('playBtn')?.classList.contains('active')||/pause/i.test(doc.getElementById('playBtn')?.textContent||'');$('playButton').classList.toggle('playing',playing);
      }catch(_){ }
    }
  }

  studioFrame.addEventListener('load',ensurePrepared);loomFrame.addEventListener('load',ensurePrepared);window.addEventListener('resize',()=>{if(window.innerWidth<850){stage.classList.remove('left-open','right-open');}});
  ensurePrepared();setInterval(syncStatus,250);
  let saved='loom';try{saved=localStorage.getItem('neusic-studio-v2-mode')||'loom';}catch(_){ }
  activateMode(MODES[saved]?saved:'loom');
})();
