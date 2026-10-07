import { TypstProject, type CompileResult, type RenderedSvgPage } from '@vedivad/typst-web-service'
import type { ProjectFile } from '../state/workspace'
import { injectLocalPackages, type LocalPackageCtx } from './localPackages'

export type { CompileResult, RenderedSvgPage }
export type { LocalPackageCtx }

export class Project {
  private vp: TypstProject | null = null
  private seq = 0
  private queue: Promise<void> = Promise.resolve()
  private initPromise: Promise<void> | null = null
  private initKey = 0

  /** Idempotent: concurrent calls share one initialization; a re-init disposes the previous engine first. */
  async init(fonts: ArrayBuffer[]): Promise<void> {
    if (this.initPromise) return this.initPromise
    const key = ++this.initKey
    this.initPromise = (async () => {
      try {
        this.vp?.destroy()
        this.vp = null
        const vp = await TypstProject.create()
        if (key !== this.initKey) {
          vp.destroy()
          return
        }
        for (const f of fonts) await vp.addFont(new Uint8Array(f))
        this.vp = vp
      } finally {
        this.initPromise = null
      }
    })()
    return this.initPromise
  }

  getEngine(): TypstProject | null {
    return this.vp
  }

  /** True when a compile is queued or running. */
  get busy(): boolean {
    return this.pending > 0
  }

  private pending = 0

  setEntry(path: string): void {
    if (this.vp) this.vp.entry = path
  }

  async addFonts(fonts: ArrayBuffer[]): Promise<void> {
    if (!this.vp) throw new Error('compiler not initialized')
    for (const f of fonts) await this.vp.addFont(new Uint8Array(f))
  }

  private async syncFiles(files: ProjectFile[]): Promise<void> {
    if (!this.vp) throw new Error('compiler not initialized')
    const wanted = new Map(files.map((f) => [f.path, f]))
    for (const p of this.vp.files) {
      if (!wanted.has(p)) await this.vp.remove(p)
    }
    const text: Record<string, string | Uint8Array> = {}
    for (const f of files) {
      text[f.path] = f.kind === 'source' ? (f.text ?? '') : (f.data ?? new Uint8Array())
    }
    if (Object.keys(text).length > 0) await this.vp.setMany(text)
  }

  async compileProject(files: ProjectFile[], ctx?: LocalPackageCtx): Promise<CompileResult | null> {
    const mySeq = ++this.seq
    this.pending++
    // Serialize compiles: concurrent calls must not interleave syncFiles() on the shared engine.
    const run = this.queue.then(async () => {
      try {
        if (!this.vp || mySeq !== this.seq) return null
        await this.syncFiles(files)
        if (ctx) {
          try {
            await injectLocalPackages(this.vp, ctx, files)
          } catch (err) {
            console.warn('[headspot] @local package resolution failed', err)
          }
        }
        const res = await this.vp.compile()
        if (mySeq !== this.seq) return null
        return res
      } finally {
        this.pending--
      }
    })
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  async renderPage(index: number): Promise<string | undefined> {
    return this.vp?.renderPage(index)
  }

  /** Every page of the last compile with its own SVG, for multi-page export. */
  async renderedPages(start: number, end: number): Promise<RenderedSvgPage[]> {
    if (!this.vp) throw new Error('compiler not initialized')
    return this.vp.renderedPages(start, end)
  }

  async exportPdf(): Promise<Uint8Array> {
    if (!this.vp) throw new Error('compiler not initialized')
    return (await this.vp.exportPdf()) ?? new Uint8Array()
  }

  async dispose() {
    this.seq++
    await this.queue.catch(() => undefined)
    this.vp?.destroy()
    this.vp = null
  }
}
