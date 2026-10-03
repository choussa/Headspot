import { createTypstCompiler, type TypstCompiler } from 'typst-wasm'
import { createWebWorker } from 'typst-wasm/worker/browser'
import coreUrl from 'typst-wasm/engine/engine.core.wasm?url'
import core2Url from 'typst-wasm/engine/engine.core2.wasm?url'
import core3Url from 'typst-wasm/engine/engine.core3.wasm?url'
import webWorkerUrl from 'typst-wasm/worker/web-worker?url'

async function compileCoreModule(url: string): Promise<WebAssembly.Module> {
  const buf = await (await fetch(url)).arrayBuffer()
  return WebAssembly.compile(buf)
}

export async function createClient(fonts: ArrayBuffer[]): Promise<TypstCompiler> {
  const [core, core2, core3] = await Promise.all([
    compileCoreModule(coreUrl),
    compileCoreModule(core2Url),
    compileCoreModule(core3Url),
  ])
  const compiler = await createTypstCompiler({
    backend: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated ? 'worker' : 'jspi',
    coreModules: {
      'engine.core.wasm': core,
      'engine.core2.wasm': core2,
      'engine.core3.wasm': core3,
    },
    worker: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated ? () => createWebWorker(webWorkerUrl) : undefined,
  })
  await compiler.addFonts(...fonts.map((f) => new Uint8Array(f)))
  return compiler
}

export interface SvgPage {
  page: number
  output: string
  width: number
  height: number
}

export function parseSvgPageSize(svg: string): { width: number; height: number } {
  const m = svg.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/)
  if (m) return { width: Number(m[3]), height: Number(m[4]) }
  return { width: 595, height: 842 }
}
