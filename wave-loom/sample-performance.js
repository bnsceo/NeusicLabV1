(() => {
  'use strict';
  if (window.NeusicSamplePerformance) return;

  const R = window.NeusicWaveReliability;
  const W = window.NeusicAudioWorkspace;
  const SCALE_STEPS = {
    minor:[0,2,3,5,7,8,10], major:[0,2,4,5,7,9,11], dorian:[0,2,3,5,7,9,10],
    pentatonic:[0,3,5,7,10], chromatic:[0,1,2,3,4,5,6,7,8,9,10,11]
  };
  const playback = {running:false,nextLoopTime:0,loopDuration:0,timer:0,lastCorePlaying:false,sources:new Set(),cache:new Map(),selectedNode:-1};
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

  function coreState() { return R.loom?.state; }

  function midiForNode(node) {
    const core = coreState();
    const scale = SCALE_STEPS[core?.scale] || SCALE_STEPS.minor;
    const normalized = 1 - Number(node?.y || .5);
    const degree = Math.round(normalized * 20);
    const octave = 2 + Math.floor(degree / scale.length);
    return 12 * (octave + 1) + Number(core?.root || 0) + scale[degree % scale.length];
  }

  function assignmentFor(node) {
    const sample = R.selectedSample();
    const current = R.state.nodeAssignments[node.id] || {};
    return {
      sampleId:current.sampleId || sample?.id || null,
      sliceId:current.sliceId || null,
      probability:clamp(Number(current.probability ?? 1),0,1),
      transpose:clamp(Number(current.transpose || 0),-24,24),
      length:clamp(Number(current.length ?? .8),.05,4),
      reverse:Boolean(current.reverse),
      pan:clamp(Number(current.pan ?? ((node.x - .5) * 1.3)),-1,1),
      delaySend:clamp(Number(current.delaySend ?? .16),0,1),
      reverbSend:clamp(Number(current.reverbSend ?? .18),0,1)
    };
  }

  function bufferKey(sample, reverse = false) {
    const edit = sample.edit || {};
    return [sample.id,sample.updatedAt,edit.trimStart,edit.trimEnd,edit.fadeIn,edit.fadeOut,edit.gainDb,edit.reverse,edit.normalized,reverse].join('|');
  }

  function renderEditedBuffer(sample, forceReverse = false) {
    if (!sample?.buffer) throw new Error('No sample is selected.');
    const key = bufferKey(sample,forceReverse);
    if (playback.cache.has(key)) return playback.cache.get(key);
    const edit = sample.edit || {};
    const source = sample.buffer;
    const startRatio = clamp(Number(edit.trimStart ?? 0),0,.999);
    const endRatio = clamp(Number(edit.trimEnd ?? 1),startRatio + .001,1);
    const start = Math.floor(source.length * startRatio);
    const end = Math.max(start + 1,Math.floor(source.length * endRatio));
    const length = end - start;
    const output = W.context.createBuffer(source.numberOfChannels,length,source.sampleRate);
    const reverse = Boolean(edit.reverse) !== Boolean(forceReverse);
    let peak = 0;
    for (let channel = 0; channel < source.numberOfChannels; channel++) {
      const from = source.getChannelData(channel);
      const to = output.getChannelData(channel);
      for (let index = 0; index < length; index++) {
        const sourceIndex = reverse ? end - 1 - index : start + index;
        to[index] = from[sourceIndex] || 0;
        peak = Math.max(peak,Math.abs(to[index]));
      }
    }
    const gainDb = Number(edit.gainDb || 0);
    const normalizeGain = edit.normalized && peak > .00001 ? .98 / peak : 1;
    const gain = Math.pow(10,gainDb / 20) * normalizeGain;
    const fadeInFrames = Math.min(length,Math.floor(source.sampleRate * Number(edit.fadeIn || 0) / 1000));
    const fadeOutFrames = Math.min(length,Math.floor(source.sampleRate * Number(edit.fadeOut || 0) / 1000));
    for (let channel = 0; channel < output.numberOfChannels; channel++) {
      const data = output.getChannelData(channel);
      for (let index = 0; index < length; index++) {
        let envelope = gain;
        if (fadeInFrames && index < fadeInFrames) envelope *= index / fadeInFrames;
        if (fadeOutFrames && index >= length - fadeOutFrames) envelope *= (length - 1 - index) / fadeOutFrames;
        data[index] = clamp(data[index] * envelope,-1,1);
      }
    }
    playback.cache.set(key,output);
    if (playback.cache.size > 40) playback.cache.delete(playback.cache.keys().next().value);
    return output;
  }

  function sliceWindow(sample, buffer, sliceId) {
    const slice = sample.slices?.find(item => item.id === sliceId);
    if (!slice) return {offset:0,duration:buffer.duration,slice:null};
    const start = clamp(Number(slice.start || 0),0,.999);
    const end = clamp(Number(slice.end || 1),start + .001,1);
    return {offset:start * buffer.duration,duration:(end - start) * buffer.duration,slice};
  }

  function connectVoice(source,gain,pan,assignment) {
    source.connect(pan);
    pan.connect(gain);
    gain.connect(W.buses.samples);
    const delay = W.context.createGain();
    const reverb = W.context.createGain();
    delay.gain.value = assignment.delaySend;
    reverb.gain.value = assignment.reverbSend;
    gain.connect(delay);delay.connect(W.buses.delayInput);
    gain.connect(reverb);reverb.connect(W.buses.reverbInput);
  }

  function scheduleStandard(sample,node,assignment,when,durationScale = 1) {
    const buffer = renderEditedBuffer(sample,assignment.reverse);
    const window = sliceWindow(sample,buffer,assignment.sliceId);
    const source = W.context.createBufferSource();
    const gain = W.context.createGain();
    const pan = W.context.createStereoPanner ? W.context.createStereoPanner() : W.context.createGain();
    const core = coreState();
    const rootMidi = 60 + Number(core?.root || 0);
    const semitones = midiForNode(node) - rootMidi + assignment.transpose;
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(clamp(Math.pow(2,semitones / 12),.25,4),when);
    if (pan.pan) pan.pan.setValueAtTime(assignment.pan,when);
    const attack = .006;
    const available = window.duration / source.playbackRate.value;
    const duration = Math.max(.035,Math.min(available,assignment.length * durationScale));
    const level = clamp((Number(node.velocity || 96) / 127) * .7,.03,.82);
    gain.gain.setValueAtTime(.0001,when);
    gain.gain.exponentialRampToValueAtTime(level,when + attack);
    gain.gain.setValueAtTime(level,Math.max(when + attack,when + duration - .018));
    gain.gain.exponentialRampToValueAtTime(.0001,when + duration);
    connectVoice(source,gain,pan,assignment);
    source.start(when,window.offset,Math.max(.01,Math.min(window.duration,duration * source.playbackRate.value)));
    source.stop(when + duration + .04);
    W.trackSource(source);
    playback.sources.add(source);
    source.addEventListener('ended',()=>playback.sources.delete(source),{once:true});
  }

  function scheduleGranular(sample,node,assignment,when) {
    const buffer = renderEditedBuffer(sample,assignment.reverse);
    const window = sliceWindow(sample,buffer,assignment.sliceId);
    const core = coreState();
    const rootMidi = 60 + Number(core?.root || 0);
    const rate = clamp(Math.pow(2,(midiForNode(node) - rootMidi + assignment.transpose) / 12),.35,3);
    const total = Math.max(.1,Math.min(assignment.length,1.4));
    const grainSize = clamp(.035 + (1 - Number(core?.density || .46)) * .08,.03,.12);
    const grainCount = Math.max(3,Math.min(18,Math.ceil(total / (grainSize * .55))));
    for (let grain = 0; grain < grainCount; grain++) {
      const source = W.context.createBufferSource();
      const gain = W.context.createGain();
      const pan = W.context.createStereoPanner ? W.context.createStereoPanner() : W.context.createGain();
      const grainWhen = when + grain * total / grainCount;
      const progress = grain / Math.max(1,grainCount - 1);
      const jitter = (Math.random() - .5) * Math.min(.035,window.duration * .12);
      const offset = clamp(window.offset + progress * Math.max(0,window.duration - grainSize) + jitter,window.offset,Math.max(window.offset,window.offset + window.duration - grainSize));
      source.buffer = buffer;
      source.playbackRate.value = rate * (.985 + Math.random() * .03);
      if (pan.pan) pan.pan.value = clamp(assignment.pan + (Math.random() - .5) * .35,-1,1);
      const level = clamp((Number(node.velocity || 96) / 127) * .28,.02,.35);
      gain.gain.setValueAtTime(.0001,grainWhen);
      gain.gain.linearRampToValueAtTime(level,grainWhen + grainSize * .35);
      gain.gain.linearRampToValueAtTime(.0001,grainWhen + grainSize);
      connectVoice(source,gain,pan,assignment);
      source.start(grainWhen,offset,Math.min(grainSize * rate,window.duration));
      source.stop(grainWhen + grainSize + .03);
      W.trackSource(source);
      playback.sources.add(source);
      source.addEventListener('ended',()=>playback.sources.delete(source),{once:true});
    }
  }

  function scheduleNode(node,when,loopDuration) {
    const assignment = assignmentFor(node);
    if (!assignment.sampleId || Math.random() > assignment.probability) return;
    const sample = R.state.samples.find(item => item.id === assignment.sampleId);
    if (!sample) return;
    if (R.state.engineMode === 'granular') scheduleGranular(sample,node,assignment,when);
    else scheduleStandard(sample,node,assignment,when,Math.max(.08,loopDuration / 4));
  }

  function scheduleLoop(startTime) {
    const core = coreState();
    if (!core) return;
    const duration = 60 / Number(core.tempo || 112) * 4;
    playback.loopDuration = duration;
    const span = Math.max(.001,Number(core.loopEnd || .945) - Number(core.loopStart || .055));
    [...core.nodes].sort((a,b)=>a.x-b.x).forEach(node => {
      if (node.x < core.loopStart || node.x > core.loopEnd) return;
      const ratio = (node.x - core.loopStart) / span;
      scheduleNode(node,startTime + ratio * duration,duration);
    });
  }

  function schedulerPass() {
    if (!playback.running) return;
    const ctx = W.context;
    while (playback.nextLoopTime < ctx.currentTime + .22) {
      scheduleLoop(playback.nextLoopTime);
      playback.nextLoopTime += playback.loopDuration || 60 / Number(coreState()?.tempo || 112) * 4;
    }
  }

  function setLegacyLevel() {
    const master = coreState()?.audio?.master;
    if (!master?.gain || !coreState()?.audio?.ctx) return;
    const level = R.state.engineMode === 'wave' ? .68 : R.state.engineMode === 'hybrid' ? .38 : 0;
    master.gain.setTargetAtTime(level,coreState().audio.ctx.currentTime,.018);
  }

  async function start() {
    if (playback.running || R.state.engineMode === 'wave') { setLegacyLevel(); return; }
    await W.resume();
    playback.running = true;
    playback.nextLoopTime = W.context.currentTime + .065;
    playback.loopDuration = 60 / Number(coreState()?.tempo || 112) * 4;
    schedulerPass();
    playback.timer = setInterval(schedulerPass,25);
    setLegacyLevel();
  }

  function stop() {
    playback.running = false;
    clearInterval(playback.timer);
    playback.timer = 0;
    playback.sources.forEach(source => { try { source.stop(); } catch (_) {} });
    playback.sources.clear();
    setLegacyLevel();
  }

  function syncCoreTransport() {
    const playing = Boolean(coreState()?.playing);
    if (playing !== playback.lastCorePlaying) {
      playback.lastCorePlaying = playing;
      if (playing) start().catch(error => R.setStatus(error.message,'error'));
      else stop();
    }
    if (playing && R.state.engineMode !== 'wave' && !playback.running) start().catch(()=>{});
    if ((!playing || R.state.engineMode === 'wave') && playback.running) stop();
    setLegacyLevel();
  }

  function previewSample(sample = R.selectedSample(), sliceId = R.state.selectedSliceId) {
    if (!sample) { R.setStatus('Add or select a Forge sample first.'); return; }
    W.resume().then(() => {
      const buffer = renderEditedBuffer(sample,false);
      const window = sliceWindow(sample,buffer,sliceId);
      const source = W.context.createBufferSource();
      const gain = W.context.createGain();
      source.buffer = buffer;gain.gain.value=.72;
      source.connect(gain);gain.connect(W.buses.preview);
      source.start(W.context.currentTime,window.offset,window.duration);
      W.trackSource(source);
      R.setStatus(`Previewing ${sample.name}${window.slice ? ` · ${window.slice.name}` : ''}.`,'live');
    }).catch(error => R.setStatus(error.message,'error'));
  }

  function setEngineMode(mode) {
    if (!['wave','sample','granular','hybrid'].includes(mode)) return;
    R.state.engineMode = mode;
    R.queueProjectSave();
    if (mode === 'wave') stop();
    else if (coreState()?.playing) start().catch(()=>{});
    setLegacyLevel();
    renderEngineControls();
    R.setStatus(`${mode.toUpperCase()} performance engine selected.`,'live');
  }

  function mapSelectedToNode(nodeIndex = Number(coreState()?.selectedNode || 0)) {
    const node = coreState()?.nodes?.[nodeIndex];
    const sample = R.selectedSample();
    if (!node || !sample) { R.setStatus('Select a node and a Forge sample first.'); return; }
    R.state.nodeAssignments[node.id] = {
      ...assignmentFor(node),sampleId:sample.id,sliceId:R.state.selectedSliceId || null
    };
    R.queueProjectSave();
    refreshNodeAssignment();
    R.setStatus(`${sample.name} mapped to Node ${String(nodeIndex + 1).padStart(2,'0')}.`,'live');
  }

  function buildEngineControls() {
    const cluster = document.querySelector('.loom-command-cluster');
    if (!cluster || document.getElementById('performanceEngine')) return;
    const panel = document.createElement('div');
    panel.className = 'performance-engine-control';
    panel.innerHTML = `<label>ENGINE<select id="performanceEngine"><option value="wave">WAVE</option><option value="sample">SAMPLE</option><option value="granular">GRANULAR</option><option value="hybrid">HYBRID</option></select></label><label>SOURCE<select id="performanceSample"></select></label>`;
    cluster.prepend(panel);
    panel.querySelector('#performanceEngine').addEventListener('change',event=>setEngineMode(event.target.value));
    panel.querySelector('#performanceSample').addEventListener('change',event=>R.selectSample(event.target.value));
  }

  function renderEngineControls() {
    const mode = document.getElementById('performanceEngine');
    const sample = document.getElementById('performanceSample');
    if (mode) mode.value = R.state.engineMode;
    if (sample) {
      sample.innerHTML = R.state.samples.length ? R.state.samples.map(item=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('') : '<option value="">NO SAMPLES</option>';
      sample.value = R.state.selectedSampleId || '';
      sample.disabled = !R.state.samples.length;
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  }

  function buildNodeAssignmentPanel() {
    const selectedCard = document.querySelector('.inspector-card.selected-node');
    if (!selectedCard || document.getElementById('nodeSampleAssignment')) return;
    const panel = document.createElement('section');
    panel.id = 'nodeSampleAssignment';
    panel.className = 'node-sample-assignment';
    panel.innerHTML = `<header><span>SAMPLE PERFORMANCE</span><b>NODE MAP</b></header>
      <label>SOURCE<select data-node-source></select></label>
      <label>SLICE<select data-node-slice></select></label>
      <div class="node-map-grid">
        <label>PROBABILITY<input data-node-prob type="range" min="0" max="100" value="100"><output>100%</output></label>
        <label>TRANSPOSE<input data-node-pitch type="range" min="-24" max="24" value="0"><output>0st</output></label>
        <label>LENGTH<input data-node-length type="range" min="5" max="400" value="80"><output>0.80s</output></label>
        <label class="node-reverse"><input data-node-reverse type="checkbox"><span>REVERSE NODE</span></label>
      </div>
      <button data-map-selected type="button">MAP SELECTED SAMPLE TO NODE</button>`;
    selectedCard.appendChild(panel);
    panel.querySelector('[data-map-selected]').onclick=()=>mapSelectedToNode();
    panel.querySelectorAll('select,input').forEach(control=>control.addEventListener('input',()=>updateNodeAssignmentFromPanel(panel)));
  }

  function updateNodeAssignmentFromPanel(panel) {
    const node = coreState()?.nodes?.[Number(coreState()?.selectedNode || 0)];
    if (!node) return;
    const assignment = assignmentFor(node);
    assignment.sampleId = panel.querySelector('[data-node-source]').value || null;
    assignment.sliceId = panel.querySelector('[data-node-slice]').value || null;
    assignment.probability = Number(panel.querySelector('[data-node-prob]').value) / 100;
    assignment.transpose = Number(panel.querySelector('[data-node-pitch]').value);
    assignment.length = Number(panel.querySelector('[data-node-length]').value) / 100;
    assignment.reverse = panel.querySelector('[data-node-reverse]').checked;
    R.state.nodeAssignments[node.id] = assignment;
    panel.querySelector('[data-node-prob]+output').textContent=`${Math.round(assignment.probability*100)}%`;
    panel.querySelector('[data-node-pitch]+output').textContent=`${assignment.transpose}st`;
    panel.querySelector('[data-node-length]+output').textContent=`${assignment.length.toFixed(2)}s`;
    R.queueProjectSave();
  }

  function refreshNodeAssignment() {
    const panel = document.getElementById('nodeSampleAssignment');
    const node = coreState()?.nodes?.[Number(coreState()?.selectedNode || 0)];
    if (!panel || !node) return;
    const assignment = assignmentFor(node);
    const source = panel.querySelector('[data-node-source]');
    source.innerHTML = R.state.samples.length ? R.state.samples.map(sample=>`<option value="${sample.id}">${escapeHtml(sample.name)}</option>`).join('') : '<option value="">NO SAMPLE</option>';
    source.value = assignment.sampleId || '';
    const sample = R.state.samples.find(item=>item.id===assignment.sampleId) || R.selectedSample();
    const slice = panel.querySelector('[data-node-slice]');
    slice.innerHTML = '<option value="">FULL SAMPLE</option>' + (sample?.slices || []).map(item=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
    slice.value = assignment.sliceId || '';
    panel.querySelector('[data-node-prob]').value=Math.round(assignment.probability*100);
    panel.querySelector('[data-node-pitch]').value=assignment.transpose;
    panel.querySelector('[data-node-length]').value=Math.round(assignment.length*100);
    panel.querySelector('[data-node-reverse]').checked=assignment.reverse;
    panel.querySelector('[data-node-prob]+output').textContent=`${Math.round(assignment.probability*100)}%`;
    panel.querySelector('[data-node-pitch]+output').textContent=`${assignment.transpose}st`;
    panel.querySelector('[data-node-length]+output').textContent=`${assignment.length.toFixed(2)}s`;
  }

  function monitorSelectedNode() {
    const next = Number(coreState()?.selectedNode ?? -1);
    if (next !== playback.selectedNode) { playback.selectedNode=next;refreshNodeAssignment(); }
  }

  const api = {playback,midiForNode,assignmentFor,renderEditedBuffer,sliceWindow,previewSample,setEngineMode,mapSelectedToNode,start,stop};
  window.NeusicSamplePerformance = api;

  R.ready.then(value => {
    if (!value) return;
    buildEngineControls();
    buildNodeAssignmentPanel();
    renderEngineControls();
    refreshNodeAssignment();
    R.events.addEventListener('sampleschange',()=>{playback.cache.clear();renderEngineControls();refreshNodeAssignment();});
    R.events.addEventListener('selectionchange',()=>{renderEngineControls();refreshNodeAssignment();});
    setInterval(syncCoreTransport,35);
    setInterval(monitorSelectedNode,80);
  });
})();