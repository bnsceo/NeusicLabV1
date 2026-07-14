/* Producer Flow integration hardening for first launch and asynchronous project safety. */
(function(){
'use strict';
const FLOW_KEY='neusic-producer-flow-v1';
const ONBOARD_KEY='neusic-flow-onboarded';
function persist(){
  if(typeof S==='undefined')return;
  try{localStorage.setItem(FLOW_KEY,JSON.stringify({projectMeta:S.projectMeta,padBanks:S.padBanks,padBank:S.padBank,noteRepeat:S.noteRepeat,mpc16Levels:S.mpc16Levels,mpcSwing:S.mpcSwing}));}catch(_){ }
}
function patchSafety(){
  const safety=window.NeusicSafety;if(!safety||safety._producerFlowPersist)return false;
  const original=safety.saveNow;safety.saveNow=async function(...args){persist();return original?.apply(this,args);};safety._producerFlowPersist=true;return true;
}
function init(){
  const firstLaunch=!localStorage.getItem(ONBOARD_KEY);
  if(firstLaunch){document.addEventListener('click',event=>{if(!event.target.closest?.('.flow-template[data-template]'))return;const original=window.confirm;window.confirm=()=>true;queueMicrotask(()=>{window.confirm=original;});},{capture:true,once:true});}
  const saveButton=document.querySelector('button[onclick="saveProjectToFile()"]');if(saveButton)saveButton.title='Save project (.neusic)';
  if(!patchSafety()){let attempts=0;const timer=setInterval(()=>{attempts++;if(patchSafety()||attempts>20)clearInterval(timer);},150);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
