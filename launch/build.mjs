// Bundles the pad board into scripts/site/pads.js. Needs three@0.180 and esbuild in the folder given as the first argument:
//   mkdir -p ~/.cache/claude-build && cd ~/.cache/claude-build && npm i three@0.180.0 esbuild
//   node launch/build.mjs ~/.cache/claude-build/node_modules
import { writeFileSync } from 'node:fs'; import { dirname, join } from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), mods = process.argv[2];
const esbuild = await import(pathToFileURL(join(mods, 'esbuild/lib/main.js')).href);
const out = await esbuild.build({ entryPoints: [join(here, 'src/pads.js')], bundle: true, minify: true, format: 'esm', write: false, target: 'es2020', nodePaths: [mods] });
writeFileSync(join(here, '..', 'scripts/site/pads.js'), out.outputFiles[0].text); console.log('scripts/site/pads.js', (out.outputFiles[0].text.length / 1024).toFixed(0) + ' KB');
