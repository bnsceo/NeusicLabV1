/* 45-nw-demo-gate.js — Demo mode: Save is gated behind Pro, Export stays free.
   Pro unlock is a license flag for now; purchase flow lands with the pricing page. */
(() => {
'use strict';
if (window.__nwDemoGate) return; window.__nwDemoGate = true;

const LS = 'nw-license';
const isPro = () => { try { return (JSON.parse(localStorage.getItem(LS)) || {}).pro === true; } catch (_) { return false; } };
const setPro = v => { try { localStorage.setItem(LS, JSON.stringify({ pro: !!v })); } catch (_) {}
  const tag = document.getElementById('nw-demo-tag'); if (tag) tag.style.display = v ? 'none' : ''; };

function ensureGateStyles() {
  if (document.getElementById('nw-gate-style')) return;
  const s = document.createElement('style'); s.id = 'nw-gate-style';
  s.textContent = `
    #nw-gate-scrim{position:fixed;inset:0;z-index:130;display:flex;align-items:center;justify-content:center;
      padding:16px;background:rgba(8,9,9,.55);backdrop-filter:blur(3px);animation:nwGateIn .18s ease}
    #nw-gate-card{width:min(440px,100%);border-radius:8px;padding:26px 24px;text-align:center;
      background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.03));
      border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(18px) saturate(1.2);
      box-shadow:0 20px 60px rgba(0,0,0,.6),inset 0 1px rgba(255,255,255,.22);
      font-family:var(--nw-font,"Arial Narrow",system-ui,sans-serif)}
    #nw-gate-card .lock{width:44px;height:44px;margin:0 auto 14px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-size:20px;
      background:linear-gradient(135deg,var(--nw-accent,#d4a574),var(--nw-accent-deep,#b58b32));
      box-shadow:0 0 18px color-mix(in srgb,var(--nw-accent,#d4a574) 45%,transparent),inset 0 1px rgba(255,255,255,.4)}
    #nw-gate-card h2{margin:0 0 8px;font:700 16px/1.2 var(--nw-font);letter-spacing:.06em;
      text-transform:uppercase;color:#eef1f0}
    #nw-gate-card p{margin:0 0 18px;font:600 12.5px/1.6 var(--nw-font);color:#c6cac8}
    #nw-gate-card .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    #nw-gate-card .up{font:700 11px/1 var(--nw-font);letter-spacing:.1em;text-transform:uppercase;
      padding:12px 20px;border:0;border-radius:4px;cursor:pointer;color:#141210;
      background:linear-gradient(90deg,var(--nw-accent,#d4a574),color-mix(in srgb,var(--nw-accent,#d4a574) 60%,#e8c89a));
      box-shadow:inset 0 1px rgba(255,255,255,.35),0 0 14px color-mix(in srgb,var(--nw-accent,#d4a574) 40%,transparent)}
    #nw-gate-card .ghost{font:700 11px/1 var(--nw-font);letter-spacing:.08em;text-transform:uppercase;
      padding:12px 16px;border:1px solid rgba(255,255,255,.2);border-radius:4px;cursor:pointer;
      background:rgba(255,255,255,.05);color:#c6cac8}
    #nw-gate-card .ghost:hover{background:rgba(255,255,255,.1)}
    #nw-gate-card .key{margin-top:12px;font:600 10px/1 var(--nw-font);letter-spacing:.06em;
      color:#8b918f;background:none;border:0;cursor:pointer;text-decoration:underline}
    @keyframes nwGateIn{from{opacity:0}to{opacity:1}}`;
  document.head.appendChild(s);
}

function gateDialog() {
  ensureGateStyles();
  document.getElementById('nw-gate-scrim')?.remove();
  const scrim = document.createElement('div'); scrim.id = 'nw-gate-scrim';
  scrim.innerHTML = `<div id="nw-gate-card" role="dialog" aria-modal="true">
    <div class="lock">🔒</div>
    <h2>Save is a premium feature</h2>
    <p>Save &amp; Cloud Archiving is a premium feature. Upgrade to Neusic Suite Pro to unlock unlimited projects.</p>
    <div class="row">
      <button class="up" data-up>Upgrade Now</button>
      <button class="ghost" data-close>Continue Demo</button>
    </div>
    <button class="key" data-key>Already purchased? Enter license key</button>
  </div>`;
  scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('[data-close]')) scrim.remove(); });
  const d = scrim;
  document.body.appendChild(scrim);
  d.querySelector('[data-up]').onclick = () => window.open('../#pricing', '_blank');
  d.querySelector('[data-key]').onclick = () => {
    const k = prompt('License key:');
    if (k && k.trim().length >= 8) { setPro(true); window.toast?.('Pro unlocked — Save enabled'); scrim.remove(); }
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
