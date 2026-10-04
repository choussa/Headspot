import { useState } from 'react'
import { FileText, Folder, FolderOpen, Image as ImageIcon, X } from 'lucide-react'
import { buildTree, type TreeNode, type ProjectFile } from '../state/workspace'

interface Props {
  files: ProjectFile[]
  activePath: string
  onOpenFile: (path: string) => void
  onNewFile: (path: string) => void
  onRequestDeleteFile: (path: string) => void
  onUploadAsset: (path: string, data: Uint8Array) => void
}

function Node({ node, activePath, depth, onOpenFile, onRequestDeleteFile }: {
  node: TreeNode
  activePath: string
  depth: number
  onOpenFile: (path: string) => void
  onRequestDeleteFile: (path: string) => void
}) {
  const [open, setOpen] = useState(true)
  if (node.kind === 'folder') {
    return (
      <div>
        <button
          className="file-row w-full text-left text-xs py-1"
          style={{ paddingLeft: depth * 12 }}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <FolderOpen size={13} className="inline -mt-0.5 mr-1" /> : <Folder size={13} className="inline -mt-0.5 mr-1" />}{node.name}
        </button>
        {open && node.children.map((c) => (
          <Node key={c.path} node={c} activePath={activePath} depth={depth + 1} onOpenFile={onOpenFile} onRequestDeleteFile={onRequestDeleteFile} />
        ))}
      </div>
    )
  }
  const isMain = node.path === '/main.typ'
  return (
    <div className="group flex items-center" style={{ paddingLeft: depth * 12 }}>
      <button
        className={`file-row flex-1 text-left text-xs py-1 truncate ${node.path === activePath ? 'file-row-active' : ''}`}
        aria-current={node.path === activePath}
        onClick={() => onOpenFile(node.path)}
      >
        {node.kind === 'asset' ? <ImageIcon size={12} className="inline -mt-0.5 mr-1" /> : <FileText size={12} className="inline -mt-0.5 mr-1" />}{node.name}
      </button>
      {!isMain && (
        <button
          className="rounded px-1 text-xs text-fg-3 opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          title={`Delete ${node.path}`}
          aria-label={`Delete ${node.path}`}
          onClick={() => onRequestDeleteFile(node.path)}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

export function FileTree({ files, activePath, onOpenFile, onNewFile, onRequestDeleteFile, onUploadAsset }: Props) {
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
    <div className="h-full flex flex-col text-sm" style={{background:'var(--panel-bg)',color:'var(--text-primary)'}}>
      <div className="file-panel-header">Files</div>
      <div className="flex-1 overflow-auto p-2">
        {tree.map((n) => (
          <Node key={n.path} node={n} activePath={activePath} depth={0} onOpenFile={onOpenFile} onRequestDeleteFile={onRequestDeleteFile} />
        ))}
      </div>
      <div className="file-panel-footer">
        <label htmlFor="new-file-path" className="sr-only">New file path</label>
        <input
          id="new-file-path"
          className="file-input flex-1 rounded px-2 py-1 text-xs"
            placeholder="new/file.typ or data.yaml"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newPath.trim()) {
              onNewFile(newPath.trim())
              setNewPath('')
            }
          }}
        />
        <label className="file-asset-btn rounded px-2 py-1 text-xs cursor-pointer">
          Asset+
          <input type="file" className="hidden" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={onFilePicked} />
        </label>
      </div>
    </div>
  )
}
