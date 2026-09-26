import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {newProject, makeAsset, transferLanes, detectSlices, equalSlices, renderSlice, renderSequence, mixLane, encodeWav, validateProject, beatsToSeconds} from '../model.js';

test('one project starts with five independent lanes and a shared tempo',()=>{
  const p=newProject();assert.equal(p.lanes.length,5);assert.equal(p.bpm,112);assert.equal(p.tracks.length,0);assert.equal(p.loom.events.length,0);
  assert.equal(new Set(p.lanes.map(l=>l.id)).size,5);
});
test('Studio transfer preserves every layer and original sample',()=>{
  const p=newProject(),a=makeAsset('voice',8000,[new Float32Array([.1,.2,.3])]),b=makeAsset('overdub',8000,[new Float32Array([.4,.5,.6])]);
  const assets=new Map([[a.id,a],[b.id,b]]);p.lanes[0].layers.push(a.id,b.id);
  transferLanes(p,assets);assert.equal(p.tracks.length,1);assert.equal(p.tracks[0].clips.length,2);
  assert.deepEqual(p.tracks[0].clips.map(c=>c.assetId),[a.id,b.id]);assert.equal(a.channels[0][0],Math.fround(.1));
  transferLanes(p,assets);assert.equal(p.tracks.length,2);assert.notEqual(p.tracks[0].clips[0].id,p.tracks[1].clips[0].id);
});
test('transient detection finds spaced drum onsets and never exceeds 16',()=>{
  const sr=8000,pcm=new Float32Array(sr*3);for(const t of [.2,.7,1.2,1.7,2.2])for(let j=0;j<400;j++)pcm[Math.round(t*sr)+j]=Math.sin(j*.8)*Math.exp(-j/100);
  const a=makeAsset('drums',sr,[pcm]),s=detectSlices(a,.7);assert.ok(s.length>=5);assert.ok(s.length<=16);
  for(const onset of [.2,.7,1.2,1.7,2.2])assert.ok(s.some(x=>Math.abs(x.start-onset)<.02),`onset ${onset}`);
  assert.equal(s[0].start,0);assert.equal(s.at(-1).end,3);
});
test('silence yields one slice rather than invented hits',()=>{const a=makeAsset('silence',8000,[new Float32Array(8000)]);assert.equal(detectSlices(a).length,1);});
test('equal slicing makes sixteen contiguous slices covering source',()=>{const a=makeAsset('x',8000,[new Float32Array(8000)]),s=equalSlices(a);assert.equal(s.length,16);assert.equal(s[0].start,0);assert.equal(s.at(-1).end,1);for(let i=1;i<16;i++)assert.equal(s[i-1].end,s[i].start);});
test('slice edits are non-destructive, pitch explicitly changes duration',()=>{
  const a=makeAsset('x',8000,[new Float32Array(8000).fill(.5)]),s={start:.2,end:.8,gain:.5,pitch:12};const out=renderSlice(a,s);
  assert.equal(out.channels[0].length,2400);assert.equal(a.channels[0].length,8000);assert.equal(a.channels[0][3000],.5);assert.equal(out.channels[0][100],.25);
});
test('pad sequence chokes the prior sound at the next trigger',()=>{
  const pcm=new Float32Array(8000);pcm.fill(.8,0,4000);pcm.fill(-.4,4000);
  const a=makeAsset('x',8000,[pcm]),s=[{id:'a',start:0,end:.5,gain:1,pitch:0},{id:'b',start:.5,end:1,gain:1,pitch:0}];
  const out=renderSequence(a,s,[{sliceId:'a',beat:0},{sliceId:'b',beat:.25}],1,120).channels[0];
  assert.equal(out.length,16000);assert.ok(out[500]>.7);assert.ok(out[1100]<-.3);assert.equal(out[6000],0);
});
test('lane mix is derived without altering source assets',()=>{const a=makeAsset('a',8000,[new Float32Array(8000).fill(.2)]),b=makeAsset('b',8000,[new Float32Array(8000).fill(.3)]);const out=mixLane({name:'lane',layers:[a.id,b.id]},new Map([[a.id,a],[b.id,b]]),1,8000);assert.ok(Math.abs(out.channels[0][100]-.5)<.00001);assert.equal(a.channels[0][100],Math.fround(.2));});
test('WAV export is stereo PCM with correct header and clipped sample range',()=>{
  const a=makeAsset('test',48000,[new Float32Array([-2,0,2]),new Float32Array([.5,0,-.5])]);const out=encodeWav(a),v=new DataView(out);
  assert.equal(out.byteLength,56);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(22,true),2);assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(52,true),32767);
});
test('project validation rejects missing source audio and unsupported versions',()=>{const p=newProject();assert.equal(validateProject(p,new Map()),true);p.version=2;assert.throws(()=>validateProject(p,new Map()));p.version=1;p.lanes[0].layers.push('missing');assert.throws(()=>validateProject(p,new Map()),/Missing audio/);});
test('capture worklet honors frame boundaries inside render quanta',()=>{
  let Processor,posted;class Base{constructor(){this.port={postMessage:data=>posted=data};}}
  const context={AudioWorkletProcessor:Base,Float32Array,currentFrame:0,registerProcessor:(_,p)=>Processor=p};vm.createContext(context);vm.runInContext(readFileSync(new URL('../capture-worklet.js',import.meta.url),'utf8'),context);
  const p=new Processor();p.port.onmessage({data:{type:'capture',start:17,end:299}});
  for(let block=0;block<3;block++){context.currentFrame=block*128;const input=Float32Array.from({length:128},(_,i)=>block*128+i);p.process([[input]],[[new Float32Array(128)]]);}
  assert.equal(posted.type,'captured');assert.equal(posted.pcm.length,282);assert.equal(posted.pcm[0],17);assert.equal(posted.pcm.at(-1),298);
});
test('capture rejects missed boundaries and cancellation produces no take',()=>{
  let Processor,posted;class Base{constructor(){this.port={postMessage:data=>posted=data};}}
  const context={AudioWorkletProcessor:Base,Float32Array,currentFrame:100,registerProcessor:(_,p)=>Processor=p};vm.createContext(context);vm.runInContext(readFileSync(new URL('../capture-worklet.js',import.meta.url),'utf8'),context);
  const p=new Processor();p.port.onmessage({data:{type:'capture',start:0,end:500}});assert.equal(posted.type,'error');
  posted=null;p.port.onmessage({data:{type:'capture',start:128,end:256}});p.port.onmessage({data:{type:'cancel'}});context.currentFrame=128;p.process([[new Float32Array(128)]],[[new Float32Array(128)]]);assert.equal(posted,null);
});
test('musical duration uses shared tempo',()=>assert.equal(beatsToSeconds(16,120),8));
test('project import rejects unsafe style metadata and invalid clip timing',()=>{
  const p=newProject();p.lanes[0].color='red; background:url(x)';assert.throws(()=>validateProject(p,new Map()),/track settings/);
  p.lanes[0].color='#abcdef';p.lanes[0].volume=Infinity;assert.throws(()=>validateProject(p,new Map()),/track settings/);
});
test('saved scenes cannot inject invalid mixer values',()=>{const p=newProject();p.scenes.A=[{volume:NaN}];assert.throws(()=>validateProject(p,new Map()),/scene settings/);});
