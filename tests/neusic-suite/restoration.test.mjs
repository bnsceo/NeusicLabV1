import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(path,'utf8');

const scripts=[
  'neusic-agent.js',
  'site-polish.js',
  'live-loop/app.js',
  'live-loop/mobile-performance.js',
  'live-loop/src/audio/PcmRecorder.js',
  'live-loop/src/audio/Looper.js',
  'app/js/39-studio-workspace-v4.js',
  'app/js/40-studio-v4-hardening.js',
  'wave-loom/wave-polish.js'
];

test('restoration JavaScript parses',()=>{
  for(const file of scripts){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${file} failed syntax validation:\n${result.stderr}`);
  }
});

test('Hermes and CrewAI bridge compiles without importing optional providers',()=>{
  const result=spawnSync('python3',['-m','py_compile','agents/neusic_agent_server.py'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('Live Loop uses raw PCM capture and keeps MIDI optional',async()=>{
  const looper=await read('live-loop/src/audio/Looper.js');
  const recorder=await read('live-loop/src/audio/PcmRecorder.js');
  const mobile=await read('live-loop/mobile-performance.js');
  const html=await read('live-loop/index.html');
  assert.doesNotMatch(looper,/MediaRecorder/);
  assert.match(looper,/new PcmRecorder/);
  assert.match(recorder,/AudioWorkletNode/);
  assert.match(recorder,/createScriptProcessor/);
  assert.match(mobile,/MIDI OPTIONAL/);
  assert.match(mobile,/data-mobile-action="record"/);
  assert.match(html,/mobile-performance-v2\.css/);
  assert.match(html,/touch REC control/i);
});

test('Lab V4 keeps one sidebar and one dedicated center workspace',async()=>{
  const script=await read('app/js/39-studio-workspace-v4.js');
  const css=await read('app/css/23-studio-workspace-v4.css');
  const wrapper=await read('app/phase-a.html');
  for(const token of ['studio-v4-left','studio-v4-track-rack','studio-v4-center','studio-v4-workspace','studio-v4-inspector'])assert.ok(script.includes(token),`missing ${token}`);
  assert.match(script,/rack\.appendChild\(sidebar\)/);
  assert.match(script,/workspace\.append\(main,drawer\)/);
  assert.match(css,/#studio-v4-shell/);
  assert.match(wrapper,/css\/23-studio-workspace-v4\.css/);
  assert.match(wrapper,/js\/39-studio-workspace-v4\.js/);
  assert.match(wrapper,/js\/40-studio-v4-hardening\.js/);
});

test('all public products expose the shared Agent and share-preview assets',async()=>{
  const live=await read('live-loop/index.html');
  const lab=await read('app/phase-a.html');
  const wave=await read('wave-loom/wave-polish.js');
  const landing=await read('site-polish.js');
  for(const source of [live,lab,wave,landing])assert.match(source,/neusic-agent/);
  assert.match(live,/social\/live-loop-card\.svg/);
  assert.match(lab,/social\/lab-card\.svg/);
  for(const card of ['neusic-suite-card.svg','live-loop-card.svg','wave-card.svg','lab-card.svg']){
    const svg=await read(`social/${card}`);
    assert.match(svg,/width="1200"/);assert.match(svg,/height="630"/);assert.match(svg,/<\/svg>$/);
  }
});

test('Pages deployment publishes social and Agent assets',async()=>{
  const workflow=await read('.github/workflows/deploy-neusic-pages.yml');
  for(const token of ['cp neusic-agent.css _site/neusic-agent.css','cp neusic-agent.js _site/neusic-agent.js','cp -R social/. _site/social/','social/neusic-suite-card.svg','social/wave-card.svg'])assert.ok(workflow.includes(token),`deployment missing ${token}`);
});
