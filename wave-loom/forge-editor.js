(() => {
  'use strict';
  if (window.NeusicForgeEditor) return;

  const R = window.NeusicWaveReliability;
  const P = () => window.NeusicSamplePerformance;
  const editor = {sampleId:null,canvas:null,ctx:null};
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  }

  function sampleById(id) { return R.state.samples.find(sample => sample.id === id) || null; }

  function detectTransients(sample, sensitivity = R.state.transientSensitivity, minimumMs = R.state.minimumSliceMs) {
    const buffer = sample.buffer;
    const channels = Array.from({length:buffer.numberOfChannels},(_,index)=>buffer.getChannelData(index));
    const windowSize = 512;
    const hop = 256;
    const energy = [];
    for (let start = 0; start + windowSize < buffer.length; start += hop) {
      let total = 0;
      for (let frame = start; frame < start + windowSize; frame++) {
        let value = 0;
        for (const channel of channels) value += channel[frame] || 0;
        value /= Math.max(1,channels.length);
        total += value * value;
      }
      energy.push(Math.sqrt(total / windowSize));
    }
    if (energy.length < 4) return [];
    const flux = energy.map((value,index)=>Math.max(0,value-(energy[index-1] ?? value)));
    const mean = flux.reduce((total,value)=>total+value,0)/flux.length;
    const variance = flux.reduce((total,value)=>total+(value-mean)**2,0)/flux.length;
    const threshold = mean + Math.sqrt(variance) * clamp(Number(sensitivity)||.72,.1,2.5);
    const minFrames = Math.max(2,Math.floor(buffer.sampleRate * (Number(minimumMs)||65) / 1000 / hop));
    const candidates = [];
    for (let index = 1; index < flux.length - 1; index++) {
      if (flux[index] < threshold || flux[index] < flux[index-1] || flux[index] < flux[index+1]) continue;
      const previous = candidates[candidates.length - 1];
      if (previous !== undefined && index - previous < minFrames) {
        if (flux[index] > flux[previous]) candidates[candidates.length - 1] = index;
      } else candidates.push(index);
    }
    const edit = sample.edit || {};
    const trimStart = clamp(Number(edit.trimStart ?? 0),0,.999);
    const trimEnd = clamp(Number(edit.trimEnd ?? 1),trimStart+.001,1);
    return candidates
      .sort((a,b)=>flux[b]-flux[a]).slice(0,31).sort((a,b)=>a-b)
      .map(index=>index*hop/buffer.length)
      .filter(ratio=>ratio>trimStart+.002&&ratio<trimEnd-.002);
  }

  function slicesFromCuts(sample,cuts) {
    const edit = sample.edit || {};
    const start = clamp(Number(edit.trimStart ?? 0),0,.999);
    const end = clamp(Number(edit.trimEnd ?? 1),start+.001,1);
    const points = [start,...cuts,end].sort((a,b)=>a-b).filter((value,index,array)=>!index||value-array[index-1]>.001);
    return points.slice(0,-1).map((value,index)=>({
      id:R.uid('slice'),
      name:`SLICE ${String(index+1).padStart(2,'0')}`,
      start:value,
      end:points[index+1]
    }));
  }

  function buildLibrary() {
    const forge = document.querySelector('.forge');
    const shelf = document.getElementById('sampleShelf');
    if (!forge || !shelf || document.getElementById('persistentForgeLibrary')) return;
    const section = document.createElement('section');
    section.id = 'persistentForgeLibrary';
    section.className = 'persistent-forge-library';
    section.innerHTML = `<header><div><span class="kicker">PERSISTENT AUDIO LIBRARY</span><h3>True Sample Forge</h3></div><div><b data-forge-count>0 SAMPLES</b><span>IndexedDB autosave</span></div></header><div class="persistent-sample-shelf" data-persistent-shelf></div>`;
    shelf.before(section);
    renderLibrary();
  }

  function renderLibrary() {
    const shelf = document.querySelector('[data-persistent-shelf]');
    const count = document.querySelector('[data-forge-count]');
    if (!shelf) return;
    count.textContent = `${R.state.samples.length} SAMPLE${R.state.samples.length===1?'':'S'}`;
    shelf.innerHTML = '';
    if (!R.state.samples.length) {
      shelf.innerHTML = '<div class="persistent-empty"><b>NO SAVED SAMPLES</b><span>Record with NeuCapture or upload an audio file. Your Forge library will survive refreshes.</span></div>';
      return;
    }
    R.state.samples.forEach(sample => {
      const card = document.createElement('article');
      card.className = `persistent-sample-card${sample.id===R.state.selectedSampleId?' selected':''}`;
      card.style.setProperty('--sample-color',sample.color);
      card.dataset.sampleId = sample.id;
      card.innerHTML = `<header><i></i><div><b>${escapeHtml(sample.name)}</b><span>${sample.duration.toFixed(2)}s · ${sample.slices.length} slices · ${escapeHtml(sample.source)}</span></div></header><canvas aria-label="${escapeHtml(sample.name)} waveform"></canvas><div class="persistent-sample-actions"><button data-preview>PREVIEW</button><button data-edit class="primary">EDIT</button><button data-map>MAP NODE</button><button data-studio>STUDIO</button><button data-delete class="danger">DELETE</button></div>`;
      card.addEventListener('click',event=>{if(!event.target.closest('button')){R.selectSample(sample.id);renderLibrary();}});
      card.querySelector('[data-preview]').onclick=()=>{R.selectSample(sample.id);P()?.previewSample(sample);renderLibrary();};
      card.querySelector('[data-edit]').onclick=()=>openEditor(sample.id);
      card.querySelector('[data-map]').onclick=()=>{R.selectSample(sample.id);P()?.mapSelectedToNode();renderLibrary();};
      card.querySelector('[data-studio]').onclick=()=>window.NeusicStudioTransfer?.sendSample?.(sample);
      card.querySelector('[data-delete]').onclick=()=>{if(confirm(`Remove ${sample.name} from the persistent Forge library?`))R.removeSample(sample.id);};
      shelf.appendChild(card);
      requestAnimationFrame(()=>drawCardWave(card.querySelector('canvas'),sample));
    });
  }

  function drawCardWave(canvas,sample) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2,devicePixelRatio||1);
    canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#02070a';ctx.fillRect(0,0,rect.width,rect.height);
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.beginPath();ctx.moveTo(0,rect.height/2);ctx.lineTo(rect.width,rect.height/2);ctx.stroke();
    ctx.strokeStyle=sample.color;ctx.shadowColor=sample.color;ctx.shadowBlur=8;ctx.beginPath();
    sample.peaks.forEach((peak,index)=>{const x=index/Math.max(1,sample.peaks.length-1)*rect.width;ctx.moveTo(x,rect.height/2+peak[0]*rect.height*.43);ctx.lineTo(x,rect.height/2+peak[1]*rect.height*.43);});ctx.stroke();ctx.shadowBlur=0;
    const edit=sample.edit||{};ctx.fillStyle='rgba(0,0,0,.66)';ctx.fillRect(0,0,(edit.trimStart||0)*rect.width,rect.height);ctx.fillRect((edit.trimEnd??1)*rect.width,0,(1-(edit.trimEnd??1))*rect.width,rect.height);
    ctx.strokeStyle='#fff';ctx.lineWidth=1;sample.slices.forEach(slice=>{ctx.beginPath();ctx.moveTo(slice.start*rect.width,0);ctx.lineTo(slice.start*rect.width,rect.height);ctx.stroke();});
  }

  function buildDialog() {
    if (document.getElementById('forgeEditorDialog')) return;
    const dialog=document.createElement('dialog');dialog.id='forgeEditorDialog';dialog.className='forge-editor-dialog';
    dialog.innerHTML=`<form method="dialog" class="forge-editor-shell"><header><div><span class="kicker">NON-DESTRUCTIVE SAMPLE EDITOR</span><h2 data-editor-title>Forge Editor</h2></div><button value="cancel" aria-label="Close editor">×</button></header><div class="forge-editor-wave"><canvas data-editor-wave></canvas><div class="forge-editor-time"><span data-trim-start-time>0.00s</span><span data-trim-end-time>0.00s</span></div></div><div class="forge-editor-controls"><label>NAME<input data-edit-name type="text"></label><label>TRIM START<input data-trim-start type="range" min="0" max="999" value="0"><output>0.0%</output></label><label>TRIM END<input data-trim-end type="range" min="1" max="1000" value="1000"><output>100.0%</output></label><label>FADE IN<input data-fade-in type="range" min="0" max="2000" step="5" value="0"><output>0ms</output></label><label>FADE OUT<input data-fade-out type="range" min="0" max="2000" step="5" value="0"><output>0ms</output></label><label>GAIN<input data-gain type="range" min="-24" max="18" step=".5" value="0"><output>0dB</output></label><label class="forge-check"><input data-reverse type="checkbox"><span>REVERSE</span></label><label class="forge-check"><input data-normalize type="checkbox"><span>NORMALIZE</span></label></div><section class="transient-controls"><label>SENSITIVITY<input data-sensitivity type="range" min="10" max="200" value="72"><output>0.72</output></label><label>MINIMUM SLICE<input data-min-slice type="range" min="15" max="500" value="65"><output>65ms</output></label><button data-detect type="button">DETECT TRANSIENTS</button></section><div class="slice-chip-list" data-slice-list></div><footer><button data-preview-editor type="button">PREVIEW EDIT</button><button data-restore type="button">RESTORE ORIGINAL</button><button data-duplicate type="button">DUPLICATE</button><button data-apply class="primary" type="button">APPLY & SAVE</button></footer></form>`;
    document.body.appendChild(dialog);
    editor.canvas=dialog.querySelector('[data-editor-wave]');editor.ctx=editor.canvas.getContext('2d');
    dialog.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{syncOutputs();drawEditor();}));
    dialog.querySelector('[data-detect]').onclick=detectEditorTransients;
    dialog.querySelector('[data-preview-editor]').onclick=previewEditor;
    dialog.querySelector('[data-restore]').onclick=restoreEditor;
    dialog.querySelector('[data-duplicate]').onclick=duplicateEditor;
    dialog.querySelector('[data-apply]').onclick=applyEditor;
    addEventListener('resize',()=>{if(dialog.open)drawEditor();});
  }

  function openEditor(id) {
    buildDialog();
    const sample=sampleById(id);if(!sample)return;
    editor.sampleId=id;R.selectSample(id);
    const dialog=document.getElementById('forgeEditorDialog');
    dialog.querySelector('[data-editor-title]').textContent=sample.name;
    dialog.querySelector('[data-edit-name]').value=sample.name;
    dialog.querySelector('[data-trim-start]').value=Math.round((sample.edit?.trimStart||0)*1000);
    dialog.querySelector('[data-trim-end]').value=Math.round((sample.edit?.trimEnd??1)*1000);
    dialog.querySelector('[data-fade-in]').value=sample.edit?.fadeIn||0;
    dialog.querySelector('[data-fade-out]').value=sample.edit?.fadeOut||0;
    dialog.querySelector('[data-gain]').value=sample.edit?.gainDb||0;
    dialog.querySelector('[data-reverse]').checked=Boolean(sample.edit?.reverse);
    dialog.querySelector('[data-normalize]').checked=Boolean(sample.edit?.normalized);
    dialog.querySelector('[data-sensitivity]').value=Math.round(R.state.transientSensitivity*100);
    dialog.querySelector('[data-min-slice]').value=R.state.minimumSliceMs;
    syncOutputs();renderSliceList(sample);dialog.showModal();requestAnimationFrame(drawEditor);
  }

  function draftEdit() {
    const dialog=document.getElementById('forgeEditorDialog');
    const start=Number(dialog.querySelector('[data-trim-start]').value)/1000;
    const end=Math.max(start+.001,Number(dialog.querySelector('[data-trim-end]').value)/1000);
    return {trimStart:start,trimEnd:end,fadeIn:Number(dialog.querySelector('[data-fade-in]').value),fadeOut:Number(dialog.querySelector('[data-fade-out]').value),gainDb:Number(dialog.querySelector('[data-gain]').value),reverse:dialog.querySelector('[data-reverse]').checked,normalized:dialog.querySelector('[data-normalize]').checked};
  }

  function syncOutputs() {
    const dialog=document.getElementById('forgeEditorDialog');if(!dialog)return;
    const sample=sampleById(editor.sampleId);if(!sample)return;
    const edit=draftEdit();
    dialog.querySelector('[data-trim-start]+output').textContent=`${(edit.trimStart*100).toFixed(1)}%`;
    dialog.querySelector('[data-trim-end]+output').textContent=`${(edit.trimEnd*100).toFixed(1)}%`;
    dialog.querySelector('[data-fade-in]+output').textContent=`${edit.fadeIn}ms`;
    dialog.querySelector('[data-fade-out]+output').textContent=`${edit.fadeOut}ms`;
    dialog.querySelector('[data-gain]+output').textContent=`${edit.gainDb>0?'+':''}${edit.gainDb}dB`;
    dialog.querySelector('[data-sensitivity]+output').textContent=(Number(dialog.querySelector('[data-sensitivity]').value)/100).toFixed(2);
    dialog.querySelector('[data-min-slice]+output').textContent=`${dialog.querySelector('[data-min-slice]').value}ms`;
    dialog.querySelector('[data-trim-start-time]').textContent=`${(edit.trimStart*sample.duration).toFixed(2)}s`;
    dialog.querySelector('[data-trim-end-time]').textContent=`${(edit.trimEnd*sample.duration).toFixed(2)}s`;
  }

  function drawEditor() {
    const canvas=editor.canvas,sample=sampleById(editor.sampleId);if(!canvas||!sample)return;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));const ctx=editor.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#02070a';ctx.fillRect(0,0,rect.width,rect.height);ctx.strokeStyle=sample.color;ctx.shadowColor=sample.color;ctx.shadowBlur=10;ctx.beginPath();sample.peaks.forEach((peak,index)=>{const x=index/(sample.peaks.length-1)*rect.width;ctx.moveTo(x,rect.height/2+peak[0]*rect.height*.44);ctx.lineTo(x,rect.height/2+peak[1]*rect.height*.44);});ctx.stroke();ctx.shadowBlur=0;const edit=draftEdit();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(0,0,edit.trimStart*rect.width,rect.height);ctx.fillRect(edit.trimEnd*rect.width,0,(1-edit.trimEnd)*rect.width,rect.height);ctx.strokeStyle='#fff';ctx.lineWidth=2;[edit.trimStart,edit.trimEnd].forEach(ratio=>{ctx.beginPath();ctx.moveTo(ratio*rect.width,0);ctx.lineTo(ratio*rect.width,rect.height);ctx.stroke();});ctx.strokeStyle='#ffc762';ctx.lineWidth=1;sample.slices.forEach(slice=>{ctx.beginPath();ctx.moveTo(slice.start*rect.width,0);ctx.lineTo(slice.start*rect.width,rect.height);ctx.stroke();});
  }

  function renderSliceList(sample) {
    const list=document.querySelector('[data-slice-list]');if(!list)return;
    list.innerHTML=sample.slices.length?sample.slices.map(slice=>`<button type="button" data-slice-id="${slice.id}">${escapeHtml(slice.name)} · ${(slice.start*sample.duration).toFixed(2)}–${(slice.end*sample.duration).toFixed(2)}s</button>`).join(''):'<span>NO SLICES · DETECT TRANSIENTS OR USE THE FULL SAMPLE</span>';
    list.querySelectorAll('button').forEach(button=>button.onclick=()=>{R.selectSample(sample.id,button.dataset.sliceId);P()?.previewSample(sample,button.dataset.sliceId);});
  }

  async function detectEditorTransients() {
    const sample=sampleById(editor.sampleId);if(!sample)return;
    const dialog=document.getElementById('forgeEditorDialog');
    sample.edit=draftEdit();
    R.state.transientSensitivity=Number(dialog.querySelector('[data-sensitivity]').value)/100;
    R.state.minimumSliceMs=Number(dialog.querySelector('[data-min-slice]').value);
    const cuts=detectTransients(sample,R.state.transientSensitivity,R.state.minimumSliceMs);
    sample.slices=slicesFromCuts(sample,cuts);
    renderSliceList(sample);drawEditor();R.queueProjectSave();
    R.setStatus(cuts.length?`${sample.name}: ${sample.slices.length} slices detected.`:`${sample.name}: no strong transients were found.`,'live');
  }

  function previewEditor() {
    const sample=sampleById(editor.sampleId);if(!sample)return;
    const previous={...sample.edit};sample.edit=draftEdit();P()?.playback.cache.clear();P()?.previewSample(sample);sample.edit=previous;P()?.playback.cache.clear();
  }

  function restoreEditor() {
    const sample=sampleById(editor.sampleId);if(!sample)return;
    sample.edit={trimStart:0,trimEnd:1,fadeIn:0,fadeOut:0,gainDb:0,reverse:false,normalized:false};sample.slices=[];openEditor(sample.id);R.setStatus(`${sample.name} editor settings restored.`);
  }

  async function duplicateEditor() {
    const sample=sampleById(editor.sampleId);if(!sample)return;
    const copy=await R.addSample({...sample,id:R.uid('sample'),name:`${sample.name} Copy`,createdAt:new Date().toISOString(),edit:{...draftEdit()},slices:sample.slices.map(slice=>({...slice,id:R.uid('slice')}))});renderLibrary();openEditor(copy.id);
  }

  async function applyEditor() {
    const sample=sampleById(editor.sampleId);if(!sample)return;
    const dialog=document.getElementById('forgeEditorDialog');sample.name=dialog.querySelector('[data-edit-name]').value.trim()||sample.name;sample.edit=draftEdit();P()?.playback.cache.clear();await R.updateSample(sample,{status:`${sample.name} edits and slices saved.`});dialog.close();renderLibrary();
  }

  const api={editor,detectTransients,slicesFromCuts,renderLibrary,openEditor,drawEditor};window.NeusicForgeEditor=api;
  R.ready.then(value=>{if(!value)return;buildLibrary();buildDialog();R.events.addEventListener('sampleschange',renderLibrary);R.events.addEventListener('selectionchange',renderLibrary);});
})();