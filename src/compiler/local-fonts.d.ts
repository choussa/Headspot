interface LocalFontData {
  family: string
  style: string
  weight: string
  postscriptName: string
  blob: () => Promise<Blob>
}

interface Window {
  queryLocalFonts?: () => Promise<LocalFontData[]>
}
