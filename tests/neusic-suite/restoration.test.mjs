import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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

test('landing menu is removed while direct product links remain',async()=>{
  const landingScript=await read('site-polish.js');
  const landingHtml=await read('index.html');
  for(const token of ["document.querySelector('.desktop-nav')?.remove()","document.getElementById('menuButton')?.remove()","document.getElementById('mobileMenu')?.remove()"])assert.ok(landingScript.includes(token),`landing removal missing ${token}`);
  for(const href of ['./live-loop/','./wave-loom/','./studio/'])assert.ok(landingHtml.includes(href),`landing lost direct product link ${href}`);
});

test('Pages build produces complete link previews and a menu-free landing',async()=>{
  const workflow=await read('.github/workflows/deploy-neusic-pages.yml');
  const block=workflow.match(/python - <<'PY'\n([\s\S]*?)\n\s*PY/);
  assert.ok(block,'Pages workflow Python build block is missing');
  const python=block[1].split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
  const root=await mkdtemp(join(tmpdir(),'neusic-pages-'));
  try{
    const site=join(root,'_site');
    await mkdir(site,{recursive:true});
    await cp('index.html',join(site,'index.html'));
    await cp('live-loop',join(site,'live-loop'),{recursive:true});
    await cp('wave-loom',join(site,'wave-loom'),{recursive:true});
    await cp('app',join(site,'studio'),{recursive:true});
    await rename(join(site,'studio','index.html'),join(site,'studio','core.html'));
    await rename(join(site,'studio','phase-a.html'),join(site,'studio','index.html'));
    const result=spawnSync('python3',['-c',python],{cwd:root,encoding:'utf8'});
    assert.equal(result.status,0,`Pages metadata build failed:\n${result.stderr}`);

    const landing=await readFile(join(site,'index.html'),'utf8');
    assert.doesNotMatch(landing,/class="desktop-nav"/);
    assert.doesNotMatch(landing,/id="menuButton"/);
    assert.doesNotMatch(landing,/id="mobileMenu"/);

    const expected=[
      ['index.html','Neusic — Live Loop, Wave & Lab','neusic-suite-card.svg'],
      ['live-loop/index.html','Neusic Live Loop — Synchronized Mobile Looping','live-loop-card.svg'],
      ['wave-loom/index.html','Neusic Wave — Sample Performance & Sound Design','wave-card.svg'],
      ['studio/index.html','Neusic Lab — Music Production Workspace','lab-card.svg']
    ];
    for(const [relative,title,image] of expected){
      const html=await readFile(join(site,...relative.split('/')),'utf8');
      assert.ok(html.includes(`<title>${title}</title>`),`${relative} missing HTML title`);
      assert.ok(html.includes(`<meta property="og:title" content="${title}">`),`${relative} missing og:title`);
      assert.ok(html.includes('<meta property="og:description" content="'),`${relative} missing og:description`);
      assert.ok(html.includes(`<meta property="og:image" content="https://bnsceo.github.io/NeusicLabV1/social/${image}">`),`${relative} missing og:image`);
      assert.ok(html.includes(`<meta name="twitter:title" content="${title}">`),`${relative} missing twitter:title`);
      assert.ok(html.includes('<meta name="twitter:description" content="'),`${relative} missing twitter:description`);
      assert.ok(html.includes(`<meta name="twitter:image" content="https://bnsceo.github.io/NeusicLabV1/social/${image}">`),`${relative} missing twitter:image`);
    }
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
