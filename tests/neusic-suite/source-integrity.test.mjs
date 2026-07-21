import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(path,'utf8');

const scripts=['landing-experience.js','neusic-suite.js','app/js/35-neusic-suite-identity.js'];

test('shared suite JavaScript parses',()=>{
  for(const file of scripts){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${file} failed syntax validation:\n${result.stderr}`);
  }
});

test('hub landing presents the NeusicWave trio with the tri-accent rule',async()=>{
  const html=await read('index.html');
  for(const token of ['NEUSICWAVE','NeusicLab','Waveform','LiveStudio','nw-tri-rule','data-product="lab"','data-product="wave"','data-product="live"'])assert.ok(html.includes(token),`hub landing missing ${token}`);
  for(const href of ['./studio/','./waveform/','./livestudio/'])assert.ok(html.includes(`href="${href}"`),`hub landing missing product link ${href}`);
  for(const href of ['./wave-loom/','./live-loop/'])assert.ok(html.includes(`href="${href}"`),`hub landing lost legacy workspace link ${href}`);
  assert.match(html,/app\/css\/30-nw-tokens\.css/);
  assert.match(html,/css\/60-hub-landing\.css/);
  assert.match(html,/<details>/);
});

test('NeusicWave product pages share the NW modules and per-page entry keys',async()=>{
  const pages=[
    ['waveform/index.html','wave','nw-entered-wave','waveform/js/50-waveform-shell.js'],
    ['livestudio/index.html','live','nw-entered-live','livestudio/js/52-livestudio-shell.js'],
  ];
  for(const [page,product,entryKey,shell] of pages){
    const html=await read(page);
    assert.ok(html.includes(`data-product="${product}"`),`${page} missing data-product ${product}`);
    assert.ok(html.includes(entryKey),`${page} missing entry key ${entryKey}`);
    for(const shared of ['../app/css/30-nw-tokens.css','../app/css/32-nw-menubar.css','../app/js/44-nw-agent.js','../app/js/45-nw-demo-gate.js'])assert.ok(html.includes(shared),`${page} missing shared module ${shared}`);
    assert.match(html,/id="nw-landing"/);
    assert.match(html,/id="nw-enter"/);
    const result=spawnSync(process.execPath,['--check',shell],{encoding:'utf8'});
    assert.equal(result.status,0,`${shell} failed syntax validation:\n${result.stderr}`);
  }
});

test('landing thumbnail interactions remain mock-only',async()=>{
  const source=await read('landing-experience.js');
  for(const forbidden of ['getUserMedia','MediaRecorder','AudioContext','webkitAudioContext','indexedDB'])assert.equal(source.includes(forbidden),false,`landing mock unexpectedly uses ${forbidden}`);
  for(const token of ['demo-recording','demo-sculpting','dataset.labView','MOCK READY'])assert.ok(source.includes(token),`mock interaction missing ${token}`);
});

test('all product pages load the shared suite identity',async()=>{
  const live=await read('live-loop/index.html');
  const wave=await read('wave-loom/index.html');
  const lab=await read('app/phase-a.html');
  for(const html of [live,wave]){assert.match(html,/\.\.\/neusic-suite\.css/);assert.match(html,/\.\.\/neusic-suite\.js/);}
  assert.match(lab,/css\/22-neusic-suite-identity\.css/);
  assert.match(lab,/js\/35-neusic-suite-identity\.js/);
});

test('Pages deployment copies every root suite asset',async()=>{
  const workflow=await read('.github/workflows/deploy-neusic-pages.yml');
  for(const file of ['landing-experience.css','landing-experience.js','neusic-suite.css','neusic-suite.js','css/60-hub-landing.css'])assert.ok(workflow.includes(`cp ${file} _site/${file}`),`deployment does not copy ${file}`);
  for(const dir of ['waveform','livestudio'])assert.ok(workflow.includes(`cp -R ${dir}/. _site/${dir}/`),`deployment does not copy ${dir}/`);
  for(const shared of ['app/css/30-nw-tokens.css','app/css/32-nw-menubar.css','app/js/44-nw-agent.js','app/js/45-nw-demo-gate.js'])assert.ok(workflow.includes(`cp ${shared} _site/${shared}`),`deployment does not copy shared NW module ${shared}`);
});
