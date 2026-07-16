import {PcmRecorder} from './PcmRecorder.js';

const STATES={EMPTY:'Empty',RECORDING:'Recording',OVERDUBBING:'Overdubbing',PLAYING:'Playing',MUTED:'Muted',STOPPED:'Stopped',QUEUED:'Queued'};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class FiveTrackLooper extends EventTarget {
  constructor(workspace,scheduler,delay,reverb){
    super();
    this.workspace=workspace;
    this.context=workspace.context;
    this.scheduler=scheduler;
    this.delay=delay;
    this.reverb=reverb;
    this.capture=new PcmRecorder(workspace);
    this.bpm=112;
    this.quantize=true;
    this.masterLength=0;
    this.transportStart=0;
    this.playing=false;
    this.activeRecording=null;
    this.fxBypassed=false;
    this.tracks=Array.from({length:5},(_,index)=>this.makeTrack(index));
    this.scheduler.callback=()=>this.dispatchEvent(new CustomEvent('tick'));
  }

  makeTrack(index){
    const gain=this.context.createGain(),pan=this.context.createStereoPanner(),delaySend=this.context.createGain(),reverbSend=this.context.createGain();
    gain.gain.value=.9;pan.pan.value=0;delaySend.gain.value=.22;reverbSend.gain.value=.18;
    gain.connect(pan);pan.connect(this.workspace.master);pan.connect(delaySend);pan.connect(reverbSend);delaySend.connect(this.delay.input);reverbSend.connect(this.reverb.input);
    return{index,name:`LOOP ${index+1}`,state:STATES.EMPTY,buffer:null,source:null,gain,pan,delaySend,reverbSend,volume:.9,panValue:0,delay:.22,reverb:.18,muted:false,rate:1,reverse:false,recording:null};
  }

  emit(type,detail={}){this.dispatchEvent(new CustomEvent(type,{detail}));}
  setBpm(value){this.bpm=clamp(Number(value)||112,40,220);this.emit('change');}
  setQuantize(value){this.quantize=Boolean(value);}
  beatLength(){return 60/this.bpm;}
  quantizedLength(seconds){if(!this.quantize)return Math.max(.2,seconds);const beat=this.beatLength(),beats=Math.max(1,Math.round(seconds/beat));return beats*beat;}
  async decodeBlob(blob){const array=await blob.arrayBuffer();return this.context.decodeAudioData(array.slice(0));}

  fitBuffer(buffer,length){
    const frames=Math.max(1,Math.round(length*this.context.sampleRate)),channels=Math.min(2,Math.max(1,buffer.numberOfChannels)),out=this.context.createBuffer(channels,frames,this.context.sampleRate);
    for(let channel=0;channel<channels;channel++){
      const src=buffer.getChannelData(Math.min(channel,buffer.numberOfChannels-1)),dst=out.getChannelData(channel);
      for(let index=0;index<frames;index++)dst[index]=src[index%src.length]||0;
    }
    return out;
  }

  mixBuffers(base,overdub,length){
    const a=this.fitBuffer(base,length),b=this.fitBuffer(overdub,length),out=this.context.createBuffer(Math.max(a.numberOfChannels,b.numberOfChannels),a.length,this.context.sampleRate);
    for(let channel=0;channel<out.numberOfChannels;channel++){
      const dst=out.getChannelData(channel),ad=a.getChannelData(Math.min(channel,a.numberOfChannels-1)),bd=b.getChannelData(Math.min(channel,b.numberOfChannels-1));
      for(let index=0;index<dst.length;index++)dst[index]=Math.tanh((ad[index]||0)+(bd[index]||0)*.9)*.92;
    }
    return out;
  }

  async importFile(index,file){
    const track=this.tracks[index],decoded=await this.decodeBlob(file),length=this.masterLength||this.quantizedLength(decoded.duration);
    if(!this.masterLength)this.masterLength=length;
    track.buffer=this.fitBuffer(decoded,this.masterLength);
    track.name=file.name.replace(/\.[^.]+$/,'').slice(0,22)||track.name;
    track.state=this.playing?STATES.PLAYING:STATES.STOPPED;
    this.restartTrack(track);this.emit('track',{index});this.emit('change');
  }

  nextBoundary(){
    if(!this.playing||!this.masterLength)return this.context.currentTime+.03;
    const elapsed=Math.max(0,this.context.currentTime-this.transportStart),cycles=Math.ceil(elapsed/this.masterLength);
    return this.transportStart+cycles*this.masterLength;
  }

  async toggleRecord(index){
    const track=this.tracks[index];
    if(this.activeRecording){
      if(this.activeRecording.index===index)await this.stopRecording();
      else this.emit('status',{message:'Finish the active recording before arming another lane.'});
      return;
    }
    await this.workspace.initMic();
    await this.workspace.init();
    const mode=track.buffer?'overdub':'record',startAt=this.masterLength?this.nextBoundary():this.context.currentTime+.05;
    track.state=STATES.QUEUED;this.emit('track',{index});
    const session={index,mode,queued:true,timer:0,autoTimer:0,startedAt:0,startPromise:null};
    this.activeRecording=session;
    const wait=Math.max(0,(startAt-this.context.currentTime)*1000);
    session.timer=setTimeout(()=>this.beginRecording(session),wait);
    this.emit('status',{message:this.masterLength?`${track.name} queued for the next loop boundary.`:`${track.name} armed. Recording starts now.`});
  }

  async beginRecording(session){
    if(this.activeRecording!==session)return;
    const track=this.tracks[session.index];
    session.queued=false;
    session.startPromise=this.capture.start();
    try{await session.startPromise;}catch(error){this.activeRecording=null;track.state=track.buffer?STATES.STOPPED:STATES.EMPTY;this.emit('track',{index:session.index});this.emit('status',{message:error.message||'Microphone capture could not start.'});return;}
    if(this.activeRecording!==session){this.capture.cancel();return;}
    session.startedAt=performance.now();
    track.state=session.mode==='overdub'?STATES.OVERDUBBING:STATES.RECORDING;
    track.recording=session;
    this.emit('track',{index:session.index});
    this.emit('status',{message:`${session.mode==='overdub'?'Overdubbing':'Recording'} ${track.name}… Tap REC again to finish.`});
    if(this.masterLength)session.autoTimer=setTimeout(()=>{if(this.activeRecording===session)this.stopRecording();},this.masterLength*1000);
  }

  async stopRecording(){
    const session=this.activeRecording;
    if(!session)return;
    this.activeRecording=null;
    clearTimeout(session.timer);clearTimeout(session.autoTimer);
    const track=this.tracks[session.index];
    if(session.queued){track.state=track.buffer?(this.playing?STATES.PLAYING:STATES.STOPPED):STATES.EMPTY;this.emit('track',{index:session.index});this.emit('change');this.emit('status',{message:`${track.name} recording cancelled.`});return;}
    try{
      if(session.startPromise)await session.startPromise;
      const buffer=await this.capture.stop();
      await this.finishRecording(session,buffer);
    }catch(error){console.error(error);track.recording=null;track.state=track.buffer?STATES.STOPPED:STATES.EMPTY;this.emit('track',{index:session.index});this.emit('change');this.emit('status',{message:error.message||'The microphone recording could not be completed.'});}
  }

  async finishRecording(session,decoded){
    const track=this.tracks[session.index];
    track.recording=null;
    const duration=decoded.duration||Math.max(.05,(performance.now()-session.startedAt)/1000);
    if(!this.masterLength)this.masterLength=this.quantizedLength(duration);
    track.buffer=session.mode==='overdub'&&track.buffer?this.mixBuffers(track.buffer,decoded,this.masterLength):this.fitBuffer(decoded,this.masterLength);
    if(!this.playing)this.start();else this.restartTrack(track);
    track.state=STATES.PLAYING;
    this.emit('status',{message:`${track.name} captured and looping · ${this.masterLength.toFixed(2)}s master cycle.`});
    this.emit('track',{index:session.index});this.emit('change');
  }

  start(){if(this.playing)return;this.playing=true;this.transportStart=this.context.currentTime+.06;this.tracks.forEach(track=>this.startTrack(track,this.transportStart));this.scheduler.start();this.emit('transport');}
  stop(){if(!this.playing)return;this.playing=false;this.scheduler.stop();this.tracks.forEach(track=>{this.stopSource(track);if(track.buffer)track.state=track.muted?STATES.MUTED:STATES.STOPPED;});this.emit('transport');this.emit('change');}
  startTrack(track,when=this.context.currentTime+.02){if(!track.buffer||track.muted)return;this.stopSource(track);const source=this.context.createBufferSource();source.buffer=track.buffer;source.loop=true;source.playbackRate.value=track.rate;source.connect(track.gain);const elapsed=this.playing&&this.masterLength?Math.max(0,this.context.currentTime-this.transportStart):0,offset=this.masterLength?(elapsed%this.masterLength):0;source.start(Math.max(this.context.currentTime,when),offset);track.source=source;track.state=STATES.PLAYING;}
  stopSource(track){try{track.source?.stop();}catch(_){}track.source?.disconnect();track.source=null;}
  restartTrack(track){if(this.playing)this.startTrack(track,this.context.currentTime+.02);}
  toggleMute(index){const track=this.tracks[index];track.muted=!track.muted;track.gain.gain.setTargetAtTime(track.muted?0:track.volume,this.context.currentTime,.02);track.state=track.muted?STATES.MUTED:(this.playing&&track.buffer?STATES.PLAYING:track.buffer?STATES.STOPPED:STATES.EMPTY);this.emit('track',{index});}
  clear(index){const track=this.tracks[index];this.stopSource(track);track.buffer=null;track.state=STATES.EMPTY;track.muted=false;track.rate=1;track.reverse=false;track.name=`LOOP ${index+1}`;if(!this.tracks.some(item=>item.buffer))this.masterLength=0;this.emit('track',{index});this.emit('change');}
  clearAll(){this.capture.cancel();this.activeRecording=null;this.stop();this.tracks.forEach((_,index)=>this.clear(index));this.masterLength=0;this.emit('change');}
  reverse(index){const track=this.tracks[index];if(!track.buffer)return;const clone=this.context.createBuffer(track.buffer.numberOfChannels,track.buffer.length,track.buffer.sampleRate);for(let channel=0;channel<clone.numberOfChannels;channel++)clone.copyToChannel(Float32Array.from(track.buffer.getChannelData(channel)).reverse(),channel);track.buffer=clone;track.reverse=!track.reverse;this.restartTrack(track);this.emit('track',{index});}
  halfSpeed(index){const track=this.tracks[index];if(!track.buffer)return;track.rate=track.rate===.5?1:.5;this.restartTrack(track);this.emit('track',{index});}
  setTrackValue(index,key,value){const track=this.tracks[index];if(key==='volume'){track.volume=value;track.gain.gain.setTargetAtTime(track.muted?0:value,this.context.currentTime,.02);}if(key==='pan'){track.panValue=value;track.pan.pan.setTargetAtTime(value,this.context.currentTime,.02);}if(key==='delay'){track.delay=value;track.delaySend.gain.setTargetAtTime(value,this.context.currentTime,.02);}if(key==='reverb'){track.reverb=value;track.reverbSend.gain.setTargetAtTime(value,this.context.currentTime,.02);}this.emit('track',{index});}
  progress(){if(!this.playing||!this.masterLength)return 0;return ((this.context.currentTime-this.transportStart)%this.masterLength+this.masterLength)%this.masterLength/this.masterLength;}
  setFxBypass(value){this.fxBypassed=value;this.delay.setBypass(value);this.reverb.setBypass(value);}
}

export {STATES};
