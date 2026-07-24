import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeWav} from '../../live-loop/src/storage/ForgeBridge.js';

const makeBuffer=({channels=2,sampleRate=48000,frames=4}={})=>{
  const data=Array.from({length:channels},(_,channel)=>Float32Array.from(
    {length:frames},
    (_,frame)=>channel===0?[0,-1,1,.5][frame]||0:[.25,-.25,.75,-.75][frame]||0
  ));
  return{
    numberOfChannels:channels,
    sampleRate,
    length:frames,
    duration:frames/sampleRate,
    getChannelData:index=>data[index]
  };
};

test('encodeWav creates a valid interleaved 16-bit PCM WAV',()=>{
  const wav=encodeWav(makeBuffer());
  const bytes=new Uint8Array(wav);
  const view=new DataView(wav);
  const text=(start,length)=>String.fromCharCode(...bytes.slice(start,start+length));

  assert.equal(text(0,4),'RIFF');
  assert.equal(text(8,4),'WAVE');
  assert.equal(text(12,4),'fmt ');
  assert.equal(text(36,4),'data');
  assert.equal(view.getUint16(20,true),1);
  assert.equal(view.getUint16(22,true),2);
  assert.equal(view.getUint32(24,true),48000);
  assert.equal(view.getUint16(34,true),16);
  assert.equal(view.getUint32(40,true),16);
  assert.equal(wav.byteLength,60);
  assert.equal(view.getInt16(44,true),0);
  assert.equal(view.getInt16(46,true),8191);
  assert.equal(view.getInt16(48,true),-32768);
});
