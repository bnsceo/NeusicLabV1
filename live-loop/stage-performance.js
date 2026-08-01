(() => {
  'use strict';

  function normalizeLayout() {
    document.getElementById('stageMacroDeck')?.remove();
    document.querySelectorAll('.mobile-lane-nav,.mobile-performance-controls').forEach(element => element.remove());

    const lowerGrid = document.querySelector('.lower-grid');
    const piano = document.querySelector('.synth-panel');
    const effects = document.querySelector('.pedalboard');
    if (lowerGrid && piano && effects && piano.nextElementSibling !== effects) {
      lowerGrid.insertBefore(piano, effects);
    }
  }

  function loadPerformancePolish() {
    if (document.querySelector('script[data-live-loop-polish]')) return;
    const script = document.createElement('script');
    script.src = 'mobile-performance-polish.js?v=a075552';
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
  addEventListener('pageshow', normalizeLayout);
})();
