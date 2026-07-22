#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const fromRoot=relative=>path.join(root,...relative.split('/'));
const posix=value=>value.split(path.sep).join('/');

const moves=new Map(Object.entries({
  // Historical root audio copies. Maintained Live Loop modules live in live-loop/src/.
  'AudioWorkspace.js':'archive/legacy-root/audio/AudioWorkspace.js',
  'BitcrusherWorklet.js':'archive/legacy-root/audio/BitcrusherWorklet.js',
  'ForgeBridge.js':'archive/legacy-root/audio/ForgeBridge.js',
  'LoopCaptureWorklet.js':'archive/legacy-root/audio/LoopCaptureWorklet.js',
  'Looper.js':'archive/legacy-root/audio/Looper.js',
  'MidiRouter.js':'archive/legacy-root/audio/MidiRouter.js',
  'PcmRecorder.js':'archive/legacy-root/audio/PcmRecorder.js',
  'PerformanceFx.js':'archive/legacy-root/audio/PerformanceFx.js',
  'Scheduler.js':'archive/legacy-root/audio/Scheduler.js',
  'SpatialReverb.js':'archive/legacy-root/audio/SpatialReverb.js',
  'Synth.js':'archive/legacy-root/audio/Synth.js',
  'TapeDelay.js':'archive/legacy-root/audio/TapeDelay.js',

  // Historical root Live Loop copies. The active product owns its files in live-loop/.
  'app.js':'archive/legacy-root/live-loop/app.js',
  'iphone-record-bridge.js':'archive/legacy-root/live-loop/iphone-record-bridge.js',
  'loop-undo.js':'archive/legacy-root/live-loop/loop-undo.js',
  'mobile-mic-primer.js':'archive/legacy-root/live-loop/mobile-mic-primer.js',
  'mobile-performance.js':'archive/legacy-root/live-loop/mobile-performance.js',
  'mobile-recording-feedback.js':'archive/legacy-root/live-loop/mobile-recording-feedback.js',
  'stage-performance.js':'archive/legacy-root/live-loop/stage-performance.js',
  'styles.css':'archive/legacy-root/live-loop/styles.css',
  'stage-performance.css':'archive/legacy-root/live-loop/stage-performance.css',
  'mobile-lanes-imperative.css':'archive/legacy-root/live-loop/mobile-lanes-imperative.css',
  'mobile-lanes-compact.css':'archive/legacy-root/live-loop/mobile-lanes-compact.css',
  'loop-undo.css':'archive/legacy-root/live-loop/loop-undo.css',
  'mobile-system.css':'archive/legacy-root/live-loop/mobile-system.css',
  'mobile-performance-v2.css':'archive/legacy-root/live-loop/mobile-performance-v2.css',
  'mobile-performance.css':'archive/legacy-root/live-loop/mobile-performance.css',

  // Active landing and shared assets.
  'css/landing/landing-experience.css':'css/landing/landing-experience.css',
  'css/landing/landing-loop.css':'css/landing/landing-loop.css',
  'css/landing/product-home.css':'css/landing/product-home.css',
  'css/landing/site-polish.css':'css/landing/site-polish.css',
  'scripts/landing/landing-experience.js':'scripts/landing/landing-experience.js',
  'scripts/landing/site-polish.js':'scripts/landing/site-polish.js',
  'css/shared/neusic-agent.css':'css/shared/neusic-agent.css',
  'css/shared/neusic-suite.css':'css/shared/neusic-suite.css',
  'scripts/shared/neusic-agent.js':'scripts/shared/neusic-agent.js',
  'scripts/shared/neusic-suite.js':'scripts/shared/neusic-suite.js',

  // Tooling, documentation, and icons.
  'scripts/workers/scheduler-worker.js':'scripts/workers/scheduler-worker.js',
  'start_music.py':'scripts/tools/start_music.py',
  'start_neusic.py':'scripts/tools/start_neusic.py',
  'CLAUDE.md':'docs/development/CLAUDE.md',
  'assets/icons/favicon.png':'assets/icons/favicon.png',
  'assets/icons/favicon.svg':'assets/icons/favicon.svg'
}));

