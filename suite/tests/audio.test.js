import test from 'node:test';
import assert from 'node:assert/strict';
import {SuiteAudio} from '../audio.js';
import {newProject,makeAsset,transferLanes} from '../model.js';

// Unit scheduling doubles, NOT a real Web Audio or microphone verification.
class Param {constructor(){this.value=0;}setTargetAtTime(v){this.value=v;}}
class Node {constructor(){this.gain=new Param();this.pan=new Param();this.frequency=new Param();this.delayTime=new Param();this.calls=[];}connect(){}disconnect(){}start(...args){this.calls.push(['start',...args]);}stop(...args){this.calls.push(['stop',...args]);}}
function context(){return {currentTime:10,sampleRate:8000,destination:new Node(),createGain:()=>new Node(),createStereoPanner:()=>new Node(),createBiquadFilter:()=>new Node(),createDelay:()=>new Node(),createConvolver:()=>new Node(),createBufferSource:()=>new Node(),createBuffer:(ch,length,sr)=>({length,sampleRate:sr,copyToChannel(){},getChannelData:()=>new Float32Array(length)})};}
function setup(){const a=new SuiteAudio();a.context=context();a.master=new Node();a.ir={};const p=newProject(),asset=makeAsset('test',8000,[new Float32Array(8000).fill(.1)]),assets=new Map([[asset.id,asset]]);p.lanes[0].layers=[asset.id];return{a,p,asset,assets};}
test('live playback schedules each source against one audio-clock epoch',()=>{
  const {a,p,assets}=setup();a.playLive(p,assets);assert.equal(a.mode,'live');assert.equal(a.nodes.length,1);assert.equal(a.nodes[0].loop,true);assert.equal(a.nodes[0].calls[0][1],10.08);
  a.context.currentTime=10.58;assert.ok(Math.abs(a.beat(112)-.5*112/60)<1e-9);
});
test('adding an overdub does not restart existing sources',()=>{
  const {a,p,assets}=setup();a.playLive(p,assets);const original=a.nodes[0],extra=makeAsset('take 2',8000,[new Float32Array(8000)]);assets.set(extra.id,extra);p.lanes[0].layers.push(extra.id);a.context.currentTime=10.5;a.addLane(p.lanes[0],assets,p.bpm);
  assert.equal(a.nodes.length,2);assert.equal(a.nodes[0],original);assert.ok(a.nodes[1].calls[0][2]>0);
});
test('Studio seek skips elapsed beats and respects clip source offset',()=>{
  const {a,p,assets}=setup();transferLanes(p,assets);p.tracks[0].clips[0].offset=.1;a.playStudio(p,assets,4);assert.equal(a.mode,'studio');assert.equal(a.nodes.length,1);assert.equal(a.startBeat,4);assert.equal(a.nodes[0].calls[0][1],10.08);
  assert.ok(Math.abs(a.nodes[0].calls[1][1]-(10.08+12*60/112))<1e-8);
});
test('mute and solo are reflected in the actual bus gain parameters',()=>{
  const {a,p,assets}=setup();a.playLive(p,assets);const bus=a.buses.get(p.lanes[0].id);p.lanes[0].muted=true;a.updateMix(p.lanes);assert.equal(bus.input.gain.value,0);p.lanes[0].muted=false;p.lanes[1].solo=true;a.updateMix(p.lanes);assert.equal(bus.input.gain.value,0);p.lanes[1].solo=false;a.updateMix(p.lanes);assert.equal(bus.input.gain.value,.72);
});
test('stop cancels all sources and disposes mixer buses',()=>{const {a,p,assets}=setup();a.playLive(p,assets);const source=a.nodes[0];a.stop();assert.equal(a.mode,null);assert.equal(a.buses.size,0);assert.equal(a.nodes.length,0);assert.ok(source.calls.some(c=>c[0]==='stop'));});
test('stop during pending microphone permission cancels arming',async()=>{
  const {a,p,assets}=setup();let grant;a.microphone=()=>new Promise(resolve=>grant=resolve);const result=a.recordLoop(p,assets,'test');a.stop();grant();await assert.rejects(result,/arming cancelled/);assert.equal(a.captureJob,null);
});
