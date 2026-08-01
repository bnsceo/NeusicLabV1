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
        gap:4px!important;
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
      .master-display>div:not(.master-meter){
        padding:5px 7px!important;
        border-radius:8px!important;
      }
      .master-display small{font-size:5px!important;letter-spacing:.08em!important}
      .master-display b{margin-top:3px!important;font-size:10px!important}
      .master-meter{
        grid-column:auto!important;
        width:42px!important;
        height:7px!important;
        padding:1px!important;
      }
      .transport{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        width:100%!important;
        gap:4px!important;
        padding:0!important;
        overflow:visible!important;
      }
      .transport>*{min-width:0!important;width:100%!important}
      .transport .hardware-button,
      .transport .lcd-control,
      .transport .switch-control{
        min-height:33px!important;
        height:33px!important;
        border-radius:9px!important;
        padding:0 5px!important;
        box-shadow:4px 4px 9px #070a0e,-3px -3px 8px #1b2430!important;
      }
      #captureBtn,#playBtn,#stopBtn{grid-row:1}
      #micBtn{grid-row:1}
      .transport .hardware-button{font-size:6px!important;gap:4px!important}
      .transport .hardware-button span,
      .transport .hardware-button b{font-size:6px!important}
      .transport .lcd-control{grid-column:1/2;grid-row:2;padding:3px 5px!important}
      .transport .lcd-control small{font-size:4.5px!important}
      .transport .lcd-control input{width:100%!important;font-size:11px!important;text-align:center!important}
      .transport .switch-control{grid-column:2/3;grid-row:2;justify-content:center!important;font-size:6px!important}
      #midiBtn{grid-column:3/4;grid-row:2}
      .transport:after{
        content:'LIVE LOOP';
        grid-column:4/5;
        grid-row:2;
        display:grid;
        place-items:center;
        min-height:33px;
        border:1px solid #26313d;
        border-radius:9px;
        background:#111720;
        color:#66717e;
        box-shadow:inset 3px 3px 7px #080b10,inset -3px -3px 7px #202a36;
        font:800 5px/1 var(--mono);
        letter-spacing:.1em;
      }
      .top-actions{
        display:grid!important;
        grid-template-columns:repeat(3,1fr)!important;
        width:100%!important;
        gap:4px!important;
        overflow:visible!important;
      }
      .top-actions a{
        min-width:0!important;
        min-height:24px!important;
        padding:0 4px!important;
        border-radius:8px!important;
        font-size:5.5px!important;
        box-shadow:3px 3px 7px #070a0e,-2px -2px 6px #1b2430!important;
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
