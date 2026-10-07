const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface TarEntry {
  name: string
  data: Uint8Array | string
}

function header(name: string, size: number): Uint8Array {
  const h = new Uint8Array(512)
  const w = (s: string, off: number, len: number) => {
    const b = encoder.encode(s)
    h.set(b.subarray(0, Math.min(b.length, len - 1)), off)
  }
  w(name, 0, 100)
  w('0000644', 100, 8)
  w('0000000', 108, 8)
  w('0000000', 116, 8)
  w(size.toString(8).padStart(11, '0'), 124, 12)
  w('0'.repeat(11), 136, 12)
  h.fill(0x20, 148, 156)
  h[156] = 0x30
  h.set(encoder.encode('ustar'), 257)
  h[262] = 0x30
  h[263] = 0x30
  let sum = 0
  for (const b of h) sum += b
  const chk = sum.toString(8).padStart(6, '0')
  const cb = encoder.encode(chk)
  h.set(cb, 148)
  h[148 + cb.length] = 0
  h[148 + cb.length + 1] = 0x20
  return h
}

/** Build an uncompressed POSIX ustar archive. */
export function tarSync(entries: TarEntry[]): Uint8Array {
  const chunks: Uint8Array[] = []
  for (const e of entries) {
    const data = typeof e.data === 'string' ? encoder.encode(e.data) : e.data
    if (e.name.length > 99) throw new Error(`tar entry name too long: ${e.name}`)
    chunks.push(header(e.name, data.length))
    chunks.push(data)
    const pad = (512 - (data.length % 512)) % 512
    if (pad > 0) chunks.push(new Uint8Array(pad))
  }
  chunks.push(new Uint8Array(1024))
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

/** Extract file entries from an uncompressed POSIX ustar archive. */
export function untarSync(buf: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = []
  let off = 0
  while (off + 512 <= buf.length) {
    const block = buf.subarray(off, off + 512)
    if (block.every((b) => b === 0)) break
    const readStr = (start: number, len: number) => decoder.decode(block.subarray(start, start + len)).replace(/\0.*$/, '').trim()
    const name = readStr(0, 100)
    const sizeField = readStr(124, 12)
    const size = parseInt(sizeField || '0', 8)
    const typeflag = String.fromCharCode(block[156] || 48)
    off += 512
    if (typeflag === '0' || typeflag === '\0') {
      entries.push({ name, data: buf.slice(off, off + size) })
    }
    off += size + ((512 - (size % 512)) % 512)
  }
  return entries
}
