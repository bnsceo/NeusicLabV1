/* ═══════════════════════════════════════════════
   Audio_ engine: Web Audio graph, playback, recording, track routing
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   AUDIO ENGINE — real Web Audio playback/recording
═══════════════════════════════════════════════ */
const Audio_ = {
  ctx:null,
  master:null,
  trackGains:{},     // trackId -> GainNode (fader + mute/solo combined)
  trackDry:{},       // trackId -> base fader gain value (0..1), separate from mute/solo silencing

  ensure(){
    if(!this.ctx){
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain();
      this.master.gain.value=S.masterVol;
      this.master.connect(this.ctx.destination);
    }
    if(this.ctx.state==='suspended')this.ctx.resume();
    return this.ctx;
  },

  ensureTrackGain(trackId){
    trackId=Number(trackId);
    this.ensure();
    if(!this.trackGains[trackId]){
      const g=this.ctx.createGain();
      g.connect(this.master);
      this.trackGains[trackId]=g;
      this.trackDry[trackId]=S.trackVol[trackId]??0.85;
      g.gain.value=this.trackDry[trackId];
    }
    return this.trackGains[trackId];
  },

  trackPanners:{},
  ensureTrackPanner(trackId){
    trackId=Number(trackId);
    this.ensure();
    if(!this.trackPanners[trackId]){
      const p=this.ctx.createStereoPanner();
      p.connect(this.ensureTrackGain(trackId));
      this.trackPanners[trackId]=p;
    }
    return this.trackPanners[trackId];
  },

  trackFilters:{},
  ensureTrackFilter(trackId){
    trackId=Number(trackId);
    this.ensure();
    if(!this.trackFilters[trackId]){
      const f=this.ctx.createBiquadFilter();
      f.type='lowpass';f.frequency.value=20000; // wide open = inaudible effect until automated
      f.connect(this.ensureTrackPanner(trackId));
      this.trackFilters[trackId]=f;
    }
    return this.trackFilters[trackId];
  },

  // ── Per-track insert effects rack ──
  // Each track gets its own ordered chain of real effect nodes, rebuilt whenever
  // S.trackFx[trackId] changes (add/remove/toggle/reorder). The rack sits between
  // clip sources and the filter/panner/gain stage: source -> FX rack -> filter -> ...
  trackFxChainInput:{},   // trackId -> first node in the rack (or the filter itself if rack is empty)
  trackFxNodes:{},        // trackId -> [{cfg, inputNode, outputNode, extraNodes:[...]}] for cleanup/rebuild

  impulseResponseCache:null,
  getImpulseResponse(ctxOverride){
    if(!ctxOverride&&this.impulseResponseCache)return this.impulseResponseCache;
    const ctx=ctxOverride||this.ensure();
    const len=ctx.sampleRate*1.6;
    const ir=ctx.createBuffer(2,len,ctx.sampleRate);
    for(let c=0;c<2;c++){
      const d=ir.getChannelData(c);
      for(let i=0;i<len;i++){
        d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2); // exponentially-decaying noise = simple plate-ish reverb
      }
    }
    if(!ctxOverride){ this.impulseResponseCache=ir; }
    return ir;
  },

  // Builds a single effect's nodes given its config {type,on,wet}. Returns
  // {input,output,extraNodes} so the rack builder can chain them and the
  // cleanup pass can disconnect everything cleanly on rebuild.
  // ctxOverride lets the offline bounce path build an identical effect chain
  // against an OfflineAudioContext instead of the live one — same DSP, same
  // parameters, just wired to a different (non-realtime) context.
  buildEffectNode(cfg,ctxOverride){
    const ctx=ctxOverride||this.ensure();
    switch(cfg.type){
      case'reverb':{
        const input=ctx.createGain();
        const dry=ctx.createGain();const wet=ctx.createGain();
        const conv=ctx.createConvolver();conv.buffer=this.getImpulseResponse(ctxOverride);
        const output=ctx.createGain();
        input.connect(dry);dry.connect(output);
        input.connect(conv);conv.connect(wet);wet.connect(output);
        dry.gain.value=1-cfg.wet;wet.gain.value=cfg.wet;
        return {input,output,extraNodes:[dry,wet,conv],setWet:v=>{dry.gain.value=1-v;wet.gain.value=v;}};
      }
      case'delay':{
        const input=ctx.createGain();
        const dry=ctx.createGain();const wet=ctx.createGain();
        const delayNode=ctx.createDelay(2.0);delayNode.delayTime.value=0.3;
        const feedback=ctx.createGain();feedback.gain.value=0.35;
        const output=ctx.createGain();
        input.connect(dry);dry.connect(output);
        input.connect(delayNode);delayNode.connect(wet);wet.connect(output);
        delayNode.connect(feedback);feedback.connect(delayNode);
        dry.gain.value=1-cfg.wet;wet.gain.value=cfg.wet;
        return {input,output,extraNodes:[dry,wet,delayNode,feedback],setWet:v=>{dry.gain.value=1-v;wet.gain.value=v;}};
      }
      case'chorus':{
        const input=ctx.createGain();
        const dry=ctx.createGain();const wet=ctx.createGain();
        const delayNode=ctx.createDelay(0.05);delayNode.delayTime.value=0.018;
        const lfo=ctx.createOscillator();lfo.frequency.value=1.4;
        const lfoGain=ctx.createGain();lfoGain.gain.value=0.006;
        lfo.connect(lfoGain);lfoGain.connect(delayNode.delayTime);lfo.start();
        const output=ctx.createGain();
        input.connect(dry);dry.connect(output);
        input.connect(delayNode);delayNode.connect(wet);wet.connect(output);
        dry.gain.value=1-cfg.wet;wet.gain.value=cfg.wet;
        return {input,output,extraNodes:[dry,wet,delayNode,lfo,lfoGain],setWet:v=>{dry.gain.value=1-v;wet.gain.value=v;}};
      }
      case'eq':{
        // Single tone-tilt EQ: cfg.wet (0..1) maps to a -12dB..+12dB shelf around 1kHz.
        const shelf=ctx.createBiquadFilter();shelf.type='highshelf';shelf.frequency.value=1000;
        shelf.gain.value=(cfg.wet-0.5)*24;
        return {input:shelf,output:shelf,extraNodes:[],setWet:v=>{shelf.gain.value=(v-0.5)*24;}};
      }
      case'compressor':{
        const comp=ctx.createDynamicsCompressor();
        comp.threshold.value=-24;comp.knee.value=12;comp.ratio.value=lerp(1.5,12,cfg.wet);
        comp.attack.value=0.005;comp.release.value=0.25;
        return {input:comp,output:comp,extraNodes:[],setWet:v=>{comp.ratio.value=lerp(1.5,12,v);}};
      }
      default:{
        const passthrough=ctx.createGain();
        return {input:passthrough,output:passthrough,extraNodes:[]};
      }
    }
  },

  // Tears down and rebuilds a track's whole FX rack from S.trackFx[trackId],
  // re-wiring it in front of the filter stage. Called after any add/remove/
  // toggle/reorder so the live graph always matches the rack's current state.
  rebuildTrackFxRack(trackId){
    trackId=Number(trackId);
    this.ensure();
    // Disconnect everything from the previous rack build to avoid leaking nodes.
    const prevNodes=this.trackFxNodes[trackId]||[];
    prevNodes.forEach(n=>{
      try{n.input.disconnect();}catch(e){}
      try{n.output.disconnect();}catch(e){}
      (n.extraNodes||[]).forEach(x=>{ try{x.disconnect();}catch(e){} try{x.stop&&x.stop();}catch(e){} });
    });

    const filterNode=this.ensureTrackFilter(trackId);
    const cfgList=(S.trackFx[trackId]||[]).filter(c=>c.on);
    if(!cfgList.length){
      this.trackFxChainInput[trackId]=filterNode;
      this.trackFxNodes[trackId]=[];
      return filterNode;
    }
    const built=cfgList.map(cfg=>{ const n=this.buildEffectNode(cfg); n.cfg=cfg; return n; });
    for(let i=0;i<built.length-1;i++){ built[i].output.connect(built[i+1].input); }
    built[built.length-1].output.connect(filterNode);
    this.trackFxChainInput[trackId]=built[0].input;
    this.trackFxNodes[trackId]=built;
    return built[0].input;
  },

  // The entry point every clip/voice on a track should connect into — routes
  // through the track's FX rack (if any), then filter -> panner -> gain -> master.
  trackInput(trackId){
    trackId=Number(trackId);
    if(!(trackId in this.trackFxChainInput))this.rebuildTrackFxRack(trackId);
    return this.trackFxChainInput[trackId];
  },

  trackAnalysers:{},
  ensureTrackAnalyser(trackId){
    trackId=Number(trackId);
    this.ensure();
    if(!this.trackAnalysers[trackId]){
      const a=this.ctx.createAnalyser();a.fftSize=256;
      this.ensureTrackGain(trackId).connect(a);
      this.trackAnalysers[trackId]=a;
    }
    return this.trackAnalysers[trackId];
  },
  masterAnalyser:null,
  ensureMasterAnalyser(){
    this.ensure();
    if(!this.masterAnalyser){
      this.masterAnalyser=this.ctx.createAnalyser();this.masterAnalyser.fftSize=256;
      this.master.connect(this.masterAnalyser);
    }
    return this.masterAnalyser;
  },
  readLevel(analyser){
    const arr=new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(arr);
    let sumSq=0;
    for(let i=0;i<arr.length;i++){ const v=(arr[i]-128)/128; sumSq+=v*v; }
    return Math.sqrt(sumSq/arr.length);
  },

  setTrackFader(trackId,val){
    trackId=Number(trackId);
    this.trackDry[trackId]=val;
    S.trackVol[trackId]=val;
    this.refreshTrackGain(trackId);
  },

  // Recompute a track's actual gain based on fader value + mute/solo state across all tracks.
  refreshTrackGain(trackId){
    trackId=Number(trackId);
    const t=S.tracks.find(tt=>tt.id===trackId);
    if(!t)return;
    const g=this.ensureTrackGain(trackId);
    const anySolo=S.tracks.some(tt=>tt.s);
    const silent=t.m||(anySolo&&!t.s);
    const dry=this.trackDry[trackId]??0.85;
    g.gain.setTargetAtTime(silent?0:dry,this.ctx.currentTime,0.01);
  },

  refreshAllTrackGains(){ S.tracks.forEach(t=>this.refreshTrackGain(t.id)); },

  setMasterVol(v){ S.masterVol=v; this.ensure(); this.master.gain.setTargetAtTime(v,this.ctx.currentTime,0.01); },

  // ── Buffer registry ──
  registerBuffer(id,buffer,name){
    const peaks=computePeaks(buffer,2000);
    S.buffers[id]={buffer,peaks,name:name||id,duration:buffer.duration};
    return S.buffers[id];
  },

  async decodeFile(file){
    this.ensure();
    const arr=await file.arrayBuffer();
    const buffer=await this.ctx.decodeAudioData(arr);
    const id='buf_'+Date.now()+'_'+Math.floor(Math.random()*1e6);
    this.registerBuffer(id,buffer,file.name);
    return id;
  },

  // ── One-shot playback (drum pads, slice preview) ──
  playBuffer(buffer,{offset=0,duration=null,gain=0.9,reverse=false,destination=null}={}){
    this.ensure();
    let buf=buffer;
    if(reverse) buf=reversedBuffer(buffer);
    const src=this.ctx.createBufferSource();
    src.buffer=buf;
    const g=this.ctx.createGain();
    g.gain.value=gain;
    src.connect(g);
    g.connect(destination||this.master);
    if(duration!=null) src.start(this.ctx.currentTime,offset,Math.max(0.005,duration));
    else src.start(this.ctx.currentTime,offset);
    return src;
  },

  // ── Synthesized one-shot drum sounds (no sample library needed) ──
  // ctx is derived from `destination` when one is given, so this same function
  // works identically for live pad taps (destination omitted -> live ctx) and
  // for offline bounce rendering (destination is a node that lives on an
  // OfflineAudioContext) — without needing two separate copies of every sound.
  synthDrum(name,destination,when){
    const ctx=destination?destination.context:this.ensure();
    const t0=(when!=null)?when:ctx.currentTime;
    const out=destination||this.master;
    const g=ctx.createGain();g.connect(out);

    const noiseBuf=(dur)=>{
      const n=Math.floor(ctx.sampleRate*dur);
      const b=ctx.createBuffer(1,n,ctx.sampleRate);
      const d=b.getChannelData(0);
      for(let i=0;i<n;i++)d[i]=(Math.random()*2-1);
      return b;
    };

    switch(name){
      case'KICK':{
        const osc=ctx.createOscillator();osc.type='sine';
        osc.frequency.setValueAtTime(150,t0);osc.frequency.exponentialRampToValueAtTime(45,t0+0.12);
        g.gain.setValueAtTime(1,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+0.35);
        osc.connect(g);osc.start(t0);osc.stop(t0+0.36);
        break;}
      case'SNARE':{
        const src=ctx.createBufferSource();src.buffer=noiseBuf(0.2);
        const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=900;
        const osc=ctx.createOscillator();osc.type='triangle';osc.frequency.value=180;
        const oscG=ctx.createGain();oscG.gain.setValueAtTime(.6,t0);oscG.gain.exponentialRampToValueAtTime(.001,t0+0.12);
        g.gain.setValueAtTime(.9,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+0.22);
        src.connect(hp);hp.connect(g);osc.connect(oscG);oscG.connect(g);
        src.start(t0);src.stop(t0+0.22);osc.start(t0);osc.stop(t0+0.12);
        break;}
      case'HI-HAT':case'OPEN':case'RIDE':{
        const isOpen=name!=='HI-HAT';
        const src=ctx.createBufferSource();src.buffer=noiseBuf(isOpen?0.35:0.08);
        const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=6000;
        g.gain.setValueAtTime(.5,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+(isOpen?0.32:0.07));
        src.connect(hp);hp.connect(g);src.start(t0);src.stop(t0+(isOpen?0.34:0.09));
        break;}
      case'CLAP':{
        for(let i=0;i<3;i++){
          const src=ctx.createBufferSource();src.buffer=noiseBuf(0.08);
          const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1100;bp.Q.value=1.5;
          const gg=ctx.createGain();const startT=t0+i*0.012;
          gg.gain.setValueAtTime(.7,startT);gg.gain.exponentialRampToValueAtTime(0.001,startT+0.09);
          src.connect(bp);bp.connect(gg);gg.connect(g);src.start(startT);src.stop(startT+0.1);
        }
        break;}
      case'808':{
        const osc=ctx.createOscillator();osc.type='sine';
        osc.frequency.setValueAtTime(90,t0);osc.frequency.exponentialRampToValueAtTime(40,t0+0.5);
        g.gain.setValueAtTime(1,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+0.9);
        osc.connect(g);osc.start(t0);osc.stop(t0+0.95);
        break;}
      case'TOM':{
        const osc=ctx.createOscillator();osc.type='sine';
        osc.frequency.setValueAtTime(220,t0);osc.frequency.exponentialRampToValueAtTime(90,t0+0.22);
        g.gain.setValueAtTime(.9,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+0.32);
        osc.connect(g);osc.start(t0);osc.stop(t0+0.34);
        break;}
      case'RIM':{
        const osc=ctx.createOscillator();osc.type='square';osc.frequency.value=1800;
        g.gain.setValueAtTime(.4,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+0.04);
        osc.connect(g);osc.start(t0);osc.stop(t0+0.05);
        break;}
      case'CRASH':{
        const src=ctx.createBufferSource();src.buffer=noiseBuf(1.2);
        const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=4000;
        g.gain.setValueAtTime(.55,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+1.1);
        src.connect(hp);hp.connect(g);src.start(t0);src.stop(t0+1.2);
        break;}
      case'SHAKER':{
        const src=ctx.createBufferSource();src.buffer=noiseBuf(0.15);
        const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=7000;
        g.gain.setValueAtTime(.35,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+0.14);
        src.connect(bp);bp.connect(g);src.start(t0);src.stop(t0+0.15);
        break;}
      default:{ // FX 1/2/3, VOX, PERC — generic pluck/blip so every pad makes a distinct sound
        const osc=ctx.createOscillator();osc.type='sawtooth';
        const baseFreq=220+ (name.length*37)%300;
        osc.frequency.setValueAtTime(baseFreq*2,t0);osc.frequency.exponentialRampToValueAtTime(baseFreq,t0+0.15);
        const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;
        g.gain.setValueAtTime(.5,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+0.25);
        osc.connect(lp);lp.connect(g);osc.start(t0);osc.stop(t0+0.26);
      }
    }
    return g;
  },
};

