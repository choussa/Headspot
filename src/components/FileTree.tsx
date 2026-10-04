import { useState } from 'react'
import { buildTree, type TreeNode, type ProjectFile } from '../state/workspace'

interface Props {
  files: ProjectFile[]
  activePath: string
  onOpenFile: (path: string) => void
  onNewFile: (path: string) => void
  onDeleteFile: (path: string) => void
  onUploadAsset: (path: string, data: Uint8Array) => void
}

function Node({ node, activePath, depth, onOpenFile, onDeleteFile }: {
  node: TreeNode
  activePath: string
  depth: number
  onOpenFile: (path: string) => void
  onDeleteFile: (path: string) => void
}) {
  const [open, setOpen] = useState(true)
  if (node.kind === 'folder') {
    return (
      <div>
        <button
          className="w-full text-left text-neutral-400 hover:text-neutral-200 text-xs py-0.5"
          style={{ paddingLeft: depth * 12 }}
          onClick={() => setOpen(!open)}
        >
          {open ? '▾' : '▸'} {node.name}
        </button>
        {open && node.children.map((c) => (
          <Node key={c.path} node={c} activePath={activePath} depth={depth + 1} onOpenFile={onOpenFile} onDeleteFile={onDeleteFile} />
        ))}
      </div>
    )
  }
  const isMain = node.path === '/main.typ'
  return (
    <div className="flex items-center group" style={{ paddingLeft: depth * 12 }}>
      <button
        className={`flex-1 text-left text-xs py-0.5 truncate ${node.path === activePath ? 'text-blue-400' : 'text-neutral-300 hover:text-white'}`}
        onClick={() => onOpenFile(node.path)}
      >
        {node.kind === 'asset' ? '🖼 ' : ''}{node.name}{isMain ? ' ★' : ''}
      </button>
      {!isMain && (
        <button
          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 text-xs px-1"
          title="Delete"
          onClick={() => { if (confirm(`Delete ${node.path}?`)) onDeleteFile(node.path) }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export function FileTree({ files, activePath, onOpenFile, onNewFile, onDeleteFile, onUploadAsset }: Props) {
  const tree = buildTree(files)
  const [newPath, setNewPath] = useState('')

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const buf = new Uint8Array(await f.arrayBuffer())
    onUploadAsset(`/assets/${f.name}`, buf)
    e.target.value = ''
  }

  return (
    <div className="h-full flex flex-col bg-neutral-900 text-neutral-200 text-sm">
      <div className="p-2 border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">Files</div>
      <div className="flex-1 overflow-auto p-2">
        {tree.map((n) => (
          <Node key={n.path} node={n} activePath={activePath} depth={0} onOpenFile={onOpenFile} onDeleteFile={onDeleteFile} />
        ))}
      </div>
      <div className="p-2 border-t border-neutral-800 flex gap-1">
        <input
          className="flex-1 bg-neutral-800 rounded px-2 py-1 text-xs"
          placeholder="new/file.typ"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newPath.trim()) {
              onNewFile(newPath.trim())
              setNewPath('')
            }
          }}
        />
        <label className="bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-1 text-xs cursor-pointer">
          Asset+
          <input type="file" className="hidden" onChange={onFilePicked} />
        </label>
      </div>
    </div>
  )
}
