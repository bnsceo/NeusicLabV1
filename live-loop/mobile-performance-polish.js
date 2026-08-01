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
        display:grid!important;
        grid-template-columns:minmax(0,1fr)!important;
        gap:6px!important;
        padding:calc(6px + env(safe-area-inset-top)) 7px 7px!important;
        background:#0d1218f2!important;
      }
      .header-master-display{
        min-width:0!important;
        width:100%!important;
        padding:5px!important;
        gap:5px!important;
        border-radius:13px!important;
      }
      .master-display>div:not(.master-meter){padding:6px 8px!important;border-radius:9px!important}
      .master-display small{font-size:5.5px!important}
      .master-display b{margin-top:4px!important;font-size:11px!important}
      .master-meter{height:6px!important;padding:1px!important}
      .transport{
        display:flex!important;
        width:100%!important;
        gap:5px!important;
        overflow-x:auto!important;
        overscroll-behavior-x:contain!important;
        scrollbar-width:none!important;
        padding:2px 1px 5px!important;
        justify-content:flex-start!important;
        scroll-snap-type:x proximity;
      }
      .transport::-webkit-scrollbar{display:none!important}
      .transport>*{flex:0 0 auto!important;scroll-snap-align:start}
      .transport .hardware-button,
      .transport .lcd-control,
      .transport .switch-control{
        min-height:36px!important;
        height:36px!important;
        border-radius:11px!important;
        padding-inline:10px!important;
        box-shadow:5px 5px 11px #070a0e,-4px -4px 9px #1b2430!important;
      }
      .transport .hardware-button{min-width:68px!important;font-size:6.5px!important}
      .transport .capture-button{min-width:88px!important}
      .transport .lcd-control{min-width:65px!important;padding:4px 8px!important}
      .transport .lcd-control input{width:48px!important;font-size:13px!important}
      .transport .switch-control{min-width:62px!important}
      .top-actions{
        display:flex!important;
        width:100%!important;
        gap:5px!important;
        overflow-x:auto!important;
        scrollbar-width:none!important;
        justify-content:flex-start!important;
      }
      .top-actions::-webkit-scrollbar{display:none!important}
      .top-actions a{
        flex:1 0 92px!important;
        min-height:31px!important;
        padding:0 8px!important;
        border-radius:10px!important;
        font-size:6px!important;
        box-shadow:4px 4px 9px #070a0e,-3px -3px 8px #1b2430!important;
      }
      .keyboard{
        touch-action:none!important;
        user-select:none!important;
        -webkit-user-select:none!important;
        overscroll-behavior:contain!important;
      }
      .keyboard button{touch-action:none!important;-webkit-user-select:none!important}
    }
  `;
  document.head.appendChild(style);

  const pointers = new Map();
  const noteUsers = new Map();

  const keyAt = (x, y) => {
    const element = document.elementFromPoint(x, y);
    const key = element?.closest?.('#keyboard [data-note]');
    return key && document.getElementById('keyboard')?.contains(key) ? key : null;
  };

  const api = () => window.NeusicLiveLoop;

  const addPointerToNote = (pointerId, key) => {
    if (!key) return;
    const note = Number(key.dataset.note);
    const users = noteUsers.get(note) || new Set();
    users.add(pointerId);
    noteUsers.set(note, users);
    key.classList.add('active');
    pointers.set(pointerId, { note, key });
  };

  const releasePointerNote = (pointerId, playNoteOff = true) => {
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

  const glideTo = (event) => {
    const current = pointers.get(event.pointerId);
    if (!current) return;
    event.preventDefault();
    const nextKey = keyAt(event.clientX, event.clientY);
    if (!nextKey) return;
    const nextNote = Number(nextKey.dataset.note);
    if (nextNote === current.note) return;

    releasePointerNote(event.pointerId, true);
    addPointerToNote(event.pointerId, nextKey);
    api()?.synth?.noteOn(nextNote, 108);
  };

  document.addEventListener('pointerdown', (event) => {
    const key = event.target.closest?.('#keyboard [data-note]');
    if (!key) return;
    addPointerToNote(event.pointerId, key);
  }, { capture:true, passive:true });

  document.addEventListener('pointermove', glideTo, { capture:true, passive:false });

  const finish = (event) => releasePointerNote(event.pointerId, false);
  document.addEventListener('pointerup', finish, { capture:true });
  document.addEventListener('pointercancel', finish, { capture:true });

  window.addEventListener('blur', () => {
    for (const pointerId of [...pointers.keys()]) releasePointerNote(pointerId, true);
  });
})();
