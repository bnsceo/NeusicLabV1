(() => {
  'use strict';
  const ready=()=>window.NeusicLiveLoop?.state?.().ready;
  const setRange=(id,value)=>{
    const input=document.getElementById(id);if(!input)return;
    input.value=String(Math.round(value));
    input.dispatchEvent(new Event('input',{bubbles:true}));
  };
  function makeButton(action,title,label,extra=''){
    const button=document.createElement('button');
    button.type='button';button.className=`stage-macro-button${extra?` ${extra}`:''}`;button.dataset.stageAction=action;
    button.innerHTML=`<strong>${title}</strong><span>${label}</span>`;
    return button;
  }
  function bindXY(element,{xId,xMin,xMax,yId,yMin,yMax}){
    const apply=event=>{
      const rect=element.getBoundingClientRect();
      const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)));
      const y=Math.max(0,Math.min(1,(event.clientY-rect.top)/Math.max(1,rect.height)));
      element.style.setProperty('--x',`${(x*100).toFixed(1)}%`);
      element.style.setProperty('--y',`${(y*100).toFixed(1)}%`);
      setRange(xId,xMin+x*(xMax-xMin));
      setRange(yId,yMax-y*(yMax-yMin));
    };
    element.addEventListener('pointerdown',event=>{event.preventDefault();element.setPointerCapture?.(event.pointerId);apply(event);});
    element.addEventListener('pointermove',event=>{if(element.hasPointerCapture?.(event.pointerId))apply(event);});
  }
  function build(){
    if(document.getElementById('stageMacroDeck'))return;
    document.body.classList.add('stage-performance');
    const deck=document.createElement('section');deck.id='stageMacroDeck';deck.className='stage-macro-deck';deck.setAttribute('aria-label','Live performance macro controls');
    const actions=document.createElement('div');actions.className='stage-macro-actions';
    actions.innerHTML='<div class="stage-selected"><span>SELECTED LANE</span><b id="stageSelectedLane">01</b></div>';
    actions.append(
      makeButton('lofi','LO-FI','CRUSH'),
      makeButton('octave','OCT −1','BASS'),
      makeButton('reverse','REVERSE','FLIP'),
      makeButton('freeze','FREEZE','SPACE'),
      makeButton('load','LOAD','SAMPLE'),
      makeButton('wave','SEND','WAVE')
    );
    const delay=document.createElement('div');delay.className='stage-xy stage-delay';delay.style.setProperty('--x','28%');delay.style.setProperty('--y','72%');delay.innerHTML='<header><span>TAPE DELAY</span><b>XY</b></header><div class="stage-xy-dot"></div><footer><span>TIME →</span><span>↑ MIX</span></footer>';
    const space=document.createElement('div');space.className='stage-xy stage-space';space.style.setProperty('--x','36%');space.style.setProperty('--y','76%');space.innerHTML='<header><span>SPACE REVERB</span><b>XY</b></header><div class="stage-xy-dot"></div><footer><span>SIZE →</span><span>↑ MIX</span></footer>';
    deck.append(actions,delay,space);
    document.querySelector('.loop-deck')?.after(deck);
    bindXY(delay,{xId:'delayTime',xMin:40,xMax:1200,yId:'delayMix',yMin:0,yMax:100});
    bindXY(space,{xId:'reverbSize',xMin:20,xMax:500,yId:'reverbMix',yMin:0,yMax:100});
    actions.addEventListener('click',event=>{
      const button=event.target.closest('[data-stage-action]');if(!button||!ready())return;
      const api=window.NeusicLiveLoop,action=button.dataset.stageAction;
      if(action==='lofi')button.classList.toggle('active',api.toggleLoFi());
      if(action==='octave'){api.toggleOctave();button.classList.toggle('active',api.state().lanes[api.selectedTrack].rate===.5);}
      if(action==='reverse'){api.toggleReverse();button.classList.toggle('active',api.state().lanes[api.selectedTrack].reverse);}
      if(action==='freeze'){api.toggleFreeze();button.classList.toggle('active');}
      if(action==='load')api.loadSelected();
      if(action==='wave')api.sendSelected();
    });
    syncSelection();
  }
  function syncSelection(){
    if(!ready())return;
    const state=window.NeusicLiveLoop.state(),selected=state.selected,lane=state.lanes[selected];
    const output=document.getElementById('stageSelectedLane');if(output)output.textContent=String(selected+1).padStart(2,'0');
    const octave=document.querySelector('[data-stage-action="octave"]');if(octave)octave.classList.toggle('active',lane?.rate===.5);
    const reverse=document.querySelector('[data-stage-action="reverse"]');if(reverse)reverse.classList.toggle('active',Boolean(lane?.reverse));
    const lofi=document.querySelector('[data-stage-action="lofi"]');if(lofi)lofi.classList.toggle('active',Boolean(state.lofi));
  }
  addEventListener('neusic:live-loop-ready',build);
  addEventListener('neusic:live-loop-select',syncSelection);
  addEventListener('neusic:live-loop-track',syncSelection);
  if(ready())build();else document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>ready()?build():null,200));
})();
