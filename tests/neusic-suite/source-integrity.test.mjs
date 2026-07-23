import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(path,'utf8');

const scripts=['scripts/landing/landing-experience.js','scripts/landing/neusicwave-teaser.js','scripts/shared/neusic-suite.js','app/js/35-neusic-suite-identity.js'];

test('shared suite JavaScript parses',()=>{
  for(const file of scripts){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${file} failed syntax validation:\n${result.stderr}`);
  }
});

test('root landing is a teaser-only NeusicWave waitlist',async()=>{
  const html=await read('index.html');
  for(const token of [
    'Something New',
    'waitlistForm',
    'The signal is getting stronger',
    '1FAIpQLSeld6WZQXpL0rRkWHFazCvSHs6FrlXYmvyQo8uyZKx3kOWhQw/formResponse',
    'entry.1064572385',
    'https://www.tiktok.com/@neusicwave',
    'https://www.instagram.com/neusicwave/'
  ])assert.ok(html.includes(token),`teaser landing missing ${token}`);
  assert.match(html,/css\/landing\/neusicwave-teaser\.css/);
  assert.match(html,/scripts\/landing\/neusicwave-teaser\.js/);
  assert.match(html,/assets\/icons\/neusicwave-logo\.svg/);
  for(const href of ['./studio/','./waveform/','./livestudio/','./wave-loom/','./live-loop/'])assert.equal(html.includes(`href="${href}"`),false,`teaser unexpectedly reveals ${href}`);
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
  const source=await read('scripts/landing/landing-experience.js');
  for(const forbidden of ['getUserMedia','MediaRecorder','AudioContext','webkitAudioContext','indexedDB'])assert.equal(source.includes(forbidden),false,`landing mock unexpectedly uses ${forbidden}`);
  for(const token of ['demo-recording','demo-sculpting','dataset.labView','MOCK READY'])assert.ok(source.includes(token),`mock interaction missing ${token}`);
});

test('all product pages load the shared suite identity',async()=>{
  const live=await read('live-loop/index.html');
  const wave=await read('wave-loom/index.html');
  const lab=await read('app/phase-a.html');
  for(const html of [live,wave]){assert.match(html,/\.\.\/css\/shared\/neusic-suite\.css/);assert.match(html,/\.\.\/scripts\/shared\/neusic-suite\.js/);}
  assert.match(lab,/css\/22-neusic-suite-identity\.css/);
  assert.match(lab,/js\/35-neusic-suite-identity\.js/);
});

test('Pages deployment copies organized suite assets and restores the teaser root',async()=>{
  const workflow=await read('.github/workflows/deploy-neusic-pages.yml');
  for(const command of [
    'cp -R css/. _site/css/',
    'cp -R scripts/landing/. _site/scripts/landing/',
    'cp -R scripts/shared/. _site/scripts/shared/',
    'cp -R assets/icons/. _site/assets/icons/'
  ])assert.ok(workflow.includes(command),`deployment missing organized asset command: ${command}`);
  for(const dir of ['waveform','livestudio'])assert.ok(workflow.includes(`cp -R ${dir}/. _site/${dir}/`),`deployment does not copy ${dir}/`);
  for(const shared of ['app/css/30-nw-tokens.css','app/css/32-nw-menubar.css','app/js/44-nw-agent.js','app/js/45-nw-demo-gate.js'])assert.ok(workflow.includes(`cp ${shared} _site/${shared}`),`deployment does not copy shared NW module ${shared}`);
  const builderAt=workflow.indexOf('python3 scripts/build_pages.py _site');
  const restoreAt=workflow.lastIndexOf('cp index.html _site/index.html');
  assert.ok(builderAt>=0&&restoreAt>builderAt,'deployment does not restore the exact teaser after metadata generation');
});
