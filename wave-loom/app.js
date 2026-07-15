(() => {
  'use strict';

  const canvas = document.getElementById('loomCanvas');
  const ctx = canvas.getContext('2d');
  const frame = document.getElementById('loomFrame');
  const spectrumCanvas = document.getElementById('spectrumCanvas');
  const spectrumCtx = spectrumCanvas.getContext('2d');
  const sampleShelf = document.getElementById('sampleShelf');
  const TAU = Math.PI * 2;
  const POINTS = 96;
  const ROOTS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const SCALE_STEPS = {
    minor:[0,2,3,5,7,8,10],
    major:[0,2,4,5,7,9,11],
    dorian:[0,2,3,5,7,9,10],
    pentatonic:[0,3,5,7,10],
    chromatic:[0,1,2,3,4,5,6,7,8,9,10,11]
  };
  const STORE = 'neusic-wave-loom-lab-v2';
  const LEGACY_STORE = 'neusic-wave-loom-lab-v1';
  const PATCH_TYPE = 'neusic-wave-loom-patch';
  const HISTORY_LIMIT = 60;
  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

  function defaultPoints() {
    return Array.from({length:POINTS}, (_, index) => {
      const t = index / (POINTS - 1);
      return Math.sin(t * TAU * 2) * .27 + Math.sin(t * TAU * 5 + .8) * .09 + Math.sin(t * TAU * 9) * .035;
    });
  }

  function defaultNodes() {
    return Array.from({length:8}, (_, index) => ({
      id:`node-${index + 1}`,
      x:.11 + index * .105,
      y:.46 + Math.sin(index * 1.48) * .19,
      velocity:88 + (index * 7) % 34
    }));
  }

  const state = {
    points:defaultPoints(),
    basePoints:null,
    nodes:defaultNodes(),
    loopStart:.055,
    loopEnd:.945,
    tempo:112,
    root:0,
    scale:'minor',
    harmonics:.58,
    density:.46,
    space:.32,
    morph:0,
    tool:'sculpt',
    selectedNode:0,
    hoverNode:-1,
    zeroPerc:true,
    livePreview:true,
    snapGrid:true,
    snapSteps:16,
    preset:'default',
    playing:false,
    pointer:null,
    samples:[],
    selectedSampleId:null,
    forgeZoom:1,
    history:[],
    future:[],
    saveTimer:0,
    mic:{stream:null,recorder:null,chunks:[],analyser:null,data:null,startTime:0},
    audio:{
      ctx:null,master:null,dry:null,wet:null,delay:null,feedback:null,compressor:null,
      analyser:null,freqData:null,nextLoopTime:0,timer:0,loopDuration:0,periodicWave:null
    },
    animation:0,
    playhead:0
  };
  state.basePoints = state.points.slice();

  const PRESETS = {
    default:defaultPoints,
    sine:() => Array.from({length:POINTS}, (_, index) => Math.sin(index / (POINTS - 1) * TAU) * .56),
    saw:() => Array.from({length:POINTS}, (_, index) => {
      const t = index / (POINTS - 1);
      const phase = (t * 2) % 1;
      return ((phase * 2) - 1) * .46 + Math.sin(t * TAU * 4) * .05;
    }),
    formant:() => Array.from({length:POINTS}, (_, index) => {
      const t = index / (POINTS - 1);
      const envelope = .72 + .28 * Math.sin(t * TAU);
      return clamp(
        Math.sin(t * TAU * 2) * .28 +
        Math.sin(t * TAU * 7 + .4) * .19 * envelope +
        Math.sin(t * TAU * 12 + 1.1) * .10,
        -.9,.9
      );
    }),
    glass:() => Array.from({length:POINTS}, (_, index) => {
      const t = index / (POINTS - 1);
      return (
        Math.sin(t * TAU * 3) * .24 +
        Math.sin(t * TAU * 11 + .6) * .16 +
        Math.sin(t * TAU * 19 + 1.7) * .08 +
        Math.sin(t * TAU * 29) * .035
      );
    }),
    noise:() => {
      const raw = Array.from({length:POINTS}, (_, index) => {
        const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
        return ((value - Math.floor(value)) * 2 - 1) * .55;
      });
      return raw.map((value, index) => (
        (raw[index - 2] || value) +
        (raw[index - 1] || value) * 2 +
        value * 3 +
        (raw[index + 1] || value) * 2 +
        (raw[index + 2] || value)
      ) / 9);
    }
  };

  function setStatus(message, live = state.playing) {
    $('statusMessage').textContent = message;
    $('engineStatus').textContent = live ? 'ENGINE ACTIVE' : 'ENGINE IDLE';
    $('engineLed').classList.toggle('live', live);
  }

  function serializableData() {
    return {
      points:state.points.slice(),
      nodes:state.nodes.map(node => ({...node})),
      loopStart:state.loopStart,
      loopEnd:state.loopEnd,
      tempo:state.tempo,
      root:state.root,
      scale:state.scale,
      harmonics:state.harmonics,
      density:state.density,
      space:state.space,
      morph:state.morph,
      zeroPerc:state.zeroPerc,
      livePreview:state.livePreview,
      snapGrid:state.snapGrid,
      snapSteps:state.snapSteps,
      preset:state.preset
    };
  }

  function cloneSample(sample) {
    return {
      ...sample,
      peaks:Array.isArray(sample.peaks) ? sample.peaks.map(peak => peak.slice()) : []
    };
  }

  function snapshot() {
    return {
      ...serializableData(),
      basePoints:state.basePoints.slice(),
      samples:state.samples.map(cloneSample),
      selectedSampleId:state.selectedSampleId,
      selectedNode:state.selectedNode,
      forgeZoom:state.forgeZoom
    };
  }

  function applySnapshot(data) {
    state.points = data.points.slice();
    state.basePoints = (data.basePoints || data.points).slice();
    state.nodes = data.nodes.map(node => ({...node}));
    state.loopStart = data.loopStart;
    state.loopEnd = data.loopEnd;
    state.tempo = data.tempo;
    state.root = data.root;
    state.scale = data.scale;
    state.harmonics = data.harmonics;
    state.density = data.density;
    state.space = data.space;
    state.morph = data.morph;
    state.zeroPerc = data.zeroPerc;
    state.livePreview = data.livePreview;
    state.snapGrid = data.snapGrid;
    state.snapSteps = data.snapSteps;
    state.preset = data.preset || 'custom';
    state.samples = (data.samples || state.samples).map(cloneSample);
    state.selectedSampleId = data.selectedSampleId || null;
    state.selectedNode = clamp(Number(data.selectedNode) || 0, 0, Math.max(0, state.nodes.length - 1));
    state.forgeZoom = clamp(Number(data.forgeZoom) || 1, 1, 8);
    state.audio.periodicWave = null;
    updateSpace();
    updateControls();
    renderSamples();
    saveState();
  }

  function checkpoint() {
    state.history.push(snapshot());
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    state.future.length = 0;
    updateHistoryButtons();
  }

  function undo() {
    if (!state.history.length) {
      setStatus('Nothing to undo.');
      return;
    }
    state.future.push(snapshot());
    applySnapshot(state.history.pop());
    updateHistoryButtons();
    setStatus('Undo restored the previous Loom state.');
  }

  function redo() {
    if (!state.future.length) {
      setStatus('Nothing to redo.');
      return;
    }
    state.history.push(snapshot());
    applySnapshot(state.future.pop());
    updateHistoryButtons();
    setStatus('Redo restored the next Loom state.');
  }

  function updateHistoryButtons() {
    $('undoBtn').disabled = !state.history.length;
    $('redoBtn').disabled = !state.future.length;
  }

  function queueSave() {
    clearTimeout(state.saveTimer);
    $('patchState').textContent = 'SAVING';
    state.saveTimer = setTimeout(saveState, 120);
  }

  function saveState() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        type:PATCH_TYPE,
        version:2,
        updatedAt:new Date().toISOString(),
        data:serializableData()
      }));
      $('patchState').textContent = 'AUTOSAVED';
    } catch (error) {
      console.warn('Wave Loom autosave failed', error);
      $('patchState').textContent = 'LOCAL ONLY';
    }
  }

  function sanitizePatch(input) {
    const source = input?.data || input;
    if (!source || !Array.isArray(source.points) || source.points.length !== POINTS || !Array.isArray(source.nodes)) {
      throw new Error('This is not a compatible Wave Loom patch.');
    }
    const data = {
      points:source.points.map(value => clamp(Number(value) || 0, -.98, .98)),
      nodes:source.nodes.map((node, index) => ({
        id:node.id || `node-${index + 1}`,
        x:clamp(Number(node.x) || .1, .02, .98),
        y:clamp(Number(node.y) || .5, .04, .96),
        velocity:clamp(Number(node.velocity) || 96, 1, 127)
      })),
      loopStart:clamp(Number(source.loopStart) || .055, .015, .85),
      loopEnd:clamp(Number(source.loopEnd) || .945, .15, .985),
      tempo:clamp(Number(source.tempo) || 112, 40, 220),
      root:clamp(Number(source.root) || 0, 0, 11),
      scale:SCALE_STEPS[source.scale] ? source.scale : 'minor',
      harmonics:clamp(finite(source.harmonics,.58), 0, 1),
      density:clamp(finite(source.density,.46), 0, 1),
      space:clamp(finite(source.space,.32), 0, 1),
      morph:clamp(finite(source.morph,0), 0, 1),
      zeroPerc:source.zeroPerc !== false,
      livePreview:source.livePreview !== false,
      snapGrid:source.snapGrid !== false,
      snapSteps:[8,16,32].includes(Number(source.snapSteps)) ? Number(source.snapSteps) : 16,
      preset:PRESETS[source.preset] ? source.preset : 'custom'
    };
    if (data.loopEnd - data.loopStart < .08) data.loopEnd = clamp(data.loopStart + .08, .15, .985);
    return data;
  }

  function applyPatch(input, options = {}) {
    const data = sanitizePatch(input);
    if (options.history !== false) checkpoint();
    Object.assign(state, data);
    state.basePoints = state.points.slice();
    state.selectedNode = clamp(state.selectedNode, 0, Math.max(0, state.nodes.length - 1));
    state.audio.periodicWave = null;
    updateControls();
    saveState();
    if (options.status !== false) setStatus('Wave Loom patch loaded.');
  }

  function loadState() {
    try {
      const current = JSON.parse(localStorage.getItem(STORE) || 'null');
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORE) || 'null');
      if (current) applyPatch(current, {history:false,status:false});
      else if (legacy) applyPatch(legacy, {history:false,status:false});
    } catch (error) {
      console.warn('Wave Loom patch recovery failed', error);
    }
  }

  function patchFile() {
    return {
      type:PATCH_TYPE,
      version:2,
      name:`Neusic Loom ${new Date().toLocaleDateString()}`,
      createdAt:new Date().toISOString(),
      data:serializableData()
    };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function savePatchFile() {
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(
      new Blob([JSON.stringify(patchFile(), null, 2)], {type:'application/json'}),
      `neusic-wave-loom-${stamp}.neusic-loom.json`
    );
    setStatus('Portable Loom patch downloaded.');
  }

  async function loadPatchFile(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      applyPatch(parsed);
      setStatus(`${file.name} loaded into the Wave Loom.`);
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'The selected patch could not be loaded.');
    } finally {
      $('patchFileInput').value = '';
    }
  }

  function resizeCanvas(canvasElement, context, rect) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvasElement.width !== width || canvasElement.height !== height) {
      canvasElement.width = width;
      canvasElement.height = height;
      canvasElement.style.width = `${rect.width}px`;
      canvasElement.style.height = `${rect.height}px`;
    }
    context.setTransform(dpr,0,0,dpr,0,0);
  }

  function resize() {
    resizeCanvas(canvas, ctx, frame.getBoundingClientRect());
    const spectrumRect = spectrumCanvas.getBoundingClientRect();
    if (spectrumRect.width && spectrumRect.height) resizeCanvas(spectrumCanvas, spectrumCtx, spectrumRect);
    draw();
    drawSpectrum();
  }

  function geometry() {
    const rect = canvas.getBoundingClientRect();
    return {w:rect.width,h:rect.height,cx:rect.width / 2,cy:rect.height / 2,amp:Math.max(70,rect.height * .29)};
  }

  function waveYAt(x) {
    const raw = clamp(x,0,1) * (POINTS - 1);
    const index = Math.floor(raw);
    const fraction = raw - index;
    return lerp(state.points[index] || 0, state.points[Math.min(POINTS - 1,index + 1)] || 0, fraction);
  }

  function canvasToNormalized(x,y) {
    const g = geometry();
    return {x:clamp(x / g.w,0,1),y:clamp(y / g.h,0,1),wave:clamp((g.cy - y) / g.amp,-1,1)};
  }

  function drawGrid(g) {
    ctx.save();
    ctx.strokeStyle = 'rgba(75,190,205,.065)';
    ctx.lineWidth = 1;
    for (let index = 1; index < 16; index++) {
      const x = index * g.w / 16;
      ctx.beginPath();
      ctx.moveTo(x,0);
      ctx.lineTo(x,g.h);
      ctx.stroke();
    }
    for (let index = 1; index < 8; index++) {
      const y = index * g.h / 8;
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(g.w,y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(89,241,255,.17)';
    ctx.beginPath();
    ctx.moveTo(0,g.cy);
    ctx.lineTo(g.w,g.cy);
    ctx.stroke();
    ctx.restore();
  }

  function drawBoundary(x, side, g) {
    const px = x * g.w;
    const width = Math.max(15,g.w * .018);
    const gradient = ctx.createLinearGradient(px - width,0,px + width,0);
    gradient.addColorStop(0,'rgba(160,240,255,0)');
    gradient.addColorStop(.5,'rgba(182,247,255,.17)');
    gradient.addColorStop(1,'rgba(160,240,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(px - width,0,width * 2,g.h);
    ctx.strokeStyle = 'rgba(180,247,255,.62)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px,0);
    ctx.lineTo(px,g.h);
    ctx.stroke();
    ctx.fillStyle = 'rgba(175,242,250,.74)';
    ctx.font = '700 7px "JetBrains Mono", monospace';
    ctx.textAlign = side === 'left' ? 'left' : 'right';
    ctx.fillText(side === 'left' ? 'LOOP IN' : 'LOOP OUT', px + (side === 'left' ? 7 : -7), g.h - 15);
  }

  function buildPath(g, depth = 0, phase = 0) {
    ctx.beginPath();
    for (let index = 0; index < POINTS; index++) {
      const x = index / (POINTS - 1);
      const px = x * g.w;
      const perspective = (x - .5) * depth * 6;
      const point = state.points[index];
      const flutter = Math.sin(phase * 1.7 + index * .43) * .008 * state.harmonics;
      const py = g.cy - (point + flutter) * g.amp + depth * 8 + perspective;
      if (!index) ctx.moveTo(px,py);
      else ctx.lineTo(px,py);
    }
  }

  function drawWave(g,time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    [
      {depth:-2,color:'rgba(155,108,255,.13)',blur:24,width:7},
      {depth:2,color:'rgba(101,255,156,.10)',blur:22,width:6},
      {depth:0,color:'rgba(41,243,255,.18)',blur:28,width:10}
    ].forEach(layer => {
      ctx.shadowColor = layer.color;
      ctx.shadowBlur = layer.blur;
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = layer.width;
      buildPath(g,layer.depth,time * .0008);
      ctx.stroke();
    });
    const gradient = ctx.createLinearGradient(0,0,g.w,0);
    gradient.addColorStop(0,'#34f5ff');
    gradient.addColorStop(.32,'#7ffff0');
    gradient.addColorStop(.58,'#a978ff');
    gradient.addColorStop(.82,'#4effa1');
    gradient.addColorStop(1,'#2ddcff');
    ctx.shadowColor = '#38eaff';
    ctx.shadowBlur = 17;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.1;
    buildPath(g,0,time * .001);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.68)';
    ctx.lineWidth = .55;
    buildPath(g,0,time * .001);
    ctx.stroke();
    ctx.restore();
  }

  function zeroCrossings() {
    const events = [];
    for (let index = 1; index < POINTS; index++) {
      const a = state.points[index - 1];
      const b = state.points[index];
      if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
        const fraction = Math.abs(a) / (Math.abs(a) + Math.abs(b));
        const x = ((index - 1) + fraction) / (POINTS - 1);
        if (x >= state.loopStart && x <= state.loopEnd) events.push(x);
      }
    }
    return events;
  }

  function drawCrossings(g) {
    const crossings = zeroCrossings();
    ctx.save();
    crossings.forEach(x => {
      const px = x * g.w;
      ctx.fillStyle = 'rgba(101,255,156,.75)';
      ctx.shadowColor = '#65ff9c';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px,g.cy,2.1,0,TAU);
      ctx.fill();
    });
    ctx.restore();
    $('crossCount').textContent = `${crossings.length} CROSSINGS`;
  }

  function nodePosition(node) {
    const g = geometry();
    return {x:node.x * g.w,y:node.y * g.h};
  }

  function selectedNode() {
    return state.nodes[state.selectedNode] || null;
  }

  function midiForNode(node) {
    const scale = SCALE_STEPS[state.scale] || SCALE_STEPS.minor;
    const normalized = 1 - node.y;
    const degree = Math.round(normalized * 20);
    const octave = 2 + Math.floor(degree / scale.length);
    return 12 * (octave + 1) + state.root + scale[degree % scale.length];
  }

  function midiName(midi) {
    return ROOTS[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  function nodeStep(node) {
    const ratio = (node.x - state.loopStart) / Math.max(.001,state.loopEnd - state.loopStart);
    return clamp(Math.round(ratio * state.snapSteps),0,state.snapSteps);
  }

  function nodeTimeLabel(node) {
    return `${String(nodeStep(node) + 1).padStart(2,'0')}/${state.snapSteps}`;
  }

  function roundedRect(context,x,y,width,height,radius) {
    context.beginPath();
    if (context.roundRect) context.roundRect(x,y,width,height,radius);
    else {
      context.moveTo(x + radius,y);
      context.lineTo(x + width - radius,y);
      context.quadraticCurveTo(x + width,y,x + width,y + radius);
      context.lineTo(x + width,y + height - radius);
      context.quadraticCurveTo(x + width,y + height,x + width - radius,y + height);
      context.lineTo(x + radius,y + height);
      context.quadraticCurveTo(x,y + height,x,y + height - radius);
      context.lineTo(x,y + radius);
      context.quadraticCurveTo(x,y,x + radius,y);
    }
  }

  function drawNodeLabel(node,index,p,g) {
    const label = `NODE ${String(index + 1).padStart(2,'0')}  ${midiName(midiForNode(node))}  ${nodeTimeLabel(node)}`;
    ctx.save();
    ctx.font = '700 7px "JetBrains Mono",monospace';
    const width = ctx.measureText(label).width + 14;
    const x = clamp(p.x - width / 2,6,g.w - width - 6);
    const y = p.y < 42 ? p.y + 18 : p.y - 34;
    roundedRect(ctx,x,y,width,20,4);
    ctx.fillStyle = 'rgba(3,11,15,.94)';
    ctx.fill();
    ctx.strokeStyle = index === state.selectedNode ? 'rgba(255,79,200,.7)' : 'rgba(41,243,255,.48)';
    ctx.stroke();
    ctx.fillStyle = '#c8f9fb';
    ctx.textAlign = 'center';
    ctx.fillText(label,x + width / 2,y + 13);
    ctx.restore();
  }

  function drawNodes(g) {
    state.nodes.forEach((node,index) => {
      if (node.x < state.loopStart || node.x > state.loopEnd) return;
      const p = nodePosition(node);
      const selected = index === state.selectedNode;
      const hovered = index === state.hoverNode;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(p.x - 3,p.y - 4,1,p.x,p.y,selected ? 26 : hovered ? 24 : 20);
      glow.addColorStop(0,'rgba(255,255,255,.96)');
      glow.addColorStop(.18,selected ? 'rgba(255,79,200,.95)' : 'rgba(138,116,255,.95)');
      glow.addColorStop(.5,selected ? 'rgba(255,79,200,.24)' : 'rgba(41,243,255,.22)');
      glow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x,p.y,selected ? 28 : hovered ? 26 : 23,0,TAU);
      ctx.fill();
      ctx.shadowColor = selected ? '#ff4fc8' : '#7f7cff';
      ctx.shadowBlur = hovered ? 17 : 12;
      ctx.fillStyle = selected ? '#ff9edc' : '#c3eaff';
      ctx.beginPath();
      ctx.arc(p.x,p.y,selected ? 7 : hovered ? 6.7 : 6,0,TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x,p.y,selected ? 10 : 9,0,TAU);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(173,221,228,.7)';
      ctx.font = '700 6px "JetBrains Mono",monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(index + 1).padStart(2,'0'),p.x,p.y - 15);
      if (selected || hovered) drawNodeLabel(node,index,p,g);
    });
    $('nodeCount').textContent = `${state.nodes.length} NODE${state.nodes.length === 1 ? '' : 'S'}`;
  }

  function drawPlayhead(g) {
    if (!state.playing) return;
    const x = lerp(state.loopStart,state.loopEnd,state.playhead) * g.w;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 7;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x,0);
    ctx.lineTo(x,g.h);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x - 4,0);
    ctx.lineTo(x + 4,0);
    ctx.lineTo(x,7);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    const g = geometry();
    const time = performance.now();
    ctx.clearRect(0,0,g.w,g.h);
    const background = ctx.createRadialGradient(g.cx,g.cy,0,g.cx,g.cy,Math.max(g.w,g.h) * .75);
    background.addColorStop(0,'rgba(7,35,43,.82)');
    background.addColorStop(.45,'rgba(2,12,17,.94)');
    background.addColorStop(1,'#010407');
    ctx.fillStyle = background;
    ctx.fillRect(0,0,g.w,g.h);
    drawGrid(g);
    drawBoundary(state.loopStart,'left',g);
    drawBoundary(state.loopEnd,'right',g);
    drawWave(g,time);
    drawCrossings(g);
    drawNodes(g);
    drawPlayhead(g);
  }

  function geometrySpectrum(size = 64) {
    const values = new Float32Array(size);
    let max = .0001;
    for (let harmonic = 1; harmonic <= size; harmonic++) {
      let re = 0;
      let im = 0;
      for (let index = 0; index < POINTS; index++) {
        const phase = TAU * harmonic * index / POINTS;
        re += state.points[index] * Math.cos(phase);
        im -= state.points[index] * Math.sin(phase);
      }
      values[harmonic - 1] = Math.sqrt(re * re + im * im) / POINTS;
      max = Math.max(max,values[harmonic - 1]);
    }
    for (let index = 0; index < values.length; index++) values[index] /= max;
    return values;
  }

  function drawSpectrum() {
    const rect = spectrumCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    resizeCanvas(spectrumCanvas,spectrumCtx,rect);
    const w = rect.width;
    const h = rect.height;
    spectrumCtx.clearRect(0,0,w,h);
    spectrumCtx.fillStyle = 'rgba(1,7,10,.92)';
    spectrumCtx.fillRect(0,0,w,h);
    spectrumCtx.strokeStyle = 'rgba(80,190,205,.1)';
    spectrumCtx.lineWidth = 1;
    for (let index = 1; index < 4; index++) {
      const y = index * h / 4;
      spectrumCtx.beginPath();
      spectrumCtx.moveTo(0,y);
      spectrumCtx.lineTo(w,y);
      spectrumCtx.stroke();
    }
    let values;
    if (state.playing && state.audio.analyser) {
      state.audio.analyser.getByteFrequencyData(state.audio.freqData);
      values = Array.from(state.audio.freqData.slice(0,64), value => value / 255);
      $('spectrumMode').textContent = 'AUDIO';
    } else {
      values = Array.from(geometrySpectrum(64));
      $('spectrumMode').textContent = 'GEOMETRY';
    }
    const gradient = spectrumCtx.createLinearGradient(0,0,w,0);
    gradient.addColorStop(0,'#65ff9c');
    gradient.addColorStop(.45,'#29f3ff');
    gradient.addColorStop(1,'#9b6cff');
    spectrumCtx.fillStyle = gradient;
    spectrumCtx.strokeStyle = gradient;
    spectrumCtx.shadowColor = '#29f3ff';
    spectrumCtx.shadowBlur = 8;
    const barWidth = w / values.length;
    values.forEach((value,index) => {
      const x = index * barWidth;
      const height = Math.max(1,value * (h - 6));
      spectrumCtx.globalAlpha = .28 + value * .72;
      spectrumCtx.fillRect(x,h - height,Math.max(1,barWidth - 1),height);
    });
    spectrumCtx.globalAlpha = 1;
    spectrumCtx.shadowBlur = 0;
  }

  function animate() {
    if (state.playing && state.audio.ctx && state.audio.loopDuration) {
      const elapsed = state.audio.ctx.currentTime - (state.audio.nextLoopTime - state.audio.loopDuration);
      state.playhead = ((elapsed % state.audio.loopDuration) + state.audio.loopDuration) % state.audio.loopDuration / state.audio.loopDuration;
    }
    draw();
    drawSpectrum();
    updateInputMeter();
    state.animation = requestAnimationFrame(animate);
  }

  function updateInspector() {
    const node = selectedNode();
    if (!node) {
      $('selectedNodeLabel').textContent = 'NO NODE';
      ['pitchOut','timeOut','velocityOut','colorOut'].forEach(id => $(id).textContent = '—');
      $('nodeVelocity').disabled = true;
      $('deleteNodeBtn').disabled = true;
      return;
    }
    $('nodeVelocity').disabled = false;
    $('deleteNodeBtn').disabled = false;
    $('selectedNodeLabel').textContent = `NODE ${String(state.selectedNode + 1).padStart(2,'0')}`;
    $('pitchOut').textContent = midiName(midiForNode(node));
    $('timeOut').textContent = nodeTimeLabel(node);
    $('velocityOut').textContent = node.velocity;
    $('colorOut').textContent = state.selectedNode % 2 ? 'VIOLET' : 'CYAN';
    $('nodeVelocity').value = node.velocity;
  }

  function updateControls() {
    $('tempoInput').value = state.tempo;
    $('tempoReadout').textContent = state.tempo;
    $('rootSelect').selectedIndex = state.root;
    $('scaleSelect').value = state.scale;
    $('zeroPerc').checked = state.zeroPerc;
    $('livePreview').checked = state.livePreview;
    $('snapGrid').checked = state.snapGrid;
    $('snapSteps').value = String(state.snapSteps);
    $('presetSelect').value = PRESETS[state.preset] ? state.preset : 'custom';
    $('forgeZoom').value = String(state.forgeZoom);
    $('forgeZoomOut').textContent = `${state.forgeZoom}×`;
    ['harmonics','density','space','morph'].forEach(id => {
      const value = Math.round(state[id] * 100);
      $(id).value = value;
      $(id).nextElementSibling.textContent = value;
    });
    updateLoopReadout();
    updateInspector();
    updateHistoryButtons();
  }

  function updateLoopReadout() {
    const start = Math.round(state.loopStart * 16);
    const end = Math.round(state.loopEnd * 16);
    const format = value => `${String(Math.floor(value / 4) + 1).padStart(2,'0')}.${value % 4 + 1}`;
    $('loopReadout').textContent = `${format(start)} — ${format(end)}`;
  }

  function hitTest(x,y) {
    const g = geometry();
    const boundaryThreshold = 18;
    if (Math.abs(x - state.loopStart * g.w) < boundaryThreshold) return {type:'boundary',side:'start'};
    if (Math.abs(x - state.loopEnd * g.w) < boundaryThreshold) return {type:'boundary',side:'end'};
    for (let index = state.nodes.length - 1; index >= 0; index--) {
      const p = nodePosition(state.nodes[index]);
      if (Math.hypot(x - p.x,y - p.y) < 18) return {type:'node',index};
    }
    return {type:'wave'};
  }

  function snapNodeX(value) {
    if (!state.snapGrid) return clamp(value,state.loopStart + .005,state.loopEnd - .005);
    const span = Math.max(.001,state.loopEnd - state.loopStart);
    const ratio = clamp((value - state.loopStart) / span,0,1);
    return state.loopStart + Math.round(ratio * state.snapSteps) / state.snapSteps * span;
  }

  function sculptAt(x,y,strength = 1) {
    const normalized = canvasToNormalized(x,y);
    const center = normalized.x * (POINTS - 1);
    const radius = 7 + state.density * 10;
    for (let index = 0; index < POINTS; index++) {
      const distance = (index - center) / radius;
      const weight = Math.exp(-distance * distance * 2.2);
      state.points[index] = clamp(lerp(state.points[index],normalized.wave,weight * .48 * strength),-.96,.96);
    }
    state.preset = 'custom';
    $('presetSelect').value = 'custom';
    state.audio.periodicWave = null;
    if (state.livePreview) previewAt(normalized.y,normalized.x);
    queueSave();
  }

  let previewGate = 0;
  function previewAt(normalizedY, normalizedX = .5, velocity = 70) {
    const now = performance.now();
    if (now - previewGate < 68) return;
    previewGate = now;
    const ac = ensureAudio();
    scheduleVoice(state.audio,{y:normalizedY,velocity,x:normalizedX},ac.currentTime + .005,.11);
  }

  function previewNode(node) {
    if (!state.livePreview || !node) return;
    previewAt(node.y,node.x,node.velocity);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {x:event.clientX - rect.left,y:event.clientY - rect.top};
  }

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const position = pointerPosition(event);
    const hit = hitTest(position.x,position.y);
    const mutable = hit.type === 'node' || hit.type === 'boundary' || (hit.type === 'wave' && state.tool === 'sculpt');
    if (mutable) checkpoint();
    state.pointer = {...hit,last:position,changed:false};
    if (hit.type === 'node') {
      state.selectedNode = hit.index;
      updateInspector();
      if (state.tool === 'sculpt') {
        state.tool = 'nodes';
        document.querySelectorAll('.mode').forEach(button => button.classList.toggle('active',button.dataset.tool === 'nodes'));
      }
      previewNode(selectedNode());
    } else if (hit.type === 'wave' && state.tool === 'sculpt') {
      sculptAt(position.x,position.y);
      state.pointer.changed = true;
    }
  });

  canvas.addEventListener('pointermove', event => {
    const position = pointerPosition(event);
    if (!state.pointer) {
      const hit = hitTest(position.x,position.y);
      state.hoverNode = hit.type === 'node' ? hit.index : -1;
      canvas.style.cursor = hit.type === 'node' ? 'grab' : state.tool === 'boundaries' ? 'ew-resize' : 'crosshair';
      return;
    }
    const g = geometry();
    if (state.pointer.type === 'node') {
      const node = state.nodes[state.pointer.index];
      if (!node) return;
      const rawX = clamp(position.x / g.w,state.loopStart + .005,state.loopEnd - .005);
      node.x = event.altKey ? rawX : snapNodeX(rawX);
      node.y = clamp(position.y / g.h,.04,.96);
      state.selectedNode = state.pointer.index;
      updateInspector();
      previewNode(node);
      queueSave();
      state.pointer.changed = true;
    } else if (state.pointer.type === 'boundary') {
      if (state.pointer.side === 'start') state.loopStart = clamp(position.x / g.w,.015,state.loopEnd - .08);
      else state.loopEnd = clamp(position.x / g.w,state.loopStart + .08,.985);
      updateLoopReadout();
      queueSave();
      state.pointer.changed = true;
    } else if (state.tool === 'sculpt') {
      sculptAt(position.x,position.y,.72);
      state.pointer.changed = true;
    }
    state.pointer.last = position;
  });

  function endPointer(event) {
    if (event?.pointerId !== undefined) canvas.releasePointerCapture?.(event.pointerId);
    if (state.pointer?.changed) saveState();
    state.pointer = null;
  }
  canvas.addEventListener('pointerup',endPointer);
  canvas.addEventListener('pointercancel',endPointer);
  canvas.addEventListener('pointerleave',() => { if (!state.pointer) state.hoverNode = -1; });

  canvas.addEventListener('dblclick', event => {
    checkpoint();
    const position = pointerPosition(event);
    const normalized = canvasToNormalized(position.x,position.y);
    const rawX = clamp(normalized.x,state.loopStart + .01,state.loopEnd - .01);
    state.nodes.push({
      id:uid('node'),
      x:event.altKey ? rawX : snapNodeX(rawX),
      y:normalized.y,
      velocity:96
    });
    state.selectedNode = state.nodes.length - 1;
    updateInspector();
    saveState();
    previewNode(selectedNode());
    setStatus('New trigger node added.');
  });

  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
    const position = pointerPosition(event);
    const hit = hitTest(position.x,position.y);
    if (hit.type === 'node') deleteNode(hit.index);
  });

  function deleteNode(index = state.selectedNode) {
    if (state.nodes.length <= 1) {
      setStatus('The Loom must keep at least one trigger.');
      return;
    }
    checkpoint();
    state.nodes.splice(index,1);
    state.selectedNode = clamp(index,0,state.nodes.length - 1);
    updateInspector();
    saveState();
    setStatus('Trigger node removed.');
  }

  function createGraph(audioContext, connectDestination = true) {
    const master = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    const delay = audioContext.createDelay(2);
    const feedback = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();
    const analyser = audioContext.createAnalyser ? audioContext.createAnalyser() : null;
    master.gain.value = .68;
    dry.gain.value = 1 - state.space * .55;
    wet.gain.value = state.space * .5;
    delay.delayTime.value = .28;
    feedback.gain.value = .36;
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    delay.connect(feedback);
    feedback.connect(delay);
    dry.connect(compressor);
    delay.connect(wet);
    wet.connect(compressor);
    compressor.connect(master);
    if (analyser) {
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = .78;
      master.connect(analyser);
      if (connectDestination) analyser.connect(audioContext.destination);
    } else if (connectDestination) master.connect(audioContext.destination);
    return {ctx:audioContext,master,dry,wet,delay,feedback,compressor,analyser,periodicWave:null};
  }

  function ensureAudio() {
    if (state.audio.ctx) return state.audio.ctx;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const graph = createGraph(audioContext,true);
    Object.assign(state.audio,graph);
    state.audio.freqData = new Uint8Array(graph.analyser.frequencyBinCount);
    return audioContext;
  }

  function periodicWaveFor(graph) {
    if (graph.periodicWave) return graph.periodicWave;
    const harmonics = 32;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
      let re = 0;
      let im = 0;
      for (let index = 0; index < POINTS; index++) {
        const sample = state.points[index];
        const phase = TAU * harmonic * index / POINTS;
        re += sample * Math.cos(phase);
        im -= sample * Math.sin(phase);
      }
      const tilt = Math.pow(1 - harmonic / (harmonics + 1),1.6 - state.harmonics);
      real[harmonic] = re / POINTS * tilt;
      imag[harmonic] = im / POINTS * tilt;
    }
    graph.periodicWave = graph.ctx.createPeriodicWave(real,imag,{disableNormalization:false});
    return graph.periodicWave;
  }

  function scheduleVoice(graph,node,when,duration = .28) {
    const audioContext = graph.ctx;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const pan = audioContext.createStereoPanner ? audioContext.createStereoPanner() : audioContext.createGain();
    oscillator.setPeriodicWave(periodicWaveFor(graph));
    const midi = midiForNode(node);
    const frequency = 440 * Math.pow(2,(midi - 69) / 12);
    oscillator.frequency.setValueAtTime(frequency,when);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650 + state.harmonics * 7200,when);
    filter.Q.value = 2 + state.harmonics * 6;
    if (pan.pan) pan.pan.value = (node.x - .5) * 1.4;
    const level = (node.velocity / 127) * .22;
    gain.gain.setValueAtTime(.0001,when);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001,level),when + .012);
    gain.gain.exponentialRampToValueAtTime(.0001,when + duration);
    oscillator.connect(filter);
    filter.connect(pan);
    pan.connect(gain);
    gain.connect(graph.dry);
    gain.connect(graph.delay);
    oscillator.start(when);
    oscillator.stop(when + duration + .03);
  }

  function schedulePerc(graph,when,brightness = .5) {
    const audioContext = graph.ctx;
    const length = Math.floor(audioContext.sampleRate * .04);
    const buffer = audioContext.createBuffer(1,length,audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index++) {
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length,3);
    }
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 2500 + brightness * 7000;
    gain.gain.setValueAtTime(.035 + state.density * .035,when);
    gain.gain.exponentialRampToValueAtTime(.0001,when + .045);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(graph.dry);
    source.start(when);
  }

  function schedulePattern(graph,startTime,duration) {
    const span = Math.max(.001,state.loopEnd - state.loopStart);
    state.nodes.slice().sort((a,b) => a.x - b.x).forEach(node => {
      if (node.x < state.loopStart || node.x > state.loopEnd) return;
      const ratio = (node.x - state.loopStart) / span;
      scheduleVoice(graph,node,startTime + ratio * duration,.16 + (1 - state.density) * .34);
    });
    if (state.zeroPerc) {
      const crossings = zeroCrossings();
      const stride = Math.max(1,Math.round(4 - state.density * 3));
      crossings.forEach((x,index) => {
        if (index % stride) return;
        const ratio = (x - state.loopStart) / span;
        schedulePerc(graph,startTime + ratio * duration,index / Math.max(1,crossings.length));
      });
    }
  }

  function scheduleLoop(startTime) {
    const duration = 60 / state.tempo * 4;
    state.audio.loopDuration = duration;
    schedulePattern(state.audio,startTime,duration);
  }

  function schedulerPass() {
    const audioContext = state.audio.ctx;
    if (!audioContext || !state.playing) return;
    while (state.audio.nextLoopTime < audioContext.currentTime + .35) {
      scheduleLoop(state.audio.nextLoopTime);
      state.audio.nextLoopTime += state.audio.loopDuration;
    }
  }

  async function togglePlay() {
    const audioContext = ensureAudio();
    if (audioContext.state === 'suspended') await audioContext.resume();
    state.playing = !state.playing;
    $('playBtn').classList.toggle('active',state.playing);
    $('playBtn').querySelector('span').textContent = state.playing ? '■' : '▶';
    $('playBtn').querySelector('b').textContent = state.playing ? 'STOP' : 'PLAY';
    if (state.playing) {
      state.audio.nextLoopTime = audioContext.currentTime + .06;
      state.audio.loopDuration = 60 / state.tempo * 4;
      schedulerPass();
      state.audio.timer = setInterval(schedulerPass,60);
      setStatus('Wave geometry is generating sound.',true);
    } else {
      clearInterval(state.audio.timer);
      state.audio.timer = 0;
      state.playhead = 0;
      setStatus('Playback stopped.',false);
    }
  }

  function applyPreset(name, options = {}) {
    const factory = PRESETS[name];
    if (!factory) return;
    if (options.history !== false) checkpoint();
    state.points = factory().map(value => clamp(value,-.96,.96));
    state.basePoints = state.points.slice();
    state.preset = name;
    state.morph = 0;
    state.audio.periodicWave = null;
    updateControls();
    saveState();
    if (options.status !== false) setStatus(`${$('presetSelect').selectedOptions[0]?.textContent || name} wave loaded.`);
  }

  function resetWave() {
    applyPreset('default');
    setStatus('Wave geometry reset to the Neusic default.');
  }

  function updateSpace() {
    if (!state.audio.ctx) return;
    state.audio.dry.gain.setTargetAtTime(1 - state.space * .55,state.audio.ctx.currentTime,.02);
    state.audio.wet.gain.setTargetAtTime(state.space * .5,state.audio.ctx.currentTime,.02);
  }

  async function armMic() {
    if (state.mic.recorder) {
      state.mic.recorder.stop();
      state.mic.stream?.getTracks().forEach(track => track.stop());
      Object.assign(state.mic,{stream:null,recorder:null,chunks:[],analyser:null,data:null});
      $('micBtn').classList.remove('live');
      $('captureOrb').classList.remove('live');
      $('captureBtn').disabled = true;
      $('micBtn').querySelector('b').textContent = 'ARM ROLLING BUFFER';
      setStatus('NeuCapture disarmed.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const candidates = ['audio/webm;codecs=opus','audio/webm','audio/ogg'];
      const mime = candidates.find(type => window.MediaRecorder?.isTypeSupported?.(type)) || '';
      const recorder = mime ? new MediaRecorder(stream,{mimeType:mime}) : new MediaRecorder(stream);
      const audioContext = ensureAudio();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const chunks = [];
      recorder.ondataavailable = event => {
        if (!event.data?.size) return;
        chunks.push({blob:event.data,time:performance.now()});
        const cutoff = performance.now() - 6500;
        while (chunks.length && chunks[0].time < cutoff) chunks.shift();
      };
      recorder.start(250);
      Object.assign(state.mic,{
        stream,recorder,chunks,analyser,
        data:new Uint8Array(analyser.frequencyBinCount),
        startTime:performance.now()
      });
      $('micBtn').classList.add('live');
      $('captureOrb').classList.add('live');
      $('captureBtn').disabled = false;
      $('micBtn').querySelector('b').textContent = 'DISARM BUFFER';
      setStatus('Rolling microphone buffer armed.');
    } catch (error) {
      console.error(error);
      setStatus('Microphone permission was denied or unavailable.');
    }
  }

  function updateInputMeter() {
    if (!state.mic.analyser) {
      $('inputMeter').style.width = '0%';
      return;
    }
    state.mic.analyser.getByteTimeDomainData(state.mic.data);
    let sum = 0;
    for (const value of state.mic.data) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / state.mic.data.length);
    $('inputMeter').style.width = `${Math.min(100,rms * 420)}%`;
    const elapsed = (performance.now() - state.mic.startTime) / 1000;
    $('captureTimer').textContent = `${Math.min(5,elapsed).toFixed(1)}s`;
  }

  async function captureLastFive() {
    const recorder = state.mic.recorder;
    if (!recorder || !state.mic.chunks.length) {
      setStatus('Arm NeuCapture and make a sound first.');
      return;
    }
    try {
      recorder.requestData();
      await new Promise(resolve => setTimeout(resolve,90));
      const recent = state.mic.chunks.filter(item => item.time >= performance.now() - 5200);
      const blob = new Blob(recent.map(item => item.blob),{type:recorder.mimeType || 'audio/webm'});
      const audioContext = ensureAudio();
      const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
      checkpoint();
      addSample(buffer,`NeuCapture ${state.samples.length + 1}`,'#29f3ff',{history:false});
      setStatus(`Captured ${Math.min(5,buffer.duration).toFixed(1)} seconds as a Sample Block.`);
    } catch (error) {
      console.error(error);
      setStatus('The browser could not decode this rolling capture. Try a slightly longer sound.');
    }
  }

  function makeDemoBuffer() {
    const audioContext = ensureAudio();
    const duration = 1.4;
    const buffer = audioContext.createBuffer(1,Math.floor(audioContext.sampleRate * duration),audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) {
      const time = index / audioContext.sampleRate;
      const envelope = Math.exp(-time * 2.8);
      data[index] = (
        Math.sin(TAU * 440 * time) +
        .36 * Math.sin(TAU * 887 * time) +
        .15 * Math.sin(TAU * 1320 * time)
      ) * envelope * .42;
      if (time > .67 && time < .7) data[index] += (Math.random() * 2 - 1) * .28;
    }
    return buffer;
  }

  function peaksFor(buffer,count = 640) {
    const data = buffer.getChannelData(0);
    const step = Math.max(1,Math.floor(data.length / count));
    const peaks = [];
    for (let index = 0; index < count; index++) {
      let min = 1;
      let max = -1;
      for (let cursor = index * step; cursor < Math.min(data.length,(index + 1) * step); cursor++) {
        min = Math.min(min,data[cursor]);
        max = Math.max(max,data[cursor]);
      }
      peaks.push([min,max]);
    }
    return peaks;
  }

  function addSample(buffer,name,color = '#9b6cff',options = {}) {
    if (options.history !== false) checkpoint();
    const sample = {
      id:uid('sample'),
      name,
      buffer,
      duration:buffer.duration,
      color,
      peaks:peaksFor(buffer)
    };
    state.samples.push(sample);
    state.selectedSampleId = sample.id;
    renderSamples();
    return sample;
  }

  function moveSliceLine(event,wave,line) {
    const articleRect = wave.closest('.sample-block').getBoundingClientRect();
    line.style.left = `${event.clientX - articleRect.left}px`;
  }

  function drawSampleWave(canvasElement,sample) {
    const context = canvasElement.getContext('2d');
    const width = canvasElement.width;
    const height = canvasElement.height;
    context.clearRect(0,0,width,height);
    context.fillStyle = '#03090c';
    context.fillRect(0,0,width,height);
    context.strokeStyle = sample.color;
    context.shadowColor = sample.color;
    context.shadowBlur = 8;
    context.lineWidth = 1.2;
    context.beginPath();
    sample.peaks.forEach((peak,index) => {
      const x = index / Math.max(1,sample.peaks.length - 1) * width;
      const y1 = height / 2 + peak[0] * height * .42;
      const y2 = height / 2 + peak[1] * height * .42;
      context.moveTo(x,y1);
      context.lineTo(x,y2);
    });
    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(255,255,255,.12)';
    context.beginPath();
    context.moveTo(0,height / 2);
    context.lineTo(width,height / 2);
    context.stroke();
  }

  function renderSamples() {
    $('forgeZoom').value = String(state.forgeZoom);
    $('forgeZoomOut').textContent = `${state.forgeZoom}×`;
    if (!state.samples.length) {
      sampleShelf.innerHTML = '<div class="sample-empty">NO SAMPLE BLOCKS · CAPTURE OR CREATE A DEMO</div>';
      return;
    }
    sampleShelf.innerHTML = '';
    state.samples.forEach((sample,index) => {
      const article = document.createElement('article');
      article.className = `sample-block${sample.id === state.selectedSampleId ? ' selected' : ''}`;
      article.draggable = true;
      article.dataset.sampleId = sample.id;
      article.style.setProperty('--sample-color',sample.color);
      const canvasWidth = Math.round(430 * state.forgeZoom);
      article.innerHTML = `
        <header><i></i><b>${escapeHtml(sample.name)}</b><span>${sample.duration.toFixed(2)}s</span></header>
        <div class="sample-wave-scroll"><canvas width="${canvasWidth}" height="96" aria-label="${escapeHtml(sample.name)} waveform"></canvas></div>
        <div class="sample-actions">
          <button data-preview>PREVIEW</button>
          <button data-auto-slice>AUTO SLICE</button>
          <button data-unfold>UNFOLD</button>
          <button data-remove>REMOVE</button>
        </div>`;
      const wave = article.querySelector('canvas');
      drawSampleWave(wave,sample);
      article.addEventListener('click',event => {
        if (event.target.closest('button')) return;
        state.selectedSampleId = sample.id;
        renderSamples();
      });
      article.addEventListener('dragstart', event => {
        article.classList.add('dragging');
        event.dataTransfer.setData('text/neusic-sample',sample.id);
        event.dataTransfer.effectAllowed = 'copy';
      });
      article.addEventListener('dragend',() => article.classList.remove('dragging'));
      article.querySelector('[data-preview]').onclick = () => previewSample(sample);
      article.querySelector('[data-auto-slice]').onclick = () => autoSliceSample(sample,index);
      article.querySelector('[data-unfold]').onclick = () => unfoldSample(sample);
      article.querySelector('[data-remove]').onclick = () => {
        checkpoint();
        state.samples.splice(index,1);
        state.selectedSampleId = state.samples[Math.min(index,state.samples.length - 1)]?.id || null;
        renderSamples();
        setStatus(`${sample.name} removed from the Forge.`);
      };
      let slicing = false;
      let line = null;
      wave.addEventListener('pointerdown', event => {
        slicing = true;
        wave.setPointerCapture?.(event.pointerId);
        line = document.createElement('span');
        line.className = 'slice-line';
        article.appendChild(line);
        moveSliceLine(event,wave,line);
      });
      wave.addEventListener('pointermove', event => {
        if (slicing) moveSliceLine(event,wave,line);
      });
      wave.addEventListener('pointerup', event => {
        if (!slicing) return;
        slicing = false;
        wave.releasePointerCapture?.(event.pointerId);
        const rect = wave.getBoundingClientRect();
        const ratio = clamp((event.clientX - rect.left) / rect.width,.02,.98);
        line?.remove();
        sliceSample(sample,index,ratio);
      });
      sampleShelf.appendChild(article);
    });
  }

  function previewSample(sample) {
    const audioContext = ensureAudio();
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = sample.buffer;
    gain.gain.value = .7;
    source.connect(gain);
    gain.connect(state.audio.master);
    source.start();
    state.selectedSampleId = sample.id;
    renderSamples();
    setStatus(`Previewing ${sample.name}.`);
  }

  function makeSegment(sample,start,length,name,color) {
    const audioContext = ensureAudio();
    const buffer = audioContext.createBuffer(sample.buffer.numberOfChannels,length,sample.buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      buffer.copyToChannel(sample.buffer.getChannelData(channel).slice(start,start + length),channel);
    }
    return {id:uid('sample'),name,buffer,duration:buffer.duration,color,peaks:peaksFor(buffer)};
  }

  function sliceSample(sample,index,ratio) {
    const cut = Math.floor(sample.buffer.length * ratio);
    if (cut < 32 || sample.buffer.length - cut < 32) return;
    checkpoint();
    const left = makeSegment(sample,0,cut,`${sample.name} A`,sample.color);
    const right = makeSegment(
      sample,cut,sample.buffer.length - cut,`${sample.name} B`,
      sample.color === '#29f3ff' ? '#9b6cff' : '#65ff9c'
    );
    state.samples.splice(index,1,left,right);
    state.selectedSampleId = left.id;
    renderSamples();
    setStatus(`${sample.name} split into two Sample Blocks.`);
  }

  function detectTransientRatios(buffer) {
    const data = buffer.getChannelData(0);
    const windowSize = 512;
    const hop = 256;
    const energies = [];
    for (let start = 0; start + windowSize < data.length; start += hop) {
      let sum = 0;
      for (let index = start; index < start + windowSize; index++) sum += data[index] * data[index];
      energies.push(Math.sqrt(sum / windowSize));
    }
    if (energies.length < 4) return [];
    const flux = energies.map((value,index) => Math.max(0,value - (energies[index - 1] || value)));
    const mean = flux.reduce((total,value) => total + value,0) / flux.length;
    const variance = flux.reduce((total,value) => total + Math.pow(value - mean,2),0) / flux.length;
    const threshold = mean + Math.sqrt(variance) * .72;
    const minFrames = Math.max(2,Math.floor(buffer.sampleRate * .065 / hop));
    const candidates = [];
    for (let index = 1; index < flux.length - 1; index++) {
      if (flux[index] < threshold || flux[index] < flux[index - 1] || flux[index] < flux[index + 1]) continue;
      const previous = candidates[candidates.length - 1];
      if (previous !== undefined && index - previous < minFrames) {
        if (flux[index] > flux[previous]) candidates[candidates.length - 1] = index;
      } else candidates.push(index);
    }
    return candidates
      .sort((a,b) => flux[b] - flux[a])
      .slice(0,15)
      .sort((a,b) => a - b)
      .map(index => clamp(index * hop / data.length,.02,.98));
  }

  function autoSliceSample(sample,index) {
    const ratios = detectTransientRatios(sample.buffer);
    if (!ratios.length) {
      setStatus(`No strong transients were detected in ${sample.name}.`);
      return;
    }
    checkpoint();
    const cuts = [0,...ratios.map(ratio => Math.floor(sample.buffer.length * ratio)),sample.buffer.length]
      .filter((value,position,array) => !position || value - array[position - 1] > Math.floor(sample.buffer.sampleRate * .035));
    const segments = [];
    const colors = [sample.color,'#29f3ff','#9b6cff','#65ff9c','#ff4fc8'];
    for (let position = 0; position < cuts.length - 1; position++) {
      const start = cuts[position];
      const length = cuts[position + 1] - start;
      if (length < 32) continue;
      segments.push(makeSegment(
        sample,start,length,
        `${sample.name} ${String(position + 1).padStart(2,'0')}`,
        colors[position % colors.length]
      ));
    }
    if (segments.length < 2) {
      state.history.pop();
      updateHistoryButtons();
      setStatus(`No useful transient slices were found in ${sample.name}.`);
      return;
    }
    state.samples.splice(index,1,...segments);
    state.selectedSampleId = segments[0].id;
    renderSamples();
    setStatus(`${sample.name} auto-sliced into ${segments.length} transient blocks.`);
  }

  function unfoldSample(sample) {
    checkpoint();
    const data = sample.buffer.getChannelData(0);
    const step = Math.max(1,Math.floor(data.length / POINTS));
    const next = [];
    const energies = [];
    for (let index = 0; index < POINTS; index++) {
      let sum = 0;
      let mean = 0;
      let zeroCross = 0;
      let previous = data[index * step] || 0;
      const start = index * step;
      const end = Math.min(data.length,(index + 1) * step);
      for (let cursor = start; cursor < end; cursor++) {
        const value = data[cursor];
        sum += value * value;
        mean += value;
        if ((value >= 0) !== (previous >= 0)) zeroCross++;
        previous = value;
      }
      const length = Math.max(1,end - start);
      const rms = Math.sqrt(sum / length);
      const sign = mean >= 0 ? 1 : -1;
      next.push(clamp(sign * rms * 2.5,-.92,.92));
      energies.push({index,rms,zeroCross});
    }
    const max = Math.max(.001,...next.map(Math.abs));
    state.points = next.map(value => value / max * .68);
    state.basePoints = state.points.slice();
    state.preset = 'custom';
    state.audio.periodicWave = null;
    const candidates = energies
      .slice(1,-1)
      .filter((item,index,array) => item.rms > (array[index - 1]?.rms || 0) && item.rms > (array[index + 1]?.rms || 0))
      .sort((a,b) => b.rms - a.rms)
      .slice(0,8)
      .sort((a,b) => a.index - b.index);
    if (candidates.length) {
      state.nodes = candidates.map(item => ({
        id:uid('node'),
        x:snapNodeX(clamp(item.index / (POINTS - 1),state.loopStart + .01,state.loopEnd - .01)),
        y:clamp(.5 - state.points[item.index] * .42,.08,.92),
        velocity:clamp(Math.round(62 + item.rms * 170),45,127)
      }));
    }
    state.selectedNode = 0;
    state.selectedSampleId = sample.id;
    updateControls();
    saveState();
    previewNode(selectedNode());
    setStatus(`${sample.name} unfolded into a playable Wave Pattern.`,state.playing);
  }

  function encodeWav(audioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const frames = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const arrayBuffer = new ArrayBuffer(44 + frames * blockAlign);
    const view = new DataView(arrayBuffer);
    const writeString = (offset,string) => {
      for (let index = 0; index < string.length; index++) view.setUint8(offset + index,string.charCodeAt(index));
    };
    writeString(0,'RIFF');
    view.setUint32(4,36 + frames * blockAlign,true);
    writeString(8,'WAVE');
    writeString(12,'fmt ');
    view.setUint32(16,16,true);
    view.setUint16(20,1,true);
    view.setUint16(22,channels,true);
    view.setUint32(24,sampleRate,true);
    view.setUint32(28,sampleRate * blockAlign,true);
    view.setUint16(32,blockAlign,true);
    view.setUint16(34,16,true);
    writeString(36,'data');
    view.setUint32(40,frames * blockAlign,true);
    let offset = 44;
    for (let frameIndex = 0; frameIndex < frames; frameIndex++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = clamp(audioBuffer.getChannelData(channel)[frameIndex],-1,1);
        view.setInt16(offset,sample < 0 ? sample * 0x8000 : sample * 0x7fff,true);
        offset += 2;
      }
    }
    return arrayBuffer;
  }

  async function exportWav() {
    const button = $('exportBtn');
    if (button.disabled) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'RENDERING…';
    setStatus('Rendering four loop passes to stereo WAV…',true);
    try {
      const sampleRate = 44100;
      const loopDuration = 60 / state.tempo * 4;
      const repeats = 4;
      const tail = 1.4 + state.space * 2.2;
      const totalDuration = loopDuration * repeats + tail;
      const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OfflineContext) throw new Error('Offline audio rendering is not available in this browser.');
      const offline = new OfflineContext(2,Math.ceil(totalDuration * sampleRate),sampleRate);
      const graph = createGraph(offline,true);
      for (let repeat = 0; repeat < repeats; repeat++) schedulePattern(graph,repeat * loopDuration,loopDuration);
      const rendered = await offline.startRendering();
      const wav = new Blob([encodeWav(rendered)],{type:'audio/wav'});
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      const filename = `neusic-wave-loom-${state.tempo}bpm-${stamp}.wav`;
      downloadBlob(wav,filename);
      checkpoint();
      addSample(rendered,`Loom Bounce ${state.samples.length + 1}`,'#65ff9c',{history:false});
      try {
        localStorage.setItem('neusic-wave-loom-last-export',JSON.stringify({
          filename,
          createdAt:new Date().toISOString(),
          duration:rendered.duration,
          tempo:state.tempo,
          patch:patchFile()
        }));
      } catch (_) {}
      setStatus('WAV exported and added to The Forge. Import the file into Classic DAW.');
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Wave Loom export failed.');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g,char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[char]));
  }

  frame.addEventListener('dragover', event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    $('dropMessage').classList.add('show');
  });
  frame.addEventListener('dragleave', event => {
    if (!frame.contains(event.relatedTarget)) $('dropMessage').classList.remove('show');
  });
  frame.addEventListener('drop', event => {
    event.preventDefault();
    $('dropMessage').classList.remove('show');
    const id = event.dataTransfer.getData('text/neusic-sample');
    const sample = state.samples.find(item => item.id === id);
    if (sample) unfoldSample(sample);
  });

  function bindControls() {
    $('playBtn').onclick = togglePlay;
    $('resetBtn').onclick = resetWave;
    $('undoBtn').onclick = undo;
    $('redoBtn').onclick = redo;
    $('exportBtn').onclick = exportWav;
    $('savePatchBtn').onclick = savePatchFile;
    $('loadPatchBtn').onclick = () => $('patchFileInput').click();
    $('patchFileInput').onchange = event => loadPatchFile(event.target.files?.[0]);
    $('micBtn').onclick = armMic;
    $('captureBtn').onclick = captureLastFive;
    $('demoSampleBtn').onclick = () => {
      checkpoint();
      addSample(makeDemoBuffer(),`Glass Tap ${state.samples.length + 1}`,'#9b6cff',{history:false});
      setStatus('Demo Sample Block forged.');
    };
    $('autoSliceBtn').onclick = () => {
      const index = state.samples.findIndex(sample => sample.id === state.selectedSampleId);
      if (index < 0) {
        setStatus('Select a Sample Block before auto-slicing.');
        return;
      }
      autoSliceSample(state.samples[index],index);
    };
    $('forgeZoom').oninput = event => {
      state.forgeZoom = clamp(Number(event.target.value) || 1,1,8);
      $('forgeZoomOut').textContent = `${state.forgeZoom}×`;
      renderSamples();
    };
    $('helpBtn').onclick = () => $('helpDialog').showModal();
    $('deleteNodeBtn').onclick = () => deleteNode();
    $('nodeVelocity').oninput = event => {
      const node = selectedNode();
      if (!node) return;
      node.velocity = Number(event.target.value);
      updateInspector();
      previewNode(node);
      queueSave();
    };
    $('nodeVelocity').onpointerdown = checkpoint;
    $('tempoInput').onchange = event => {
      checkpoint();
      state.tempo = clamp(Number(event.target.value) || 112,40,220);
      event.target.value = state.tempo;
      $('tempoReadout').textContent = state.tempo;
      if (state.playing && state.audio.ctx) state.audio.nextLoopTime = state.audio.ctx.currentTime + .08;
      saveState();
    };
    $('rootSelect').onchange = event => {
      checkpoint();
      state.root = event.target.selectedIndex;
      updateInspector();
      previewNode(selectedNode());
      saveState();
    };
    $('scaleSelect').onchange = event => {
      checkpoint();
      state.scale = event.target.value;
      updateInspector();
      previewNode(selectedNode());
      saveState();
    };
    $('snapGrid').onchange = event => {
      checkpoint();
      state.snapGrid = event.target.checked;
      saveState();
      setStatus(state.snapGrid ? `Node snap enabled at 1/${state.snapSteps}.` : 'Node snap disabled. Hold Alt is no longer required for free timing.');
    };
    $('snapSteps').onchange = event => {
      checkpoint();
      state.snapSteps = Number(event.target.value);
      if (state.snapGrid) state.nodes.forEach(node => { node.x = snapNodeX(node.x); });
      updateInspector();
      saveState();
      setStatus(`Node grid set to 1/${state.snapSteps}.`);
    };
    $('presetSelect').onchange = event => {
      if (PRESETS[event.target.value]) applyPreset(event.target.value);
    };
    $('zeroPerc').onchange = event => {
      checkpoint();
      state.zeroPerc = event.target.checked;
      saveState();
    };
    $('livePreview').onchange = event => {
      checkpoint();
      state.livePreview = event.target.checked;
      saveState();
    };
    document.querySelectorAll('.mode').forEach(button => {
      button.onclick = () => {
        state.tool = button.dataset.tool;
        document.querySelectorAll('.mode').forEach(candidate => candidate.classList.toggle('active',candidate === button));
        canvas.style.cursor = state.tool === 'nodes' ? 'grab' : state.tool === 'boundaries' ? 'ew-resize' : 'crosshair';
        setStatus(`${button.textContent.toLowerCase()} mode selected.`);
      };
    });
    ['harmonics','density','space','morph'].forEach(id => {
      const control = $(id);
      control.onpointerdown = checkpoint;
      control.oninput = event => {
        state[id] = Number(event.target.value) / 100;
        event.target.nextElementSibling.textContent = event.target.value;
        if (id === 'harmonics') state.audio.periodicWave = null;
        if (id === 'space') updateSpace();
        if (id === 'morph') {
          const amount = state.morph;
          state.points = state.points.map((point,index) => lerp(point,state.basePoints[index] ?? point,amount * .035));
          state.audio.periodicWave = null;
          state.preset = 'custom';
          $('presetSelect').value = 'custom';
        }
        queueSave();
      };
    });
    document.addEventListener('keydown', event => {
      const editable = event.target.matches('input,select,textarea,button,[contenteditable="true"]');
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (command && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        exportWav();
        return;
      }
      if (editable) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
        return;
      }
      const node = selectedNode();
      if (!node) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteNode();
        return;
      }
      const freeStep = event.shiftKey ? .02 : .006;
      const snappedStep = (state.loopEnd - state.loopStart) / state.snapSteps;
      const step = state.snapGrid && !event.altKey ? snappedStep : freeStep;
      const directionKey = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key);
      if (!directionKey) return;
      event.preventDefault();
      checkpoint();
      if (event.key === 'ArrowLeft') node.x = clamp(node.x - step,state.loopStart + .005,state.loopEnd - .005);
      else if (event.key === 'ArrowRight') node.x = clamp(node.x + step,state.loopStart + .005,state.loopEnd - .005);
      else if (event.key === 'ArrowUp') node.y = clamp(node.y - freeStep,.04,.96);
      else if (event.key === 'ArrowDown') node.y = clamp(node.y + freeStep,.04,.96);
      if (state.snapGrid && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) node.x = snapNodeX(node.x);
      updateInspector();
      previewNode(node);
      saveState();
    });
  }

  window.NeusicWaveLoom = {
    version:'2.0.0',
    state,
    getPatch:patchFile,
    applyPatch,
    savePatch:savePatchFile,
    exportWav,
    undo,
    redo,
    applyPreset,
    autoSliceSelected() {
      const index = state.samples.findIndex(sample => sample.id === state.selectedSampleId);
      if (index >= 0) autoSliceSample(state.samples[index],index);
    }
  };

  loadState();
  bindControls();
  updateControls();
  renderSamples();
  if (!state.samples.length) addSample(makeDemoBuffer(),'Glass Tap','#9b6cff',{history:false});
  resize();
  window.addEventListener('resize',resize);
  state.animation = requestAnimationFrame(animate);
  setStatus('Wave Loom ready. Sculpt, auto-slice, save a patch, or export a WAV.');
})();