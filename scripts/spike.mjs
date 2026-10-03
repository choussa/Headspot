import { createTypstCompiler } from 'typst-wasm';
import { createWorkerThread } from 'typst-wasm/worker/node';
import { readFile } from 'node:fs/promises';

const readMod = async (p) =>
  new WebAssembly.Module(await readFile(new URL('../node_modules/' + p, import.meta.url)));

const compiler = await createTypstCompiler({
  backend: 'worker',
  coreModules: {
    'engine.core.wasm': await readMod('typst-wasm/dist/engine/engine.core.wasm'),
    'engine.core2.wasm': await readMod('typst-wasm/dist/engine/engine.core2.wasm'),
    'engine.core3.wasm': await readMod('typst-wasm/dist/engine/engine.core3.wasm'),
  },
  worker: () => createWorkerThread(new URL('../node_modules/typst-wasm/dist/worker/worker-thread.js', import.meta.url)),
});
await compiler.addFonts(new Uint8Array(await readFile(new URL('../node_modules/@typst-wasm/fonts/dist/files/NewCM10-Regular.otf', import.meta.url))));
await compiler.addSource('main.typ', '= Hello from spike!');
const res = await compiler.compile({ main: 'main.typ', format: 'svg' });
console.log(res.pages.length, res.pages[0].output.slice(0, 120), 'diags:', res.diagnostics.length);
await compiler.dispose();

// second source overwrite check
const c2 = await createTypstCompiler({
  backend: 'worker',
  coreModules: {
    'engine.core.wasm': await readMod('typst-wasm/dist/engine/engine.core.wasm'),
    'engine.core2.wasm': await readMod('typst-wasm/dist/engine/engine.core2.wasm'),
    'engine.core3.wasm': await readMod('typst-wasm/dist/engine/engine.core3.wasm'),
  },
  worker: () => createWorkerThread(new URL('../node_modules/typst-wasm/dist/worker/worker-thread.js', import.meta.url)),
});
await c2.addFonts(new Uint8Array(await readFile(new URL('../node_modules/@typst-wasm/fonts/dist/files/NewCM10-Regular.otf', import.meta.url))));
await c2.addSource('main.typ', '= First');
await c2.removeFile('main.typ');
await c2.addSource('main.typ', '= Second');
const r2 = await c2.compile({ main: 'main.typ', format: 'svg' });
console.log('overwrite contains Second:', r2.pages[0].output.includes('Second'));
await c2.dispose();
