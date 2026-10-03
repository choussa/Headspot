import { createTypstCompiler } from 'typst-wasm';
import { createWorkerThread } from 'typst-wasm/worker/node';
import { readFile } from 'node:fs/promises';
const readMod = async (p) => new WebAssembly.Module(await readFile(new URL('../node_modules/' + p, import.meta.url)));
const mods = {
  'engine.core.wasm': await readMod('typst-wasm/dist/engine/engine.core.wasm'),
  'engine.core2.wasm': await readMod('typst-wasm/dist/engine/engine.core2.wasm'),
  'engine.core3.wasm': await readMod('typst-wasm/dist/engine/engine.core3.wasm'),
};
const wt = () => createWorkerThread(new URL('../node_modules/typst-wasm/dist/worker/worker-thread.js', import.meta.url));
const font = new Uint8Array(await readFile(new URL('../node_modules/@typst-wasm/fonts/dist/files/NewCM10-Regular.otf', import.meta.url)));

// variant A: clearFiles
const c3 = await createTypstCompiler({ backend: 'worker', coreModules: mods, worker: wt });
await c3.addFonts(font);
await c3.addSource('main.typ', '= First');
await c3.clearFiles();
await c3.addSource('main.typ', '= Second');
const ra = await c3.compile({ main: 'main.typ', format: 'svg' });
console.log('clearFiles overwrite:', ra.pages[0].output.length);
await c3.dispose();

// variant B: setMain new source path each time
const c4 = await createTypstCompiler({ backend: 'worker', coreModules: mods, worker: wt });
await c4.addFonts(font);
await c4.addSource('v1.typ', '= First');
await c4.addSource('v2.typ', '= Second');
const rb = await c4.compile({ main: 'v2.typ', format: 'svg' });
console.log('new path each time:', rb.pages[0].output.length);
await c4.dispose();
