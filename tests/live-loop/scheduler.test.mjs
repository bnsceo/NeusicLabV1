import test from 'node:test';
import assert from 'node:assert/strict';
import {LookAheadScheduler} from '../../live-loop/src/audio/Scheduler.js';

test('scheduler uses its shipped worker and falls back after asynchronous worker failure',()=>{
  const originalWorker=globalThis.Worker;
  const originalSetInterval=globalThis.setInterval;
  const originalClearInterval=globalThis.clearInterval;
  let instance=null,intervalCallback=null,terminated=false,callbackTicks=0;
  globalThis.Worker=class{
    constructor(url){this.url=url;instance=this;}
    postMessage(){}
    terminate(){terminated=true;}
  };
  globalThis.setInterval=callback=>{intervalCallback=callback;return 77;};
  globalThis.clearInterval=()=>{};
  try{
    const scheduler=new LookAheadScheduler({currentTime:2},()=>callbackTicks++);
    scheduler.start();
    assert.match(String(instance.url),/\/live-loop\/src\/audio\/scheduler-worker\.js$/);
    instance.onerror(new Error('worker load failed'));
    assert.equal(terminated,true);
    assert.equal(scheduler.worker,null);
    assert.equal(scheduler.fallback,77);
    intervalCallback();
    assert.equal(callbackTicks,1);
    scheduler.stop();
    assert.equal(scheduler.fallback,0);
  }finally{
    globalThis.Worker=originalWorker;
    globalThis.setInterval=originalSetInterval;
    globalThis.clearInterval=originalClearInterval;
  }
});
