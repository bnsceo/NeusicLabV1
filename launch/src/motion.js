// Below the hero: each part of a section rises into place once as it comes on screen, and the neumorphic cards catch a soft light under the pointer.
// Nothing is hidden unless this script runs, and with "reduce motion" nothing moves.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!still && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting || e.boundingClientRect.bottom < 0) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.inside, .dj, .prices, .pack, .book').forEach((sec) => {
    // heading, text, then the cards: a list or grid hands over its own items, so they come in one after another
    [...sec.children].flatMap((el) => (el.matches('ul, .plans') ? [...el.children] : [el])).forEach((el, i) => {
      el.setAttribute('data-r', ''); el.style.setProperty('--d', Math.min(i, 5) * 70 + 'ms'); io.observe(el);
    });
  });
  document.documentElement.classList.add('js-reveal'); // hiding starts only now, after every part is marked and watched
}

if (!still && matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.inside li, .plans article, .pack-card, .pack-addon').forEach((el) => {
    el.classList.add('hl');
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px'); });
  });
}
