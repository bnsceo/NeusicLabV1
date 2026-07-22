export class TapeDelay {
  constructor(context) {
    this.context = context;
    this.input = context.createGain();
    this.output = context.createGain();
    this.delay = context.createDelay(2.5);
    this.feedback = context.createGain();
    this.tone = context.createBiquadFilter();
    this.wet = context.createGain();
    this.dry = context.createGain();
    this.delay.delayTime.value = .36;
    this.feedback.gain.value = .42;
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 6400;
    this.wet.gain.value = .28;
    this.dry.gain.value = .72;
    this.input.connect(this.dry); this.dry.connect(this.output);
    this.input.connect(this.delay); this.delay.connect(this.tone); this.tone.connect(this.wet); this.wet.connect(this.output);
    this.tone.connect(this.feedback); this.feedback.connect(this.delay);
  }
  setTime(seconds) {const now=this.context.currentTime;this.delay.delayTime.cancelScheduledValues(now);this.delay.delayTime.linearRampToValueAtTime(Math.max(.04,Math.min(1.8,seconds)),now+.09);}
  setFeedback(value) {this.feedback.gain.setTargetAtTime(Math.max(0,Math.min(.92,value)),this.context.currentTime,.03);}
  setMix(value) {const mix=Math.max(0,Math.min(1,value));this.wet.gain.setTargetAtTime(mix,this.context.currentTime,.03);this.dry.gain.setTargetAtTime(1-mix*.62,this.context.currentTime,.03);}
  setBypass(bypass) {this.output.gain.setTargetAtTime(bypass?0:1,this.context.currentTime,.02);}
}
