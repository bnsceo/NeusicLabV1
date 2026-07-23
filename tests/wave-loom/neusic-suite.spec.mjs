import {test,expect} from '@playwright/test';

test('teaser landing presents the NeusicWave waitlist without revealing products',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('h1')).toContainText('Something New');
  await expect(page.locator('#waitlistForm')).toBeVisible();
  await expect(page.locator('#email')).toHaveAttribute('name','entry.1064572385');
  await expect(page.locator('#waitlistForm')).toHaveAttribute('action',/1FAIpQLSeld6WZQXpL0rRkWHFazCvSHs6FrlXYmvyQo8uyZKx3kOWhQw\/formResponse/);
  await expect(page.getByRole('link',{name:'TikTok'})).toHaveAttribute('href','https://www.tiktok.com/@neusicwave');
  await expect(page.getByRole('link',{name:'Instagram'})).toHaveAttribute('href','https://www.instagram.com/neusicwave/');
  await expect(page.locator('.product-card')).toHaveCount(0);
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

test('mobile teaser keeps the waitlist usable without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const form=page.locator('#waitlistForm');
  await form.scrollIntoViewIfNeeded();
  await expect(form).toBeVisible();
  const inputHeight=await page.locator('#email').evaluate(element=>element.getBoundingClientRect().height);
  const buttonHeight=await page.locator('#waitlistForm button[type="submit"]').evaluate(element=>element.getBoundingClientRect().height);
  expect(inputHeight,'email field is below the 44px touch target').toBeGreaterThanOrEqual(44);
  expect(buttonHeight,'waitlist button is below the 44px touch target').toBeGreaterThanOrEqual(44);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow,'teaser landing overflows horizontally on a phone').toBeLessThanOrEqual(1);
});
