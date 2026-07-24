export class LookAheadScheduler {
  constructor(context, callback, interval = 25, ahead = .1) {
    this.context = context;
    this.callback = callback;
    this.interval = interval;
    this.ahead = ahead;
    this.running = false;
    this.worker = null;
    this.fallback = 0;
  }
  startFallback() {
    if (!this.running || this.fallback) return;
    this.fallback = setInterval(() => this.tick(), this.interval);
  }
  start() {
    if (this.running) return;
    this.running = true;
    try {
      this.worker = new Worker(new URL('./scheduler-worker.js', import.meta.url));
      this.worker.onmessage = () => this.tick();
      this.worker.onerror = () => {
        this.worker?.terminate();
        this.worker = null;
        this.startFallback();
      };
      this.worker.postMessage({type:'start', interval:this.interval});
    } catch (_) {
      this.worker = null;
      this.startFallback();
    }
  }
  tick() {
    if (!this.running) return;
    this.callback?.(this.context.currentTime, this.context.currentTime + this.ahead);
  }
  stop() {
    this.running = false;
    this.worker?.postMessage({type:'stop'});
    this.worker?.terminate();
    this.worker = null;
    clearInterval(this.fallback);
    this.fallback = 0;
  }
}
