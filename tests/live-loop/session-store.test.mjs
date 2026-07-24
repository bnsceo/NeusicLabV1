import test from 'node:test';
import assert from 'node:assert/strict';
import {hasRecoverableAudio,restoreSession,serializeSession} from '../../live-loop/src/storage/LiveLoopSessionStore.js';

const makeBuffer=(values,sampleRate=8)=>{
  const channels=values.map(valuesForChannel=>Float32Array.from(valuesForChannel));
  return{
    numberOfChannels:channels.length,
    sampleRate,
    length:channels[0].length,
    duration:channels[0].length/sampleRate,
    getChannelData:index=>channels[index]
  };
};

const audioParam=value=>({value,setTargetAtTime(next){this.value=next;}});

const makeLooper=()=>{
  const context={
    currentTime:2,
    createBuffer(channels,length,sampleRate){
      const data=Array.from({length:channels},()=>new Float32Array(length));
      return{
        numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,
        getChannelData:index=>data[index],
        copyToChannel(values,index){data[index].set(values);}
      };
    }
  };
  const makeTrack=index=>({
    index,name:`LOOP ${index+1}`,buffer:null,state:'Empty',muted:false,volume:.9,panValue:0,delay:.22,reverb:.18,rate:1,reverse:false,
    gain:{gain:audioParam(.9)},pan:{pan:audioParam(0)},delaySend:{gain:audioParam(.22)},reverbSend:{gain:audioParam(.18)}
  });
  return{
    context,bpm:112,quantize:true,masterLength:0,playing:false,tracks:Array.from({length:5},(_,index)=>makeTrack(index)),events:[],
    stop(){this.playing=false;},stopSource(){},emit(type,detail){this.events.push([type,detail]);}
  };
};

test('serializeSession copies audio and lane controls into a durable record',()=>{
  const looper=makeLooper();
  looper.bpm=96;
  looper.quantize=false;
  looper.masterLength=.5;
  Object.assign(looper.tracks[0],{
    name:'VOICE',buffer:makeBuffer([[0,.25,-.5,1],[.1,.2,.3,.4]]),muted:true,
    volume:.72,panValue:-.2,delay:.4,reverb:.6,rate:.5,reverse:true
  });

  const record=serializeSession(looper,12345);
  assert.equal(record.id,'current');
  assert.equal(record.version,1);
  assert.equal(record.savedAt,12345);
  assert.equal(record.bpm,96);
  assert.equal(record.quantize,false);
  assert.equal(record.masterLength,.5);
  assert.equal(record.tracks.length,5);
  assert.deepEqual(Array.from(record.tracks[0].buffer.channels[0]),[0,.25,-.5,1]);
  assert.equal(record.tracks[0].volume,.72);
  assert.equal(record.tracks[0].rate,.5);
  looper.tracks[0].buffer.getChannelData(0)[1]=.99;
  assert.equal(record.tracks[0].buffer.channels[0][1],.25,'saved audio must not alias the live buffer');
  assert.equal(hasRecoverableAudio(record),true);
});

test('restoreSession rebuilds audio and leaves the recovered session stopped',()=>{
  const source=makeLooper();
  source.masterLength=.5;
  Object.assign(source.tracks[0],{
    name:'BEAT',buffer:makeBuffer([[0,.5,-.5,1]]),muted:true,
    volume:.64,panValue:.25,delay:.3,reverb:.55,rate:.5,reverse:true
  });
  const record=serializeSession(source,99);
  const target=makeLooper();
  target.playing=true;

  const restored=restoreSession(target,record);
  assert.equal(restored,1);
  assert.equal(target.playing,false);
  assert.equal(target.masterLength,.5);
  assert.equal(target.tracks[0].name,'BEAT');
  assert.deepEqual(Array.from(target.tracks[0].buffer.getChannelData(0)),[0,.5,-.5,1]);
  assert.equal(target.tracks[0].state,'Muted');
  assert.equal(target.tracks[0].gain.gain.value,0);
  assert.equal(target.tracks[0].pan.pan.value,.25);
  assert.equal(target.tracks[1].buffer,null);
});

test('hasRecoverableAudio rejects empty or malformed records',()=>{
  assert.equal(hasRecoverableAudio(null),false);
  assert.equal(hasRecoverableAudio({version:1,tracks:[]}),false);
  assert.equal(hasRecoverableAudio({version:99,tracks:[{buffer:{}}]}),false);
});
