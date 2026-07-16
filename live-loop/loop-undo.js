(() => {
  'use strict';

  const HISTORY_LIMIT = 4;
  const histories = Array.from({length:5}, () => []);
  let api = null;
  let looper = null;

  const cloneSnapshot = index => {
    const track = looper?.tracks?.[index];
    if (!track) return null;
    return {
      buffer: track.buffer || null,
      name: track.name,
      muted: Boolean(track.muted),
      rate: track.rate,
      reverse: Boolean(track.reverse),
      masterLength: looper.masterLength
    };
  };

  const updateButton = index => {
    const button = document.querySelector(`.loop-track[data-index="${index}"] [data-action="undo"]`);
    if (!button) return;
    const available = histories[index].length > 0;
    button.disabled = !available;
    button.setAttribute('aria-disabled', String(!available));
    button.title = available ? 'Undo the last loop change' : 'Nothing to undo';
  };

  const updateAllButtons = () => histories.forEach((_, index) => updateButton(index));

  const pushSnapshot = index => {
    const snapshot = cloneSnapshot(index);
    if (!snapshot) return;
    histories[index].push(snapshot);
    if (histories[index].length > HISTORY_LIMIT) histories[index].shift();
    updateButton(index);
  };

  const restoreSnapshot = index => {
    if (!looper || looper.activeRecording || looper.arming) {
      window.dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message:'Finish or cancel recording before using undo.'}}));
      return false;
    }

    const snapshot = histories[index].pop();
    if (!snapshot) {
      window.dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message:`Track ${index + 1} has nothing to undo.`}}));
      updateButton(index);
      return false;
    }

    const track = looper.tracks[index];
    looper.stopSource(track);
    track.buffer = snapshot.buffer;
    track.name = snapshot.name;
    track.muted = snapshot.muted;
    track.rate = snapshot.rate;
    track.reverse = snapshot.reverse;
    track.recording = null;

    const otherHasAudio = looper.tracks.some((item, itemIndex) => itemIndex !== index && item.buffer);
    if (snapshot.buffer) looper.masterLength = snapshot.masterLength;
    else if (!otherHasAudio) looper.masterLength = 0;

    track.gain.gain.setTargetAtTime(track.muted ? 0 : track.volume, looper.context.currentTime, .02);
    if (track.buffer && looper.playing && !track.muted) looper.startTrack(track, looper.context.currentTime + .02);
    else track.state = track.muted && track.buffer ? 'Muted' : track.buffer ? 'Stopped' : 'Empty';

    looper.emit('track', {index});
    looper.emit('change');
    looper.emit('status', {message:`Undid the last change on ${track.name}.`});
    updateButton(index);
    return true;
  };

  const wrapMutation = (methodName, resolveIndex, shouldSnapshot = () => true) => {
    const original = looper[methodName]?.bind(looper);
    if (!original) return;
    looper[methodName] = async function(...args) {
      const index = resolveIndex(...args);
      const track = looper.tracks[index];
      const takeSnapshot = track && shouldSnapshot(track, ...args);
      if (takeSnapshot) pushSnapshot(index);
      try {
        return await original(...args);
      } catch (error) {
        if (takeSnapshot) histories[index].pop();
        updateButton(index);
        throw error;
      }
    };
  };

  const addUndoButtons = () => {
    document.querySelectorAll('.loop-track').forEach((card, index) => {
      const actions = card.querySelector('.track-actions');
      if (!actions || actions.querySelector('[data-action="undo"]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = 'undo';
      button.className = 'undo-action';
      button.textContent = 'UNDO';
      button.disabled = true;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        api?.selectTrack?.(index);
        restoreSnapshot(index);
      });
      const mute = actions.querySelector('[data-action="mute"]');
      actions.insertBefore(button, mute || null);
      updateButton(index);
    });
  };

  const install = () => {
    if (window.__neusicLoopUndoInstalled || !window.NeusicLiveLoop?.looper) return;
    window.__neusicLoopUndoInstalled = true;
    api = window.NeusicLiveLoop;
    looper = api.looper;

    wrapMutation('importFile', index => index);
    wrapMutation('finishRecording', session => session.index);
    wrapMutation('clear', index => index, track => Boolean(track.buffer));
    wrapMutation('reverse', index => index, track => Boolean(track.buffer));
    wrapMutation('halfSpeed', index => index, track => Boolean(track.buffer));

    looper.undo = restoreSnapshot;
    looper.canUndo = index => histories[index]?.length > 0;
    api.undoSelected = () => restoreSnapshot(api.selectedTrack);
    api.canUndoSelected = () => looper.canUndo(api.selectedTrack);

    addUndoButtons();
    addEventListener('neusic:live-loop-track', event => updateButton(event.detail?.index));
    document.addEventListener('keydown', event => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if (event.target.matches('input,textarea,select')) return;
      event.preventDefault();
      restoreSnapshot(api.selectedTrack);
    });

    updateAllButtons();
    window.dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message:'Loop undo is ready. Use UNDO on any lane or press Ctrl/Command + Z.'}}));
  };

  addEventListener('neusic:live-loop-ready', install, {once:true});
  if (window.NeusicLiveLoop?.looper) install();
})();
