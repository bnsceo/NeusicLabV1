(() => {
  'use strict';
  if(window.__neusicExperiencePolish)return;window.__neusicExperiencePolish=true;
  const topbar=document.getElementById('topbar'),tracksArea=document.getElementById('tracks-area');
  if(topbar){
    const links=document.createElement('div');links.className='neusic-page-links';links.innerHTML='<a href="../" target="_top" aria-label="Neusic landing page">HOME</a><a href="../wave-loom/" target="_top" aria-label="Open Wave Loom">LOOM</a>';
    const spacer=topbar.querySelector('.tb-spacer');topbar.insertBefore(links,spacer||null);
    const pill=document.createElement('span');pill.className='neusic-engine-pill';pill.innerHTML='<i></i> ENGINE READY';topbar.insertBefore(pill,spacer||null);
  }
  const empty=document.createElement('div');empty.className='neusic-empty-state';empty.innerHTML='<div class="neusic-empty-card"><small>START A SESSION</small><h2>Make the first sound.</h2><p>Add a track, record an idea, or open an instrument. Neusic will keep the session autosaved while you build.</p><div class="neusic-quick-grid"><button data-quick="audio"><b>AUDIO</b>New track</button><button data-quick="midi"><b>MIDI</b>Instrument</button><button data-quick="beat"><b>DRUMS</b>Beat track</button><button data-quick="record"><b>REC</b>Capture</button></div></div>';
  tracksArea?.appendChild(empty);
  empty.addEventListener('click',event=>{const type=event.target.closest('[data-quick]')?.dataset.quick;if(!type)return;try{if(type==='record')return window.openDrawer?.('rec');if(type==='audio')return window.addTrack?.();const names={midi:'New Instrument',beat:'New Drum Track'};window.NeusicTracks?.create?.({type,name:names[type]});window.renderTracks?.();window.toast?.(`${names[type]} created`);}catch(error){console.warn(error)}});
  const rotate=document.createElement('div');rotate.className='neusic-rotate-note';rotate.textContent='ROTATE FOR A WIDER TIMELINE';document.body.appendChild(rotate);
  function updateEmpty(){try{const count=Array.isArray(window.S?.tracks)?window.S.tracks.length:document.querySelectorAll('#tracks-inner [data-track-id],#tracks-inner .track-row').length;empty.classList.toggle('show',count===0);}catch(_){empty.classList.remove('show')}}
  updateEmpty();setInterval(updateEmpty,900);
  function showError(message){if(document.querySelector('.neusic-runtime-error'))return;const box=document.createElement('div');box.className='neusic-runtime-error';box.innerHTML=`<span><b>Neusic recovered from a UI error.</b><br>${String(message||'Reload the page if a control stopped responding.').slice(0,180)}</span><button aria-label="Dismiss">×</button>`;box.querySelector('button').onclick=()=>box.remove();document.body.appendChild(box);setTimeout(()=>box.remove(),9000)}
  addEventListener('error',event=>{if(event?.error)showError(event.error.message)});addEventListener('unhandledrejection',event=>showError(event.reason?.message||event.reason));
  document.querySelectorAll('button').forEach(button=>{if(!button.getAttribute('aria-label')&&button.title)button.setAttribute('aria-label',button.title)});
})();