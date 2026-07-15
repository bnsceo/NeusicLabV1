import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const files=[
  'wave-loom/audio-workspace.js',
  'wave-loom/neucapture-worklet.js',
  'wave-loom/wave-project-store.js',
  'wave-loom/reliability-core.js',
  'wave-loom/neucapture-controller.js',
  'wave-loom/sample-performance.js',
  'wave-loom/forge-editor.js',
  'wave-loom/mobile-workspaces.js',
  'wave-loom/studio-transfer.js',
  'wave-loom/expanded-export.js',
  'wave-loom/live-loop-receiver-v3.js',
  'app/js/34-wave-transfer-receiver.js'
];

test('all reliability JavaScript parses',()=>{
  for(const file of files){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${file} failed syntax validation:\n${result.stderr}`);
  }
});

test('Wave Loom loads reliability modules in dependency order',async()=>{
  const html=await readFile('wave-loom/index.html','utf8');
  const order=['audio-workspace.js','wave-project-store.js','app.js','reliability-core.js','neucapture-controller.js','sample-performance.js','forge-editor.js','studio-transfer.js','expanded-export.js','mobile-workspaces.js','live-loop-receiver-v3.js'];
  let previous=-1;
  for(const file of order){const index=html.indexOf(`src="${file}"`);assert.ok(index>previous,`${file} is missing or loaded out of order`);previous=index;}
  assert.match(html,/reliability-phase\.css/);
  assert.doesNotMatch(html,/src="sample-import\.js"/);
  assert.doesNotMatch(html,/src="forge-receiver\.js"/);
});

test('AudioWorkspace enforces one browser AudioContext',async()=>{
  const source=await readFile('wave-loom/audio-workspace.js','utf8');
  assert.match(source,/sharedContext/);
  assert.match(source,/window\.AudioContext = SharedAudioContext/);
  assert.match(source,/loadCaptureWorklet/);
  assert.match(source,/preview/);
  assert.match(source,/samples/);
});

test('NeuCapture uses a PCM ring buffer and AudioWorklet',async()=>{
  const source=await readFile('wave-loom/neucapture-worklet.js','utf8');
  assert.match(source,/registerProcessor\('neusic-neucapture'/);
  assert.match(source,/Float32Array\(this\.capacity\)/);
  assert.match(source,/type === 'capture'/);
  assert.match(source,/type === 'start-record'/);
  assert.match(source,/type === 'stop-record'/);
});

test('persistent project storage includes samples and Studio transfers',async()=>{
  const source=await readFile('wave-loom/wave-project-store.js','utf8');
  for(const token of ["'samples'","'projects'","'studioTransfers'",'serializeBuffer','createStudioTransfer'])assert.match(source,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('sample engine includes sample, granular, hybrid, node mapping, and probability',async()=>{
  const source=await readFile('wave-loom/sample-performance.js','utf8');
  for(const token of ['granular','hybrid','nodeAssignments','probability','sliceId','transpose','scheduleGranular'])assert.ok(source.includes(token),`missing ${token}`);
});

test('Forge editor and expanded export include production controls',async()=>{
  const forge=await readFile('wave-loom/forge-editor.js','utf8');
  for(const token of ['trimStart','fadeIn','fadeOut','gainDb','normalized','detectTransients','minimumSliceMs'])assert.ok(forge.includes(token),`Forge missing ${token}`);
  const exp=await readFile('wave-loom/expanded-export.js','utf8');
  for(const token of ['48000','24-BIT','ALL STEMS','SEAMLESS LOOP','SEND MIX TO STUDIO'])assert.ok(exp.includes(token),`Export missing ${token}`);
});

test('Classic Studio wrapper loads the Wave Loom transfer receiver',async()=>{
  const html=await readFile('app/phase-a.html','utf8');
  assert.match(html,/js\/34-wave-transfer-receiver\.js/);
  const receiver=await readFile('app/js/34-wave-transfer-receiver.js','utf8');
  for(const token of ['Audio_.registerBuffer','S.tracks.push','renderTracks','waveTransfer'])assert.ok(receiver.includes(token),`Studio receiver missing ${token}`);
});