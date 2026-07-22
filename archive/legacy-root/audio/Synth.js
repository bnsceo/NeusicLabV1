export class PolySynth {
  constructor(context, output) {this.context=context;this.output=output;this.voices=new Map();this.wave='sawtooth';this.cutoff=2400;this.attack=.02;this.release=.45;}
  setWave(value){this.wave=value;}
  setCutoff(value){this.cutoff=value;this.voices.forEach(v=>v.filter.frequency.setTargetAtTime(value,this.context.currentTime,.02));}
  setAttack(value){this.attack=value;}
  setRelease(value){this.release=value;}
  noteOn(note,velocity=100){if(this.context.state==='suspended')this.context.resume().catch(()=>{});if(this.voices.has(note))this.noteOff(note);const now=this.context.currentTime,osc=this.context.createOscillator(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();osc.type=this.wave;osc.frequency.value=440*Math.pow(2,(note-69)/12);filter.type='lowpass';filter.frequency.value=this.cutoff;filter.Q.value=4;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.001,(velocity/127)*.18),now+Math.max(.005,this.attack));osc.connect(filter);filter.connect(gain);gain.connect(this.output);osc.start(now);this.voices.set(note,{osc,filter,gain});}
  noteOff(note){const voice=this.voices.get(note);if(!voice)return;const now=this.context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(Math.max(.0001,voice.gain.gain.value),now);voice.gain.gain.exponentialRampToValueAtTime(.0001,now+Math.max(.03,this.release));voice.osc.stop(now+this.release+.05);this.voices.delete(note);}
}
