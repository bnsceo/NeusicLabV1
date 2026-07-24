import test from 'node:test';
import assert from 'node:assert/strict';
import {FiveTrackLooper} from '../../live-loop/src/audio/Looper.js';

const makeSource=()=>({
  buffer:null,loop:false,playbackRate:{value:1},connections:[],starts:[],
  connect(node){this.connections.push(node);},
  start(...args){this.starts.push(args);},
  stop(){}
});

const makeTrack=()=>({
  buffer:{duration:4},rate:.5,source:null,muted:false,state:'Stopped',volume:.9,
  gain:{gain:{setTargetAtTime(){}}}
});

test('startTrack restores half-speed playback at the correct source phase',()=>{
  const source=makeSource();
  const track=makeTrack();
  const looper=Object.create(FiveTrackLooper.prototype);
  looper.context={currentTime:11,createBufferSource:()=>source};
  looper.masterLength=4;
  looper.transportStart=1;
  looper.playing=true;

  looper.startTrack(track,11);

  assert.equal(source.playbackRate.value,.5);
  assert.deepEqual(source.starts,[ [11,1] ],'elapsed transport time must be scaled by playbackRate before converting to a buffer offset');
});

test('recorded audio pads with silence while imported loops may repeat',()=>{
  const createBuffer=(channels,length,sampleRate)=>{
    const data=Array.from({length:channels},()=>new Float32Array(length));
    return{numberOfChannels:channels,length,sampleRate,getChannelData:index=>data[index]};
  };
  const looper=Object.create(FiveTrackLooper.prototype);
  looper.context={sampleRate:4,createBuffer};
  const source=createBuffer(1,2,4);
  source.getChannelData(0).set([1,.5]);

  const recorded=looper.fitBuffer(source,1);
  const imported=looper.fitBuffer(source,1,{wrap:true});

  assert.deepEqual(Array.from(recorded.getChannelData(0)),[1,.5,0,0]);
  assert.deepEqual(Array.from(imported.getChannelData(0)),[1,.5,1,.5]);
});

test('first import after an empty running transport establishes a fresh phase origin',async()=>{
  const decoded={duration:4,numberOfChannels:1,length:4,getChannelData:()=>new Float32Array(4)};
  const track={...makeTrack(),index:0,buffer:null,revision:0,name:'LOOP 1'};
  const looper=Object.create(FiveTrackLooper.prototype);
  looper.context={currentTime:10};
  looper.tracks=[track];
  looper.masterLength=0;
  looper.transportStart=1;
  looper.playing=true;
  looper.decodeBlob=async()=>decoded;
  looper.quantizedLength=()=>4;
  looper.fitBuffer=buffer=>buffer;
  looper.restartTrack=()=>{};
  looper.emit=()=>{};

  await looper.importFile(0,{name:'first.wav'});

  assert.equal(looper.transportStart,10);
  assert.equal(looper.masterLength,4);
});

test('a stale audio decode cannot overwrite a later clear',async()=>{
  let resolveDecode;
  const decoded={duration:4,numberOfChannels:1,length:4,getChannelData:()=>new Float32Array(4)};
  const original={duration:4};
  const track={...makeTrack(),index:0,buffer:original,revision:0,name:'LOOP 1',reverse:false};
  const looper=Object.create(FiveTrackLooper.prototype);
  looper.context={currentTime:0};
  looper.tracks=[track];
  looper.masterLength=4;
  looper.playing=false;
  looper.activeRecording=null;
  looper.arming=null;
  looper.decodeBlob=()=>new Promise(resolve=>{resolveDecode=resolve;});
  looper.fitBuffer=buffer=>buffer;
  looper.stopSource=()=>{};
  looper.emit=()=>{};
  const importing=looper.importFile(0,{name:'slow.wav'});
  await Promise.resolve();
  assert.equal(looper.clear(0),true);
  resolveDecode(decoded);
  await assert.rejects(importing,/changed while audio was decoding/i);
  assert.equal(track.buffer,null);
});

test('finishing an overdub on a muted lane preserves MUTED state',async()=>{
  const buffer={duration:4};
  const track={...makeTrack(),index:0,buffer,muted:true,state:'Overdubbing',recording:{}};
  const looper=Object.create(FiveTrackLooper.prototype);
  looper.tracks=[track];
  looper.capture={stop:async()=>buffer};
  looper.fitBuffer=value=>value;
  looper.mixBuffers=()=>buffer;
  looper.restartTrack=()=>{};
  looper.emit=()=>{};
  looper.context={currentTime:0};
  looper.masterLength=4;
  looper.playing=true;
  await looper.finishRecording({index:0,base:buffer,mode:'overdub'},buffer);
  assert.equal(track.state,'Muted');
});

test('stopRecording keeps the session active until asynchronous finalization completes',async()=>{
  let resolveCapture;
  const session={index:0,queued:false};
  const activeStates=[];
  const looper=Object.create(FiveTrackLooper.prototype);
  looper.activeRecording=session;
  looper.tracks=[{...makeTrack(),index:0,recording:{}}];
  looper.capture={stop:()=>new Promise(resolve=>{resolveCapture=resolve;})};
  looper.finishRecording=async()=>{};
  looper.emit=type=>{if(type==='change')activeStates.push(Boolean(looper.activeRecording));};
  const stopping=looper.stopRecording();
  await Promise.resolve();
  assert.equal(looper.activeRecording,session);
  resolveCapture({duration:1});
  await stopping;
  assert.equal(looper.activeRecording,null);
  assert.equal(activeStates.at(-1),false);
});

test('destructive lane transforms are blocked while that lane is recording',()=>{
  const track={...makeTrack(),index:0,reverse:false};
  const looper=Object.create(FiveTrackLooper.prototype);
  looper.context={currentTime:0};
  looper.tracks=[track];
  looper.activeRecording={index:0};
  looper.emit=()=>{};
  const originalBuffer=track.buffer;

  assert.equal(looper.clear(0),false);
  assert.equal(looper.reverse(0),false);
  assert.equal(looper.halfSpeed(0),false);
  assert.equal(track.buffer,originalBuffer);
  assert.equal(track.reverse,false);
  assert.equal(track.rate,.5);
});
