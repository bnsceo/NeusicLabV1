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

test('landing clearly presents three products and one connected project',async()=>{
  const html=await read('index.html');
  for(const token of ['3 PRODUCTS / 1 CONNECTED PROJECT','Neusic Live Loop','Neusic Wave','Neusic Lab','Live Loop → Wave → Lab','data-preview="live-loop"','data-preview="wave"','data-preview="lab"'])assert.ok(html.includes(token),`landing missing ${token}`);
  const order=['./live-loop/','./wave-loom/','./studio/'].map(token=>html.indexOf(token));
  assert.ok(order[0]>=0&&order[0]<order[1]&&order[1]<order[2],'recommended product order is not Live Loop → Wave → Lab');
  assert.match(html,/landing-experience\.css/);
  assert.match(html,/landing-experience\.js/);
});

test('landing thumbnail interactions remain mock-only',async()=>{
  const source=await read('landing-experience.js');
  for(const forbidden of ['getUserMedia','MediaRecorder','AudioContext','webkitAudioContext','indexedDB'])assert.equal(source.includes(forbidden),false,`landing mock unexpectedly uses ${forbidden}`);
  for(const token of ['demo-recording','demo-sculpting','data-lab-view','MOCK READY'])assert.ok(source.includes(token),`mock interaction missing ${token}`);
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
  for(const file of ['landing-experience.css','landing-experience.js','neusic-suite.css','neusic-suite.js'])assert.ok(workflow.includes(`cp ${file} _site/${file}`),`deployment does not copy ${file}`);
});
