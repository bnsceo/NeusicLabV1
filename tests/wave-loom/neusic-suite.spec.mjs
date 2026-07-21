import {test,expect} from '@playwright/test';

test('hub landing presents the NeusicWave trio and FAQ responds',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.hub-hero h1')).toContainText('entirely in your browser');
  await expect(page.locator('.nw-tri-rule')).toBeVisible();
  const cards=page.locator('.product-card');
  await expect(cards).toHaveCount(3);
  const destinations=await cards.locator('.cta').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
  expect(destinations).toEqual(['./studio/','./waveform/','./livestudio/']);

  const faq=page.locator('.faq details').first();
  await expect(faq.locator('p')).not.toBeVisible();
  await faq.locator('summary').click();
  await expect(faq.locator('p')).toBeVisible();
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

test('mobile hub stacks the product cards and keeps all three reachable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const cards=page.locator('.product-card');
  await expect(cards).toHaveCount(3);
  for(let index=0;index<3;index++){
    await cards.nth(index).scrollIntoViewIfNeeded();
    await expect(cards.nth(index)).toBeVisible();
  }
  const first=await cards.nth(0).boundingBox();
  const second=await cards.nth(1).boundingBox();
  expect(second.y).toBeGreaterThan(first.y+first.height-1);
});