// Compute min/max peak pairs for fast waveform drawing at any zoom level.
function computePeaks(buffer,resolution){
  const data=buffer.getChannelData(0);
  const n=Math.min(resolution,data.length);
  const blockSize=Math.floor(data.length/n)||1;
  const mins=new Float32Array(n),maxs=new Float32Array(n);
  for(let i=0;i<n;i++){
    let mn=1,mx=-1;
    const start=i*blockSize;
    for(let j=0;j<blockSize;j++){
      const v=data[start+j];if(v===undefined)break;
      if(v<mn)mn=v;if(v>mx)mx=v;
    }
    if(mn>mx){mn=0;mx=0;}
    mins[i]=mn;maxs[i]=mx;
  }
  return {mins,maxs,n};
}

// Cache of reversed copies of buffers, keyed by the original buffer object (WeakMap avoids leaks).
const _reverseCache=new WeakMap();
function reversedBuffer(buffer){
  if(_reverseCache.has(buffer))return _reverseCache.get(buffer);
  const ctx=Audio_.ensure();
  const rev=ctx.createBuffer(buffer.numberOfChannels,buffer.length,buffer.sampleRate);
  for(let c=0;c<buffer.numberOfChannels;c++){
    const src=buffer.getChannelData(c),dst=rev.getChannelData(c);
    for(let i=0;i<src.length;i++)dst[i]=src[src.length-1-i];
  }
  _reverseCache.set(buffer,rev);
  return rev;
}
