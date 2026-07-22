(() => {
  'use strict';
  const previews=[...document.querySelectorAll('[data-preview]')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const status=(preview,message)=>{const el=preview.querySelector('.preview-demo-status');if(el)el.textContent=message;};

  function installStudioIdentity(){
    document.title='Neusic — Connected DAW & Music Production Studio';
    const description=document.querySelector('meta[name="description"]');
    if(description)description.content='Neusic is a connected digital audio workstation and music production studio for live looping, sound design, recording, arranging, mixing, mastering, and export.';

    const hero=document.querySelector('.hero-content');
    const statement=hero?.querySelector('.hero-statement');
    const copy=hero?.querySelector('.hero-copy');
    if(!hero||hero.querySelector('.daw-identity'))return;

    const identity=document.createElement('div');
    identity.className='daw-identity';
    identity.setAttribute('aria-label','Neusic is digital audio workstation and studio software');
    identity.innerHTML='<span class="daw-pulse" aria-hidden="true"></span><div><small>DIGITAL AUDIO WORKSTATION · MUSIC PRODUCTION STUDIO</small><b>A complete studio system for capturing, shaping, arranging, mixing, and finishing music.</b></div>';
    hero.insertBefore(identity,statement||hero.firstChild);

    if(statement)statement.textContent='Capture the performance. Design the sound. Produce the record.';
    if(copy)copy.textContent='Neusic is a connected DAW and studio environment built as three focused creative instruments: Live Loop for performance capture, Wave for sound design, and Lab for recording, arrangement, mixing, mastering, and delivery.';

    const style=document.createElement('style');
    style.textContent=`
      .daw-identity{display:inline-flex;align-items:center;gap:12px;max-width:min(760px,100%);margin:18px auto 22px;padding:11px 15px 11px 12px;border:1px solid rgba(206,224,233,.22);border-radius:999px;background:linear-gradient(110deg,rgba(15,22,27,.84),rgba(28,37,43,.42));box-shadow:inset 0 1px rgba(255,255,255,.05),0 14px 44px rgba(0,0,0,.28);backdrop-filter:blur(14px);text-align:left}
      .daw-pulse{position:relative;flex:0 0 34px;width:34px;height:34px;border:1px solid rgba(222,239,246,.34);border-radius:50%;background:radial-gradient(circle at 42% 38%,rgba(255,255,255,.2),rgba(113,153,173,.08) 42%,rgba(0,0,0,.12) 68%)}
      .daw-pulse:before,.daw-pulse:after{content:"";position:absolute;inset:8px;border:1px solid rgba(210,232,242,.42);border-radius:50%}
      .daw-pulse:after{inset:14px;background:#d7e7ed;box-shadow:0 0 16px rgba(178,220,237,.7)}
      .daw-identity div{display:grid;gap:3px;min-width:0}
      .daw-identity small{color:#aebdc4;font:700 9px/1.2 var(--mono,"JetBrains Mono",monospace);letter-spacing:.17em}
      .daw-identity b{color:#e9f0f3;font:650 clamp(11px,1.15vw,14px)/1.35 var(--sans,"Satoshi",sans-serif);letter-spacing:.01em}
      @media(max-width:680px){.daw-identity{width:100%;border-radius:12px;margin:14px 0 18px;padding:10px}.daw-pulse{flex-basis:30px;width:30px;height:30px}.daw-identity small{font-size:7px;letter-spacing:.11em}.daw-identity b{font-size:11px}}
    `;
    document.head.appendChild(style);
  }

  function panel(preview,actions){
    const root=document.createElement('div');root.className='preview-demo-panel';
    root.innerHTML=actions.map(([id,label])=>`<button type="button" data-demo-action="${id}">${label}</button>`).join('')+'<span class="preview-demo-status" aria-live="polite">MOCK READY</span>';
    const foot=preview.querySelector('.preview-foot');preview.insertBefore(root,foot||null);return root;
  }

  function live(preview){
    const controls=panel(preview,[['record','Record'],['overdub','Overdub'],['mute','Mute'],['reset','Reset']]);
    const rings=[...preview.querySelectorAll('.loop-ring')];let selected=0,recording=false,overdub=false,muted=false;
    const select=index=>{selected=index;rings.forEach((ring,i)=>ring.classList.toggle('mock-active',i===index));status(preview,`LANE ${String(index+1).padStart(2,'0')} SELECTED`)};
    rings.forEach((ring,index)=>{ring.type='button';ring.setAttribute('aria-label',`Select mock loop lane ${index+1}`);ring.addEventListener('click',()=>select(index));});
    controls.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const action=button.dataset.demoAction;
      if(action==='record'){recording=!recording;overdub=false;preview.classList.toggle('demo-recording',recording);controls.querySelector('[data-demo-action="overdub"]').classList.remove('active');button.classList.toggle('active',recording);preview.querySelector('.preview-top b').textContent=recording?'RECORDING':'LIVE';status(preview,recording?`CAPTURING LANE ${selected+1}`:'LOOP CAPTURED');}
      if(action==='overdub'){overdub=!overdub;recording=false;preview.classList.remove('demo-recording');controls.querySelector('[data-demo-action="record"]').classList.remove('active');button.classList.toggle('active',overdub);preview.querySelector('.preview-top b').textContent=overdub?'OVERDUB':'LIVE';status(preview,overdub?`STACKING LANE ${selected+1}`:'OVERDUB COMMITTED');}
      if(action==='mute'){muted=!muted;preview.classList.toggle('demo-muted',muted);button.classList.toggle('active',muted);status(preview,muted?'MASTER MUTED':'MASTER ACTIVE');}
      if(action==='reset'){recording=overdub=muted=false;preview.classList.remove('demo-recording','demo-muted');controls.querySelectorAll('button').forEach(item=>item.classList.remove('active'));preview.querySelector('.preview-top b').textContent='LIVE';select(0);status(preview,'MOCK RESET');}
    });select(0);
  }

  function wave(preview){
    const controls=panel(preview,[['sculpt','Sculpt'],['slice','Slice'],['morph','Morph'],['reset','Reset']]);
    const nodes=[...preview.querySelectorAll('.wave-nodes circle')];let selected=0;
    const choose=index=>{selected=index;nodes.forEach((node,i)=>node.classList.toggle('mock-selected',i===index));status(preview,`NODE ${String(index+1).padStart(2,'0')} · ${['C4','D#4','F4','G4','A#4','C5','D#5'][index]||'C4'}`)};
    nodes.forEach((node,index)=>{node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label',`Select mock wave node ${index+1}`);node.addEventListener('click',()=>choose(index));node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(index)}})});
    controls.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const action=button.dataset.demoAction;controls.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button&&action!=='reset'));preview.classList.remove('demo-sculpting','demo-slice','demo-morph');
      if(action==='sculpt'){preview.classList.add('demo-sculpting');status(preview,'GEOMETRY RESPONDING');}
      if(action==='slice'){preview.classList.add('demo-slice');status(preview,'7 TRANSIENTS FOUND');}
      if(action==='morph'){preview.classList.add('demo-morph');const out=preview.querySelector('.wave-readouts span:nth-child(3) b');if(out)out.textContent=String(31+Math.floor(Math.random()*55));status(preview,'TIMBRE MORPHING');}
      if(action==='reset'){choose(0);controls.querySelectorAll('button').forEach(item=>item.classList.remove('active'));status(preview,'PATCH RESTORED');}
    });choose(0);
  }

  function lab(preview){
    const controls=panel(preview,[['play','Play'],['arrange','Arrange'],['mix','Mix'],['export','Export']]);
    const tracks=[...preview.querySelectorAll('.lab-tracks span')];let playing=false;
    tracks.forEach((track,index)=>track.addEventListener('click',()=>{tracks.forEach((item,i)=>item.classList.toggle('mock-selected',i===index));status(preview,`${track.textContent} TRACK SELECTED`)}));
    controls.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const action=button.dataset.demoAction;
      if(action==='play'){playing=!playing;preview.classList.toggle('demo-playing',playing);button.classList.toggle('active',playing);button.textContent=playing?'Pause':'Play';status(preview,playing?'ARRANGEMENT PLAYING':'TRANSPORT PAUSED');return;}
      controls.querySelectorAll('button:not([data-demo-action="play"])').forEach(item=>item.classList.toggle('active',item===button));preview.dataset.labView=action;status(preview,action==='arrange'?'TIMELINE WORKSPACE':action==='mix'?'MIX CONSOLE ACTIVE':'EXPORT CHECK READY');
    });tracks[0]?.classList.add('mock-selected');preview.dataset.labView='arrange';
  }

  installStudioIdentity();
  previews.forEach(preview=>{preview.classList.add('interactive-preview');preview.tabIndex=0;preview.setAttribute('aria-description','Interactive visual mockup. It does not record, process, or save audio.');const type=preview.dataset.preview;if(type==='live-loop')live(preview);if(type==='wave')wave(preview);if(type==='lab')lab(preview);if(!reduced)preview.addEventListener('pointermove',event=>{const r=preview.getBoundingClientRect();preview.style.setProperty('--mock-x',`${((event.clientX-r.left)/r.width*100).toFixed(1)}%`);preview.style.setProperty('--mock-y',`${((event.clientY-r.top)/r.height*100).toFixed(1)}%`);});});
})();