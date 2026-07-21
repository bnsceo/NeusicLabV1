/* 52-livestudio-shell.js — LiveStudio loop-station shell.
   Adapted from ../waveform/js/50-waveform-shell.js: simplified menubar
   (New / Open / Export / Settings; Save behind Pro), 16-slot loop grid,
   trigger pads, and stub engine functions (real looper lands in a later phase). */
(() => {
'use strict';
if (window.__lsShell) return; window.__lsShell = true;

/* performance mode defaults to "live" on this page (before 44-nw-agent.js reads prefs) */
try {
  const k = 'nw-agent-prefs';
  const p = JSON.parse(localStorage.getItem(k)) || {};
  if (!p.performanceMode) { p.performanceMode = 'live'; localStorage.setItem(k, JSON.stringify(p)); }
} catch (_) {}

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
    this.open('nw-about', 'LiveStudio',
      `<p class="nw-label" style="text-transform:none;letter-spacing:.02em;line-height:1.6">
       Part of the <b>NeusicWave</b> suite — LiveStudio · Waveform · NeusicLab.<br>
       Browser-native live looping. Engines local, projects yours.<br><br>
       <span class="nw-micro">Made by Anderson Paulino</span></p>`);
  },
};

/* ── loop model (stub; real looper engine is next phase) ── */
const SLOTS = 16;
const loops = Array.from({ length: SLOTS }, (_, i) => ({ i, filled: i < 3, playing: false, name: i < 3 ? ['Drums A', 'Bass', 'Keys'][i] : 'Empty ' + (i + 1) }));
const state = { playing: false, armed: false, bpm: 120, bars: 4, selected: 0 };

window.togglePlay = () => {
  state.playing = !state.playing;
  const b = document.getElementById('ls-play'); if (b) b.textContent = state.playing ? '■' : '▶';
  loops.forEach(l => { l.playing = state.playing && l.filled; });
  renderGrid(); renderTracks();
  window.toast(state.playing ? 'Loops running' : 'Stopped');
};
window.toggleRecord = () => {
  state.armed = !state.armed;
  document.getElementById('ls-rec')?.classList.toggle('armed', state.armed);
  window.toast(state.armed ? 'Record armed — tap a slot to capture' : 'Record disarmed');
};
window.bpmTap = e => {
  const rect = e.currentTarget.getBoundingClientRect();
  state.bpm = Math.min(220, Math.max(50, state.bpm + (e.clientX > rect.left + rect.width / 2 ? 1 : -1)));
  const d = document.getElementById('ls-bpm'); if (d) d.textContent = state.bpm;
};
window.cycleLoopLen = () => {
  state.bars = { 1: 2, 2: 4, 4: 8, 8: 1 }[state.bars];
  const d = document.getElementById('ls-len'); if (d) d.textContent = state.bars;
  window.toast('Loop length: ' + state.bars + ' bars');
};
window.saveProjectToFile = () => { window.toast('Project saved'); };
window.loadProjectFromFile = () => { window.toast('Open Project — engine lands in the next phase'); };
window.exportWavFile = () => { window.toast('Export WAV — engine lands in the next phase'); };

/* ── panel state ── */
const LS = 'nw-live-shell-state';
const shell = Object.assign({ left: true, right: true },
  (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (_) { return {}; } })());
const save = () => { try { localStorage.setItem(LS, JSON.stringify(shell)); } catch (_) {} };
function applyPanels() {
  const b = document.body;
  b.classList.toggle('ls-left-closed', !shell.left);
  b.classList.toggle('ls-right-closed', !shell.right);
  /* mobile slide-overs start closed; togglePanel opens them explicitly */
  if (window.innerWidth > 768) b.classList.remove('ls-left-open', 'ls-right-open');
}
function togglePanel(side) {
  if (window.innerWidth <= 768) {
    document.body.classList.toggle(side === 'left' ? 'ls-left-open' : 'ls-right-open');
    return;
  }
  shell[side] = !shell[side]; save(); applyPanels();
}
window.LSShell = { togglePanel, state: shell };

/* ── current-loop display ── */
function drawLoop() {
  const c = document.getElementById('ls-canvas'); if (!c) return;
  const w = c.clientWidth || 600, h = c.clientHeight || 110;
  c.width = w * devicePixelRatio; c.height = h * devicePixelRatio;
  const g = c.getContext('2d'); g.scale(devicePixelRatio, devicePixelRatio);
  g.clearRect(0, 0, w, h);
  const accent = getComputedStyle(document.body).getPropertyValue('--nw-accent').trim() || '#c97d5a';
  const loop = loops[state.selected];
  g.strokeStyle = accent; g.globalAlpha = loop.filled ? .9 : .3; g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const y = h / 2 + Math.sin(t * 220 + state.selected * 7) * Math.sin(Math.PI * t) * h * .36;
    x ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
}

