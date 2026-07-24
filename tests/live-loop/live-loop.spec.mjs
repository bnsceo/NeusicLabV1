import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';

function wavTone({sampleRate=48000,seconds=.12,frequency=220}={}){
  const frames=Math.floor(sampleRate*seconds),dataBytes=frames*2,buffer=Buffer.alloc(44+dataBytes);
  buffer.write('RIFF',0);buffer.writeUInt32LE(36+dataBytes,4);buffer.write('WAVE',8);buffer.write('fmt ',12);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(sampleRate,24);
  buffer.writeUInt32LE(sampleRate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(dataBytes,40);
  for(let frame=0;frame<frames;frame++)buffer.writeInt16LE(Math.round(Math.sin(frame/sampleRate*Math.PI*2*frequency)*8191),44+frame*2);
  return buffer;
}
async function open(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('requestfailed',request=>errors.push(`${request.method()} ${request.url()} failed: ${request.failure()?.errorText||'unknown error'}`));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  await page.goto('/live-loop/');
  await expect(page.locator('.loop-track')).toHaveCount(5);
  await expect(page.locator('#keyboard button')).toHaveCount(13);
  await expect(page.locator('#keyboard button').last()).toHaveAttribute('aria-label',/Play C5/);
  await page.locator('#playBtn').click();
  await page.waitForFunction(()=>window.NeusicLiveLoop?.workspace?.context?.state==='running');
  const finalKey=page.locator('#keyboard button').last();
  await finalKey.focus();
  await page.keyboard.down('Enter');
  await expect(finalKey).toHaveAttribute('aria-pressed','true');
  await page.keyboard.up('Enter');
  await expect(finalKey).toHaveAttribute('aria-pressed','false');
  return errors;
}

test('import, recovery, WAV export, and Wave handoff use real audio',async({page},testInfo)=>{
  const errors=await open(page);
  const fixture=testInfo.outputPath('runtime-tone.wav');
  await writeFile(fixture,wavTone());
  await page.locator('#fileInput').setInputFiles(fixture);
  await page.waitForFunction(()=>window.NeusicLiveLoop?.state().lanes[0].hasAudio===true);

  const imported=await page.evaluate(()=>window.NeusicLiveLoop.state());
  expect(imported.lanes[0].name).toBe('runtime-tone');
  expect(imported.masterLength).toBeGreaterThan(0);
  expect(imported.playing).toBe(true);

  await page.waitForTimeout(900);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#sessionRecovery')).toBeVisible();
  await page.locator('#recoverSessionBtn').click();
  await page.waitForFunction(()=>window.NeusicLiveLoop?.state().lanes[0].hasAudio===true);
  const recovered=await page.evaluate(()=>window.NeusicLiveLoop.state());
  expect(recovered.playing).toBe(false);
  expect(recovered.lanes[0].name).toBe('runtime-tone');

  const visibleDownload=page.locator('[data-stage-action="download"]');
  await expect(visibleDownload).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await visibleDownload.click();
  const download=await downloadPromise;
  const downloadedPath=await download.path();
  const header=(await readFile(downloadedPath)).subarray(0,12);
  expect(header.subarray(0,4).toString()).toBe('RIFF');
  expect(header.subarray(8,12).toString()).toBe('WAVE');
  expect(download.suggestedFilename()).toBe('runtime-tone.wav');

  const popupPromise=page.waitForEvent('popup');
  await page.locator('[data-stage-action="wave"]').click();
  const wave=await popupPromise;
  await wave.waitForURL(/\/wave-loom\//,{timeout:20_000});
  await wave.waitForFunction(()=>window.NeusicWaveReliability?.state?.ready===true,null,{timeout:25_000});
  await expect(wave.locator('.persistent-sample-card,.forge-transfer-card').filter({hasText:/runtime-tone/i}).first()).toBeVisible({timeout:20_000});

  expect(errors).toEqual([]);
});

test('fake microphone creates a loop and completes an overdub',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Fake microphone coverage is Chromium-specific.');
  const errors=await open(page);
  const record=page.locator('[data-index="0"] [data-action="record"]');

  await record.click();
  await page.waitForFunction(()=>window.NeusicLiveLoop?.state().lanes[0].state==='Recording',null,{timeout:25_000});
  await page.waitForTimeout(1100);
  await record.click();
  await page.waitForFunction(()=>window.NeusicLiveLoop?.state().lanes[0].hasAudio===true&&window.NeusicLiveLoop?.looper?.activeRecording===null,null,{timeout:20_000});
  const first=await page.evaluate(()=>window.NeusicLiveLoop.state());
  expect(first.masterLength).toBeGreaterThan(.1);

  await record.click();
  await page.waitForFunction(()=>['Queued','Overdubbing'].includes(window.NeusicLiveLoop?.state().lanes[0].state),null,{timeout:20_000});
  await page.waitForFunction(()=>window.NeusicLiveLoop?.looper?.activeRecording===null&&window.NeusicLiveLoop?.state().lanes[0].hasAudio===true,null,{timeout:25_000});
  const overdubbed=await page.evaluate(()=>window.NeusicLiveLoop.state());
  expect(overdubbed.lanes[0].state).toBe('Playing');
  expect(errors).toEqual([]);
});
