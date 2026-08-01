(() => {
  'use strict';

  const style = document.createElement('style');
  style.id = 'liveLoopMobilePerformancePolish';
  style.textContent = `
    @media (max-width:760px){
      .topbar{
        position:sticky!important;
        top:0!important;
        z-index:90!important;
        display:block!important;
        padding:calc(4px + env(safe-area-inset-top)) 6px 5px!important;
        background:#0d1218f4!important;
        box-shadow:0 8px 18px #05080caa!important;
      }
      .header-master-display{
        min-width:0!important;
        width:100%!important;
        grid-template-columns:1fr 1fr auto!important;
        align-items:center!important;
        gap:4px!important;
        padding:4px!important;
        border-radius:11px!important;
        box-shadow:4px 4px 9px #070a0e,-3px -3px 8px #1b2430!important;
      }
      .master-display>div:not(.master-meter){padding:5px 7px!important;border-radius:8px!important}
      .master-display small{font-size:5px!important;letter-spacing:.08em!important}
      .master-display b{margin-top:3px!important;font-size:10px!important}
      .master-meter{grid-column:auto!important;width:42px!important;height:7px!important;padding:1px!important}

      .transport.transport-carousel{
        position:relative!important;
        z-index:20!important;
        display:flex!important;
        align-items:center!important;
        justify-content:flex-start!important;
        gap:7px!important;
        width:100%!important;
        margin:0!important;
        padding:8px 8px 10px!important;
        overflow-x:auto!important;
        overflow-y:hidden!important;
        scroll-snap-type:x mandatory!important;
        -webkit-overflow-scrolling:touch!important;
        scrollbar-width:none!important;
        background:#0b1016!important;
        border-bottom:1px solid #202a35!important;
      }
      .transport.transport-carousel::-webkit-scrollbar{display:none!important}
      .transport.transport-carousel>*{
        flex:0 0 auto!important;
        width:auto!important;
        min-width:82px!important;
        scroll-snap-align:start!important;
      }
      .transport.transport-carousel .hardware-button,
      .transport.transport-carousel .lcd-control,
      .transport.transport-carousel .switch-control{
        min-height:38px!important;
        height:38px!important;
        border-radius:11px!important;
        padding:0 11px!important;
        box-shadow:5px 5px 11px #070a0e,-4px -4px 9px #1b2430!important;
      }
      .transport.transport-carousel .lcd-control{min-width:74px!important;padding:4px 8px!important}
      .transport.transport-carousel .lcd-control input{width:52px!important;font-size:13px!important;text-align:center!important}
      .transport.transport-carousel .switch-control{justify-content:center!important}

      .track-actions{
        display:flex!important;
        grid-template-columns:none!important;
        gap:7px!important;
        width:100%!important;
        overflow-x:auto!important;
        overflow-y:hidden!important;
        scroll-snap-type:x mandatory!important;
        -webkit-overflow-scrolling:touch!important;
        scrollbar-width:none!important;
        padding:2px 1px 8px!important;
      }
      .track-actions::-webkit-scrollbar{display:none!important}
      .track-actions button{
        flex:0 0 auto!important;
        width:auto!important;
        min-width:88px!important;
        grid-column:auto!important;
        scroll-snap-align:start!important;
      }
      .track-actions [data-action="forge"]{display:none!important}

      .keyboard{touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;overscroll-behavior:contain!important}
      .keyboard button{touch-action:none!important;-webkit-user-select:none!important}
    }
  `;
  document.head.appendChild(style);

  function normalizeControls(){
    const topbar = document.querySelector('.topbar');
    const transport = document.querySelector('.transport');
    if (topbar && transport) {
      transport.classList.add('transport-carousel');
      if (transport.parentElement === topbar) topbar.after(transport);
    }
    document.querySelectorAll('.track-actions [data-action="forge"]').forEach(button => {
      button.hidden = true;
      button.setAttribute('aria-hidden','true');
      button.tabIndex = -1;
    });
  }

  const pointers = new Map();
  const noteUsers = new Map();
  const keyAt = (x,y) => {
    const element = document.elementFromPoint(x,y);
    const key = element?.closest?.('#keyboard [data-note]');
    return key && document.getElementById('keyboard')?.contains(key) ? key : null;
  };
  const api = () => window.NeusicLiveLoop;
  const addPointerToNote = (pointerId,key) => {
    if (!key) return;
    const note = Number(key.dataset.note);
    const users = noteUsers.get(note) || new Set();
    users.add(pointerId);
    noteUsers.set(note,users);
    key.classList.add('active');
    pointers.set(pointerId,{note,key});
  };
  const releasePointerNote = (pointerId,playNoteOff=true) => {
    const current = pointers.get(pointerId);
    if (!current) return;
    const users = noteUsers.get(current.note);
    users?.delete(pointerId);
    if (!users?.size) {
      noteUsers.delete(current.note);
      current.key.classList.remove('active');
      if (playNoteOff) api()?.synth?.noteOff(current.note);
    }
    pointers.delete(pointerId);
  };
  const glideTo = event => {
    const current = pointers.get(event.pointerId);
    if (!current) return;
    event.preventDefault();
    const nextKey = keyAt(event.clientX,event.clientY);
    if (!nextKey) return;
    const nextNote = Number(nextKey.dataset.note);
    if (nextNote === current.note) return;
    releasePointerNote(event.pointerId,true);
    addPointerToNote(event.pointerId,nextKey);
    api()?.synth?.noteOn(nextNote,108);
  };

  document.addEventListener('pointerdown',event => {
    const key = event.target.closest?.('#keyboard [data-note]');
    if (key) addPointerToNote(event.pointerId,key);
  },{capture:true,passive:true});
  document.addEventListener('pointermove',glideTo,{capture:true,passive:false});
  const finish = event => releasePointerNote(event.pointerId,false);
  document.addEventListener('pointerup',finish,{capture:true});
  document.addEventListener('pointercancel',finish,{capture:true});
  window.addEventListener('blur',() => {
    for (const pointerId of [...pointers.keys()]) releasePointerNote(pointerId,true);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',normalizeControls,{once:true});
  else normalizeControls();
  addEventListener('neusic:live-loop-ui-ready',normalizeControls);
  addEventListener('pageshow',normalizeControls);
})();
