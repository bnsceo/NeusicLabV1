export function planImportTargets(selected,fileCount,trackCount=5){
  if(!Number.isInteger(selected)||selected<0||selected>=trackCount||!Number.isInteger(fileCount)||fileCount<1||trackCount<1)return[];
  const count=Math.min(fileCount,trackCount);
  return Array.from({length:count},(_,offset)=>(selected+offset)%trackCount);
}