/* ── loop grid (4×4) ── */
function renderGrid() {
  const grid = document.getElementById('ls-grid'); if (!grid) return;
  grid.innerHTML = '';
  loops.forEach(l => {
    const s = document.createElement('button');
    s.className = 'ls-slot' + (l.filled ? ' filled' : '') + (l.playing ? ' playing' : '');
    s.innerHTML = `<span class="nw-micro">${String(l.i + 1).padStart(2, '0')}</span>${l.filled ? l.name : '·'}`;
    s.onclick = () => {
      state.selected = l.i;
      if (state.armed && !l.filled) {
        l.filled = true; l.name = 'Take ' + (l.i + 1); l.playing = state.playing;
        s.classList.add('recording');
        window.toast('Loop captured to slot ' + (l.i + 1));
        setTimeout(() => { renderGrid(); renderTracks(); }, 350);
      } else if (l.filled) {
        l.playing = !l.playing;
        renderGrid(); renderTracks();
      }
      inspect(l); drawLoop();
    };
    grid.appendChild(s);
  });
}

/* ── left rows: mute/solo/volume per loop ── */
function renderTracks() {
  const box = document.getElementById('ls-tracks'); if (!box) return;
  box.innerHTML = '';
  loops.forEach(l => {
    const row = document.createElement('div'); row.className = 'ls-track';
    row.innerHTML = `<span class="num">${String(l.i + 1).padStart(2, '0')}</span>
      <span class="name${l.filled ? ' filled' : ''}">${l.name}</span>
      <button class="ls-ms${l.muted ? ' on' : ''}" data-m title="Mute">M</button>
      <button class="ls-ms${l.solo ? ' on' : ''}" data-s title="Solo">S</button>
      <input type="range" min="0" max="100" value="${l.vol ?? 80}" title="Volume">`;
    row.querySelector('[data-m]').onclick = () => { l.muted = !l.muted; renderTracks(); };
    row.querySelector('[data-s]').onclick = () => { l.solo = !l.solo; renderTracks(); };
    row.querySelector('input').oninput = e => { l.vol = +e.target.value; };
    row.querySelector('.name').onclick = () => { state.selected = l.i; inspect(l); drawLoop(); };
    box.appendChild(row);
  });
}

function inspect(l) {
  const body = document.getElementById('ls-inspector-body'); if (!body) return;
  body.innerHTML = `<div class="nw-label" style="color:var(--nw-accent)">${l.name}</div>
    <div class="nw-micro" style="margin:6px 0 2px">Slot ${l.i + 1} · ${l.filled ? state.bars + ' bars @ ' + state.bpm + ' BPM' : 'empty'}</div>
    <div class="nw-micro">Decay 100% · Pitch 0st · Pan C · Send 0%</div>`;
}

/* ── trigger pads ── */
function renderPads() {
  const row = document.getElementById('ls-pad-row'); if (!row) return;
  const NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C+'];
  NOTES.forEach(n => {
    const p = document.createElement('button'); p.className = 'ls-pad'; p.textContent = n;
    p.onpointerdown = () => { p.classList.add('hit'); };
    p.onpointerup = p.onpointerleave = () => p.classList.remove('hit');
    row.appendChild(p);
  });
}

/* ── simplified menubar: New / Open / Export / Settings; Save behind Pro ── */
const call = (name, ...a) => { const f = window[name]; if (typeof f === 'function') return f(...a); window.toast?.(name + ' unavailable'); };
const MENUS = [
  ['File', [
    ['New Session', () => { if (confirm('Start a new session? Unsaved loops are lost.')) location.reload(); }, ''],
    ['Open…', () => call('loadProjectFromFile'), '⌘O'],
    ['Save', () => window.NWDemoGate ? window.NWDemoGate.trySave() : call('saveProjectToFile'), '⌘S'],
    '—',
    ['Export WAV', () => call('exportWavFile'), '⌘E'],
    '—',
    ['Settings…', () => window.NeusicAgent?.openSettings?.(), ','],
  ]],
  ['Edit', [
    ['Clear Selected Loop', () => {
      const l = loops[state.selected];
      if (l.filled) { l.filled = false; l.playing = false; l.name = 'Empty ' + (l.i + 1); renderGrid(); renderTracks(); inspect(l); drawLoop(); }
    }, '⌫'],
  ]],
  ['View', [
    ['Toggle Loop Tracks', () => togglePanel('left'), '⌘1'],
    ['Toggle Inspector', () => togglePanel('right'), '⌘2'],
  ]],
  ['Help', [
    ['About LiveStudio', () => window.NWDialogs.about(), ''],
    ['Keyboard Shortcuts', () => window.toast?.('Shortcuts: Space play · R record arm'), ''],
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
      const [name, fn, kbd] = it;
      const btn = document.createElement('button');
      btn.innerHTML = `<span>${name}</span><span class="kbd">${kbd || ''}</span>`;
      btn.onclick = () => { m.classList.remove('open'); fn(); };
      list.appendChild(btn);
    });
    m.append(list); m.prepend(b); bar.appendChild(m);
  });
  const brand = document.createElement('div'); brand.className = 'nw-brand';
  brand.innerHTML = `<i></i><span>LIVESTUDIO</span>`;
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

function boot() {
  buildMenubar();
  renderGrid(); renderTracks(); renderPads();
  inspect(loops[0]); drawLoop();
  applyPanels();
  window.addEventListener('resize', () => { applyPanels(); drawLoop(); });
  window.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea')) return;
    if (e.key === ' ') { e.preventDefault(); window.togglePlay(); }
    if (e.key.toLowerCase() === 'r') window.toggleRecord();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
