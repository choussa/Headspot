const fs = require('fs')

let code = fs.readFileSync('src/preview/VirtualizedPreview.tsx', 'utf8')

code = code.replace(/const onNativeWheel[\s\S]*?el\.addEventListener\('wheel', onNativeWheel, { passive: false }\)/, '')
code = code.replace(/el\.removeEventListener\('wheel', onNativeWheel\)/, '')

fs.writeFileSync('src/preview/VirtualizedPreview.tsx', code)
