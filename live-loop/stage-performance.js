(() => {
  'use strict';

  const clearObsoleteStatus = () => {
    const output = document.getElementById('statusMessage');
    if (!output) return;
    const text = output.textContent.trim();
    if (text === 'Five loop lanes are visible. Tap REC on any lane; MIDI is optional.') output.textContent = '';
  };

  function hideDeferredBridge() {
    const tools = document.querySelector('.session-tools');
    if (!tools) return;
    tools.classList.add('bridge-deferred');
    [...tools.children].forEach(child => {
      if (!child.classList.contains('status-message')) child.hidden = true;
    });
    tools.setAttribute('aria-label', 'Live Loop status');
  }

  function normalizeLayout() {
    document.getElementById('stageMacroDeck')?.remove();
    document.querySelectorAll('.mobile-lane-nav,.mobile-performance-controls').forEach(element => element.remove());
    const lowerGrid = document.querySelector('.lower-grid');
    const piano = document.querySelector('.synth-panel');
    const effects = document.querySelector('.pedalboard');
    if (lowerGrid && piano && effects && piano.nextElementSibling !== effects) lowerGrid.insertBefore(piano, effects);
    hideDeferredBridge();
    clearObsoleteStatus();
  }

  function loadScript(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute(marker, 'true');
    script.defer = true;
    document.head.appendChild(script);
  }

  function loadEnhancements() {
    loadScript('recording-controller-v2.js?v=75f79f7', 'data-live-loop-record-controller');
    loadScript('mobile-performance-polish.js?v=ce76418', 'data-live-loop-polish');
    loadScript('vocal-pitch-correction-v2.js?v=610488c', 'data-live-loop-pitch-v2');
    loadScript('scene-manager-v2.js?v=1b343dc', 'data-live-loop-scenes-v2');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      normalizeLayout();
      loadEnhancements();
    }, {once:true});
  } else {
    normalizeLayout();
    loadEnhancements();
  }

  addEventListener('neusic:live-loop-ui-ready', normalizeLayout);
  addEventListener('neusic:live-loop-ready', normalizeLayout);
  addEventListener('pageshow', normalizeLayout);
})();