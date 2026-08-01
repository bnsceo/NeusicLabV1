(() => {
  'use strict';

  const TOUCH_CLICK_WINDOW_MS = 1200;
  const lastTouchByButton = new WeakMap();

  document.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('.loop-track [data-action="record"]');
    if (!button || event.pointerType === 'mouse') return;
    lastTouchByButton.set(button, performance.now());
  }, {capture:true, passive:true});

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.loop-track [data-action="record"]');
    if (!button) return;
    const touchedAt = lastTouchByButton.get(button);
    if (touchedAt === undefined) return;
    if (performance.now() - touchedAt > TOUCH_CLICK_WINDOW_MS) {
      lastTouchByButton.delete(button);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    lastTouchByButton.delete(button);
  }, true);
})();
