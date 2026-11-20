// Bundles the landing page's script into scripts/site/main.js (+ chunks/ for the shared three code and the lazy DJ decks).
// Needs three@0.180 and esbuild in the folder given as the first argument:
//   mkdir -p ~/.cache/claude-build && cd ~/.cache/claude-build && npm i three@0.180.0 esbuild
//   node launch/build.mjs ~/.cache/claude-build/node_modules
import { readdirSync, rmSync, statSync } from 'node:fs'; import { dirname, join } from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), mods = process.argv[2], outdir = join(here, '..', 'scripts/site');
const esbuild = await import(pathToFileURL(join(mods, 'esbuild/lib/main.js')).href);
rmSync(join(outdir, 'chunks'), { recursive: true, force: true }); // chunk names carry a hash: drop the old ones
await esbuild.build({ entryPoints: [join(here, 'src/main.js')], bundle: true, splitting: true, minify: true, format: 'esm', target: 'es2020', nodePaths: [mods], outdir, entryNames: '[name]', chunkNames: 'chunks/[name]-[hash]', logLevel: 'warning' });
for (const f of ['main.js', ...readdirSync(join(outdir, 'chunks')).map((c) => 'chunks/' + c)]) console.log('scripts/site/' + f, (statSync(join(outdir, f)).size / 1024).toFixed(0) + ' KB');
