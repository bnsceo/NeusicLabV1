import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(path,'utf8');

test('mobile microphone primer and workspace share the same audio resources',async()=>{
  const primer=await read('live-loop/mobile-mic-primer.js');
  const workspace=await read('live-loop/src/audio/AudioWorkspace.js');
  const html=await read('live-loop/index.html');
  assert.match(primer,/adoptContext/);
  assert.match(primer,/get stream\(\)/);
  assert.match(workspace,/NeusicMobileMicPrimer\?\.context/);
  assert.match(workspace,/NeusicMobileMicPrimer\?\.stream/);
  assert.match(workspace,/granted microphone permission but no live audio/);
  assert.match(html,/mobile-system\.css\?v=1/);
  assert.match(html,/mobile-mic-primer\.js\?v=3/);
});

test('mobile runtime scripts parse',()=>{
  for(const file of ['live-loop/mobile-mic-primer.js','live-loop/src/audio/AudioWorkspace.js']){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${file} failed syntax validation:\n${result.stderr}`);
  }
});

test('Live Loop and Lab final mobile layers are present',async()=>{
  const live=await read('live-loop/mobile-system.css');
  const lab=await read('app/css/24-mobile-responsive.css');
  assert.match(live,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(live,/orientation:landscape/);
  assert.match(lab,/100dvh/);
  assert.match(lab,/studio-v4-left\.open/);
  assert.match(lab,/studio-v4-inspector\.open/);
  assert.match(lab,/studio-v4-mobile-nav/);
});