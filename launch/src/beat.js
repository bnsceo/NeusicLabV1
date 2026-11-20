// A tiny bus: the pad board says which drum played (and where on the page), the hero light and the DJ decks listen.
const subs = new Set();
export const on = (cb) => (subs.add(cb), () => subs.delete(cb));
export const emit = (row, col, x, y) => subs.forEach((cb) => cb(row, col, x, y));
