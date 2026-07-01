/* ═══════════════════════════════════════════════
   Full sample browser: categories, search, preview, drag-to-timeline, folder scan
═══════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   SAMPLE BROWSER
   Full-featured file browser with:
   · Category sidebar (All, Drums, Loops, One-shots, Samples, Vocals, MIDI, Cloud)
   · Search with live filtering
   · BPM / key metadata display
   · Preview on tap (Web Audio)
   · Drag or "Use" button → drops sample into current track at playhead
   · Recent files history (sessionStorage)
   · File System Access API (showOpenFilePicker) for folder scan
   · Fallback: manual file picker
════════════════════════════════════════════════════════════ */
const SB = {
  items: [],          // [{id,name,path,category,bpm,key,duration,buffer,url}]
  filtered: [],
  query: '',
  category: 'all',
  previewSrc: null,   // active AudioBufferSourceNode
  previewId: null,
  recent: [],
};

const SB_CATS = [
  { id:'all',      icon:'🎵', label:'All files' },
  { id:'drums',    icon:'🥁', label:'Drums' },
  { id:'loops',    icon:'🔁', label:'Loops' },
  { id:'oneshots', icon:'⚡', label:'One-shots' },
  { id:'samples',  icon:'🎤', label:'Samples' },
  { id:'vocals',   icon:'🎙', label:'Vocals' },
  { id:'bass',     icon:'🎸', label:'Bass' },
  { id:'midi',     icon:'🎹', label:'MIDI' },
  { id:'recent',   icon:'🕐', label:'Recent' },
];

function catForFile(name){
  const n=name.toLowerCase();
  if(/drum|kick|snare|hat|clap|808|perc|cymbal/.test(n))return 'drums';
  if(/loop|groove|beat|full/.test(n))return 'loops';
  if(/vocal|vox|voice|rap|adlib|hook/.test(n))return 'vocals';
  if(/bass|sub/.test(n))return 'bass';
  if(/\.mid$/.test(n))return 'midi';
  if(/_[0-9]+bar|_[0-9]+bpm/.test(n))return 'loops';
  return 'oneshots';
}

function guessBpm(name){
  const m=name.match(/(\d{2,3})\s*bpm/i)||name.match(/_(\d{2,3})_/);
  if(m){const v=parseInt(m[1],10);if(v>=40&&v<=240)return v;}
  return null;
}

