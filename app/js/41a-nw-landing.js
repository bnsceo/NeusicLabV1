/* Studio-first marketing entry from the Phase 2B Build 1 package. */
(() => {
  'use strict';
  if (document.getElementById('nw-landing')) return;

  document.body.dataset.product = 'lab';

  const landing = document.createElement('section');
  landing.id = 'nw-landing';
  landing.className = 'nw-noise';
  landing.innerHTML = `
    <div class="wrap">
      <div class="nw-micro" style="margin-bottom:14px">NEUSICWAVE / PRODUCTION</div>
      <h1>Arrange, record, mix, master.<br>All in your browser.</h1>
      <p class="sub">NeusicLab is the finishing studio of the NeusicWave suite. No installation, no login — the demo is the full studio.</p>
      <ul>
        <li>Multi-track arrangement with waveform clips and full editing</li>
        <li>5 drum kits, sampler, effects rack, and real-time mixing</li>
        <li>File operations: Open, Export WAV — Save unlocks with Pro</li>
      </ul>
      <button class="cta" id="nw-enter"><i></i>Open NeusicLab</button>
      <div class="more">
        <h3>The studio</h3>
        <p>Record tracks, arrange clips on the timeline, design sounds with the sampler, apply effects, and mix with live level meters. Export your finished project as a WAV file — straight from the browser.</p>
        <div class="shot">SCREENSHOT — TIMELINE &amp; TRANSPORT</div>
        <h3>File operations &amp; control</h3>
        <p>Work like a desktop app. Open projects, export mixes, and tune the Neusic Agent from the File menu — verbosity, approvals, and what it may listen to are all yours to set.</p>
        <div class="shot">SCREENSHOT — FILE MENU &amp; AGENT SETTINGS</div>
        <h3>Neusic Agent</h3>
        <p>Connect your API key to unlock AI mixing advice, auto-arrangement, and sound matching. A local model via Ollama keeps advice working offline — the agent stays quiet while you create and never edits without asking.</p>
        <div class="shot">SCREENSHOT — AGENT PANEL</div>
      </div>
    </div>`;

  const app = document.getElementById('app');
  document.body.insertBefore(landing, app || document.body.firstChild);

  const enter = () => {
    document.body.classList.add('nw-in-app');
    try { localStorage.setItem('nw-entered', '1'); } catch (_) {}
    window.scrollTo(0, 0);
  };

  landing.querySelector('#nw-enter')?.addEventListener('click', enter);
  try {
    if (localStorage.getItem('nw-entered') === '1') {
      document.body.classList.add('nw-in-app');
    }
  } catch (_) {}
})();