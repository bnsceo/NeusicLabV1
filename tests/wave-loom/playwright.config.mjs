import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'.',
  testMatch:'wave-loom.spec.mjs',
  timeout:45_000,
  expect:{timeout:10_000},
  fullyParallel:false,
  workers:1,
  reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
  use:{
    baseURL:'http://127.0.0.1:4173',
    headless:true,
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure',
    permissions:['microphone'],
    launchOptions:{args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}
  },
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}}
  ],
  webServer:{
    command:'python3 -m http.server 4173 --bind 127.0.0.1',
    url:'http://127.0.0.1:4173/wave-loom/',
    reuseExistingServer:true,
    timeout:20_000
  }
});