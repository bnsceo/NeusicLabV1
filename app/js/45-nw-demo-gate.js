/* 45-nw-demo-gate.js — Demo mode: Save is gated behind Pro, Export stays free.
   Pro unlock is a license flag for now; purchase flow lands with the pricing page. */
(() => {
'use strict';
if (window.__nwDemoGate) return; window.__nwDemoGate = true;

const LS = 'nw-license';
const isPro = () => { try { return (JSON.parse(localStorage.getItem(LS)) || {}).pro === true; } catch (_) { return false; } };
const setPro = v => { try { localStorage.setItem(LS, JSON.stringify({ pro: !!v })); } catch (_) {}
  const tag = document.getElementById('nw-demo-tag'); if (tag) tag.style.display = v ? 'none' : ''; };

function gateDialog() {
  const d = window.NWDialogs.open('nw-gate', 'Save is a paid feature', `
    <p>Upgrade to <b>NeusicWave Pro</b> to save your projects.</p>
    <p class="nw-micro" style="margin-top:2px">Demo includes the full studio and WAV export. Pro adds project save/load, all kits untagged, and priority AI features.</p>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <button class="nw-up" data-up>Upgrade Now</button>
      <button class="nw-btn" data-nw-close>Continue Demo</button>
      <button class="nw-btn" data-key title="Already purchased">Enter license key</button></div>`);
  d.querySelector('[data-up]').onclick = () => window.open('../#pricing', '_blank');
  d.querySelector('[data-key]').onclick = () => {
    const k = prompt('License key:');
    if (k && k.trim().length >= 8) { setPro(true); window.toast?.('Pro unlocked — Save enabled'); window.NWDialogs.closeAll(); }
    else if (k != null) window.toast?.('Invalid key');
  };
}

function trySave(saveAs) {
  if (!isPro()) { gateDialog(); return false; }
  return window.saveProjectToFile?.(saveAs);
}

/* Intercept legacy save triggers (buttons + ⌘S) so the gate is universal */
function install() {
  if (typeof window.saveProjectToFile === 'function' && !window.saveProjectToFile.__nwGated) {
    const orig = window.saveProjectToFile;
    const gated = function (...a) { if (!isPro()) { gateDialog(); return; } return orig.apply(this, a); };
    gated.__nwGated = true; window.saveProjectToFile = gated;
  }
  window.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); trySave(); }
  }, true);
  setPro(isPro()); /* sync the DEMO tag */
}

window.NWDemoGate = { isDemo: () => !isPro(), trySave, unlock: () => setPro(true) };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
