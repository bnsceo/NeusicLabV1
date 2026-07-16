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

  assert.match(html,/<body class="stage-performance" data-neusic-product="live-loop">/);
  assert.match(html,/mobile-lanes-imperative\.css/);
  assert.match(html,/aria-label="Five synchronized loop lanes"/);
  assert.match(app,/function buildTracks\(\)/);
  assert.match(app,/neusic:live-loop-lanes-visible/);
  assert.match(app,/neusic:live-loop-ui-ready/);
  assert.ok(app.lastIndexOf('buildTracks();')<app.lastIndexOf('requestAnimationFrame(()=>ensureEngine()'), 'tracks must render before audio initialization is attempted');
  assert.match(stage,/document\.body\?\.classList\.add\('stage-performance'\)/);
  assert.match(stage,/neusic:live-loop-ui-ready/);
  assert.match(mobile,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(mobile,/100svh/);
  assert.match(mobile,/button\[data-action="record"\]/);
  assert.match(mobile,/input\[data-control="volume"\]/);
  assert.match(mobile,/input\[data-control="pan"\]/);
});

test('mobile Live Loop scripts parse',()=>{
  for(const file of ['live-loop/app.js','live-loop/stage-performance.js']){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${file} failed syntax validation:\n${result.stderr}`);
  }
});
