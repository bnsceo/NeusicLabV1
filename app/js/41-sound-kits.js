/* 41-sound-kits.js — NEUSIC multi-kit drum engine.
   Five kits × 16 pads. Parameterizes the synthesis recipes from 02-audio-engine
   and replaces Audio_.synthDrum with a kit-aware version. The active kit lives
   in S.drumKit so it saves/loads with the project like everything else. */
(() => {
'use strict';
if (window.__neusicSoundKits) return; window.__neusicSoundKits = true;

/* Per-kit voice parameters. Anything omitted falls back to CLASSIC. */
const KITS = {
  classic: { label: 'Classic', copy: 'The original NEUSIC voices' },
  trap: {
    label: 'Trap', copy: 'Long 808 glide, crisp hats, sharp snare',
    kick:  { f0: 160, f1: 48, pDec: 0.10, aDec: 0.30 },
    snare: { noiseDec: 0.16, tone: 210, hp: 1400, aDec: 0.18 },
    hat:   { hp: 8000, dec: 0.05, openDec: 0.26 },
    e808:  { f0: 80, f1: 34, glide: 0.7, aDec: 1.6, drive: true },
    clap:  { bp: 1300, taps: 4, spread: 0.010 },
  },
  boombap: {
    label: 'Boom Bap', copy: 'Punchy kick, fat snare, dusty top end',
    kick:  { f0: 120, f1: 52, pDec: 0.16, aDec: 0.42, drive: true },
    snare: { noiseDec: 0.24, tone: 165, hp: 700, aDec: 0.26, body: 0.8 },
    hat:   { hp: 5200, dec: 0.09, openDec: 0.34, lp: 9500 },
    e808:  { f0: 85, f1: 45, glide: 0.25, aDec: 0.7 },
    clap:  { bp: 950, taps: 3, spread: 0.014 },
  },
  lofi: {
    label: 'Lo-Fi', copy: 'Soft, filtered, warm around the edges',
    kick:  { f0: 130, f1: 50, pDec: 0.14, aDec: 0.38, lp: 2800 },
    snare: { noiseDec: 0.20, tone: 170, hp: 500, aDec: 0.24, lp: 4500 },
    hat:   { hp: 4500, dec: 0.07, openDec: 0.30, lp: 7000, gain: 0.35 },
    e808:  { f0: 82, f1: 44, glide: 0.35, aDec: 0.8, lp: 1200 },
    clap:  { bp: 850, taps: 3, spread: 0.016, lp: 5000 },
  },
  drill: {
    label: 'Drill', copy: 'Sliding 808s, dark and aggressive',
    kick:  { f0: 150, f1: 44, pDec: 0.09, aDec: 0.28 },
    snare: { noiseDec: 0.14, tone: 230, hp: 1600, aDec: 0.16 },
    hat:   { hp: 8800, dec: 0.045, openDec: 0.22 },
    e808:  { f0: 110, f1: 30, glide: 1.1, aDec: 1.3, drive: true },
    clap:  { bp: 1500, taps: 4, spread: 0.009 },
  },
};
const DEFAULT_KIT = 'classic';
const kitOf = () => KITS[S.drumKit] && S.drumKit ? S.drumKit : DEFAULT_KIT;
const P = (kit, voice) => (KITS[kit] && KITS[kit][voice]) || {};

function drive(ctx, out) {
  const ws = ctx.createWaveShaper();
  const curve = new Float32Array(257);
  for (let i = 0; i <= 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(2.2 * x); }
  ws.curve = curve; ws.oversample = '2x'; ws.connect(out); return ws;
}
function maybeLP(ctx, out, freq) {
  if (!freq) return out;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq;
  lp.connect(out); return lp;
}

function kitSynthDrum(name, destination, when) {
  const ctx = destination ? destination.context : this.ensure();
  const t0 = (when != null) ? when : ctx.currentTime;
  const out = destination || this.master;
  const kit = kitOf();
  if (kit === DEFAULT_KIT) return ORIGINAL.call(this, name, destination, when);

  const g = ctx.createGain(); g.connect(out);
  const noiseBuf = (dur) => {
    const n = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1);
    return b;
  };

  switch (name) {
    case 'KICK': {
      const p = { f0: 150, f1: 45, pDec: 0.12, aDec: 0.35, ...P(kit, 'kick') };
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(p.f0, t0);
      osc.frequency.exponentialRampToValueAtTime(p.f1, t0 + p.pDec);
      g.gain.setValueAtTime(1, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + p.aDec);
      let dest = maybeLP(ctx, g, p.lp); if (p.drive) dest = drive(ctx, dest);
      osc.connect(dest); osc.start(t0); osc.stop(t0 + p.aDec + 0.02);
      break; }
    case 'SNARE': {
      const p = { noiseDec: 0.2, tone: 180, hp: 900, aDec: 0.22, body: 0.6, ...P(kit, 'snare') };
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(p.noiseDec);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = p.hp;
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = p.tone;
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(p.body, t0); oscG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      g.gain.setValueAtTime(0.9, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + p.aDec);
      const dest = maybeLP(ctx, g, p.lp);
      src.connect(hp); hp.connect(dest); osc.connect(oscG); oscG.connect(dest);
      src.start(t0); src.stop(t0 + p.aDec); osc.start(t0); osc.stop(t0 + 0.12);
      break; }
    case 'HI-HAT': case 'OPEN': case 'RIDE': {
      const p = { hp: 6000, dec: 0.07, openDec: 0.32, gain: 0.5, ...P(kit, 'hat') };
      const isOpen = name !== 'HI-HAT';
      const dur = isOpen ? p.openDec : p.dec;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(dur + 0.03);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = p.hp;
      g.gain.setValueAtTime(p.gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      const dest = maybeLP(ctx, g, p.lp);
      src.connect(hp); hp.connect(dest); src.start(t0); src.stop(t0 + dur + 0.02);
      break; }
    case 'CLAP': {
      const p = { bp: 1100, taps: 3, spread: 0.012, ...P(kit, 'clap') };
      for (let i = 0; i < p.taps; i++) {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf(0.08);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = p.bp; bp.Q.value = 1.5;
        const gg = ctx.createGain(); const startT = t0 + i * p.spread;
        gg.gain.setValueAtTime(0.7, startT); gg.gain.exponentialRampToValueAtTime(0.001, startT + 0.09);
        const dest = maybeLP(ctx, g, p.lp);
        src.connect(bp); bp.connect(gg); gg.connect(dest); src.start(startT); src.stop(startT + 0.1);
      }
      break; }
    case '808': {
      const p = { f0: 90, f1: 40, glide: 0.5, aDec: 0.9, ...P(kit, 'e808') };
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(p.f0, t0);
      osc.frequency.exponentialRampToValueAtTime(p.f1, t0 + p.glide);
      g.gain.setValueAtTime(1, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + p.aDec);
      let dest = maybeLP(ctx, g, p.lp); if (p.drive) dest = drive(ctx, dest);
      osc.connect(dest); osc.start(t0); osc.stop(t0 + p.aDec + 0.05);
      break; }
    default:
      return ORIGINAL.call(this, name, destination, when);
  }
  return g;
}

let ORIGINAL = null;
let installedOnce = false;
function install() {
  if (installedOnce) return true;
  if (typeof Audio_ === 'undefined' || typeof S === 'undefined') return false;
  if (Audio_.synthDrum.__kitAware) return true;
  installedOnce = true;
  ORIGINAL = Audio_.synthDrum;
  const bound = Audio_;
  const wrapped = function (name, destination, when) {
    return kitSynthDrum.call(bound, name, destination, when);
  };
  wrapped.__kitAware = true;
  Audio_.synthDrum = wrapped;
  if (!S.drumKit) S.drumKit = DEFAULT_KIT;
  window.NeusicKits = {
    list: () => Object.entries(KITS).map(([id, k]) => ({ id, label: k.label, copy: k.copy })),
    active: () => kitOf(),
    set(id) {
      if (!KITS[id]) return false;
      S.drumKit = id;
      window.toast?.(`${KITS[id].label} kit loaded`);
      document.querySelectorAll('[data-kit-btn]').forEach(b =>
        b.classList.toggle('kit-active', b.dataset.kitBtn === id));
      return true;
    },
  };
  return true;
}

function injectPicker() {
  const panel = document.querySelector('.seq-steps')?.closest('[class*="drum"],[id*="drum"],.panel,.drawer-panel')
    || document.querySelector('.seq-steps')?.parentElement;
  if (!panel || panel.querySelector('.kit-picker')) return;
  const bar = document.createElement('div');
  bar.className = 'kit-picker';
  bar.innerHTML = window.NeusicKits.list().map(k =>
    `<button type="button" data-kit-btn="${k.id}" class="kit-btn${k.id === kitOf() ? ' kit-active' : ''}" title="${k.copy}">${k.label}</button>`
  ).join('');
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-kit-btn]'); if (!b) return;
    window.NeusicKits.set(b.dataset.kitBtn);
    const now = Audio_.ctx?.currentTime ?? 0;
    try { Audio_.synthDrum('KICK', null, now); Audio_.synthDrum('HI-HAT', null, now + 0.18); Audio_.synthDrum('808', null, now + 0.36); } catch (_) {}
  });
  panel.prepend(bar);
}

function boot() {
  if (!install()) { setTimeout(boot, 120); return; }
  injectPicker();
  new MutationObserver(() => { if (document.querySelector('.seq-steps')) injectPicker(); })
    .observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
