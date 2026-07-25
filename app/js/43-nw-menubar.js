/* 43-nw-menubar.js — OS-style menubar wired to existing engine functions. */
(() => {
'use strict';
if (window.__nwMenubar) return; window.__nwMenubar = true;

const call = (name, ...a) => { const f = window[name]; if (typeof f === 'function') return f(...a); window.toast?.(name + ' unavailable'); };

const MENUS = [
  ['File', [
    ['New Project', () => { if (confirm('Start a new project? Unsaved work is lost.')) location.reload(); }, ''],
    ['Open…', () => call('loadProjectFromFile'), '⌘O'],
    ['Save', () => window.NWDemoGate ? window.NWDemoGate.trySave() : call('saveProjectToFile'), '⌘S'],
    ['Save As…', () => window.NWDemoGate ? window.NWDemoGate.trySave(true) : call('saveProjectToFile'), ''],
    '—',
    ['Export WAV', () => call('exportWavFile'), '⌘E'],
    '—',
    ['Settings…', () => window.NeusicAgent?.openSettings?.(), ','],
  ]],
  ['Edit', [
    ['Undo', () => call('undo'), '⌘Z'],
    ['Redo', () => call('redo'), '⇧⌘Z'],
    '—',
    ['Select All Clips', () => window.selectAllClips?.() ?? window.toast?.('Select All unavailable'), '⌘A'],
  ]],
  ['View', [
    ['Toggle Left Panel', () => window.NWShell?.togglePanel('left'), '⌘1'],
    ['Toggle Inspector', () => window.NWShell?.togglePanel('right'), '⌘2'],
    '—',
    ['Arrange', () => window.NWShell?.setMode('arrange'), 'F1', 'arrange'],
    ['Mixer', () => window.NWShell?.setMode('mix'), 'F2', 'mix'],
    ['Pads', () => window.NWShell?.setMode('pads'), 'F3', 'pads'],
    ['Keys', () => window.NWShell?.setMode('keys'), 'F4', 'keys'],
    '—',
    ['Zoom In', () => window.zoomIn?.(), '⌘+'],
    ['Zoom Out', () => window.zoomOut?.(), '⌘−'],
  ]],
  ['Help', [
    ['About NeusicLab', () => window.NWDialogs.about(), ''],
    ['Keyboard Shortcuts', () => window.toast?.('Shortcuts: Space play · ⌘Z undo · F1–F4 views'), ''],
  ]],
];

function build() {
  if (document.getElementById('nw-menubar')) return;
  const bar = document.createElement('nav'); bar.id = 'nw-menubar';
  MENUS.forEach(([label, items]) => {
    const m = document.createElement('div'); m.className = 'nw-menu';
    const b = document.createElement('button'); b.textContent = label;
    b.onclick = e => { e.stopPropagation(); close(bar, m); m.classList.toggle('open'); };
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
  brand.innerHTML = `<i></i><span>NEUSICLAB</span>`;
  if (window.NWDemoGate?.isDemo?.() !== false) {
    const tag = document.createElement('span'); tag.className = 'nw-demo-tag'; tag.id = 'nw-demo-tag';
    tag.textContent = 'DEMO'; brand.appendChild(tag);
  }
  bar.appendChild(brand);
  const app = document.getElementById('app');
  (app || document.body).prepend(bar);
  document.addEventListener('click', () => close(bar));
}
const close = (bar, except) => bar.querySelectorAll('.nw-menu.open').forEach(m => { if (m !== except) m.classList.remove('open'); });

/* Shared dialog helpers */
window.NWDialogs = {
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
    this.open('nw-about', 'NeusicLab',
      `<p class="nw-label" style="text-transform:none;letter-spacing:.02em;line-height:1.6">
       Part of the <b>NeusicWave</b> suite — LiveStudio · Waveform · NeusicLab.<br>
       Browser-native production. Engines local, projects yours.<br><br>
       <span class="nw-micro">Made by Anderson Paulino</span></p>`);
  },
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
