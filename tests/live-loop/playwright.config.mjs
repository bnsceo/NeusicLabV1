import {defineConfig,devices} from '@playwright/test';
import {fileURLToPath} from 'node:url';

const repositoryRoot=fileURLToPath(new URL('../..',import.meta.url));

export default defineConfig({
  testDir:'.',
  testMatch:'*.spec.mjs',
  timeout:60_000,
  expect:{timeout:15_000},
  fullyParallel:false,
  workers:1,
  reporter:'list',
  use:{
    baseURL:'http://127.0.0.1:4174',
    headless:true,
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    permissions:['microphone'],
    acceptDownloads:true,
    launchOptions:{args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}
  },
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}}
  ],
  webServer:{
    command:'python3 -m http.server 4174 --bind 127.0.0.1',
    cwd:repositoryRoot,
    url:'http://127.0.0.1:4174/live-loop/',
    reuseExistingServer:true,
    timeout:20_000
  }
});
