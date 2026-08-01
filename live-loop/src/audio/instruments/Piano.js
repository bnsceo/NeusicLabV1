// Real piano playback with an always-audible oscillator fallback.
import {PolySynth} from './Synth.js';

const SAMPLE_MAP = [
  {name:'A0',midi:21},{name:'C1',midi:24},{name:'Ds1',midi:27},{name:'Fs1',midi:30},
  {name:'A1',midi:33},{name:'C2',midi:36},{name:'Ds2',midi:39},{name:'Fs2',midi:42},
  {name:'A2',midi:45},{name:'C3',midi:48},{name:'Ds3',midi:51},{name:'Fs3',midi:54},
  {name:'A3',midi:57},{name:'C4',midi:60},{name:'Ds4',midi:63},{name:'Fs4',midi:66},
  {name:'A4',midi:69},{name:'C5',midi:72},{name:'Ds5',midi:75},{name:'Fs5',midi:78},
  {name:'A5',midi:81},{name:'C6',midi:84},{name:'Ds6',midi:87},{name:'Fs6',midi:90},
  {name:'A6',midi:93},{name:'C7',midi:96},{name:'Ds7',midi:99},{name:'Fs7',midi:102},
  {name:'A7',midi:105},{name:'C8',midi:108}
];

const VOICE_PRESETS = {
  grimy:{wave:'sawtooth',cutoff:1450,attack:.008,release:.28},
  bounce:{wave:'square',cutoff:3200,attack:.004,release:.18},
  space:{wave:'triangle',cutoff:5200,attack:.08,release:1.15},
  pure:{wave:'sine',cutoff:10000,attack:.012,release:.55}
};

export class SamplePiano {
  constructor(context, output, basePath='assets/piano/'){
    this.context=context;
    this.output=output;
    this.basePath=basePath;
    this.buffers=new Map();
    this.voices=new Map();
    this.attack=.004;
    this.release=.35;
    this.loadPromise=null;
  }

  nearestSample(midiNote){
    let best=SAMPLE_MAP[0];
    for(const entry of SAMPLE_MAP){
      if(Math.abs(entry.midi-midiNote)<Math.abs(best.midi-midiNote)) best=entry;
    }
    return best;
  }

  async load(){
    if(this.loadPromise) return this.loadPromise;
    this.loadPromise=Promise.all(SAMPLE_MAP.map(async entry=>{
      try{
        const response=await fetch(`${this.basePath}${entry.name}.mp3`);
        if(!response.ok) throw new Error(`${response.status}`);
        const arrayBuffer=await response.arrayBuffer();
        const buffer=await this.context.decodeAudioData(arrayBuffer.slice(0));
        this.buffers.set(entry.midi,buffer);
      }catch(error){
        console.warn(`Piano sample ${entry.name} unavailable; using synth fallback.`,error);
      }
    }));
    return this.loadPromise;
  }

  hasSample(note){return this.buffers.has(this.nearestSample(note).midi);}
  setAttack(value){this.attack=Math.max(.002,value);}
  setRelease(value){this.release=Math.max(.05,value);}

  noteOn(note,velocity=100){
    this.noteOff(note);
    const sample=this.nearestSample(note);
    const buffer=this.buffers.get(sample.midi);
    if(!buffer) return false;
    const now=this.context.currentTime;
    const source=this.context.createBufferSource();
    source.buffer=buffer;
    source.playbackRate.value=Math.pow(2,(note-sample.midi)/12);
    const gain=this.context.createGain();
    const peak=Math.max(.05,Math.min(1,velocity/127));
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(peak,now+this.attack);
    source.connect(gain);
    gain.connect(this.output);
    source.start(now);
    this.voices.set(note,{source,gain});
    return true;
  }

  noteOff(note){
    const voice=this.voices.get(note);
    if(!voice) return;
    const now=this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(.0001,voice.gain.gain.value),now);
    voice.gain.gain.exponentialRampToValueAtTime(.0001,now+this.release);
    voice.source.stop(now+this.release+.05);
    this.voices.delete(note);
  }
}

export class HybridInstrument {
  constructor(context,output,basePath){
    this.synth=new PolySynth(context,output);
    this.piano=new SamplePiano(context,output,basePath);
    this.wave='piano';
    this.fallbackNotes=new Set();
    this.piano.load();
    this.applyPreset('space');
  }

  applyPreset(name){
    const preset=VOICE_PRESETS[name];
    if(!preset)return;
    this.synth.setWave(preset.wave);
    this.synth.setCutoff(preset.cutoff);
    this.synth.setAttack(preset.attack);
    this.synth.setRelease(preset.release);
  }

  setWave(value){
    this.wave=value;
    if(value!=='piano')this.applyPreset(value);
  }
  setCutoff(value){this.synth.setCutoff(value);}
  setAttack(value){this.synth.setAttack(value);this.piano.setAttack(value);}
  setRelease(value){this.synth.setRelease(value);this.piano.setRelease(value);}

  noteOn(note,velocity){
    if(this.context?.state==='suspended')this.context.resume().catch(()=>{});
    if(this.wave!=='piano'){
      this.synth.noteOn(note,velocity);
      return;
    }
    if(!this.piano.noteOn(note,velocity)){
      this.fallbackNotes.add(note);
      this.synth.noteOn(note,velocity);
    }
  }

  noteOff(note){
    this.piano.noteOff(note);
    if(this.wave!=='piano'||this.fallbackNotes.has(note)){
      this.synth.noteOff(note);
      this.fallbackNotes.delete(note);
    }
  }

  get context(){return this.synth.context;}
}
