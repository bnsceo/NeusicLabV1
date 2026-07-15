(() => {
  'use strict';
  if (window.__neusicLiveLoopMobile) return;
  window.__neusicLiveLoopMobile = true;

  const COLORS = ['#4de7ee','#9e7cff','#69d994','#f2bd5b','#ed6f89'];
  const MOBILE_QUERY = matchMedia('(max-width:760px)');
  let initialized = false;
  let scrollTimer = 0;

  function cards() {
    return [...document.querySelectorAll('#trackGrid .loop-track')];
  }

  function currentIndex() {
    const list = cards();
    const selected = list.findIndex(card => card.classList.contains('selected'));
    return selected >= 0 ? selected : 0;
  }

  function syncNav() {
    const nav = document.getElementById('mobileLaneNav');
    if (!nav) return;
    const list = cards();
    const active = currentIndex();
    nav.querySelectorAll('.mobile-lane-button').forEach((button,index) => {
      const card = list[index];
      const state = card?.dataset.state || 'Empty';
      button.dataset.state = state;
      button.classList.toggle('active',index === active);
      button.setAttribute('aria-current',index === active ? 'true' : 'false');
      const label = card?.querySelector('.track-name')?.textContent?.trim() || `Loop ${index + 1}`;
      const status = state.toUpperCase();
      button.querySelector('small').textContent = status;
      button.setAttribute('aria-label',`Select ${label}. ${status}.`);
    });
    const readout = nav.querySelector('[data-mobile-lane-readout]');
    if (readout) readout.textContent = `LANE ${active + 1} OF ${Math.max(1,list.length)}`;
  }

  function activateLane(index, options = {}) {
    const list = cards();
    const card = list[index];
    if (!card) return;
    card.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    if (options.scroll !== false && MOBILE_QUERY.matches) {
      card.scrollIntoView({behavior:options.instant ? 'auto' : 'smooth',block:'nearest',inline:'center'});
    }
    syncNav();
  }

  function nearestLane() {
    const grid = document.getElementById('trackGrid');
    const list = cards();
    if (!grid || !list.length || !MOBILE_QUERY.matches) return;
    const center = grid.scrollLeft + grid.clientWidth / 2;
    let best = 0;
    let distance = Infinity;
    list.forEach((card,index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const nextDistance = Math.abs(center - cardCenter);
      if (nextDistance < distance) {distance = nextDistance;best = index;}
    });
    if (best !== currentIndex()) activateLane(best,{scroll:false});
    else syncNav();
  }

  function install() {
    if (initialized) return;
    const grid = document.getElementById('trackGrid');
    if (!grid || cards().length < 5) return;
    initialized = true;

    const nav = document.createElement('section');
    nav.id = 'mobileLaneNav';
    nav.className = 'mobile-lane-nav';
    nav.setAttribute('aria-label','Select one of five loop lanes');
    nav.innerHTML = `
      <div class="mobile-lane-nav-head">
        <span>SWIPE THE DECK OR TAP A LANE</span>
        <b data-mobile-lane-readout>LANE 1 OF 5</b>
      </div>
      <div class="mobile-lane-buttons" role="tablist" aria-label="Loop lanes">
        ${COLORS.map((color,index)=>`<button class="mobile-lane-button" type="button" role="tab" data-lane-index="${index}" style="--lane-color:${color}"><span>${String(index+1).padStart(2,'0')}</span><small>EMPTY</small></button>`).join('')}
      </div>`;
    grid.before(nav);

    nav.addEventListener('click',event => {
      const button = event.target.closest('[data-lane-index]');
      if (!button) return;
      activateLane(Number(button.dataset.laneIndex));
    });

    grid.addEventListener('scroll',() => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(nearestLane,110);
    },{passive:true});

    grid.addEventListener('keydown',event => {
      if (!MOBILE_QUERY.matches) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      activateLane(Math.max(0,Math.min(cards().length - 1,currentIndex() + direction)));
    });

    const observer = new MutationObserver(syncNav);
    observer.observe(grid,{subtree:true,attributes:true,attributeFilter:['class','data-state','disabled'],childList:true,characterData:true});

    MOBILE_QUERY.addEventListener?.('change',event => {
      if (event.matches) activateLane(currentIndex(),{instant:true});
    });

    requestAnimationFrame(() => activateLane(currentIndex(),{instant:true}));
  }

  function waitForTracks() {
    install();
    if (initialized) return;
    const observer = new MutationObserver(() => {
      install();
      if (initialized) observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(() => observer.disconnect(),12000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',waitForTracks,{once:true});
  else waitForTracks();
})();
