const COMMON_FAMILIES = [
  'arial', 'times new roman', 'courier new', 'georgia', 'verdana',
  'trebuchet ms', 'comic sans ms', 'impact', 'calibri', 'cambria',
  'consolas', 'tahoma', 'garamond', 'palatino', 'bookman', 'helvetica',
]

export async function loadLocalFonts(): Promise<ArrayBuffer[]> {
  const qlf = window.queryLocalFonts
  if (!qlf) throw new Error('Local font access is not supported in this browser (needs Chrome/Edge).')
  const fonts = await qlf.call(window)
  const wanted = fonts.filter((f) =>
    COMMON_FAMILIES.some((name) => f.family.toLowerCase().includes(name)),
  )
  const selected = wanted.length > 0 ? wanted : fonts.slice(0, 20)
  return Promise.all(selected.map(async (f) => (await f.blob()).arrayBuffer()))
}
