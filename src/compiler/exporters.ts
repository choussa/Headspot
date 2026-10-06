// Export helpers: turn compiler output and project files into browser downloads.

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next task so the navigation has started.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBlob(blob: Blob, filename: string): void {
  triggerDownload(blob, filename)
}

/** Zip a set of named text or binary entries. */
export async function zipEntries(
  entries: Array<{ path: string; data: string | Uint8Array }>,
): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const e of entries) zip.file(e.path, e.data)
  return zip.generateAsync({ type: 'blob' })
}

/**
 * Rasterize one page SVG to a PNG blob.
 * Typst emits text as vector paths, so no webfont loading is needed; the SVG is
 * loaded through a blob URL to keep the canvas untainted.
 */
export async function svgToPngBlob(svg: string, widthPt: number, heightPt: number, scale = 2): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not rasterize the rendered page.'))
      image.src = url
    })
    // Typst's page size is in points; 1pt = 1/72in and CSS treats 1in = 96px.
    const baseW = Math.max(1, Math.round((widthPt / 72) * 96))
    const baseH = Math.max(1, Math.round((heightPt / 72) * 96))
    const canvas = document.createElement('canvas')
    canvas.width = baseW * scale
    canvas.height = baseH * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create a canvas to rasterize the page.')
    // Typst pages are transparent by default; paint white so text stays legible.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the page as PNG.'))),
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
