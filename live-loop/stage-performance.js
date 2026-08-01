(() => {
  'use strict';

  /**
   * Live Loop now uses one interface for every viewport.
   * This compatibility file intentionally does not create a second mobile or
   * stage-performance control surface. It only removes stale injected markup
   * left by older cached builds and keeps the real desktop panels in the
   * intended responsive order.
   */
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeLayout, {once:true});
  } else {
    normalizeLayout();
  }

  addEventListener('neusic:live-loop-ui-ready', normalizeLayout);
  addEventListener('pageshow', normalizeLayout);
})();
