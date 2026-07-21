let timer = null;
self.onmessage = event => {
  if (event.data?.type === 'start') {
    clearInterval(timer);
    timer = setInterval(() => self.postMessage({type:'tick',now:performance.now()}), event.data.interval || 25);
  }
  if (event.data?.type === 'stop') {
    clearInterval(timer);
    timer = null;
  }
};
