const decoder = new TextDecoder()

export interface TarEntry {
  name: string
  data: Uint8Array | string
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
