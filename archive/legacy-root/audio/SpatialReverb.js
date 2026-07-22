export class SpatialReverb {
  constructor(context) {
    this.context = context;
    this.input = context.createGain();
    this.output = context.createGain();
    this.convolver = context.createConvolver();
    this.tone = context.createBiquadFilter();
    this.wet = context.createGain();
    this.dry = context.createGain();
    this.freezeGain = context.createGain();
    this.size = 1.8;
    this.tone.type = 'lowpass'; this.tone.frequency.value = 7200;
    this.wet.gain.value = .24; this.dry.gain.value = .76; this.freezeGain.gain.value = 1;
    this.convolver.buffer = this.makeImpulse(this.size,2.6);
    this.input.connect(this.dry); this.dry.connect(this.output);
    this.input.connect(this.convolver); this.convolver.connect(this.tone); this.tone.connect(this.wet); this.wet.connect(this.freezeGain); this.freezeGain.connect(this.output);
  }
  makeImpulse(seconds,decay) {const length=Math.max(1,Math.floor(this.context.sampleRate*seconds));const buffer=this.context.createBuffer(2,length,this.context.sampleRate);for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,decay)*(channel?0.96:1);}return buffer;}
  setSize(seconds) {this.size=Math.max(.2,Math.min(5,seconds));this.convolver.buffer=this.makeImpulse(this.size,2.6);}
  setTone(value) {this.tone.frequency.setTargetAtTime(Math.max(800,Math.min(16000,value)),this.context.currentTime,.04);}
  setMix(value) {const mix=Math.max(0,Math.min(1,value));this.wet.gain.setTargetAtTime(mix,this.context.currentTime,.03);this.dry.gain.setTargetAtTime(1-mix*.55,this.context.currentTime,.03);}
  freeze(enabled) {this.freezeGain.gain.setTargetAtTime(enabled?1.8:1,this.context.currentTime,.12);}
  setBypass(bypass) {this.output.gain.setTargetAtTime(bypass?0:1,this.context.currentTime,.02);}
}
