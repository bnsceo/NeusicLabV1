import {test,expect} from '@playwright/test';

test('Waveform: hero, entry handoff, four-zone shell, and save gate',async({page})=>{
  await page.goto('/waveform/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#nw-landing h1')).toContainText('sound design studio');
  await expect(page.locator('#nw-landing li')).toHaveCount(3);
  await expect(page.locator('body')).toHaveAttribute('data-product','wave');

  await page.click('#nw-enter');
  await expect(page.locator('body')).toHaveClass(/nw-in-app/);
  expect(await page.evaluate(()=>localStorage.getItem('nw-entered-wave'))).toBe('1');

  await expect(page.locator('#nw-menubar')).toBeVisible();
  await expect(page.locator('#wf-topbar')).toBeVisible();
  await expect(page.locator('#wf-left')).toBeVisible();
  await expect(page.locator('#wf-canvas')).toBeVisible();
  await expect(page.locator('#wf-inspector')).toBeVisible();

  await page.locator('.nw-menu>button',{hasText:'File'}).click();
  await page.locator('.nw-menu-list button',{hasText:'Save'}).click();
  await expect(page.locator('#nw-gate-scrim')).toBeVisible();
  await expect(page.locator('#nw-gate-card h2')).toHaveText('Save is a premium feature');
});

test('Waveform: VIEW menu switches between waveform editor and synth designer',async({page})=>{
  await page.goto('/waveform/',{waitUntil:'domcontentloaded'});
  await page.click('#nw-enter');
  await page.locator('.nw-menu>button',{hasText:'View'}).click();
  await page.locator('.nw-menu-list button',{hasText:'Synth Designer'}).click();
  await expect(page.locator('#wf-synth-view')).toBeVisible();
  await expect(page.locator('#wf-wave-view')).not.toBeVisible();
});

test('LiveStudio: hero, entry handoff, 16-slot loop grid, and live agent default',async({page})=>{
  await page.goto('/livestudio/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#nw-landing h1')).toContainText('real-time beat making');
  await expect(page.locator('body')).toHaveAttribute('data-product','live');

  await page.click('#nw-enter');
  await expect(page.locator('body')).toHaveClass(/nw-in-app/);
  expect(await page.evaluate(()=>localStorage.getItem('nw-entered-live'))).toBe('1');

  await expect(page.locator('#nw-menubar')).toBeVisible();
  await expect(page.locator('#ls-grid .ls-slot')).toHaveCount(16);
  await expect(page.locator('#ls-tracks .ls-track')).toHaveCount(16);

  await page.click('#ls-rec');
  await expect(page.locator('#ls-rec')).toHaveClass(/armed/);

  const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('nw-agent-prefs')||'{}'));
  expect(prefs.performanceMode).toBe('live');
});

test('mobile product pages collapse panels into slide-overs without overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const [url,left] of [['/waveform/','#wf-left'],['/livestudio/','#ls-left']]){
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>localStorage.clear());
    await page.reload({waitUntil:'domcontentloaded'});
    const cta=await page.locator('#nw-enter').boundingBox();
    expect(cta.height,`${url} hero CTA is below the 44px touch target`).toBeGreaterThanOrEqual(44);
    await page.click('#nw-enter');
    const box=await page.locator(left).boundingBox();
    if(box)expect(box.x+box.width).toBeLessThanOrEqual(1);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,`${url} overflows horizontally on a phone`).toBeLessThanOrEqual(1);
  }
});