const keepAtRoot=new Set([
  '.gitignore','.nojekyll','CNAME','LICENSE','LICENSE.md','README.md',
  'apple-touch-icon.png','favicon.ico','index.html','manifest.json',
  'manifest.webmanifest','package-lock.json','package.json','robots.txt',
  'sitemap.xml','suite.html'
]);

const fallbackDestination=filename=>{
  const extension=path.extname(filename).toLowerCase();
  if(extension==='.css'||extension==='.js'||extension==='.mjs')return `archive/legacy-root/unclassified/${filename}`;
  if(['.png','.jpg','.jpeg','.webp','.gif','.svg','.ico'].includes(extension))return `assets/images/legacy-root/${filename}`;
  if(extension==='.py'||extension==='.sh')return `scripts/tools/${filename}`;
  if(extension==='.md')return `docs/legacy-root/${filename}`;
  if(extension==='.html'||extension==='.htm')return `archive/legacy-root/pages/${filename}`;
  return null;
};

for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(!entry.isFile()||keepAtRoot.has(entry.name)||entry.name.startsWith('.')||moves.has(entry.name))continue;
  const destination=fallbackDestination(entry.name);
  if(destination)moves.set(entry.name,destination);
}

function moveFile(source,destination){
  const sourcePath=fromRoot(source);
  if(!fs.existsSync(sourcePath))return;
  const destinationPath=fromRoot(destination);
  fs.mkdirSync(path.dirname(destinationPath),{recursive:true});
  if(fs.existsSync(destinationPath)){
    const current=fs.readFileSync(sourcePath);
    const existing=fs.readFileSync(destinationPath);
    if(!current.equals(existing))throw new Error(`Refusing to overwrite a different file at ${destination}`);
    fs.unlinkSync(sourcePath);
    return;
  }
  fs.renameSync(sourcePath,destinationPath);
}

for(const [source,destination] of moves)moveFile(source,destination);

const replacements=new Map([
  ['assets/icons/favicon.svg','assets/icons/favicon.svg'],
  ['assets/icons/favicon.png','assets/icons/favicon.png'],
  ['css/landing/landing-experience.css','css/landing/landing-experience.css'],
  ['css/landing/landing-loop.css','css/landing/landing-loop.css'],
  ['css/landing/product-home.css','css/landing/product-home.css'],
  ['css/landing/site-polish.css','css/landing/site-polish.css'],
  ['scripts/landing/landing-experience.js','scripts/landing/landing-experience.js'],
  ['scripts/landing/site-polish.js','scripts/landing/site-polish.js'],
  ['css/shared/neusic-agent.css','css/shared/neusic-agent.css'],
  ['css/shared/neusic-suite.css','css/shared/neusic-suite.css'],
  ['scripts/shared/neusic-agent.js','scripts/shared/neusic-agent.js'],
  ['scripts/shared/neusic-suite.js','scripts/shared/neusic-suite.js'],
  ['scripts/workers/scheduler-worker.js','scripts/workers/scheduler-worker.js']
]);

const textExtensions=new Set(['.html','.htm','.css','.js','.mjs','.cjs','.json','.md','.py','.svg','.txt','.yml','.yaml']);
const ignoredDirectories=new Set(['.git','node_modules','archive']);

function walk(directory){
  const output=[];
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(entry.isDirectory()&&ignoredDirectories.has(entry.name))continue;
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())output.push(...walk(absolute));
    else if(entry.isFile())output.push(absolute);
  }
  return output;
}

function replaceKnownReference(content,oldName,newPath){
  const escaped=oldName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp(`(["'\\(=:\\s])((?:\\.\\.\\/)+|\\.\\/|\\/NeusicLabV1\\/)?${escaped}([?#][^"'\\)\\s]*)?`,'g');
  return content.replace(pattern,(match,lead,prefix='',suffix='')=>{
    let next;
    if(prefix==='/NeusicLabV1/')next=`/NeusicLabV1/${newPath}`;
    else next=`${prefix}${newPath}`;
    return `${lead}${next}${suffix}`;
  });
}

