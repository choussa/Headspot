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
const c = await createTypstCompiler({ backend: 'worker', coreModules: mods, worker: wt });
await c.addFonts(font);
await c.addSource('main.typ', '= A\n#pagebreak()\n= B\n#pagebreak()\n= C');
let r = await c.compile({ main: 'main.typ', format: 'svg' });
console.log('pages before:', r.pages.length);
await c.clearFiles();
await c.addSource('main.typ', '= Only one');
r = await c.compile({ main: 'main.typ', format: 'svg' });
console.log('pages after clearFiles:', r.pages.length);
await c.addSource('other.typ', '= X\n#pagebreak()\n= Y');
r = await c.compile({ main: 'other.typ', format: 'svg' });
console.log('pages other.typ:', r.pages.length);
await c.dispose();
