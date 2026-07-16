import {test,expect} from '@playwright/test';

async function openLiveLoop(page){
  await page.setViewportSize({width:390,height:844});
  await page.goto('/live-loop/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/stage-performance/);
  await expect(page.locator('.loop-track')).toHaveCount(5);
  for(let index=0;index<5;index++)await expect(page.locator(`.loop-track[data-index="${index}"]`)).toBeVisible();
  const positions=await page.locator('.loop-track').evaluateAll(items=>items.map(item=>{
    const rect=item.getBoundingClientRect();
    return{top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,width:rect.width,height:rect.height};
  }));
  expect(positions).toHaveLength(5);
  for(const [index,rect] of positions.entries()){
    expect(rect.top,`lane ${index+1} starts outside the phone viewport`).toBeGreaterThanOrEqual(0);
    expect(rect.top,`lane ${index+1} is below the first phone screen`).toBeLessThan(844);
    expect(rect.left,`lane ${index+1} starts outside the phone width`).toBeGreaterThanOrEqual(0);
    expect(rect.right,`lane ${index+1} extends beyond the phone width`).toBeLessThanOrEqual(391);
    expect(rect.width,`lane ${index+1} collapsed`).toBeGreaterThan(45);
    expect(rect.height,`lane ${index+1} is not a usable channel strip`).toBeGreaterThan(480);
  }
  await expect(page.locator('.neusic-suite-rail')).toBeHidden();
  await page.waitForFunction(()=>window.NeusicLiveLoop?.state?.().ready===true,null,{timeout:25_000});
  await expect(page.locator('#stageMacroDeck')).toBeAttached();
}

test('mobile Live Loop keeps all five lanes visible and records without MIDI',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Fake microphone configuration is Chromium-specific.');
  await openLiveLoop(page);
  for(let index=0;index<5;index++)await expect(page.locator(`.loop-track[data-index="${index}"]`)).toBeVisible();
  await expect(page.locator('#midiBtn')).toBeVisible();
  await expect(page.locator('.mobile-lane-nav')).toHaveCount(0);
  await expect(page.locator('.mobile-performance-controls')).toHaveCount(0);

  const lane1=page.locator('.loop-track[data-index="0"]');
  await lane1.locator('[data-action="record"]').click();
  await expect.poll(()=>lane1.getAttribute('data-state'),{timeout:15_000}).toBe('Recording');
  await page.waitForTimeout(720);
  await lane1.locator('[data-action="record"]').click();
  await expect.poll(()=>page.evaluate(()=>window.NeusicLiveLoop.state().lanes[0]),{timeout:15_000}).toMatchObject({state:'Playing',hasAudio:true});

  const lane2=page.locator('.loop-track[data-index="1"]');
  await lane2.locator('[data-action="record"]').click();
  await expect.poll(()=>page.evaluate(()=>window.NeusicLiveLoop.state().lanes[1].state),{timeout:15_000}).toMatch(/Queued|Recording/);
  await expect.poll(()=>page.evaluate(()=>window.NeusicLiveLoop.state().lanes[1]),{timeout:15_000}).toMatchObject({state:'Playing',hasAudio:true});
});

test('phone stage exposes tactile faders, pan, macro effects, and synth',async({page})=>{
  await openLiveLoop(page);
  await expect(page.locator('.loop-track input[data-control="volume"]')).toHaveCount(5);
  await expect(page.locator('.loop-track input[data-control="pan"]')).toHaveCount(5);
  for(let index=0;index<5;index++){
    await expect(page.locator(`.loop-track[data-index="${index}"] [data-action="record"]`)).toBeVisible();
    await expect(page.locator(`.loop-track[data-index="${index}"] [data-action="mute"]`)).toBeVisible();
    await expect(page.locator(`.loop-track[data-index="${index}"] input[data-control="volume"]`)).toBeVisible();
    await expect(page.locator(`.loop-track[data-index="${index}"] input[data-control="pan"]`)).toBeVisible();
  }
  await expect(page.locator('.stage-xy')).toHaveCount(2);
  await expect(page.locator('#keyboard button')).toHaveCount(13);
  for(const action of ['lofi','octave','reverse','freeze','load','wave'])await expect(page.locator(`[data-stage-action="${action}"]`)).toBeAttached();
  await page.locator('[data-stage-action="lofi"]').click();
  await expect(page.locator('[data-stage-action="lofi"]')).toHaveClass(/active/);
  expect(await page.evaluate(()=>window.NeusicLiveLoop.state().lofi)).toBe(true);
});

test('shared Neusic Agent works offline and explains touch recording',async({page})=>{
  await openLiveLoop(page);
  await page.locator('.neusic-agent-launcher').click();
  await expect(page.locator('.neusic-agent-panel')).toHaveClass(/open/);
  await page.locator('.neusic-agent-compose textarea').fill('How do I record without MIDI on my phone?');
  await page.locator('.neusic-agent-send').click();
  await expect(page.locator('.neusic-agent-message').last()).toContainText('MIDI is optional');
  const context=await page.evaluate(()=>window.NeusicAgent.context());
  expect(context.product).toBe('live-loop');
  expect(context.lanes).toHaveLength(5);
});

test('Neusic Lab restores one track sidebar and one dedicated center workspace',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/app/phase-a.html?v=restoration-test',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('studio')?.contentDocument?.body?.classList.contains('neusic-studio-v4'),null,{timeout:30_000});
  const frame=page.frameLocator('#studio');
  await expect(frame.locator('#studio-v4-shell')).toBeVisible();
  await expect(frame.locator('.studio-v4-left')).toBeVisible();
  await expect(frame.locator('.studio-v4-track-rack > #sidebar')).toHaveCount(1);
  await expect(frame.locator('.studio-v4-center')).toBeVisible();
  await expect(frame.locator('.studio-v4-workspace > #main')).toHaveCount(1);
  await expect(frame.locator('.studio-v4-inspector')).toBeVisible();
  await expect(frame.locator('.neusic-workspace-shell')).toHaveCount(0);
  await expect(frame.locator('.flow-modal')).toHaveCount(0);
  await expect(frame.locator('[aria-label="Primary tools"]')).toHaveCount(0);

  await frame.locator('[data-studio-stage="create"]').click();
  await expect(frame.locator('#studio-v4-title')).toHaveText('Create');
  await frame.locator('[data-studio-tool="drums"]').click();
  await expect(frame.locator('#drawer')).toHaveClass(/studio-v4-panel-visible/);
  await expect(frame.locator('#dp-drums')).toHaveClass(/active/);

  await frame.locator('[data-studio-stage="arrange"]').click();
  await expect(frame.locator('#studio-v4-workspace')).toHaveClass(/arrange-active/);
  await expect(frame.locator('#center')).toBeVisible();
});

test('mobile Lab keeps stage navigation and track drawer reachable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/app/phase-a.html?v=mobile-restoration',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('studio')?.contentDocument?.body?.classList.contains('neusic-studio-v4'),null,{timeout:30_000});
  const frame=page.frameLocator('#studio');
  await expect(frame.locator('#studio-v4-mobile-nav')).toBeVisible();
  await expect(frame.locator('[aria-label="Primary tools"]')).toHaveCount(0);
  await frame.locator('[data-v4-tracks]').click();
  await expect(frame.locator('.studio-v4-left')).toHaveClass(/open/);
  await frame.locator('[data-mobile-stage="capture"]').click();
  await expect(frame.locator('#studio-v4-title')).toHaveText('Capture');
  await expect(frame.locator('#dp-rec')).toHaveClass(/active/);
});
