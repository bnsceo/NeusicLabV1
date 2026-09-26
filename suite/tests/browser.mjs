import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright`));}
const base=process.env.SUITE_TEST_URL||'http://127.0.0.1:4174/suite/?test=1';
const output=new URL('./evidence/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1600,height:1000},permissions:['microphone']});
const page=await context.newPage();const errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
const results=[];
async function check(name,fn){await fn();results.push(name);console.log(`PASS ${name}`);}
try{
  await page.goto(base);await page.getByText('Record your voice, import audio',{exact:false}).waitFor();
  await check('Empty project has exactly five lanes and no placeholder audio',async()=>{assert.equal(await page.locator('[data-lane]').count(),5);assert.equal(await page.evaluate(()=>__suite.assets.size),0);});
  // Exercise actual browser AudioWorklet with Chromium fake mic, not a mocked AudioContext.
  await page.locator('#loop-bars').selectOption('1');await page.locator('#bpm').fill('220');await page.locator('#bpm').dispatchEvent('change');
  await page.locator('[data-action="record-lane"][data-index="0"]').first().click();
  await page.waitForFunction(()=>__suite.project.lanes[0].layers.length===1,{},{timeout:15000});
  await check('Microphone worklet captures exact one-bar duration',async()=>{
    const result=await page.evaluate(()=>{const a=__suite.assets.get(__suite.project.lanes[0].layers[0]);return{frames:a.channels[0].length,sr:a.sampleRate,peak:Math.max(...a.channels[0].subarray(0,10000).map(Math.abs))};});
    assert.equal(result.frames,Math.round(4*60/220*result.sr));assert.ok(result.peak>0,'fake microphone produced real nonzero PCM');
  });
  await page.locator('[data-action="record-lane"][data-index="0"]').first().click();
  await page.waitForFunction(()=>__suite.project.lanes[0].layers.length===2,{},{timeout:15000});
  await check('Overdub retains two independent assets',async()=>{assert.equal(await page.evaluate(()=>new Set(__suite.project.lanes[0].layers).size),2);});
  await page.locator('#stop').click();
  await page.locator('[data-action="live-to-studio"]').click();
  await check('Live → Studio transfers both takes as separate clips',async()=>{assert.equal(await page.locator('.clip').count(),2);assert.equal(await page.evaluate(()=>__suite.project.tracks[0].clips.length),2);});
  await page.evaluate(()=>__suite.saveNow());await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.clip').length===2);
  await check('Reload restores original PCM and shared arrangement',async()=>{const r=await page.evaluate(()=>({layers:__suite.project.lanes[0].layers.length,clips:__suite.project.tracks[0].clips.length,assets:__suite.assets.size}));assert.equal(r.layers,2);assert.equal(r.clips,2);assert.ok(r.assets>=2);});
  await page.locator('nav [data-view="live"]').click();await page.locator('[data-action="lane-to-loom"]').click();
  await page.locator('[data-action="equal"]').click();
  await check('Wave Loom maps exactly 16 clickable pads',async()=>{assert.equal(await page.locator('[data-pad]').count(),16);assert.equal(await page.locator('[data-pad]:enabled').count(),16);});
  await page.locator('[data-pad="0"]').click();await page.locator('[data-pad="1"]').click();
  await check('Pad playback uses one active source for choke mode',async()=>{assert.equal(await page.evaluate(()=>!!__suite.audio.padNode),true);});
  await page.locator('[data-slice="start"]').fill('0.080');await page.locator('[data-slice="start"]').dispatchEvent('change');
  await page.locator('[data-action="sequence-record"]').click();
  await page.waitForTimeout(180);await page.locator('[data-pad="0"]').click();await page.waitForTimeout(140);await page.locator('[data-pad="1"]').click();
  await page.locator('[data-action="sequence-record"]').click();
  await check('Pad recording creates timed events',async()=>{assert.ok(await page.evaluate(()=>__suite.project.loom.events.length>=2));});
  await page.locator('[data-action="sequence-to-studio"]').click();
  await check('Wave Loom → Studio preserves pattern and adds rendered audio',async()=>{const s=await page.evaluate(()=>({patterns:__suite.project.sequences.length,tracks:__suite.project.tracks.length,events:__suite.project.sequences[0].events.length}));assert.equal(s.patterns,1);assert.equal(s.tracks,2);assert.ok(s.events>=2);});
  await page.locator('.clip').last().click();await page.locator('[data-action="duplicate-clip"]').click();
  await check('Timeline duplicate and Undo work',async()=>{assert.equal(await page.locator('.clip').count(),4);await page.locator('#undo').click();assert.equal(await page.locator('.clip').count(),3);});
  await page.locator('#play').click();
  await check('Studio playback advances from the audio clock',async()=>{const first=await page.evaluate(()=>__suite.audio.beat(__suite.project.bpm));await page.waitForTimeout(250);const next=await page.evaluate(()=>__suite.audio.beat(__suite.project.bpm));assert.ok(next>first);});
  await page.locator('#stop').click();
  await check('Offline song export contains nonzero audio',async()=>{
    const r=await page.evaluate(async()=>{const a=await __suite.audio.render(__suite.project,__suite.assets);let peak=0;for(const n of a.channels[0])peak=Math.max(peak,Math.abs(n));return{sr:a.sampleRate,channels:a.channels.length,frames:a.channels[0].length,peak};});
    assert.equal(r.sr,48000);assert.equal(r.channels,2);assert.ok(r.frames>48000);assert.ok(r.peak>0);
  });
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="export-song"]').click();const download=await downloadPromise;assert.ok(download.suggestedFilename().endsWith('.wav'));
  await check('Export button delivers a WAV download',async()=>assert.equal(await download.failure(),null));
  const portable=page.waitForEvent('download');await page.locator('#save-project').click();const file=await portable;const path=await file.path();
  await page.locator('#project-file').setInputFiles(path);await page.getByText('Project opened.',{exact:false}).waitFor();
  await check('Portable project round trip keeps takes and arrangement',async()=>{assert.equal(await page.evaluate(()=>__suite.project.lanes[0].layers.length),2);assert.equal(await page.locator('.clip').count(),3);});
  // Visual evidence uses an explicitly synthesized demo in a separate browser context.
  const visual=await browser.newContext({viewport:{width:1600,height:1000}}),v=await visual.newPage();
  await v.goto(base);await v.locator('[data-action="demo"]').waitFor();await v.locator('[data-action="demo"]').click();await v.locator('.take-list [data-action="take-to-loom"]').waitFor();
  await v.screenshot({path:`${output}desktop-live.png`,fullPage:true});
  await v.locator('[data-action="lane-to-loom"]').click();await v.locator('[data-pad="0"]').waitFor();await v.screenshot({path:`${output}desktop-loom.png`,fullPage:true});
  await v.locator('nav [data-view="live"]').click();await v.locator('[data-action="live-to-studio"]').click();await v.screenshot({path:`${output}desktop-studio.png`,fullPage:true});
  for(const width of [390,768]){
    await v.setViewportSize({width,height:844});
    for(const screen of ['live','loom','studio']){
      await v.locator(`nav [data-view="${screen}"]`).click();await v.screenshot({path:`${output}${width}-${screen}.png`,fullPage:true});
      await check(`${width}px ${screen} has no page-level horizontal overflow`,async()=>{const size=await v.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(size.doc<=size.viewport+1,JSON.stringify(size));});
    }
  }
  await visual.close();
  await check('No uncaught browser errors or missing resources',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);});
  console.log(JSON.stringify({passed:results.length,results,errors,failed,evidence:output},null,2));
}finally{await browser.close();}