function guessKey(name){
  const m=name.match(/\b([A-G](?:#|b)?(?:maj|min|m)?)\b/i);
  return m?m[1]:null;
}

function sbAddItem(file, buffer){
  const id='sb_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  const item={
    id, name:file.name,
    category:catForFile(file.name),
    bpm:guessBpm(file.name),
    key:guessKey(file.name),
    duration:buffer?buffer.duration:null,
    buffer,
    url:buffer?null:URL.createObjectURL(file),
    file,
  };
  SB.items.unshift(item);
  // Keep in recent
  SB.recent.unshift({id,name:file.name});
  if(SB.recent.length>20)SB.recent.length=20;
  sbFilter();
  return item;
}

function sbFilter(){
  const q=SB.query.toLowerCase();
  const cat=SB.category;
  SB.filtered=SB.items.filter(it=>{
    if(cat==='recent')return SB.recent.some(r=>r.id===it.id);
    if(cat!=='all'&&it.category!==cat)return false;
    if(q&&!it.name.toLowerCase().includes(q))return false;
    return true;
  });
  renderSbList();
}

function buildBrowser(el){
  el.innerHTML=`<div class="sb-browser">
    <div class="sb-b-top">
      <div class="sb-b-search-wrap">
        <input id="sb-search" class="sb-b-search" type="search" placeholder="Search samples…"
          oninput="SB.query=this.value;sbFilter()">
        <button class="sb-b-import-btn" onclick="sbOpenFiles()" title="Import files">＋ Import</button>
        <button class="sb-b-import-btn" onclick="sbScanFolder()" title="Scan folder" style="opacity:.7;">📁 Folder</button>
      </div>
    </div>
    <div class="sb-b-body">
      <div class="sb-b-cats" id="sb-b-cats">
        ${SB_CATS.map(c=>`<button class="sb-b-cat${SB.category===c.id?' active':''}" onclick="sbSetCat('${c.id}',this)">
          <span>${c.icon}</span><span class="sb-b-cat-lbl">${c.label}</span>
        </button>`).join('')}
      </div>
      <div class="sb-b-list-wrap">
        <div id="sb-b-list" class="sb-b-list"></div>
      </div>
    </div>
    <div class="sb-b-footer" id="sb-b-footer">
      ${SB.items.length?`${SB.items.length} files loaded`:'No samples — tap ＋ Import to load files'}
    </div>
  </div>`;
  sbFilter();
  injectSbStyles();
}

function renderSbList(){
  const list=document.getElementById('sb-b-list');
  if(!list)return;
  const footer=document.getElementById('sb-b-footer');
  if(footer)footer.textContent=`${SB.filtered.length} of ${SB.items.length} files`;
  if(!SB.filtered.length){
    list.innerHTML=`<div class="sb-empty">${SB.items.length?'No matches — try a different search':'Drop audio files here or tap ＋ Import'}</div>`;
    return;
  }
  list.innerHTML=SB.filtered.map(it=>`
    <div class="sb-item-row${SB.previewId===it.id?' sb-previewing':''}" id="sbi-${it.id}"
      onclick="sbPreview('${it.id}')" draggable="true"
      ondragstart="sbDragStart(event,'${it.id}')">
      <div class="sb-item-icon">${it.category==='drums'?'🥁':it.category==='vocals'?'🎙':it.category==='loops'?'🔁':it.category==='bass'?'🎸':it.category==='midi'?'🎹':'⚡'}</div>
      <div class="sb-item-info">
        <div class="sb-item-name">${it.name}</div>
        <div class="sb-item-meta">
          ${it.duration?`<span>${it.duration.toFixed(1)}s</span>`:''}
          ${it.bpm?`<span>${it.bpm} BPM</span>`:''}
          ${it.key?`<span>${it.key}</span>`:''}
          <span style="opacity:.5;text-transform:uppercase;font-size:8px;">${it.category}</span>
        </div>
      </div>
      <div class="sb-item-actions">
        <button class="sb-act-btn" onclick="event.stopPropagation();sbPreview('${it.id}')" title="Preview">
          ${SB.previewId===it.id?'■':'▶'}
        </button>
        <button class="sb-act-btn sb-use-btn" onclick="event.stopPropagation();sbUseItem('${it.id}')" title="Add to track">+</button>
      </div>
    </div>`).join('');

  // Wire drag from list items
  list.querySelectorAll('.sb-item-row').forEach(row=>{
    const id=row.id.replace('sbi-','');
    row.addEventListener('dragstart',e=>sbDragStart(e,id));
  });
}

function sbSetCat(cat,btn){
  SB.category=cat;
  document.querySelectorAll('.sb-b-cat').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  sbFilter();
}

async function sbPreview(id){
  // Stop any current preview
  if(SB.previewSrc){try{SB.previewSrc.stop();}catch(e){}SB.previewSrc=null;}
  if(SB.previewId===id){SB.previewId=null;renderSbList();return;}

  const item=SB.items.find(i=>i.id===id);
  if(!item)return;
  SB.previewId=id;
  renderSbList();

  Audio_.ensure();
  let buffer=item.buffer;
  if(!buffer&&item.file){
    try{
      const ab=await item.file.arrayBuffer();
      buffer=await Audio_.ctx.decodeAudioData(ab);
      item.buffer=buffer;
      item.duration=buffer.duration;
    }catch(e){toast('Cannot preview this file');SB.previewId=null;renderSbList();return;}
  }
  if(!buffer){toast('No audio data');SB.previewId=null;renderSbList();return;}

  const g=Audio_.ctx.createGain();g.gain.value=0.85;
  g.connect(Audio_.master);
  const src=Audio_.ctx.createBufferSource();
  src.buffer=buffer;src.connect(g);
  src.start(0);
  SB.previewSrc=src;
  src.onended=()=>{if(SB.previewId===id){SB.previewId=null;renderSbList();}};
}

async function sbUseItem(id){
  const item=SB.items.find(i=>i.id===id);
  if(!item)return;
  if(!S.tracks.length){toast('Add a track first');return;}

  Audio_.ensure();
  let buffer=item.buffer;
  if(!buffer&&item.file){
    try{
      const ab=await item.file.arrayBuffer();
      buffer=await Audio_.ctx.decodeAudioData(ab);
      item.buffer=buffer;item.duration=buffer.duration;
    }catch(e){toast('Cannot decode file');return;}
  }
  if(!buffer){toast('No audio data');return;}

  const bufId='sb_buf_'+id;
  Audio_.registerBuffer(bufId,buffer,item.name);

  const ti=S.activeTrack<S.tracks.length?S.activeTrack:0;
  const t=S.tracks[ti];
  const dropBeat=Math.max(0,Math.round(secToBeat(S.sec)));
  const lenBeats=Math.max(0.25,secToBeat(buffer.duration));
  snapshot();
  t.clips.push({id:'clip_'+Date.now(),start:dropBeat,len:lenBeats,label:item.name.replace(/\.[^.]+$/,''),bufferId:bufId});
  renderTracks();
  if(S.playing){stopAllScheduled();scheduleClipPlayback();}
  toast(`Added "${item.name}" → Track ${ti+1}`);
}

function sbDragStart(e,id){
  e.dataTransfer.setData('text/plain',id);
  e.dataTransfer.effectAllowed='copy';
}

// Wire clip lanes to accept drags from browser
(function wireSbLaneDrop(){
  // We patch setupLaneFileDrop to also accept sb item IDs
  const _orig=window.setupLaneFileDrop;
  window.setupLaneFileDrop=function(lane,t,ti){
    _orig(lane,t,ti);
    lane.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('text/plain'))e.preventDefault();});
    lane.addEventListener('drop',async e=>{
      const sbId=e.dataTransfer.getData('text/plain');
      if(!sbId||!sbId.startsWith('sb_'))return;
      e.preventDefault();e.stopPropagation();
      const item=SB.items.find(i=>i.id===sbId);if(!item)return;
      const rect=lane.getBoundingClientRect();
      const dropBeat=Math.max(0,Math.floor(xToBeat(e.clientX-rect.left)));
      Audio_.ensure();
      let buffer=item.buffer;
      if(!buffer&&item.file){
        try{const ab=await item.file.arrayBuffer();buffer=await Audio_.ctx.decodeAudioData(ab);item.buffer=buffer;item.duration=buffer.duration;}
        catch(ex){toast('Cannot decode');return;}
      }
      if(!buffer)return;
      const bufId='sb_buf_'+item.id;
      Audio_.registerBuffer(bufId,buffer,item.name);
      const lenBeats=Math.max(0.25,secToBeat(buffer.duration));
      snapshot();
      t.clips.push({id:'clip_'+Date.now(),start:dropBeat,len:lenBeats,label:item.name.replace(/\.[^.]+$/,''),bufferId:bufId});
      renderTracks();
      if(S.playing){stopAllScheduled();scheduleClipPlayback();}
      toast(`Dropped "${item.name}" at bar ${Math.floor(dropBeat/4)+1}`);
    });
  };
})();

