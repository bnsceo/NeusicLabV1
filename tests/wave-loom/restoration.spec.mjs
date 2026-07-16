import {test,expect} from '@playwright/test';

async function openLiveLoop(page){
  await page.setViewportSize({width:390,height:844});
  await page.goto('/live-loop/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.NeusicLiveLoop?.state?.().ready===true,null,{timeout:25_000});
  await expect(page.locator('#mobileLaneNav')).toBeVisible();
  await expect(page.locator('#mobilePerformanceControls')).toBeVisible();
}

test('mobile Live Loop records synchronized lanes without MIDI',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Fake microphone configuration is Chromium-specific.');
  await openLiveLoop(page);
  await expect(page.locator('.mobile-lane-button')).toHaveCount(5);
  await expect(page.locator('.loop-track.mobile-active')).toHaveCount(1);
  await expect(page.locator('[data-mobile-action="midi"]')).toContainText('MIDI OPTIONAL');

  await page.locator('[data-lane-index="0"]').click();
  await page.locator('[data-mobile-action="record"]').click();
  await expect.poll(()=>page.locator('.loop-track.mobile-active').getAttribute('data-state'),{timeout:15_000}).toBe('Recording');
  await page.waitForTimeout(720);
  await page.locator('[data-mobile-action="record"]').click();
  await expect.poll(()=>page.evaluate(()=>window.NeusicLiveLoop.state().lanes[0]),{timeout:15_000}).toMatchObject({state:'Playing',hasAudio:true});

  await page.locator('[data-lane-index="1"]').click();
  await expect(page.locator('.loop-track.mobile-active')).toHaveAttribute('data-index','1');
  await page.locator('[data-mobile-action="record"]').click();
  await expect.poll(()=>page.evaluate(()=>window.NeusicLiveLoop.state().lanes[1].state),{timeout:15_000}).toMatch(/Queued|Recording/);
  await expect.poll(()=>page.evaluate(()=>window.NeusicLiveLoop.state().lanes[1]),{timeout:15_000}).toMatchObject({state:'Playing',hasAudio:true});
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
