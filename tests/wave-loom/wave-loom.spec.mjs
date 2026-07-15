import {test,expect} from '@playwright/test';

async function openLoom(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('neusic-wave-onboarding','1');
    localStorage.setItem('neusic-wave-mobile-workspace','loom');
  });
  await page.goto('/wave-loom/?automation=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.NeusicWaveReliability?.state?.ready===true,null,{timeout:20_000});
  return errors;
}

test('reliability modules boot without page errors',async({page})=>{
  const errors=await openLoom(page);
  const modules=await page.evaluate(()=>({
    workspace:Boolean(window.NeusicAudioWorkspace?.supported),
    store:Boolean(window.NeusicWaveProjectStore),
    reliability:Boolean(window.NeusicWaveReliability?.state.ready),
    capture:Boolean(window.NeusicNeuCapture),
    performance:Boolean(window.NeusicSamplePerformance),
    editor:Boolean(window.NeusicForgeEditor),
    mobile:Boolean(window.NeusicWaveMobileWorkspaces),
    transfer:Boolean(window.NeusicStudioTransfer),
    export:Boolean(window.NeusicExpandedExport)
  }));
  expect(modules).toEqual({workspace:true,store:true,reliability:true,capture:true,performance:true,editor:true,mobile:true,transfer:true,export:true});
  expect(errors).toEqual([]);
});

test('persistent sample library survives reload',async({page})=>{
  await openLoom(page);
  const name=`Automation Tone ${Date.now()}`;
  await page.evaluate(async sampleName=>{
    const workspace=window.NeusicAudioWorkspace;
    const ctx=workspace.ensure();
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.2),ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.sin(i/ctx.sampleRate*Math.PI*2*220)*.25;
    await window.NeusicWaveReliability.addSample({buffer,name:sampleName,source:'automation'});
  },name);
  await expect(page.locator('.persistent-sample-card').filter({hasText:name})).toHaveCount(1);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.NeusicWaveReliability?.state?.ready===true);
  await expect(page.locator('.persistent-sample-card').filter({hasText:name})).toHaveCount(1);
});

test('AudioWorklet NeuCapture arms with a fake microphone',async({page,browserName})=>{
  test.skip(browserName!=='chromium','The fake-media configuration is Chromium-specific.');
  await openLoom(page);
  await page.locator('#micBtn').click();
  await page.waitForFunction(()=>window.NeusicNeuCapture?.state?.armed===true,null,{timeout:15_000});
  await expect(page.locator('#captureBtn')).toBeEnabled();
  const details=await page.evaluate(()=>({sameContext:window.NeusicAudioWorkspace.context===window.NeusicWaveLoom.state.audio.ctx||window.NeusicWaveLoom.state.audio.ctx===null,worklet:Boolean(window.NeusicNeuCapture.state.node)}));
  expect(details.worklet).toBe(true);
  expect(details.sameContext).toBe(true);
  await page.locator('#micBtn').click();
  await page.waitForFunction(()=>window.NeusicNeuCapture?.state?.armed===false);
});

test('sample engine exposes true sample and granular node controls',async({page})=>{
  await openLoom(page);
  await page.locator('#performanceEngine').selectOption('sample');
  await expect(page.locator('#nodeSampleAssignment')).toBeVisible();
  await expect(page.locator('[data-node-source]')).toBeVisible();
  await page.locator('#performanceEngine').selectOption('granular');
  expect(await page.evaluate(()=>window.NeusicWaveReliability.state.engineMode)).toBe('granular');
  await page.locator('#performanceEngine').selectOption('hybrid');
  expect(await page.evaluate(()=>window.NeusicWaveReliability.state.engineMode)).toBe('hybrid');
});

test('mobile workspaces make Capture, Loom, Forge, and Inspector separately usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openLoom(page);
  const nav=page.locator('#waveWorkspaceNav');
  await expect(nav).toBeVisible();
  for(const name of ['capture','loom','forge','inspect']){
    await page.locator(`[data-wave-workspace-button="${name}"]`).click();
    await expect(page.locator('body')).toHaveAttribute('data-wave-workspace',name);
  }
  await page.locator('[data-wave-workspace-button="loom"]').click();
  await expect(page.locator('#mobileLoomTools')).toBeVisible();
  await page.locator('[data-add-node]').click();
  expect(await page.evaluate(()=>window.NeusicWaveLoom.state.nodes.length)).toBeGreaterThan(8);
});

test('expanded export dialog presents production render options',async({page})=>{
  await openLoom(page);
  await page.locator('#exportBtn').click();
  const dialog=page.locator('#expandedExportDialog');
  await expect(dialog).toHaveAttribute('open','');
  await expect(dialog.locator('[data-export-rate]')).toHaveValue('48000');
  await expect(dialog.locator('[data-export-depth]')).toHaveValue('24');
  await expect(dialog.locator('[data-export-stem] option[value="stems"]')).toHaveCount(1);
});

test('Wave Loom transfer creates a real Classic Studio audio track',async({page})=>{
  await openLoom(page);
  const transferId=await page.evaluate(async()=>{
    const workspace=window.NeusicAudioWorkspace,ctx=workspace.ensure(),buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.15),ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.sin(i/ctx.sampleRate*Math.PI*2*330)*.2;
    const record=await window.NeusicWaveProjectStore.createStudioTransfer({buffer,name:'Automation Wave Transfer',tempo:112,root:0,scale:'minor',metadata:{automation:true}});
    return record.id;
  });
  await page.goto(`/app/phase-a.html?waveTransfer=${encodeURIComponent(transferId)}&source=wave-loom`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('studio')?.contentWindow?.NeusicWaveTransfer?.trackId,null,{timeout:25_000});
  const result=await page.evaluate(()=>{
    const win=document.getElementById('studio').contentWindow;
    const bridge=win.__NeusicStudioBridge;
    const transfer=win.NeusicWaveTransfer;
    const track=bridge.S.tracks.find(item=>item.id===transfer.trackId);
    return{name:track?.name,buffer:Boolean(bridge.S.buffers[transfer.bufferId]?.buffer),clips:track?.clips?.length};
  });
  expect(result).toEqual({name:'Automation Wave Transfer',buffer:true,clips:1});
});