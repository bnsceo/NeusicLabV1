(() => {
  'use strict';
  if (window.NeusicNeuCapture) return;

  const R = window.NeusicWaveReliability;
  const W = window.NeusicAudioWorkspace;
  const state = {
    stream:null,
    source:null,
    node:null,
    armed:false,
    fullRecording:false,
    requests:new Map(),
    startedAt:0,
    meter:0
  };
  const uid = () => `capture-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

  function buttonText(id, text) {
    const button = document.getElementById(id);
    const label = button?.querySelector('b');
    if (label) label.textContent = text;
  }

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function trimSilence(buffer, threshold = .006, paddingMs = 24) {
    const channels = Array.from({length:buffer.numberOfChannels}, (_, index) => buffer.getChannelData(index));
    let first = 0;
    let last = buffer.length - 1;
    const amplitudeAt = index => {
      let peak = 0;
      for (const channel of channels) peak = Math.max(peak,Math.abs(channel[index] || 0));
      return peak;
    };
    while (first < last && amplitudeAt(first) < threshold) first++;
    while (last > first && amplitudeAt(last) < threshold) last--;
    const pad = Math.floor(buffer.sampleRate * paddingMs / 1000);
    first = Math.max(0,first - pad);
    last = Math.min(buffer.length - 1,last + pad);
    if (last - first < buffer.sampleRate * .03 || (first === 0 && last === buffer.length - 1)) return buffer;
    const result = W.context.createBuffer(buffer.numberOfChannels,last - first + 1,buffer.sampleRate);
    channels.forEach((channel,index) => result.copyToChannel(channel.slice(first,last + 1),index));
    return result;
  }

  async function bufferFromMessage(message) {
    if (!message.channels?.length || !message.frames) throw new Error('NeuCapture has not received enough audio yet.');
    const channels = message.channels.map(channel => new Float32Array(channel));
    return trimSilence(W.bufferFromChannels(channels,message.sampleRate));
  }

  function resolveRequest(message) {
    const pending = state.requests.get(message.requestId);
    if (!pending) return;
    state.requests.delete(message.requestId);
    if (!message.frames) pending.reject(new Error('No audible input was captured.'));
    else pending.resolve(message);
  }

  function handleMessage(event) {
    const message = event.data || {};
    if (message.type === 'meter') {
      state.meter = Number(message.level) || 0;
      const meter = document.getElementById('inputMeter');
      if (meter) meter.style.width = `${Math.min(100,state.meter * 520)}%`;
      const timer = document.getElementById('captureTimer');
      if (timer) timer.textContent = `${Math.min(R.state.captureSeconds,Number(message.availableSeconds)||0).toFixed(1)}s`;
      if (state.fullRecording) R.setStatus(`Sample-accurate recording · ${(Number(message.recordedSeconds)||0).toFixed(1)} seconds · tap Stop when finished`,'live');
      return;
    }
    if (message.type === 'capture' || message.type === 'recording') resolveRequest(message);
  }

  async function arm() {
    if (state.armed) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is unavailable in this browser.');
    await W.loadCaptureWorklet();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:2}},
      video:false
    });
    const {source} = W.connectInput(stream);
    const node = new AudioWorkletNode(W.context,'neusic-neucapture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
    node.port.onmessage = handleMessage;
    node.port.postMessage({type:'configure',maxSeconds:Math.max(30,R.state.captureSeconds)});
    source.connect(node);
    node.connect(W.buses.capture);
    state.stream = stream;
    state.source = source;
    state.node = node;
    state.armed = true;
    document.getElementById('micBtn')?.classList.add('live');
    document.getElementById('captureOrb')?.classList.add('live');
    const capture = document.getElementById('captureBtn');
    if (capture) capture.disabled = false;
    buttonText('micBtn','DISARM NEUCAPTURE');
    R.setStatus(`Sample-accurate rolling capture armed · last ${R.state.captureSeconds} seconds are always available.`,'live');
  }

  async function disarm() {
    if (state.fullRecording) await stopFullRecording().catch(()=>{});
    try { state.source?.disconnect(); } catch (_) {}
    try { state.node?.disconnect(); } catch (_) {}
    state.stream?.getTracks().forEach(track => track.stop());
    W.disconnectInput();
    Object.assign(state,{stream:null,source:null,node:null,armed:false,fullRecording:false});
    state.requests.forEach(request => request.reject(new Error('NeuCapture was disarmed.')));
    state.requests.clear();
    document.getElementById('micBtn')?.classList.remove('live');
    document.getElementById('captureOrb')?.classList.remove('live');
    const capture = document.getElementById('captureBtn');
    if (capture) capture.disabled = true;
    const meter = document.getElementById('inputMeter');
    if (meter) meter.style.width = '0%';
    buttonText('micBtn','ARM NEUCAPTURE');
    buttonText('recordSampleBtn','RECORD FULL SAMPLE');
    R.setStatus('NeuCapture disarmed.');
  }

  async function toggleArm() {
    try { if (state.armed) await disarm(); else await arm(); }
    catch (error) { console.error(error); R.setStatus(error.message || 'Microphone permission was denied.','error'); }
  }

  function request(type, extra = {}) {
    if (!state.node) return Promise.reject(new Error('Arm NeuCapture first.'));
    const requestId = uid();
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => { state.requests.delete(requestId); reject(new Error('NeuCapture did not respond.')); },10000);
      state.requests.set(requestId,{
        resolve:value => { clearTimeout(timer); resolve(value); },
        reject:error => { clearTimeout(timer); reject(error); }
      });
      state.node.port.postMessage({type,requestId,...extra});
    });
  }

  async function captureRecent() {
    try {
      if (!state.armed) await arm();
      R.setStatus(`Materializing the last ${R.state.captureSeconds} seconds from the PCM ring buffer…`,'live');
      const message = await request('capture',{seconds:R.state.captureSeconds});
      const buffer = await bufferFromMessage(message);
      await R.addSample({buffer,name:`NeuCapture ${R.state.samples.length + 1}`,source:'neucapture',color:'#29f3ff'});
      R.setStatus(`Captured ${buffer.duration.toFixed(2)} seconds with sample-accurate boundaries.`,'live');
    } catch (error) { console.error(error); R.setStatus(error.message,'error'); }
  }

  async function startFullRecording() {
    if (!state.armed) await arm();
    state.fullRecording = true;
    state.startedAt = performance.now();
    state.node.port.postMessage({type:'start-record',requestId:uid()});
    const button = document.getElementById('recordSampleBtn');
    button?.classList.add('live');
    buttonText('recordSampleBtn','STOP & SAVE SAMPLE');
    R.setStatus('Sample-accurate full recording started.','live');
  }

  async function stopFullRecording() {
    if (!state.fullRecording) return;
    try {
      const message = await request('stop-record');
      const buffer = await bufferFromMessage(message);
      await R.addSample({buffer,name:`Loom Recording ${R.state.samples.length + 1}`,source:'full-recording',color:'#ff4fc8'});
      R.setStatus(`Recorded ${buffer.duration.toFixed(2)} seconds and saved it persistently.`,'live');
    } finally {
      state.fullRecording = false;
      document.getElementById('recordSampleBtn')?.classList.remove('live');
      buttonText('recordSampleBtn','RECORD FULL SAMPLE');
    }
  }

  async function toggleFullRecording() {
    try { if (state.fullRecording) await stopFullRecording(); else await startFullRecording(); }
    catch (error) { console.error(error); state.fullRecording=false; buttonText('recordSampleBtn','RECORD FULL SAMPLE'); R.setStatus(error.message,'error'); }
  }

  async function importFiles(files) {
    const list = [...(files || [])];
    if (!list.length) return;
    for (const file of list) {
      try {
        R.setStatus(`Decoding and saving ${file.name}…`,'live');
        const buffer = await W.decode(file);
        await R.addSample({buffer,name:file.name.replace(/\.[^.]+$/,''),mime:file.type,source:'upload'});
      } catch (error) { console.error(error); R.setStatus(`${file.name}: ${error.message || 'unsupported audio format'}`,'error'); }
    }
  }

  function installDurationControl() {
    const divider = document.querySelector('.capture-divider');
    if (!divider || document.getElementById('captureDuration')) return;
    const label = document.createElement('label');
    label.className = 'capture-duration-control';
    label.innerHTML = `<span>ROLLING CAPTURE</span><select id="captureDuration"><option value="3">3 SEC</option><option value="5">5 SEC</option><option value="8">8 SEC</option><option value="12">12 SEC</option><option value="20">20 SEC</option><option value="30">30 SEC</option></select>`;
    divider.before(label);
    const select = label.querySelector('select');
    select.value = String(R.state.captureSeconds);
    select.addEventListener('change',() => {
      R.state.captureSeconds = Number(select.value);
      state.node?.port.postMessage({type:'configure',maxSeconds:Math.max(30,R.state.captureSeconds)});
      R.queueProjectSave();
      R.setStatus(`Rolling capture length set to ${R.state.captureSeconds} seconds.`);
    });
  }

  function bind() {
    installDurationControl();
    document.getElementById('micBtn')?.addEventListener('click',event => { stopEvent(event); toggleArm(); },true);
    document.getElementById('captureBtn')?.addEventListener('click',event => { stopEvent(event); captureRecent(); },true);
    document.getElementById('recordSampleBtn')?.addEventListener('click',event => { stopEvent(event); toggleFullRecording(); },true);
    document.getElementById('uploadSampleBtn')?.addEventListener('click',event => { stopEvent(event); document.getElementById('sampleFileInput')?.click(); },true);
    document.getElementById('sampleFileInput')?.addEventListener('change',event => {
      stopEvent(event);
      const files = event.target.files;
      importFiles(files).finally(() => { event.target.value=''; });
    },true);
    addEventListener('pagehide',() => { if (state.armed) disarm().catch(()=>{}); });
  }

  const api = {state,arm,disarm,toggleArm,captureRecent,startFullRecording,stopFullRecording,toggleFullRecording,importFiles,trimSilence};
  window.NeusicNeuCapture = api;
  R.ready.then(value => { if (value) bind(); });
})();