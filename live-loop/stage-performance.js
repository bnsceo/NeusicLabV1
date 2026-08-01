(() => {
  'use strict';

  const clearObsoleteStatus = () => {
    const output = document.getElementById('statusMessage');
    if (!output) return;
    const text = output.textContent.trim();
    if (text === 'Five loop lanes are visible. Tap REC on any lane; MIDI is optional.') {
      output.textContent = '';
    }
  };

  function normalizeLayout() {
    document.getElementById('stageMacroDeck')?.remove();
    document.querySelectorAll('.mobile-lane-nav,.mobile-performance-controls').forEach(element => element.remove());

    const lowerGrid = document.querySelector('.lower-grid');
    const piano = document.querySelector('.synth-panel');
    const effects = document.querySelector('.pedalboard');
    if (lowerGrid && piano && effects && piano.nextElementSibling !== effects) {
      lowerGrid.insertBefore(piano, effects);
    }

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
    loadScript('mobile-performance-polish.js?v=ce76418', 'data-live-loop-polish');
    loadScript('vocal-pitch-correction.js?v=653d420', 'data-live-loop-pitch');
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
  addEventListener('neusic:live-loop-ready', clearObsoleteStatus);
  addEventListener('pageshow', normalizeLayout);
})();
