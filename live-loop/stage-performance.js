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

  function loadPerformancePolish() {
    if (document.querySelector('script[data-live-loop-polish]')) return;
    const script = document.createElement('script');
    script.src = 'mobile-performance-polish.js?v=ce76418';
    script.dataset.liveLoopPolish = 'true';
    script.defer = true;
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      normalizeLayout();
      loadPerformancePolish();
    }, {once:true});
  } else {
    normalizeLayout();
    loadPerformancePolish();
  }

  addEventListener('neusic:live-loop-ui-ready', normalizeLayout);
  addEventListener('neusic:live-loop-ready', clearObsoleteStatus);
  addEventListener('pageshow', normalizeLayout);
})();
