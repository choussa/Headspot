import type { TypstCompiler, Diagnostic } from 'typst-wasm'
import { createClient, parseSvgPageSize, type SvgPage } from './typstClient'

export interface CompileOutcome {
  pages: SvgPage[]
  changedPages: { page: number; output: string }[]
  totalPages: number
  diagnostics: Diagnostic[]
}

export class Project {
  private compiler: TypstCompiler | null = null
  private seq = 0
  private pageHashes = new Map<number, string>()
  private source = ''

  async init(fonts: ArrayBuffer[]) {
    this.compiler = await createClient(fonts)
  }

  private hash(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
    return h
  }

  async compile(source: string): Promise<CompileOutcome | null> {
    if (!this.compiler) throw new Error('compiler not initialized')
    const mySeq = ++this.seq
    this.source = source
    await this.compiler.clearFiles()
    await this.compiler.addSource('main.typ', source)
    const res = await this.compiler.compile({ main: 'main.typ', format: 'svg' })
    if (mySeq !== this.seq) return null

    const pages: SvgPage[] = res.pages.map((p) => ({
      page: p.page,
      output: p.output,
      ...parseSvgPageSize(p.output),
    }))
    const changedPages = pages
      .filter((p) => this.pageHashes.get(p.page) !== String(this.hash(p.output)))
      .map((p) => ({ page: p.page, output: p.output }))
    this.pageHashes = new Map(pages.map((p) => [p.page, String(this.hash(p.output))]))

    return { pages, changedPages, totalPages: pages.length, diagnostics: res.diagnostics }
  }

  async exportPdf(): Promise<Uint8Array> {
    if (!this.compiler) throw new Error('compiler not initialized')
    const mySeq = ++this.seq
    await this.compiler.clearFiles()
    await this.compiler.addSource('main.typ', this.source)
    const res = await this.compiler.compile({ main: 'main.typ', format: 'pdf' })
    if (mySeq !== this.seq) throw new Error('stale')
    return new Uint8Array(res.output)
  }

  async dispose() {
    await this.compiler?.dispose()
  }
}
