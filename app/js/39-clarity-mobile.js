(() => {
  'use strict';
  if (window.__neusicClarityMobile) return;
  window.__neusicClarityMobile = true;

  const ICONS = {
    undo:'<path d="M9 7H4v-5"/><path d="M4 7c2-3 5-4 8-3 4 1 6 5 5 9-1 4-5 6-9 5"/>',
    redo:'<path d="M15 7h5v-5"/><path d="M20 7c-2-3-5-4-8-3-4 1-6 5-5 9 1 4 5 6 9 5"/>',
    rewind:'<path d="M11 6 5 12l6 6V6Z"/><path d="M19 6 13 12l6 6V6Z"/>',
    play:'<path d="m8 5 11 7-11 7V5Z"/>',
    record:'<circle cx="12" cy="12" r="6"/>',
    save:'<path d="M5 4h12l2 2v14H5V4Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    open:'<path d="M3 7h7l2 2h9l-2 10H5L3 7Z"/><path d="M5 7V4h12v5"/>',
    export:'<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v6h14v-6"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    drums:'<ellipse cx="12" cy="13" rx="7" ry="4"/><path d="M5 13v4c0 2 3 4 7 4s7-2 7-4v-4M8 3l4 7M16 3l-4 7"/>',
    piano:'<path d="M3 6h18v12H3V6Z"/><path d="M7 6v12M11 6v12M15 6v12M19 6v12M5 6v6M9 6v6M13 6v6M17 6v6"/>',
    sampler:'<path d="M4 17h16M5 14l2-6 3 4 3-8 3 10 3-6"/>',
    browser:'<path d="M3 6h7l2 2h9v11H3V6Z"/><path d="M7 13h10"/>',
    fx:'<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h8M16 17h4"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="17" r="2"/>',
    mixer:'<path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="7" width="4" height="5" rx="1"/><rect x="10" y="12" width="4" height="5" rx="1"/><rect x="16" y="6" width="4" height="5" rx="1"/>',
    automation:'<path d="M3 17c4 0 4-10 8-10s4 8 10 2"/><circle cx="3" cy="17" r="1.5"/><circle cx="11" cy="7" r="1.5"/><circle cx="21" cy="9" r="1.5"/>',
    mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    project:'<path d="M5 3h10l4 4v14H5V3Z"/><path d="M15 3v5h5M8 12h8M8 16h8"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1-2-4-2 1a7 7 0 0 0-2-1l-.3-2h-5l-.3 2a7 7 0 0 0-2 1l-2-1-2 4 2 1a7 7 0 0 0 0 2l-2 1 2 4 2-1a7 7 0 0 0 2 1l.3 2h5l.3-2a7 7 0 0 0 2-1l2 1 2-4-2-1a7 7 0 0 0 .1-1Z"/>'
  };
  const svg = name => `<svg class="neusic-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.menu}</svg>`;
  const decorate = (button, icon, label, visible = false) => {
    if (!button) return;
    button.innerHTML = `${svg(icon)}${visible ? `<span class="tb-action-label">${label}</span>` : ''}`;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.dataset.neusicTooltip = label;
    if (visible) button.classList.add('neusic-labeled-action');
  };

  decorate(document.getElementById('btn-undo'),'undo','Undo');
  decorate(document.getElementById('btn-redo'),'redo','Redo');
  decorate(document.getElementById('btn-rew'),'rewind','Rewind');
  decorate(document.getElementById('btn-play'),'play','Play or pause');
  decorate(document.getElementById('btn-rec'),'record','Record');
  decorate(document.querySelector('button[onclick^="saveProjectToFile"]'),'save','Save',true);
  decorate(document.querySelector('button[onclick^="triggerLoadProject"]'),'open','Open',true);
  decorate(document.querySelector('button[onclick^="exportWavFile"]'),'export','Export',true);
  decorate(document.getElementById('btn-sb'),'menu','Menu',true);

  const zoom = document.querySelector('.zoom-group');
  if (zoom && !zoom.querySelector('.zoom-caption')) {
    const caption = document.createElement('span');
    caption.className = 'zoom-caption';
    caption.textContent = 'TIMELINE ZOOM';
    zoom.prepend(caption);
    zoom.setAttribute('aria-label','Timeline zoom');
    zoom.title = 'Timeline zoom — this does not change tempo';
  }

  document.querySelector('.add-track-row')?.setAttribute('role','button');
  document.querySelector('.add-track-row')?.setAttribute('aria-label','Add a new track to the timeline');

  const toolMap = [
    ['tb-drums','drums'],['tb-piano','piano'],['tb-sampler','sampler'],['tb-browser','browser'],
    ['tb-fx','fx'],['tb-mixer','mixer'],['tb-auto','automation'],['tb-rec','mic']
  ];
  toolMap.forEach(([id,icon]) => {
    const host=document.querySelector(`#${id} .ico`);
    if(host)host.innerHTML=svg(icon);
  });
  const mobileMap = [
    ['projects','project'],['browser','browser'],['record','mic'],['settings','settings']
  ];
  mobileMap.forEach(([key,icon])=>{
    const button=document.querySelector(`#mobile-nav button[onclick*="'${key}'"]`);
    const host=button?.querySelector('.mob-ico');
    if(host)host.innerHTML=svg(icon);
  });
  const mobileCenter=document.querySelector('.mob-center-wrap');
  if(mobileCenter)mobileCenter.innerHTML=svg('mixer');

  const menu=document.getElementById('ctx-menu');
  if(menu && !menu.querySelector('.ctx-group-label')) {
    const items=[...menu.querySelectorAll('.ctx-item')];
    const addLabel=(target,text)=>{if(!target)return;const label=document.createElement('div');label.className='ctx-group-label';label.textContent=text;target.before(label);};
    addLabel(items.find(item=>item.getAttribute('onclick')?.includes('ctxSplit')),'Edit');
    addLabel(items.find(item=>item.getAttribute('onclick')?.includes('ctxFadeIn')),'Shape');
    addLabel(items.find(item=>item.getAttribute('onclick')?.includes('ctxBounce')),'Render');
    items.forEach(item=>{
      const action=item.getAttribute('onclick')||'';
      if(action.includes('ctxDelete'))item.setAttribute('aria-label','Delete selected clip');
    });
  }

  document.querySelectorAll('input[type="range"],input[type="number"],select').forEach(control=>{
    if(control.getAttribute('aria-label'))return;
    const label=control.closest('label');
    const text=label?.textContent?.replace(control.value||'','').trim();
    if(text)control.setAttribute('aria-label',text.slice(0,80));
  });

  const explainZoom = document.createElement('div');
  explainZoom.id='neusic-zoom-explainer';
  explainZoom.hidden=true;
  explainZoom.textContent='Timeline zoom changes horizontal detail only. Tempo remains unchanged.';
  document.body.appendChild(explainZoom);
})();
