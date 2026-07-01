/* ═══════════════════════════════════════════════
   Real MIDI device input via navigator.requestMIDIAccess, CC learn
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   PHASE 6F — REAL MIDI DEVICE INPUT
   navigator.requestMIDIAccess → note-on/off → piano roll
   record, drum pad trigger, CC mapping + MIDI learn.
═══════════════════════════════════════════════════════════════ */
const MIDI_={
  access:null,inputs:{},
  learnMode:false,learnTarget:null,
  ccMap:{},noteChannel:0,drumChannel:9,
};
PR._midiRec=false;PR._heldNotes={};

async function initMIDI(){
  if(!navigator.requestMIDIAccess){toast('Web MIDI not supported');return;}
  try{
    MIDI_.access=await navigator.requestMIDIAccess({sysex:false});
    MIDI_.access.inputs.forEach(p=>{MIDI_.inputs[p.id]=p;p.onmidimessage=onMIDIMsg;});
    MIDI_.access.onstatechange=e=>{
      if(e.port.type==='input'){
        if(e.port.state==='connected'){MIDI_.inputs[e.port.id]=e.port;e.port.onmidimessage=onMIDIMsg;}
        else{if(MIDI_.inputs[e.port.id])MIDI_.inputs[e.port.id].onmidimessage=null;delete MIDI_.inputs[e.port.id];}
      }
      toast(`MIDI: ${e.port.name} ${e.port.state}`);refreshMidiList();
    };
    toast(`MIDI ready · ${MIDI_.access.inputs.size} device(s)`);refreshMidiList();
  }catch(err){toast('MIDI denied: '+err.message);}
}

function onMIDIMsg(e){
  const [st,d1,d2]=e.data,type=st&0xF0,ch=st&0x0F;
  if(type===0x90&&d2>0)onMidiNoteOn(d1,d2,ch);
  else if(type===0x80||(type===0x90&&d2===0))onMidiNoteOff(d1,ch);
  else if(type===0xB0)onMidiCC(d1,d2,ch);
  else if(type===0xE0)onMidiPitchBend(((d2<<7)|d1)-8192,ch);
}

const DRUM_MAP={36:'KICK',38:'SNARE',42:'HI-HAT',46:'OPEN',49:'CRASH',51:'RIDE',
  37:'RIM',41:'TOM',43:'TOM',45:'TOM',47:'TOM',39:'CLAP',54:'SHAKER'};

function onMidiNoteOn(midi,vel,ch){
  if(ch===MIDI_.drumChannel){
    const name=DRUM_MAP[midi]||'KICK';
    Audio_.synthDrum(name);
    const pads=document.querySelectorAll('.pad-btn');
    const idx=Object.keys(DRUM_MAP).indexOf(String(midi));
    if(idx>=0&&pads[idx]){pads[idx].classList.add('hit');setTimeout(()=>pads[idx]?.classList.remove('hit'),100);}
    return;
  }
  if(S.activePanel==='sampler'){const pi=(midi-48);if(pi>=0&&pi<16)hitMpcPad(pi,null);return;}
  prPlayMidiNote(midi,vel,0.4);
  if(PR._midiRec&&document.getElementById('pr-canvas')){
    snapshot();const nowBeat=secToBeat(S.sec);
    PR.notes.push({midi,beat:nowBeat,len:0.25,vel});
    PR._heldNotes[midi]={idx:PR.notes.length-1,startBeat:nowBeat};
    const col=(S.tracks[S.activeTrack]||{}).color||'#b06ef3';
    prDrawGrid(col);prDrawVelocity(col);
  }
}
function onMidiNoteOff(midi,ch){
  const held=PR._heldNotes[midi];
  if(held){
    const nowBeat=secToBeat(S.sec);
    if(PR.notes[held.idx])PR.notes[held.idx].len=Math.max(0.125,nowBeat-held.startBeat);
    delete PR._heldNotes[midi];
    const col=(S.tracks[S.activeTrack]||{}).color||'#b06ef3';
    prDrawGrid(col);prDrawVelocity(col);
  }
}
function onMidiCC(cc,val,ch){
  if(MIDI_.learnMode&&MIDI_.learnTarget){
    MIDI_.ccMap[cc]=MIDI_.learnTarget;
    toast(`Learned CC${cc} → ${MIDI_.learnTarget}`);
    MIDI_.learnMode=false;MIDI_.learnTarget=null;refreshMidiList();return;
  }
  const map=MIDI_.ccMap[cc];if(!map)return;
  const norm=val/127;
  if(map==='volume')Audio_.setMasterVol(norm);
  else if(map==='bpm'){S.bpm=Math.round(60+norm*160);document.getElementById('bpm-disp').textContent=S.bpm;}
}
function onMidiPitchBend(bend,ch){/* future: modulate active track detune */}

function midiLearn(param){MIDI_.learnMode=true;MIDI_.learnTarget=param;toast(`MIDI Learn: move a knob → ${param}`);}
function startMidiRec(){PR._midiRec=true;PR._heldNotes={};toast('MIDI recording — play keyboard');}
function stopMidiRec(){PR._midiRec=false;PR._heldNotes={};toast('MIDI recording stopped');}

function refreshMidiList(){
  const el=document.getElementById('midi-dev-list');if(!el)return;
  const ports=MIDI_.access?[...MIDI_.access.inputs.values()]:[];
  if(!ports.length){el.innerHTML='<div style="font-size:11px;color:var(--txt2);padding:4px 0;">No MIDI devices</div>';return;}
  el.innerHTML=ports.map(p=>`<div class="midi-device-row">
    <div class="midi-dev-led" style="background:${p.state==='connected'?'var(--grn)':'var(--txt3)'}"></div>
    <div style="flex:1"><div style="font-size:12px;color:var(--txt);">${p.name}</div>
    <div style="font-size:10px;color:var(--txt2);">${p.manufacturer||'Unknown'}</div></div>
    <button class="chop-btn sec" style="padding:2px 7px;font-size:10px;" onclick="midiLearn('volume')">Learn</button>
  </div>`).join('');
}

// Inject MIDI section into Record panel
const _origBuildRec=window.buildRec;
window.buildRec=function(el){
  _origBuildRec(el);
  if(!el.querySelector('#midi-dev-list')){
    const sec=document.createElement('div');
    sec.style.cssText='margin-top:12px;padding-top:10px;border-top:1px solid var(--txt3)';
    sec.innerHTML=`<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;">
      <span style="font-size:10px;font-weight:700;color:var(--txt2);letter-spacing:.5px;text-transform:uppercase;">MIDI</span>
      <button class="chop-btn sec" style="padding:2px 9px;font-size:10px;" onclick="initMIDI()">Refresh</button>
    </div>
    <div id="midi-dev-list"></div>
    <div style="display:flex;gap:5px;margin-top:7px;flex-wrap:wrap;">
      <button class="chop-btn sec" style="padding:4px 8px;font-size:10px;" onclick="startMidiRec()">● MIDI Rec</button>
      <button class="chop-btn sec" style="padding:4px 8px;font-size:10px;" onclick="stopMidiRec()">■ Stop</button>
      <button class="chop-btn sec" style="padding:4px 8px;font-size:10px;" onclick="midiLearn('bpm')">Learn BPM</button>
    </div>`;
    el.appendChild(sec);
    refreshMidiList();
  }
};

// Init MIDI on first user interaction
let _midiReady=false;
document.addEventListener('click',()=>{if(!_midiReady){_midiReady=true;initMIDI();}},{capture:true});
