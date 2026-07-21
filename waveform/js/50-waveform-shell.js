/* 50-waveform-shell.js — Waveform shell activation.
   Adapted from ../app/js/42-nw-shell.js + 43-nw-menubar.js: page-specific menubar,
   stub engine functions (real waveform/synth engines land in a later phase),
   panel/view state, and the shared NWDialogs helper for the demo gate. */
(() => {
'use strict';
if (window.__wfShell) return; window.__wfShell = true;

/* ── toast ── */
let toastTimer;
window.toast = window.toast || (msg => {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
});

/* ── shared dialog helpers (same contract as 43-nw-menubar.js) ── */
if (!window.NWDialogs) window.NWDialogs = {
  open(id, title, bodyHTML, footHTML) {
    this.closeAll();
    const scrim = document.createElement('div'); scrim.className = 'nw-scrim'; scrim.dataset.nwScrim = '1';
    scrim.innerHTML = `<div class="nw-dialog" id="${id}" role="dialog" aria-modal="true">
      <header><h2>${title}</h2><button class="nw-btn" data-nw-close>✕</button></header>
      <div class="nw-body">${bodyHTML}</div>${footHTML ? `<footer>${footHTML}</footer>` : ''}</div>`;
    scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('[data-nw-close]')) this.closeAll(); });
    document.body.appendChild(scrim);
    return scrim.querySelector('.nw-dialog');
  },
  closeAll() { document.querySelectorAll('[data-nw-scrim]').forEach(s => s.remove()); },
  about() {
    this.open('nw-about', 'Waveform',
      `<p class="nw-label" style="text-transform:none;letter-spacing:.02em;line-height:1.6">
       Part of the <b>NeusicWave</b> suite — LiveStudio · Waveform · NeusicLab.<br>
       Browser-native sound design. Engines local, projects yours.<br><br>
       <span class="nw-micro">Made by Anderson Paulino</span></p>`);
  },
};

/* ── stub engine (wired by the menubar + transport; real engine is next phase) ── */
const state = { playing: false, armed: false, bpm: 120, view: 'wave' };
window.playAudio = window.togglePlay = () => {
  state.playing = !state.playing;
  const b = document.getElementById('wf-play'); if (b) b.textContent = state.playing ? '❚❚' : '▶';
  window.toast(state.playing ? 'Preview playing' : 'Stopped');
};
window.toggleRecord = () => {
  state.armed = !state.armed;
  document.getElementById('wf-rec')?.classList.toggle('armed', state.armed);
  window.toast(state.armed ? 'Record armed' : 'Record disarmed');
};
window.bpmTap = e => {
  const rect = e.currentTarget.getBoundingClientRect();
  state.bpm = Math.min(220, Math.max(50, state.bpm + (e.clientX > rect.left + rect.width / 2 ? 1 : -1)));
  const d = document.getElementById('wf-bpm'); if (d) d.textContent = state.bpm;
};
window.saveProjectToFile = () => { window.toast('Project saved'); };
window.loadProjectFromFile = () => { window.toast('Open Project — engine lands in the next phase'); };
window.exportWavFile = () => { window.toast('Export WAV — engine lands in the next phase'); };
window.undo = () => window.toast('Nothing to undo');
window.redo = () => window.toast('Nothing to redo');
window.zoomIn = () => window.toast('Zoom in');
window.zoomOut = () => window.toast('Zoom out');
window.wfTool = name => window.toast(name.replace(/-/g, ' ') + ' — engine lands in the next phase');

/* ── panel + view state ── */
const LS = 'nw-wave-shell-state';
const shell = Object.assign({ left: true, right: true, view: 'wave' },
  (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (_) { return {}; } })());
const save = () => { try { localStorage.setItem(LS, JSON.stringify(shell)); } catch (_) {} };

function applyPanels() {
  const b = document.body;
  b.classList.toggle('wf-left-closed', !shell.left);
  b.classList.toggle('wf-right-closed', !shell.right);
  /* mobile slide-overs start closed; togglePanel opens them explicitly */
  if (window.innerWidth > 768) b.classList.remove('wf-left-open', 'wf-right-open');
}
function togglePanel(side) {
  if (window.innerWidth <= 768) {
    document.body.classList.toggle(side === 'left' ? 'wf-left-open' : 'wf-right-open');
    return;
  }
  shell[side] = !shell[side]; save(); applyPanels();
}
function setView(view) {
  shell.view = view; save();
  document.getElementById('wf-wave-view')?.classList.toggle('on', view === 'wave');
  document.getElementById('wf-synth-view')?.classList.toggle('on', view === 'synth');
  document.querySelectorAll('[data-nw-mode]').forEach(x =>
    x.classList.toggle('is-active', x.dataset.nwMode === view));
  if (view === 'wave') drawWave();
}
window.WFShell = { togglePanel, setView, state: shell };

/* ── placeholder waveform ── */
function drawWave() {
  const c = document.getElementById('wf-canvas'); if (!c) return;
  const w = c.clientWidth || 600, h = c.clientHeight || 200;
  c.width = w * devicePixelRatio; c.height = h * devicePixelRatio;
  const g = c.getContext('2d'); g.scale(devicePixelRatio, devicePixelRatio);
  g.clearRect(0, 0, w, h);
  const accent = getComputedStyle(document.body).getPropertyValue('--nw-accent').trim() || '#b0b3b2';
  g.strokeStyle = accent; g.lineWidth = 1; g.globalAlpha = .9;
  g.beginPath();
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const env = Math.sin(Math.PI * t) * (.5 + .5 * Math.sin(t * 41));
    const y = h / 2 + Math.sin(t * 480) * env * h * .38;
    x ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  g.globalAlpha = .35; g.strokeStyle = accent;
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
}

