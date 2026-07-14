/* Keeps Professional Arranger state synchronized after IndexedDB recovery and external project restores. */
(function(){
'use strict';
let lastHash='';
const clone=value=>JSON.parse(JSON.stringify(value));
function saved(){return S?.recOpts?.__arranger||null;}
function hash(value){try{return JSON.stringify(value||null);}catch(_){return'';}}
function apply(raw){
  if(!raw||typeof raw!=='object')return;
  S.arrangementBeats=Math.max(64,Number(raw.arrangementBeats)||256);
  S.arrangerSections=Array.isArray(raw.sections)?clone(raw.sections):[];
  S.loopRegion=Object.assign({enabled:false,start:0,end:16},clone(raw.loop||{}));
  S.drumPatterns=raw.drumPatterns&&typeof raw.drumPatterns==='object'?clone(raw.drumPatterns):{A:clone(S.seqSteps||{})};
  S.activePatternId=String(raw.activePatternId||'A');
  if(S.drumPatterns[S.activePatternId])S.seqSteps=clone(S.drumPatterns[S.activePatternId]);
  S.projectMeta=S.projectMeta||{};S.projectMeta.arranger=clone(raw);
  window.syncTimelineMetrics?.();window.renderTracks?.();window.drawRuler?.();window.buildOv?.();
}
function check(){
  const raw=saved(),next=hash(raw);if(!next||next===lastHash)return;
  const live=window.NeusicArranger?.exportState?.(),liveHash=hash(live);
  lastHash=next;if(next!==liveHash)apply(raw);
}
function init(){if(typeof S==='undefined')return;lastHash=hash(saved());setInterval(check,500);document.addEventListener('neusic:project-restored',check);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
