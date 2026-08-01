(() => {
  'use strict';

  const mediaDevices=navigator.mediaDevices;
  if(!window.isSecureContext||!mediaDevices?.getUserMedia)return;

  const nativeGetUserMedia=mediaDevices.getUserMedia.bind(mediaDevices);
  let primedStream=null;
  let primedPromise=null;
  let sharedContext=null;

  const streamIsLive=stream=>Boolean(stream?.getAudioTracks?.().some(track=>track.readyState==='live'&&track.enabled));
  const announce=message=>{
    const output=document.getElementById('statusMessage');
    if(output)output.textContent=message;
    window.dispatchEvent(new CustomEvent('neusic:live-loop-status',{detail:{message}}));
  };

  const adoptContext=context=>{
    if(!context||context.state==='closed')return sharedContext;
    sharedContext=context;
    window.__neusicMobileAudioContext=context;
    return context;
  };

  const currentContext=()=>window.NeusicLiveLoop?.workspace?.context||sharedContext||null;
  const unlock=async()=>{
    const context=currentContext();
    if(!context)return null;
    if(context.state!=='running')await context.resume();
    return context;
  };

  const requestNativeMic=async()=>{
    try{
      return await nativeGetUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:1}}});
    }catch(preferredError){
      if(preferredError?.name==='NotAllowedError'||preferredError?.name==='SecurityError')throw preferredError;
      return nativeGetUserMedia({audio:true});
    }
  };

  const prime=()=>{
    if(streamIsLive(primedStream))return Promise.resolve(primedStream);
    if(primedPromise)return primedPromise;

    announce('Opening the microphone…');
    primedPromise=requestNativeMic()
      .then(stream=>{
        const track=stream.getAudioTracks()[0];
        if(!track||track.readyState!=='live'){
          stream.getTracks().forEach(item=>item.stop());
          throw new Error('The phone granted permission but did not return a live microphone track.');
        }
        track.enabled=true;
        primedStream=stream;
        window.__neusicPrimedMicStream=stream;
        track.addEventListener('ended',()=>{
          if(primedStream===stream)primedStream=null;
          if(window.__neusicPrimedMicStream===stream)window.__neusicPrimedMicStream=null;
        },{once:true});
        announce('Microphone active. Starting the selected lane…');
        return stream;
      })
      .catch(error=>{
        const blocked=error?.name==='NotAllowedError'||error?.name==='SecurityError';
        announce(blocked?'Microphone blocked. Enable it for this site, reload, and tap REC.':(error?.message||'The microphone could not start.'));
        throw error;
      })
      .finally(()=>{primedPromise=null;});

    primedPromise.catch(()=>{});
    return primedPromise;
  };

  window.__neusicPrimeMic=prime;
  window.__neusicUnlockAudio=unlock;
  window.NeusicMobileMicPrimer={
    prime,
    unlock,
    adoptContext,
    get context(){return sharedContext;},
    get stream(){return streamIsLive(primedStream)?primedStream:null;},
    diagnostics:()=>({
      secureContext:window.isSecureContext,
      contextState:currentContext()?.state||'not-created',
      microphoneLive:streamIsLive(primedStream),
      trackState:primedStream?.getAudioTracks?.()[0]?.readyState||'none'
    })
  };
})();