for(const absolute of walk(root)){
  const relative=posix(path.relative(root,absolute));
  if(!textExtensions.has(path.extname(relative).toLowerCase()))continue;
  let content=fs.readFileSync(absolute,'utf8');
  const original=content;
  for(const [oldName,newPath] of replacements)content=replaceKnownReference(content,oldName,newPath);
  if(content!==original)fs.writeFileSync(absolute,content);
}

// Preserve the public suite.html URL while making suite/ the maintained implementation.
if(fs.existsSync(fromRoot('suite/index.html'))){
  const suitePath=fromRoot('suite.html');
  if(fs.existsSync(suitePath)){
    const archivePath=fromRoot('archive/legacy-root/pages/suite-original.html');
    fs.mkdirSync(path.dirname(archivePath),{recursive:true});
    if(!fs.existsSync(archivePath))fs.copyFileSync(suitePath,archivePath);
  }
  fs.writeFileSync(suitePath,`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./suite/"><link rel="canonical" href="./suite/"><title>Opening Neusic Suite</title></head><body><p><a href="./suite/">Open Neusic Suite</a></p></body></html>\n`);
}

fs.mkdirSync(fromRoot('docs'),{recursive:true});
fs.writeFileSync(fromRoot('docs/REPOSITORY_STRUCTURE.md'),`# Repository structure

The repository root is limited to public entrypoints and project configuration.

- \`index.html\` — GitHub Pages entrypoint
- \`suite.html\` — compatibility redirect to \`suite/\`
- \`app/\` — shared application shell
- \`assets/\` — images, icons, and screenshots
- \`css/\` — landing and shared styles
- \`scripts/\` — browser scripts, workers, tools, and maintenance utilities
- \`live-loop/src/\` — maintained Live Loop audio, MIDI, storage, and instrument modules
- \`live-loop/\`, \`wave-loom/\`, \`waveform/\`, \`livestudio/\`, \`studio/\`, \`suite/\` — product entrypoints
- \`backend/\` — backend services
- \`tests/\` — automated tests
- \`docs/\` — product and engineering documentation
- \`archive/legacy-root/\` — historical root duplicates retained for reference

Do not add feature CSS, JavaScript, audio modules, or screenshots directly to the root.
`);

fs.mkdirSync(fromRoot('archive/legacy-root'),{recursive:true});
fs.writeFileSync(fromRoot('archive/legacy-root/README.md'),`# Legacy root files

These files previously sat at the repository root. They are retained only for historical comparison. Active product code remains in its product folder or under the maintained shared \`css/\`, \`scripts/\`, and \`live-loop/src/\` directories.
`);

if(!fs.existsSync(fromRoot('README.md'))){
  fs.writeFileSync(fromRoot('README.md'),`# NeusicLabV1

NeusicLabV1 contains the connected Neusic Live Loop, Wave, Waveform, LiveStudio, and Lab experiences.

See [docs/REPOSITORY_STRUCTURE.md](docs/REPOSITORY_STRUCTURE.md) for the maintained folder map.
`);
}

const remaining=fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isFile()).map(entry=>entry.name).sort();
const unexpected=remaining.filter(name=>!keepAtRoot.has(name)&&!name.startsWith('.'));
if(unexpected.length)throw new Error(`Unexpected files remain at the repository root: ${unexpected.join(', ')}`);

for(const required of [
  'index.html','live-loop/index.html','live-loop/app.js','live-loop/src/audio/AudioWorkspace.js',
  'css/landing/site-polish.css','scripts/landing/site-polish.js',
  'css/shared/neusic-agent.css','scripts/shared/neusic-agent.js'
]){
  if(!fs.existsSync(fromRoot(required)))throw new Error(`Required maintained file is missing: ${required}`);
}

console.log(`Repository root organized. ${moves.size} root files moved; ${remaining.length} intentional root files remain.`);
