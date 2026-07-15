(() => {
  'use strict';
  if (window.__neusicSampleImport) return;
  window.__neusicSampleImport = true;

  const loom = window.NeusicWaveLoom;
  const input = document.getElementById('sampleFileInput');
  const uploadButton = document.getElementById('uploadSampleBtn');
  const recordButton = document.getElementById('recordSampleBtn');
  const shelf = document.getElementById('uploadedSampleShelf');
  const count = document.getElementById('uploadedSampleCount');
  const status = document.getElementById('sampleInputStatus');
  const frame = document.getElementById('loomFrame');
  if (!loom || !input || !uploadButton || !recordButton || !shelf) return;

  const POINTS = 96;
  const imports = [];
  let audioContext = null;
  let recording = null;
  const colors = ['#29f3ff','#9b6cff','#65ff9c','#ff4fc8','#ffc762'];
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const uid = () => `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

  function setStatus(message, type = '') {
    status.textContent = message;
    status.classList.toggle('live',type === 'live');
    status.classList.toggle('error',type === 'error');
    const global = document.getElementById('statusMessage');
    if (global) global.textContent = message;
  }

  function ensureAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(()=>{});
    return audioContext;
  }

  async function decodeAudio(source, name, type = '') {
    const ac = ensureAudio();
    let arrayBuffer;
    if (source instanceof Blob) arrayBuffer = await source.arrayBuffer();
    else if (source instanceof ArrayBuffer) arrayBuffer = source;
    else throw new Error('No audio data was supplied.');
    try {
      return await ac.decodeAudioData(arrayBuffer.slice(0));
    } catch (error) {
      throw new Error(`${name || type || 'This file'} is not decodable by this browser. Convert it to WAV, MP3, M4A or OGG and try again.`);
    }
  }

  function peaksFor(buffer, count = 220) {
    const data = buffer.getChannelData(0);
    const step = Math.max(1,Math.floor(data.length / count));
    const peaks = [];
    for (let index = 0; index < count; index++) {
      let min = 1, max = -1;
      const start = index * step;
      const end = Math.min(data.length,start + step);
      for (let cursor = start; cursor < end; cursor++) {
        min = Math.min(min,data[cursor]);
        max = Math.max(max,data[cursor]);
      }
      peaks.push([min,max]);
    }
    return peaks;
  }

  function addImport(buffer, name, mime = '') {
    const item = {id:uid(),buffer,name:name || `Sample ${imports.length + 1}`,mime,duration:buffer.duration,color:colors[imports.length % colors.length],peaks:peaksFor(buffer)};
    imports.push(item);
    render();
    setStatus(`${item.name} is ready. Preview it or unfold it into the Loom.`,'live');
    return item;
  }

  function drawWave(canvas, item) {
    const dpr = Math.min(2,window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1,Math.round(rect.width * dpr));
    const height = Math.max(1,Math.round(rect.height * dpr));
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    context.setTransform(dpr,0,0,dpr,0,0);
    const w = rect.width, h = rect.height;
    context.fillStyle='#02070a';context.fillRect(0,0,w,h);
    context.strokeStyle='rgba(255,255,255,.09)';context.beginPath();context.moveTo(0,h/2);context.lineTo(w,h/2);context.stroke();
    context.strokeStyle=item.color;context.shadowColor=item.color;context.shadowBlur=7;context.lineWidth=1.1;context.beginPath();
    item.peaks.forEach((peak,index)=>{const x=index/Math.max(1,item.peaks.length-1)*w;context.moveTo(x,h/2+peak[0]*h*.43);context.lineTo(x,h/2+peak[1]*h*.43);});
    context.stroke();context.shadowBlur=0;
  }

  function preview(item) {
    const ac = ensureAudio();
    const source = ac.createBufferSource();
    const gain = ac.createGain();
    source.buffer = item.buffer; gain.gain.value = .78;
    source.connect(gain); gain.connect(ac.destination); source.start();
    setStatus(`Previewing ${item.name}.`,'live');
  }

  function derivePatch(item) {
    const data = item.buffer.getChannelData(0);
    const step = Math.max(1,Math.floor(data.length / POINTS));
    const points = [];
    const energies = [];
    for (let index = 0; index < POINTS; index++) {
      const start = index * step;
      const end = Math.min(data.length,(index + 1) * step);
      let sum = 0, mean = 0;
      for (let cursor = start; cursor < end; cursor++) {const value=data[cursor];sum += value*value;mean += value;}
      const length = Math.max(1,end - start);
      const rms = Math.sqrt(sum / length);
      points.push((mean >= 0 ? 1 : -1) * rms);
      energies.push(rms);
    }
    const maximum = Math.max(.0001,...points.map(Math.abs));
    const normalized = points.map(value=>clamp(value/maximum*.72,-.92,.92));
    const candidates = energies.map((value,index)=>({value,index}))
      .filter(({value,index})=>index>0&&index<energies.length-1&&value>energies[index-1]&&value>=energies[index+1])
      .sort((a,b)=>b.value-a.value).slice(0,10).sort((a,b)=>a.index-b.index);
    const current = loom.getPatch();
    const loopStart = current.data.loopStart ?? .055;
    const loopEnd = current.data.loopEnd ?? .945;
    const nodes = (candidates.length ? candidates : Array.from({length:8},(_,index)=>({index:Math.round((index+1)*POINTS/9),value:.5}))).map((candidate,index)=>({
      id:`import-${item.id}-${index+1}`,
      x:clamp(candidate.index/(POINTS-1),loopStart+.01,loopEnd-.01),
      y:clamp(.5-normalized[candidate.index]*.42,.07,.93),
      velocity:clamp(Math.round(68+candidate.value*190),48,127)
    }));
    current.data.points = normalized;
    current.data.nodes = nodes;
    current.data.preset = 'custom';
    current.name = `Imported ${item.name}`;
    return current;
  }

  function unfold(item) {
    loom.applyPatch(derivePatch(item));
    document.querySelector('[data-tool="sculpt"]')?.click();
    frame?.scrollIntoView({behavior:'smooth',block:'center'});
    setStatus(`${item.name} unfolded into a playable Wave Pattern.`,'live');
  }

  function remove(item) {
    const index = imports.findIndex(entry=>entry.id===item.id);
    if (index >= 0) imports.splice(index,1);
    render();
    setStatus(`${item.name} removed from your imports.`);
  }

  function render() {
    count.textContent = `${imports.length} SAMPLE${imports.length===1?'':'S'}`;
    if (!imports.length) {shelf.innerHTML='<div class="uploaded-sample-empty">UPLOAD OR RECORD AUDIO · YOUR SAMPLES STAY IN THIS BROWSER SESSION</div>';return;}
    shelf.innerHTML='';
    imports.forEach(item=>{
      const article=document.createElement('article');
      article.className='imported-sample';article.draggable=true;article.dataset.importId=item.id;article.style.setProperty('--import-color',item.color);
      article.innerHTML=`<header><i></i><b></b><span>${item.duration.toFixed(2)}s</span></header><canvas class="imported-wave" aria-label="Waveform for uploaded sample"></canvas><div class="imported-actions"><button data-preview>PREVIEW</button><button class="primary" data-unfold>UNFOLD</button><button data-remove>REMOVE</button></div>`;
      article.querySelector('b').textContent=item.name;
      article.addEventListener('dragstart',event=>{article.classList.add('dragging');event.dataTransfer.setData('application/x-neusic-upload',item.id);event.dataTransfer.effectAllowed='copy';});
      article.addEventListener('dragend',()=>article.classList.remove('dragging'));
      article.querySelector('[data-preview]').onclick=()=>preview(item);
      article.querySelector('[data-unfold]').onclick=()=>unfold(item);
      article.querySelector('[data-remove]').onclick=()=>remove(item);
      shelf.appendChild(article);
      requestAnimationFrame(()=>drawWave(article.querySelector('canvas'),item));
    });
  }

  async function importFiles(files) {
    const list=[...files];
    if(!list.length)return;
    uploadButton.disabled=true;
    for(const file of list){
      setStatus(`Decoding ${file.name}…`,'live');
      try {addImport(await decodeAudio(file,file.name,file.type),file.name,file.type);}
      catch(error){console.error(error);setStatus(error.message,'error');}
    }
    uploadButton.disabled=false;input.value='';
  }

  function supportedMime() {
    const candidates=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus','audio/ogg'];
    return candidates.find(type=>window.MediaRecorder?.isTypeSupported?.(type))||'';
  }

  async function toggleRecording() {
    if (recording) {
      recording.recorder.stop();
      recordButton.disabled=true;
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {setStatus('Audio recording is not supported in this browser.','error');return;}
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=supportedMime();
      const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      const chunks=[];const started=performance.now();
      recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
      recorder.onstop=async()=>{
        clearInterval(recording?.timer);stream.getTracks().forEach(track=>track.stop());
        const seconds=(performance.now()-started)/1000;
        recording=null;recordButton.disabled=false;recordButton.classList.remove('live');recordButton.querySelector('b').textContent='RECORD FULL SAMPLE';
        try {const blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});addImport(await decodeAudio(blob,'Recorded sample',blob.type),`Loom Recording ${imports.length+1}`,blob.type);setStatus(`Recorded ${seconds.toFixed(1)} seconds and added it to your imports.`,'live');}
        catch(error){console.error(error);setStatus(error.message,'error');}
      };
      recorder.start(250);
      const timer=setInterval(()=>{const elapsed=(performance.now()-started)/1000;setStatus(`Recording sample · ${elapsed.toFixed(1)} seconds · tap Stop when finished`,'live');},200);
      recording={stream,recorder,chunks,started,timer};
      recordButton.classList.add('live');recordButton.querySelector('b').textContent='STOP & ADD SAMPLE';
      setStatus('Recording your sample…','live');
    } catch(error){console.error(error);setStatus('Microphone permission was denied or unavailable.','error');}
  }

  uploadButton.addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>importFiles(input.files));
  recordButton.addEventListener('click',toggleRecording);
  frame?.addEventListener('dragover',event=>{if(event.dataTransfer?.types?.includes('application/x-neusic-upload')){event.preventDefault();event.dataTransfer.dropEffect='copy';}},true);
  frame?.addEventListener('drop',event=>{const id=event.dataTransfer?.getData('application/x-neusic-upload');if(!id)return;event.preventDefault();event.stopImmediatePropagation();const item=imports.find(entry=>entry.id===id);if(item)unfold(item);},true);
  window.addEventListener('resize',()=>document.querySelectorAll('.imported-sample').forEach(article=>{const item=imports.find(entry=>entry.id===article.dataset.importId);if(item)drawWave(article.querySelector('canvas'),item);}));
  render();
})();
