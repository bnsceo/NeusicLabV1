import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(path,'utf8');

test('mobile Live Loop source boots five lanes before audio readiness',async()=>{
  const html=await read('live-loop/index.html');
  const app=await read('live-loop/app.js');
  const stage=await read('live-loop/stage-performance.js');
  const mobile=await read('live-loop/mobile-lanes-imperative.css');
  const compact=await read('live-loop/mobile-lanes-compact.css');

  assert.match(html,/<body class="stage-performance" data-neusic-product="live-loop">/);
  assert.match(html,/mobile-lanes-imperative\.css/);
  assert.match(html,/mobile-lanes-compact\.css/);
  assert.match(html,/mobile-recording-feedback\.js/);
  assert.match(html,/aria-label="Five synchronized loop lanes"/);
  assert.match(app,/function buildTracks\(\)/);
  assert.match(app,/neusic:live-loop-lanes-visible/);
  assert.match(app,/neusic:live-loop-ui-ready/);
  assert.ok(app.lastIndexOf('buildTracks();')<app.lastIndexOf('requestAnimationFrame(()=>ensureEngine()'), 'tracks must render before audio initialization is attempted');
  assert.match(stage,/document\.body\?\.classList\.add\('stage-performance'\)/);
  assert.match(stage,/neusic:live-loop-ui-ready/);
  assert.match(mobile,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(mobile,/button\[data-action="record"\]/);
  assert.match(compact,/height:clamp\(440px,72svh,590px\)/);
  assert.match(compact,/mobile-recording-toast/);
});

test('mobile recorder includes iOS compatibility and permission recovery',async()=>{
  const workspace=await read('live-loop/src/audio/AudioWorkspace.js');
  const recorder=await read('live-loop/src/audio/PcmRecorder.js');
  const looper=await read('live-loop/src/audio/Looper.js');
  assert.match(workspace,/resume\(\{required=false\}/);
  assert.match(workspace,/Microphone permission is blocked/);
  assert.match(workspace,/track\.readyState === 'live'/);
  assert.match(recorder,/isIOSWebKit/);
  assert.match(recorder,/createScriptProcessor\?\.\(1024, 1, 1\)/);
  assert.match(recorder,/this\.sink\.gain\.value = 1/);
  assert.match(recorder,/switchToCompatibility/);
  assert.match(recorder,/650/);
  assert.match(looper,/ARMING:'Arming'/);
  assert.match(looper,/Opening the microphone/);
  assert.match(looper,/resume\(\{required:true\}\)/);
});

test('mobile Live Loop scripts parse',()=>{
  for(const file of [
    'live-loop/app.js',
    'live-loop/stage-performance.js',
    'live-loop/mobile-recording-feedback.js',
    'live-loop/src/audio/AudioWorkspace.js',
    'live-loop/src/audio/PcmRecorder.js',
    'live-loop/src/audio/Looper.js'
  ]){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${file} failed syntax validation:\n${result.stderr}`);
  }
});
