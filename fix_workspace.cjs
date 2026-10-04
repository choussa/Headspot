const fs = require('fs')

let code = fs.readFileSync('src/state/workspace.ts', 'utf8')

const metaStr = `export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}`

const newMetaStr = `export interface ProjectMeta {
  id: string
  name: string
  folderId?: string | null
  thumbnail?: string | null
  createdAt: number
  updatedAt: number
}`

code = code.replace(metaStr, newMetaStr)
fs.writeFileSync('src/state/workspace.ts', code)
