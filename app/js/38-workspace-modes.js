(() => {
  'use strict';
  if (window.__neusicWorkspaceModes) return;
  window.__neusicWorkspaceModes = true;

  const MODES = {
    arrange: { label: 'Arrange', code: 'ARR', eyebrow: 'SONG FORM & TIMELINE', panel: null, note: 'Build the complete record with tracks, sections, clips and the project overview.' },
    record: { label: 'Record', code: 'REC', eyebrow: 'CAPTURE & TAKE MANAGEMENT', panel: 'rec', note: 'Record audio or MIDI, manage takes and keep alternate performances connected to the session.' },
    piano: { label: 'Piano', code: 'MIDI', eyebrow: 'NOTE & CHORD EDITOR', panel: 'piano', note: 'Compose and edit MIDI with scale tools, velocity, chords, ghost notes and clip-aware playback.' },
    drums: { label: 'Drums', code: 'DRM', eyebrow: 'PADS & PATTERN PERFORMANCE', panel: 'drums', note: 'Build patterns, finger-drum parts and route the result directly into the arranger.' },
    sampler: { label: 'Sampler', code: 'SMP', eyebrow: 'SLICE & INSTRUMENT DESIGN', panel: 'sampler', note: 'Chop recordings, map slices and turn captured audio into a playable instrument.' },
    mixer: { label: 'Mixer', code: 'MIX', eyebrow: 'ROUTING, BUSES & RETURNS', panel: 'mixer', note: 'Balance the project through channel strips, buses, returns, sends and master processing.' },
    fx: { label: 'Effects', code: 'FX', eyebrow: 'INSERTS & SOUND PROCESSING', panel: 'fx', note: 'Shape the selected source with effects while preserving the same session and routing.' },
    auto: { label: 'Automation', code: 'AUTO', eyebrow: 'PARAMETER MOVEMENT', panel: 'auto', note: 'Draw and refine parameter changes across the song without leaving the production flow.' },
    browser: { label: 'Browser', code: 'LIB', eyebrow: 'PROJECT MEDIA & SOURCES', panel: 'browser', note: 'Find project media, instruments and reusable sources in a dedicated full workspace.' }
  };

  const app = document.getElementById('app');
  const topbar = document.getElementById('topbar');
  const main = document.getElementById('main');
  const drawer = document.getElementById('drawer');
  if (!app || !topbar || !main || !drawer) return;

  const originalOpenDrawer = typeof window.openDrawer === 'function' ? window.openDrawer.bind(window) : null;
  let currentMode = 'arrange';
  let previousEditor = 'piano';

  const shell = document.createElement('div');
  shell.className = 'neusic-workspace-shell';
  shell.dataset.workspace = 'arrange';

  const rail = document.createElement('aside');
  rail.className = 'neusic-workspace-rail';
  rail.setAttribute('aria-label', 'Studio workspaces');
  rail.innerHTML = `<span class="neusic-rail-label">WORKSPACES</span>${Object.entries(MODES).map(([key, mode]) => `<button class="neusic-workspace-button${key === 'arrange' ? ' active' : ''}" type="button" data-workspace="${key}" aria-label="Open ${mode.label} workspace"><i>${mode.code}</i><span>${mode.label}</span></button>`).join('')}`;

  const stage = document.createElement('section');
  stage.className = 'neusic-workspace-stage';
  const header = document.createElement('header');
  header.className = 'neusic-workspace-header';
  header.innerHTML = `<button class="neusic-workspace-back" type="button" aria-label="Back to Arrange">‹</button><div class="neusic-workspace-title"><small id="neusic-workspace-eyebrow">${MODES.arrange.eyebrow}</small><b id="neusic-workspace-title">${MODES.arrange.label}</b></div><div class="neusic-workspace-meta"><i></i><span id="neusic-workspace-project">UNTITLED SESSION</span><span id="neusic-workspace-position">00:00.000</span></div>`;
  const content = document.createElement('div');
  content.className = 'neusic-workspace-content';
  stage.append(header, content);

  const inspector = document.createElement('aside');
  inspector.className = 'neusic-context-inspector';
  inspector.setAttribute('aria-label', 'Context inspector');
  inspector.innerHTML = `<div class="neusic-inspector-head"><small>CONTEXT INSPECTOR</small><b id="neusic-inspector-title">Arrange</b></div><section class="neusic-inspector-section"><small>SESSION</small><div class="neusic-inspector-grid"><div class="neusic-inspector-readout"><small>TRACKS</small><b id="neusic-inspector-tracks">00</b></div><div class="neusic-inspector-readout"><small>CLIPS</small><b id="neusic-inspector-clips">00</b></div><div class="neusic-inspector-readout"><small>TEMPO</small><b id="neusic-inspector-tempo">120</b></div><div class="neusic-inspector-readout"><small>MODE</small><b id="neusic-inspector-mode">ARR</b></div></div></section><section class="neusic-inspector-section"><small>QUICK ACTIONS</small><div class="neusic-inspector-actions"><button type="button" data-ws-action="add">ADD TRACK</button><button type="button" data-ws-action="save">SAVE</button><button type="button" data-ws-action="export">EXPORT</button><a href="../wave-loom/" target="_top">WAVE LOOM</a></div></section><section class="neusic-inspector-section"><small>WORKFLOW</small><p class="neusic-inspector-note" id="neusic-inspector-note">${MODES.arrange.note}</p></section>`;

  shell.append(rail, stage, inspector);
  topbar.after(shell);
  content.append(main, drawer);

  const statusBar = document.createElement('footer');
  statusBar.className = 'neusic-status-bar';
  statusBar.innerHTML = '<span><i></i><b>AUTOSAVE READY</b></span><span id="neusic-status-selection">NO SELECTION</span><span id="neusic-status-workspace">ARRANGE</span><span id="neusic-status-engine">AUDIO ENGINE READY</span>';
  app.appendChild(statusBar);

  const mobileNav = document.createElement('nav');
  mobileNav.className = 'neusic-mobile-nav';
  mobileNav.setAttribute('aria-label', 'Mobile Studio navigation');
  mobileNav.innerHTML = '<button class="active" type="button" data-mobile-workspace="arrange"><i>ARR</i>Arrange</button><button type="button" data-mobile-menu="create"><i>＋</i>Create</button><button type="button" data-mobile-workspace="record"><i>REC</i>Record</button><button type="button" data-mobile-workspace="mixer"><i>MIX</i>Mix</button><button type="button" data-mobile-menu="more"><i>•••</i>More</button>';
  document.body.appendChild(mobileNav);

  const actionLayer = document.createElement('div');
  actionLayer.className = 'neusic-action-layer';
  actionLayer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(actionLayer);

  function menuMarkup(kind) {
    if (kind === 'create') {
      return '<div class="neusic-action-menu" role="dialog" aria-label="Create and compose"><header><span>CREATE & COMPOSE</span><button type="button" data-close-action aria-label="Close">×</button></header><button type="button" data-create-track="audio">NEW AUDIO TRACK</button><button type="button" data-create-track="midi">NEW INSTRUMENT</button><button type="button" data-workspace="piano">PIANO ROLL</button><button type="button" data-workspace="drums">DRUM WORKSPACE</button><button type="button" data-workspace="sampler">SAMPLER</button><a href="../wave-loom/" target="_top">WAVE LOOM</a></div>';
    }
    return '<div class="neusic-action-menu" role="dialog" aria-label="More Studio workspaces"><header><span>MORE WORKSPACES</span><button type="button" data-close-action aria-label="Close">×</button></header><button type="button" data-workspace="browser">BROWSER</button><button type="button" data-workspace="fx">EFFECTS</button><button type="button" data-workspace="auto">AUTOMATION</button><button type="button" data-workspace="sampler">SAMPLER</button><a href="../" target="_top">HOME</a><a href="../wave-loom/" target="_top">WAVE LOOM</a></div>';
  }

  function openActionMenu(kind) {
    actionLayer.innerHTML = menuMarkup(kind);
    actionLayer.classList.add('open');
    actionLayer.setAttribute('aria-hidden', 'false');
  }
  function closeActionMenu() {
    actionLayer.classList.remove('open');
    actionLayer.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (!actionLayer.classList.contains('open')) actionLayer.innerHTML = ''; }, 220);
  }

  function setPanel(panel) {
    if (!panel) return;
    if (originalOpenDrawer) originalOpenDrawer(panel);
    drawer.classList.add('open');
    document.querySelectorAll('#drawer .dpanel').forEach(el => el.classList.toggle('active', el.id === `dp-${panel}`));
    document.querySelectorAll('#drawer .dtabs [data-panel],#drawer .dtabs button').forEach(button => {
      const key = button.dataset.panel || button.dataset.tab || button.id?.replace(/^dt-/, '');
      if (key) button.classList.toggle('active', key === panel);
    });
  }

  function activateWorkspace(mode, options = {}) {
    if (!MODES[mode]) mode = 'arrange';
    currentMode = mode;
    if (mode !== 'arrange') previousEditor = mode;
    const config = MODES[mode];
    shell.dataset.workspace = mode;
    document.getElementById('neusic-workspace-title').textContent = config.label;
    document.getElementById('neusic-workspace-eyebrow').textContent = config.eyebrow;
    document.getElementById('neusic-inspector-title').textContent = config.label;
    document.getElementById('neusic-inspector-note').textContent = config.note;
    document.getElementById('neusic-inspector-mode').textContent = config.code;
    document.getElementById('neusic-status-workspace').textContent = config.label.toUpperCase();
    rail.querySelectorAll('[data-workspace]').forEach(button => button.classList.toggle('active', button.dataset.workspace === mode));
    mobileNav.querySelectorAll('[data-mobile-workspace]').forEach(button => button.classList.toggle('active', button.dataset.mobileWorkspace === mode));
    if (config.panel) setPanel(config.panel);
    closeActionMenu();
    try { localStorage.setItem('neusic-workspace-mode', mode); } catch (_) {}
    window.dispatchEvent(new CustomEvent('neusic:workspace-change', { detail: { mode, panel: config.panel } }));
    if (!options.silent) window.toast?.(`${config.label} workspace`);
  }

  function createTrack(type) {
    try {
      if (type === 'audio') window.addTrack?.();
      else {
        const names = { midi: 'New Instrument', beat: 'New Drum Track' };
        window.NeusicTracks?.create?.({ type, name: names[type] || 'New Track' });
        window.renderTracks?.();
        window.toast?.(`${names[type] || 'Track'} created`);
      }
      activateWorkspace('arrange', { silent: true });
    } catch (error) { console.warn('Workspace track creation failed', error); }
  }

  rail.addEventListener('click', event => {
    const mode = event.target.closest('[data-workspace]')?.dataset.workspace;
    if (mode) activateWorkspace(mode);
  });
  header.querySelector('.neusic-workspace-back').addEventListener('click', () => activateWorkspace('arrange'));
  mobileNav.addEventListener('click', event => {
    const mode = event.target.closest('[data-mobile-workspace]')?.dataset.mobileWorkspace;
    if (mode) return activateWorkspace(mode);
    const menu = event.target.closest('[data-mobile-menu]')?.dataset.mobileMenu;
    if (menu) openActionMenu(menu);
  });
  actionLayer.addEventListener('click', event => {
    if (event.target === actionLayer || event.target.closest('[data-close-action]')) return closeActionMenu();
    const mode = event.target.closest('[data-workspace]')?.dataset.workspace;
    if (mode) return activateWorkspace(mode);
    const type = event.target.closest('[data-create-track]')?.dataset.createTrack;
    if (type) createTrack(type);
  });
  inspector.addEventListener('click', event => {
    const action = event.target.closest('[data-ws-action]')?.dataset.wsAction;
    if (!action) return;
    if (action === 'add') window.addTrack?.();
    if (action === 'save') window.saveProjectToFile?.();
    if (action === 'export') window.exportWavFile?.();
  });

  window.openDrawer = panel => {
    const mode = Object.keys(MODES).find(key => MODES[key].panel === panel) || panel;
    if (MODES[mode]) return activateWorkspace(mode);
    return originalOpenDrawer?.(panel);
  };
  window.toggleDrawer = () => {
    if (currentMode === 'arrange') activateWorkspace(previousEditor || 'piano');
    else activateWorkspace('arrange');
  };
  window.activateNeusicWorkspace = activateWorkspace;

  document.addEventListener('keydown', event => {
    if (event.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key === 'Escape') { closeActionMenu(); if (currentMode !== 'arrange') activateWorkspace('arrange'); return; }
    const shortcuts = { '1': 'arrange', '2': 'record', '3': 'piano', '4': 'drums', '5': 'sampler', '6': 'mixer', '7': 'fx', '8': 'auto', '9': 'browser' };
    if (shortcuts[event.key]) activateWorkspace(shortcuts[event.key]);
  });

  function syncContext() {
    try {
      const tracks = Array.isArray(window.S?.tracks) ? window.S.tracks : [];
      const clips = tracks.reduce((total, track) => total + (Array.isArray(track.clips) ? track.clips.length : 0), 0);
      const bpm = document.getElementById('bpm-disp')?.textContent || window.S?.bpm || 120;
      const time = document.getElementById('time-disp')?.textContent || '00:00.000';
      const name = window.S?.projectName || window.S?.name || 'Untitled Session';
      document.getElementById('neusic-inspector-tracks').textContent = String(tracks.length).padStart(2, '0');
      document.getElementById('neusic-inspector-clips').textContent = String(clips).padStart(2, '0');
      document.getElementById('neusic-inspector-tempo').textContent = String(bpm).trim();
      document.getElementById('neusic-workspace-project').textContent = String(name).toUpperCase().slice(0, 28);
      document.getElementById('neusic-workspace-position').textContent = String(time).trim();
      const selected = document.querySelector('.track-row.selected,.track.selected,[data-track-id].selected,.clip.selected,.midi-note.selected');
      document.getElementById('neusic-status-selection').textContent = selected?.getAttribute('data-name') || selected?.textContent?.trim().slice(0, 48) || 'NO SELECTION';
    } catch (_) {}
  }
  syncContext();
  setInterval(syncContext, 500);

  let saved = 'arrange';
  try { saved = localStorage.getItem('neusic-workspace-mode') || 'arrange'; } catch (_) {}
  activateWorkspace(MODES[saved] ? saved : 'arrange', { silent: true });
})();
