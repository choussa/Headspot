import { TypstProject, type CompileResult } from '@vedivad/typst-web-service'
import type { ProjectFile } from '../state/workspace'

export type { CompileResult }

export class Project {
  private vp: TypstProject | null = null
  private seq = 0

  async init(fonts: ArrayBuffer[]): Promise<void> {
    this.vp = await TypstProject.create()
    for (const f of fonts) await this.vp.addFont(new Uint8Array(f))
  }

  getEngine(): TypstProject | null {
    return this.vp
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

  async compileProject(files: ProjectFile[]): Promise<CompileResult | null> {
    const mySeq = ++this.seq
    await this.syncFiles(files)
    const res = await this.vp!.compile()
    if (mySeq !== this.seq) return null
    return res
  }

  async renderPage(index: number): Promise<string | undefined> {
    return this.vp?.renderPage(index)
  }

  async exportPdf(): Promise<Uint8Array> {
    if (!this.vp) throw new Error('compiler not initialized')
    return (await this.vp.exportPdf()) ?? new Uint8Array()
  }

  async dispose() {
    this.vp?.destroy()
    this.vp = null
  }
}
