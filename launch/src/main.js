// The landing page's script: the pad board (which tells the hero light when a drum plays) and the motion below the hero.
// The DJ decks are a separate chunk, fetched when their section is about a screen away: nobody needs them to read the page.
import './pads.js';
import './light.js';
import './motion.js';

const deck = document.querySelector('.dj-deck');
if (deck) {
  let tries = 0; // a phone changing network can drop the fetch: try again a few times
  const load = () => import('./decks.js').catch(() => { if (++tries < 4) setTimeout(load, 2500); });
  let started = false;
  const go = () => { if (!started) { started = true; load(); } };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '100% 0px' });
    io.observe(deck);
    setTimeout(go, 5000); // in case the observer is slow (a busy phone or tablet): the chunk is 4 KB gzipped
  } else go();
}
