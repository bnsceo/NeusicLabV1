(() => {
  'use strict';
  if (window.NeusicStudioTransfer) return;

  const R = window.NeusicWaveReliability;
  const P = () => window.NeusicSamplePerformance;

  async function sendBuffer(buffer,{name,sourceSample,slices,metadata}={}) {
    if (!buffer) throw new Error('No audio is available to send to Studio.');
    const core=R.loom?.state||{};
    const patch=R.loom?.getPatch?.()||null;
    const transfer=await R.store.createStudioTransfer({
      buffer,
      name:name||sourceSample?.name||'Wave Loom Audio',
      patch,
      tempo:core.tempo,
      root:core.root,
      scale:core.scale,
      slices:slices||sourceSample?.slices||[],
      metadata:{source:'wave-loom',engineMode:R.state.engineMode,sampleId:sourceSample?.id||null,...(metadata||{})}
    });
    R.setStatus(`${transfer.name} is ready for Classic Studio.`,'live');
    const url=new URL('../studio/',location.href);url.searchParams.set('waveTransfer',transfer.id);url.searchParams.set('source','wave-loom');
    location.href=url.href;
    return transfer;
  }

  async function sendSample(sample=R.selectedSample()) {
    if(!sample){R.setStatus('Select a persistent Forge sample first.','error');return;}
    try{
      await R.workspace.resume();
      const buffer=P()?.renderEditedBuffer(sample,false)||sample.buffer;
      return sendBuffer(buffer,{name:sample.name,sourceSample:sample,metadata:{kind:'sample'}});
    }catch(error){console.error(error);R.setStatus(error.message||'The sample could not be sent to Studio.','error');}
  }

  function buildButton(){
    const actions=document.querySelector('.top-actions');if(!actions||document.getElementById('sendStudioBtn'))return;
    const button=document.createElement('button');button.id='sendStudioBtn';button.className='command-button studio-command';button.type='button';button.textContent='SEND STUDIO';button.title='Create a real audio track in Classic Studio';
    button.onclick=()=>sendSample();actions.insertBefore(button,actions.querySelector('a'));
  }

  const api={sendBuffer,sendSample};window.NeusicStudioTransfer=api;
  R.ready.then(value=>{if(value)buildButton();});
})();