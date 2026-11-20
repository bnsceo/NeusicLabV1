// The landing page's script: the pad board (which tells the hero light when a drum plays) and the motion below the hero.
// The DJ decks are a separate chunk, fetched when their section is about a screen away: nobody needs them to read the page.
import './pads.js';
import './light.js';
import './motion.js';

const deck = document.querySelector('.dj-deck');
if (deck) {
  const load = () => import('./decks.js');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '100% 0px' });
    io.observe(deck);
  } else load();
}
