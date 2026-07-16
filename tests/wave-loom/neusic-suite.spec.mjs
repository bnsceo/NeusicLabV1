import {test,expect} from '@playwright/test';

test('landing explains the three-product journey and mock previews respond',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('3 PRODUCTS / 1 CONNECTED PROJECT')).toBeVisible();
  await expect(page.locator('.journey-step')).toHaveCount(3);
  const destinations=await page.locator('.journey-step').evaluateAll(items=>items.map(item=>item.getAttribute('href')));
  expect(destinations).toEqual(['./live-loop/','./wave-loom/','./studio/']);

  const live=page.locator('[data-preview="live-loop"]');
  await live.locator('[data-demo-action="record"]').click();
  await expect(live).toHaveClass(/demo-recording/);
  await live.locator('.loop-ring').nth(2).click();
  await expect(live.locator('.preview-demo-status')).toContainText('LANE 03');

  const wave=page.locator('[data-preview="wave"]');
  await wave.locator('[data-demo-action="morph"]').click();
  await expect(wave).toHaveClass(/demo-morph/);
  const waveNode=wave.locator('.wave-nodes circle').nth(3);
  await waveNode.evaluate(node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await expect(waveNode).toHaveClass(/mock-selected/);

  const lab=page.locator('[data-preview="lab"]');
  await lab.locator('[data-demo-action="mix"]').click();
  await expect(lab).toHaveAttribute('data-lab-view','mix');
  await lab.locator('[data-demo-action="play"]').click();
  await expect(lab).toHaveClass(/demo-playing/);
});

test('Live Loop and Wave share the suite rail while remaining distinct',async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/live-loop/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.neusic-suite-rail')).toBeVisible();
  await expect(page.locator('.neusic-suite-path a[aria-current="page"]')).toContainText('Neusic Live Loop');
  await expect(page.locator('h1')).toContainText('Capture lightning');
  await expect(page.locator('#trackGrid .loop-track')).toHaveCount(5);

  await page.goto('/wave-loom/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.setItem('neusic-wave-onboarding','1'));
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('.neusic-suite-rail')).toBeVisible();
  await expect(page.locator('.neusic-suite-path a[aria-current="page"]')).toContainText('Neusic Wave');
  await expect(page.locator('.loom-heading h1')).toHaveText('Neusic Wave');
});

test('Neusic Lab exposes the same journey inside the Studio frame',async({page})=>{
  await page.goto('/app/phase-a.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('studio')?.contentDocument?.querySelector('#neusic-lab-suite'),null,{timeout:25_000});
  const frame=page.frameLocator('#studio');
  await expect(frame.locator('#neusic-lab-suite')).toBeVisible();
  await expect(frame.locator('#neusic-lab-suite .current')).toContainText('Lab');
  await expect(frame.locator('#topbar')).toBeVisible();
});

test('mobile landing keeps all three starting points reachable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const steps=page.locator('.journey-step');
  await expect(steps).toHaveCount(3);
  for(let index=0;index<3;index++)await expect(steps.nth(index)).toBeVisible();
  await expect(page.locator('[data-preview="live-loop"] .preview-demo-panel')).toBeVisible();
  await expect(page.locator('[data-preview="wave"] .preview-demo-panel')).toBeVisible();
  await expect(page.locator('[data-preview="lab"] .preview-demo-panel')).toBeVisible();
});