/* ── menubar (FILE / EDIT / VIEW / HELP wired to the stub engine) ── */
const call = (name, ...a) => { const f = window[name]; if (typeof f === 'function') return f(...a); window.toast?.(name + ' unavailable'); };
const MENUS = [
  ['File', [
    ['New Project', () => { if (confirm('Start a new project? Unsaved work is lost.')) location.reload(); }, ''],
    ['Open…', () => call('loadProjectFromFile'), '⌘O'],
    ['Save', () => window.NWDemoGate ? window.NWDemoGate.trySave() : call('saveProjectToFile'), '⌘S'],
    '—',
    ['Export WAV', () => call('exportWavFile'), '⌘E'],
    '—',
    ['Settings…', () => window.NeusicAgent?.openSettings?.(), ','],
  ]],
  ['Edit', [
    ['Undo', () => call('undo'), '⌘Z'],
    ['Redo', () => call('redo'), '⇧⌘Z'],
  ]],
  ['View', [
    ['Toggle Browser', () => togglePanel('left'), '⌘1'],
    ['Toggle Inspector', () => togglePanel('right'), '⌘2'],
    '—',
    ['Waveform Editor', () => setView('wave'), 'F1', 'wave'],
    ['Synth Designer', () => setView('synth'), 'F2', 'synth'],
    '—',
    ['Zoom In', () => call('zoomIn'), '⌘+'],
    ['Zoom Out', () => call('zoomOut'), '⌘−'],
  ]],
  ['Help', [
    ['About Waveform', () => window.NWDialogs.about(), ''],
    ['Keyboard Shortcuts', () => window.toast?.('Shortcuts: Space play · ⌘Z undo · F1–F2 views'), ''],
  ]],
];

function buildMenubar() {
  if (document.getElementById('nw-menubar')) return;
  const bar = document.createElement('nav'); bar.id = 'nw-menubar';
  MENUS.forEach(([label, items]) => {
    const m = document.createElement('div'); m.className = 'nw-menu';
    const b = document.createElement('button'); b.textContent = label;
    b.onclick = e => { e.stopPropagation(); closeMenus(bar, m); m.classList.toggle('open'); };
    const list = document.createElement('div'); list.className = 'nw-menu-list';
    items.forEach(it => {
      if (it === '—') { list.appendChild(document.createElement('hr')); return; }
      const [name, fn, kbd, mode] = it;
      const btn = document.createElement('button');
      btn.innerHTML = `<span>${name}</span><span class="kbd">${kbd || ''}</span>`;
      if (mode) btn.dataset.nwMode = mode;
      btn.onclick = () => { m.classList.remove('open'); fn(); };
      list.appendChild(btn);
    });
    m.append(list); m.prepend(b); bar.appendChild(m);
  });
  const brand = document.createElement('div'); brand.className = 'nw-brand';
  brand.innerHTML = `<i></i><span>WAVEFORM</span>`;
  if (window.NWDemoGate?.isDemo?.() !== false) {
    const tag = document.createElement('span'); tag.className = 'nw-demo-tag'; tag.id = 'nw-demo-tag';
    tag.textContent = 'DEMO'; brand.appendChild(tag);
  }
  bar.appendChild(brand);
  const app = document.getElementById('app');
  (app || document.body).prepend(bar);
  document.addEventListener('click', () => closeMenus(bar));
}
const closeMenus = (bar, except) => bar.querySelectorAll('.nw-menu.open').forEach(m => { if (m !== except) m.classList.remove('open'); });

/* ── left panel stub content ── */
function fillLists() {
  const fill = (id, items) => {
    const box = document.getElementById(id); if (!box) return;
    box.innerHTML = '';
    items.forEach((name, i) => {
      const b = document.createElement('button'); b.textContent = name;
      b.onclick = () => {
        box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        const body = document.getElementById('wf-inspector-body');
        if (body) body.innerHTML = `<div class="nw-label" style="color:var(--nw-accent)">${name}</div>
          <div class="nw-micro" style="margin:6px 0 2px">${id === 'wf-samples' ? 'Sample · 44.1kHz · stereo' : 'Synth preset · 2 osc'}</div>
          <div class="nw-micro">Gain 0.0dB · Pan C · Pitch 0st</div>`;
        if (i >= 0) drawWave();
      };
      box.appendChild(b);
    });
  };
  fill('wf-samples', ['Kick — deep', 'Snare — vinyl', 'Hat — closed', 'Vocal chop 01', 'Bass one-shot']);
  fill('wf-presets', ['Init Saw', 'Glass Keys', 'Rubber Bass', 'Airy Pad', 'Chip Lead']);
}

function boot() {
  buildMenubar();
  fillLists();
  applyPanels(); setView(shell.view);
  window.addEventListener('resize', () => { applyPanels(); if (shell.view === 'wave') drawWave(); });
  window.addEventListener('keydown', e => {
    if (e.key === ' ' && !e.target.closest('input,textarea')) { e.preventDefault(); window.playAudio(); }
    if (e.key === 'F1') { e.preventDefault(); setView('wave'); }
    if (e.key === 'F2') { e.preventDefault(); setView('synth'); }
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
