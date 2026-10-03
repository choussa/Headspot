import { get, set } from 'idb-keyval'
import newcmReg from '@typst-wasm/fonts/NewCM10-Regular.otf?url'
import newcmBold from '@typst-wasm/fonts/NewCM10-Bold.otf?url'
import newcmItalic from '@typst-wasm/fonts/NewCM10-Italic.otf?url'
import newcmBoldItalic from '@typst-wasm/fonts/NewCM10-BoldItalic.otf?url'
import newcmMath from '@typst-wasm/fonts/NewCMMath-Regular.otf?url'
import dejaMono from '@typst-wasm/fonts/DejaVuSansMono.ttf?url'

const FONT_CACHE_KEY = 'headspot-fonts-v1'
const FONT_URLS = [newcmReg, newcmBold, newcmItalic, newcmBoldItalic, newcmMath, dejaMono]

export async function loadFonts(): Promise<ArrayBuffer[]> {
  const cached = await get<ArrayBuffer[]>(FONT_CACHE_KEY)
  if (cached) return cached
  const fonts = await Promise.all(FONT_URLS.map((u) => fetch(u).then((r) => r.arrayBuffer())))
  await set(FONT_CACHE_KEY, fonts)
  return fonts
}
