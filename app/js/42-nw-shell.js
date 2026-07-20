/* 42-nw-shell.js — Four-zone shell activation.
   Preserves every engine; reorganizes the existing regions. */
(() => {
'use strict';
if (window.__nwShell) return; window.__nwShell = true;

const LS = 'nw-shell-state';
const state = Object.assign({ left: true, right: true, mode: 'arrange' },
  (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (_) { return {}; } })());
const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (_) {} };

function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

function buildInspector(main) {
  if (document.getElementById('nw-inspector')) return;
  const insp = el('aside', '', ''); insp.id = 'nw-inspector';
  insp.appendChild(el('button', 'nw-btn nw-panel-toggle', '›')).onclick = () => togglePanel('right');
  const sect = el('div', 'nw-sect');
  sect.appendChild(el('div', 'nw-label', 'Inspector'));
  const body = el('div', '', '<div class="nw-micro" style="margin-top:6px">Select a track or clip</div>');
  body.id = 'nw-inspector-body';
  sect.appendChild(body); insp.appendChild(sect);
  const agent = el('div', 'nw-sect');
  agent.appendChild(el('div', 'nw-label', 'Neusic Agent'));
  const lamp = el('div', 'nw-lamp', '<i></i><span>Checking…</span>'); lamp.id = 'nw-agent-lamp'; lamp.classList.add('busy');
  agent.appendChild(lamp);
  const open = el('button', 'nw-btn', 'Open Assistant'); open.style.marginTop = '8px';
  open.onclick = () => window.NeusicAgent?.openPanel?.();
  agent.appendChild(open); insp.appendChild(agent);
  main.appendChild(insp);
}

function refreshInspector() {
  const body = document.getElementById('nw-inspector-body');
  if (!body || typeof S === 'undefined') return;
  const t = S.tracks?.[S.activeTrack];
  if (!t) { body.innerHTML = '<div class="nw-micro">Select a track or clip</div>'; return; }
  body.innerHTML =
    `<div class="nw-label" style="color:${t.color}">${t.name}</div>
     <div class="nw-micro" style="margin:6px 0 2px">Type ${t.type} · Clips ${t.clips?.length ?? 0}</div>
     <div class="nw-micro">Mute ${t.m ? 'ON' : 'off'} · Solo ${t.s ? 'ON' : 'off'} · Arm ${t.arm ? 'ON' : 'off'}</div>`;
}

function togglePanel(side) {
  state[side] = !state[side]; save(); applyPanels();
}
function applyPanels() {
  const b = document.body;
  b.classList.toggle('nw-left-closed', !state.left);
  b.classList.toggle('nw-right-closed', !state.right);
  b.classList.toggle('nw-left-open', state.left && window.innerWidth <= 768);
  b.classList.toggle('nw-right-open', state.right && window.innerWidth <= 768);
}

function setMode(mode) {
  state.mode = mode; save();
  const b = document.body;
  ['arrange', 'mix', 'pads', 'keys'].forEach(m => b.classList.toggle('nw-mode-' + m, m === mode));
  if (typeof S !== 'undefined' && mode !== 'arrange') {
    S.drawerOpen = true;
    S.activePanel = mode === 'mix' ? 'mixer' : mode === 'pads' ? 'drums' : 'keys';
    window.buildDrawer?.();
  }
  document.querySelectorAll('[data-nw-mode]').forEach(x =>
    x.classList.toggle('is-active', x.dataset.nwMode === mode));
}

function boot() {
  const main = document.getElementById('main');
  if (!main || typeof S === 'undefined') { setTimeout(boot, 120); return; }
  document.body.classList.add('nw-shell');
  document.body.dataset.product = document.body.dataset.product || 'lab';
  buildInspector(main);
  const sb = document.getElementById('sidebar');
  if (sb && !sb.querySelector('.nw-panel-toggle')) {
    const t = el('button', 'nw-btn nw-panel-toggle', '‹'); t.onclick = () => togglePanel('left');
    sb.prepend(t);
  }
  applyPanels(); setMode(state.mode);
  window.addEventListener('resize', applyPanels);
  setInterval(refreshInspector, 800);
  window.NWShell = { togglePanel, setMode, state };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
