/* ═══════════════════════════════════════════════
   Global state: S object, track colors/icons, drum pad definitions
═══════════════════════════════════════════════ */
const COLORS=['#2dd4bf','#fb923c','#a78bfa','#60a5fa','#f472b6','#34d399','#fbbf24','#f43f5e'];
const ICONS =['🎤','🟧','🎸','🎹','💥','🎷','🎻','🥁'];
const TRACK_TYPES=['audio','beat','midi','midi','audio','midi','audio','beat'];

const S={
  playing:false, recording:false,
  bpm:120, sec:18.45, pct:0.30,
  zoom:1.0,          // px per beat (base 40)
  scrollX:0,
  drawerOpen:true, activePanel:'drums',
  activeTrack:0,
  selectedClip:null, // {trackIdx,clipIdx}
  undoStack:[], redoStack:[],
  sidebarOpen:true,
  meterRaf:null,
  automation:{},      // trackId -> { volume:[{beat,value}], pan:[...], filter:[...] }, value always normalized 0..1
  autoParam:'volume',
  autoMode:'draw',
  recOpts:{metronome:true,countIn:false,overdub:false,loop:false},
  seqStep:-1, seqInterval:null,

  // ── Look-ahead scheduling clock ──
  // The song position (S.sec) is NEVER advanced by accumulating frame deltas.
  // Instead we anchor it to AudioContext.currentTime at the moment playback
  // starts (or whenever we seek), then derive S.sec on every read as:
  //   S.sec = secAtAnchor + (ctx.currentTime - ctxTimeAtAnchor)
  // This makes the transport immune to rAF throttling/drift — the audio clock
  // is the single source of truth, exactly like a hardware DAW's clock.
  clockCtxAnchor:0,   // AudioContext.currentTime at the moment of the last anchor
  clockSecAnchor:0,   // S.sec value at that same anchor moment
  schedTimer:null,    // setInterval handle for the look-ahead scheduler pass
  nextSeqStepBeat:0,     // next 16th-note step beat the sequencer scheduler hasn't queued yet
  nextMetroBeat:0,       // next beat the metronome scheduler hasn't queued yet
  metroOn:true,

  tracks:[
    {id:1,name:'Vocal', icon:'🎤',color:'#2dd4bf',type:'audio',m:false,s:false,arm:false,
     clips:[{id:'c1',start:0,len:8,label:'Vocal_01'}]},
    {id:2,name:'Beat',  icon:'🟧',color:'#fb923c',type:'beat', m:false,s:false,arm:false,
     clips:[{id:'c2',start:0,len:16,label:'Beat_01'}]},
    {id:3,name:'Bass',  icon:'🎸',color:'#a78bfa',type:'midi', m:false,s:false,arm:false,
     clips:[{id:'c3',start:0,len:12,label:'Bass_01'},{id:'c3b',start:13,len:6,label:'Bass_02'}]},
    {id:4,name:'Piano', icon:'🎹',color:'#60a5fa',type:'midi', m:false,s:false,arm:false,
     clips:[{id:'c4',start:2,len:10,label:'Piano_01'}]},
    {id:5,name:'FX',    icon:'💥',color:'#f472b6',type:'audio',m:false,s:false,arm:false,
     clips:[{id:'c5',start:4,len:6, label:'FX_01'}]},
  ],

  seqSteps:{
    1:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    2:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
    3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    4:[1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0],
  },

  // Per-track effects racks: trackId -> [{type,on,wet}]. 'type' is one of
  // reverb/delay/chorus/eq/compressor; 'wet' is 0..1 and means different things
  // per effect (mix amount, EQ tilt, or compression amount) — see buildEffectNode.
  trackFx:{
    1:[{type:'reverb',on:true,wet:0.25},{type:'compressor',on:true,wet:0.4}],
    2:[{type:'compressor',on:true,wet:0.5}],
    3:[{type:'chorus',on:false,wet:0.3}],
    4:[{type:'eq',on:true,wet:0.55}],
    5:[{type:'delay',on:true,wet:0.2}],
  },

  slices:8,

  // ── Real audio engine state (kept OUT of undo/redo JSON snapshots since
  // AudioBuffers aren't serializable) ──
  buffers:{},       // bufferId -> { buffer:AudioBuffer, peaks:Float32Array[2][n] (min,max), name, duration }
  masterVol:0.85,
  trackVol:{},      // trackId -> 0..1 fader value (separate from clip gain)
  scheduled:[],     // active AudioBufferSourceNodes for the current playback pass
  recordedChunks:[],
  recStream:null,
  recAnalyser:null,
  recDataArr:null,
  inputLevel:0,
  samplerBufferId:null,   // bufferId currently loaded into the Sampler panel
  samplerSlices:[],       // [{start,end,reverse,loop}] in seconds, real chop points
  lastChopMode:'transient', // 'transient' | 'equal' — which mode produced S.samplerSlices, so the +/- stepper re-chops consistently
  samplerMode:'slice',    // 'slice' | 'reverse' indicator for UI (Chop/Trim/Stretch are aliases of Slice for now)
};

const PADS=[
  {id:1,n:'KICK',  col:'#4ade80',bg:'rgba(74,222,128,.12)'},
  {id:2,n:'SNARE', col:'#a78bfa',bg:'rgba(167,139,250,.12)'},
  {id:3,n:'HI-HAT',col:'#fb923c',bg:'rgba(251,146,60,.12)'},
  {id:4,n:'CLAP',  col:'#fbbf24',bg:'rgba(251,191,36,.12)'},
  {id:5,n:'808',   col:'#f472b6',bg:'rgba(244,114,182,.12)'},
  {id:6,n:'PERC',  col:'#34d399',bg:'rgba(52,211,153,.12)'},
  {id:7,n:'TOM',   col:'#60a5fa',bg:'rgba(96,165,250,.12)'},
  {id:8,n:'RIM',   col:'#f87171',bg:'rgba(248,113,113,.12)'},
  {id:9,n:'OPEN',  col:'#fb923c',bg:'rgba(251,146,60,.12)'},
  {id:10,n:'CRASH',col:'#c084fc',bg:'rgba(192,132,252,.12)'},
  {id:11,n:'RIDE', col:'#2dd4bf',bg:'rgba(45,212,191,.12)'},
  {id:12,n:'SHAKER',col:'#fbbf24',bg:'rgba(251,191,36,.12)'},
  {id:13,n:'FX 1', col:'#b06ef3',bg:'rgba(176,110,243,.12)'},
  {id:14,n:'FX 2', col:'#f43f5e',bg:'rgba(244,63,94,.12)'},
  {id:15,n:'FX 3', col:'#06b6d4',bg:'rgba(6,182,212,.12)'},
  {id:16,n:'VOX',  col:'#a78bfa',bg:'rgba(167,139,250,.12)'},
];
