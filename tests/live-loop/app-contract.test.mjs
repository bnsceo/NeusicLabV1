import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(path,'utf8');

test('Live Loop exposes accessible recovery controls and no fake agent',async()=>{
  const html=await read('live-loop/index.html');
  assert.match(html,/name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/);
  assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
  assert.match(html,/id="sessionRecovery"/);
  assert.match(html,/id="recoverSessionBtn"/);
  assert.match(html,/id="discardSessionBtn"/);
  assert.match(html,/aria-live="polite"/);
  assert.doesNotMatch(html,/neusic-agent\.js|neusic-agent\.css/);
  assert.match(html,/https:\/\/neusicwave\.com\/live-loop\//);
});

test('Live Loop loads, saves, restores, and discards recovery sessions',async()=>{
  const app=await read('live-loop/app.js');
  assert.match(app,/LiveLoopSessionStore\.js/);
  assert.match(app,/loadSession\(\)/);
  assert.match(app,/saveSession\(looper\)/);
  assert.match(app,/restoreSession\(looper,pendingRecovery\)/);
  assert.match(app,/clearSession\(\)/);
  assert.match(app,/hasRecoverableAudio\(record\)/);
  assert.match(app,/recoverSessionBtn/);
  assert.match(app,/discardSessionBtn/);
  assert.match(app,/sendingTracks\.has\(index\)/);
  assert.match(app,/sendingTracks\.add\(index\)/);
  assert.match(app,/sendingTracks\.delete\(index\)/);
  assert.match(app,/SENDING…/);
});

test('Live Loop ships the Banani console shell and site-wide favicon contract',async()=>{
  const live=await read('live-loop/index.html');
  assert.match(live,/banani-ui\.css\?v=1/);
  assert.match(live,/class="banani-workspace"/);
  assert.match(live,/class="banani-identity-rail"/);
  assert.match(live,/FIVE-LANE MAP/);
  assert.match(live,/neusicwave-campaign-logo\.jpg\?v=20260723/);

  for(const file of ['index.html','suite.html','live-loop/index.html','live-loop/home/index.html','wave-loom/index.html','wave-loom/home/index.html']){
    const html=await read(file);
    assert.match(html,/rel="icon"/,`${file} must declare a favicon`);
    assert.match(html,/apple-touch-icon\.png\?v=20260723/,`${file} must declare the campaign touch icon`);
  }
});

test('Live Loop recovery source parses',()=>{
  for(const file of ['live-loop/app.js','live-loop/src/storage/LiveLoopSessionStore.js','live-loop/src/storage/ForgeBridge.js']){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${file} failed syntax validation:\n${result.stderr}`);
  }
});