async function sbOpenFiles(){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='audio/*,.mid,.midi';inp.multiple=true;inp.style.display='none';
  document.body.appendChild(inp);
  inp.onchange=async()=>{
    const files=[...inp.files];inp.remove();
    toast(`Loading ${files.length} file(s)…`);
    let ok=0;
    for(const f of files){
      try{
        if(f.name.match(/\.midi?$/)){sbAddItem(f,null);ok++;continue;}
        const ab=await f.arrayBuffer();
        Audio_.ensure();
        const buf=await Audio_.ctx.decodeAudioData(ab);
        sbAddItem(f,buf);ok++;
      }catch(e){toast('Skipped: '+f.name);}
    }
    toast(`${ok} file(s) imported`);
    const el=document.getElementById('dp-browser');
    if(el&&el.classList.contains('active'))buildBrowser(el);
  };
  inp.click();
}

async function sbScanFolder(){
  if(!window.showDirectoryPicker){
    toast('Folder scan needs Chrome/Edge. Use ＋ Import instead.');
    return sbOpenFiles();
  }
  try{
    const dir=await window.showDirectoryPicker();
    toast('Scanning folder…');
    let count=0;
    async function scanDir(d){
      for await(const [name,entry] of d.entries()){
        if(entry.kind==='directory')await scanDir(entry);
        else if(/\.(wav|mp3|aiff|flac|ogg|m4a|aac|mid|midi)$/i.test(name)){
          try{
            const file=await entry.getFile();
            if(name.match(/\.midi?$/)){sbAddItem(file,null);count++;continue;}
            const ab=await file.arrayBuffer();
            Audio_.ensure();
            const buf=await Audio_.ctx.decodeAudioData(ab);
            sbAddItem(file,buf);count++;
            if(count%10===0)toast(`${count} files loaded…`);
          }catch(e){}
        }
      }
    }
    await scanDir(dir);
    toast(`Imported ${count} file(s) from folder`);
    const el=document.getElementById('dp-browser');
    if(el&&el.classList.contains('active'))buildBrowser(el);
  }catch(e){if(e.name!=='AbortError')toast('Folder scan failed');}
}

// Also hook the sampler waveform drop zone → add to browser too
(function patchSamplerForBrowser(){
  const _origSampDrop=window.setupSamplerDrop;
  window.setupSamplerDrop=function(){
    _origSampDrop&&_origSampDrop();
    const zone=document.getElementById('samp-drop');
    if(!zone||zone._sbHooked)return;
    zone._sbHooked=true;
    zone.addEventListener('drop',async e=>{
      const files=[...((e.dataTransfer&&e.dataTransfer.files)||[])];
      for(const f of files){
        if(!/\.(wav|mp3|aiff|flac|ogg|m4a|aac)$/i.test(f.name))continue;
        try{
          const ab=await f.arrayBuffer();Audio_.ensure();
          const buf=await Audio_.ctx.decodeAudioData(ab);
          sbAddItem(f,buf);
        }catch(e){}
      }
    },{passive:false,capture:false});
  };
})();

function injectSbStyles(){ /* CSS now static: css/browser.css */ }
