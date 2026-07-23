import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(path,'utf8');

const scripts=[
  'scripts/shared/neusic-agent.js',
  'scripts/landing/site-polish.js',
  'live-loop/app.js',
  'live-loop/stage-performance.js',
  'live-loop/src/audio/PcmRecorder.js',
  'live-loop/src/audio/Looper.js',
  'live-loop/src/audio/effects/PerformanceFx.js',
  'live-loop/src/audio/effects/BitcrusherWorklet.js',
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

test('Hermes, CrewAI, and Pages builders compile without optional providers',()=>{
  for(const file of ['agents/neusic_agent_server.py','scripts/build_pages.py']){
    const result=spawnSync('python3',['-m','py_compile',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${file} failed Python validation:\n${result.stderr}`);
  }
});

test('Live Loop uses raw PCM capture, five visible lanes, and optional MIDI',async()=>{
  const looper=await read('live-loop/src/audio/Looper.js');
  const recorder=await read('live-loop/src/audio/PcmRecorder.js');
  const stage=await read('live-loop/stage-performance.js');
  const css=await read('live-loop/stage-performance.css');
  const app=await read('live-loop/app.js');
  const html=await read('live-loop/index.html');
  assert.doesNotMatch(looper,/MediaRecorder/);
  assert.match(looper,/new PcmRecorder/);
  assert.match(recorder,/AudioWorkletNode/);
  assert.match(recorder,/createScriptProcessor/);
  assert.match(html,/stage-performance\.css/);
  assert.match(html,/stage-performance\.js/);
  assert.doesNotMatch(html,/mobile-performance\.js/);
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/loop-track\.mobile-active\{display:block!important/);
  for(const action of ['lofi','octave','reverse','freeze','load','wave'])assert.ok(stage.includes(`'${action}'`)||stage.includes(`"${action}"`),`stage macro missing ${action}`);
  assert.match(app,/new PerformanceFx/);
  assert.match(app,/MIDI is optional/);
});

test('global lo-fi performance chain includes a real AudioWorklet bitcrusher',async()=>{
  const effect=await read('live-loop/src/audio/effects/PerformanceFx.js');
  const processor=await read('live-loop/src/audio/effects/BitcrusherWorklet.js');
  assert.match(effect,/audioWorklet\.addModule/);
  assert.match(effect,/neusic-bitcrusher/);
  assert.match(effect,/setLoFi/);
  assert.match(processor,/registerProcessor\('neusic-bitcrusher'/);
  assert.match(processor,/Math\.round\(sample\*step\)\/step/);
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

test('all public products expose the shared Agent and preview builder',async()=>{
  const live=await read('live-loop/index.html');
  const lab=await read('app/phase-a.html');
  const wave=await read('wave-loom/wave-polish.js');
  const landing=await read('scripts/landing/site-polish.js');
  const builder=await read('scripts/build_pages.py');
  for(const source of [live,lab,wave,landing])assert.match(source,/neusic-agent/);
  for(const image of ['neusic-suite-card-v3.png','live-loop-card-v3.png','wave-card-v3.png','lab-card-v3.png'])assert.ok(builder.includes(image),`preview builder missing ${image}`);
  assert.match(builder,/og:image:secure_url/);
  assert.match(builder,/twitter:image:src/);
  assert.match(builder,/image\/png/);
});

test('teaser root hides direct product links and retains the waitlist',async()=>{
  const landingHtml=await read('index.html');
  for(const href of ['./live-loop/','./wave-loom/','./studio/','./waveform/','./livestudio/'])assert.equal(landingHtml.includes(`href="${href}"`),false,`teaser unexpectedly reveals product link ${href}`);
  assert.match(landingHtml,/id="waitlistForm"/);
  assert.match(landingHtml,/entry\.1064572385/);
});

test('Pages build produces PNG link previews and a menu-free landing',async()=>{
  const workflow=await read('.github/workflows/deploy-neusic-pages.yml');
  assert.match(workflow,/python3 scripts\/build_pages\.py _site/);
  const root=await mkdtemp(join(tmpdir(),'neusic-pages-'));
  try{
    const site=join(root,'_site');
    await mkdir(site,{recursive:true});
    await cp('index.html',join(site,'index.html'));
    await cp('live-loop',join(site,'live-loop'),{recursive:true});
    await cp('wave-loom',join(site,'wave-loom'),{recursive:true});
    await cp('waveform',join(site,'waveform'),{recursive:true});
    await cp('livestudio',join(site,'livestudio'),{recursive:true});
    await cp('app',join(site,'studio'),{recursive:true});
    await rename(join(site,'studio','index.html'),join(site,'studio','core.html'));
    await rename(join(site,'studio','phase-a.html'),join(site,'studio','index.html'));
    const builder=join(process.cwd(),'scripts','build_pages.py');
    const result=spawnSync('python3',[builder,site],{encoding:'utf8'});
    assert.equal(result.status,0,`Pages metadata build failed:\n${result.stderr}`);

    const landing=await readFile(join(site,'index.html'),'utf8');
    assert.doesNotMatch(landing,/class="desktop-nav"/);
    assert.doesNotMatch(landing,/id="menuButton"/);
    assert.doesNotMatch(landing,/id="mobileMenu"/);

    const expected=[
      ['index.html','NeusicWave — Beats, Loops, and Full Tracks in Your Browser','neusicwave-hub-card-v1.png'],
      ['waveform/index.html','Waveform — NeusicWave Sound Design Studio','waveform-card-v1.png'],
      ['livestudio/index.html','LiveStudio — NeusicWave Loop Station','livestudio-card-v1.png'],
      ['live-loop/index.html','Neusic Live Loop — Five-Lane Performance Instrument','live-loop-card-v3.png'],
      ['wave-loom/index.html','Neusic Wave — Sample Performance & Sound Design','wave-card-v3.png'],
      ['studio/index.html','Neusic Lab — Music Production Workspace','lab-card-v3.png']
    ];
    for(const [relative,title,image] of expected){
      const html=await readFile(join(site,...relative.split('/')),'utf8');
      const imageUrl=`https://bnsceo.github.io/NeusicLabV1/social/${image}`;
      assert.ok(html.includes(`<title>${title}</title>`),`${relative} missing HTML title`);
      assert.ok(html.includes(`<meta property="og:title" content="${title}">`),`${relative} missing og:title`);
      assert.ok(html.includes('<meta property="og:description" content="'),`${relative} missing og:description`);
      assert.ok(html.includes(`<meta property="og:image" content="${imageUrl}">`),`${relative} missing og:image`);
      assert.ok(html.includes(`<meta property="og:image:secure_url" content="${imageUrl}">`),`${relative} missing og:image:secure_url`);
      assert.ok(html.includes('<meta property="og:image:type" content="image/png">'),`${relative} missing PNG type`);
      assert.ok(html.includes(`<meta name="twitter:title" content="${title}">`),`${relative} missing twitter:title`);
      assert.ok(html.includes(`<meta name="twitter:image" content="${imageUrl}">`),`${relative} missing twitter:image`);

      const png=await readFile(join(site,'social',image));
      assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10],`${image} is not a PNG`);
      assert.equal(png.readUInt32BE(16),1200,`${image} width is not 1200`);
      assert.equal(png.readUInt32BE(20),630,`${image} height is not 630`);
    }
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
