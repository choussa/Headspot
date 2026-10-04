const fs = require('fs')

let code = fs.readFileSync('src/App.tsx', 'utf8')

// Remove document-crumb
code = code.replace(/<div className="document-crumb">[\s\S]*?<\/div>\n\s*/, '')

// Insert global zoom interceptor
const interceptor = `
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom(z => {
          const delta = e.deltaY > 0 ? -5 : 5
          return Math.max(50, Math.min(300, z + delta))
        })
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+' || e.key === '-') {
          e.preventDefault()
          setZoom(z => {
            if (e.key === '-') return Math.max(50, z - 10)
            return Math.min(300, z + 10)
          })
        }
        if (e.key === '0') {
          e.preventDefault()
          setZoom(100)
        }
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
`

if (!code.includes('handleWheel')) {
  // Insert before the first return in the component
  const returnIdx = code.indexOf('  return (\n    <div className="app-shell">')
  if (returnIdx !== -1) {
    code = code.slice(0, returnIdx) + interceptor + '\n' + code.slice(returnIdx)
  }
}

fs.writeFileSync('src/App.tsx', code)
