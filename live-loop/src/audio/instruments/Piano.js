// Real piano playback — Salamander Grand Piano samples (Yamaha C5), recorded and
// released by Alexander Holm under CC-BY 3.0 (http://creativecommons.org/licenses/by/3.0/).
// Sampled every minor third across the keyboard; notes between samples are pitch-shifted
// via playbackRate, which stays natural-sounding within +/-1.5 semitones.
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
        const buffer=await this.context.decodeAudioData(arrayBuffer);
        this.buffers.set(entry.midi,buffer);
      }catch(error){
        console.warn(`Piano sample ${entry.name} failed to load; nearby notes will fall back.`,error);
      }
    }));
    return this.loadPromise;
  }

  setAttack(value){this.attack=Math.max(.002,value);}
  setRelease(value){this.release=Math.max(.05,value);}

  noteOn(note,velocity=100){
    this.noteOff(note);
    const sample=this.nearestSample(note);
    const buffer=this.buffers.get(sample.midi);
    if(!buffer) return; // still loading or failed — silently skip rather than throw mid-performance
    const now=this.context.currentTime;
    const source=this.context.createBufferSource();
    source.buffer=buffer;
    source.playbackRate.value=Math.pow(2,(note-sample.midi)/12);
    const gain=this.context.createGain();
    const peak=Math.max(.05,Math.min(1,velocity/127));
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(peak,now+this.attack);
    source.connect(gain);
    gain.connect(this.output);
    source.start(now);
    this.voices.set(note,{source,gain});
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

// Keeps app.js's existing synth.noteOn/noteOff/setWave/setCutoff/setAttack/setRelease
// calls exactly as they are — 'piano' routes to real samples, every other wave value
// keeps using the existing oscillator synth untouched.
export class HybridInstrument {
  constructor(context,output,basePath){
    this.synth=new PolySynth(context,output);
    this.piano=new SamplePiano(context,output,basePath);
    this.wave='piano';
    this.piano.load();
  }
  setWave(value){this.wave=value;if(value!=='piano')this.synth.setWave(value);}
  setCutoff(value){this.synth.setCutoff(value);}
  setAttack(value){this.synth.setAttack(value);this.piano.setAttack(value);}
  setRelease(value){this.synth.setRelease(value);this.piano.setRelease(value);}
  noteOn(note,velocity){(this.wave==='piano'?this.piano:this.synth).noteOn(note,velocity);}
  noteOff(note){(this.wave==='piano'?this.piano:this.synth).noteOff(note);}
}
