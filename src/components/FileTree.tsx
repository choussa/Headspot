import { useState } from 'react'
import { FileText, Folder, FolderOpen, Image as ImageIcon, X } from 'lucide-react'
import { buildTree, type TreeNode, type ProjectFile } from '../state/workspace'
import { PromptDialog } from './Dialogs'

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
  const [dragOver, setDragOver] = useState(false)
  const [pending, setPending] = useState<{ name: string; data: Uint8Array }[]>([])

  const queueUploads = async (list: FileList | File[]) => {
    const next: { name: string; data: Uint8Array }[] = []
    for (const f of Array.from(list)) {
      const isImage = f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name)
      if (!isImage) continue
      next.push({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })
    }
    if (next.length) setPending((q) => [...q, ...next])
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    await queueUploads(e.dataTransfer.files)
  }

  const confirmAsset = (value: string) => {
    const item = pending[0]
    setPending((q) => q.slice(1))
    if (!item) return
    const safe = (value.trim() || item.name).replace(/[/\\]/g, '-')
    onUploadAsset(`/assets/${safe}`, item.data)
  }

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length) await queueUploads(files)
    e.target.value = ''
  }

  return (
    <div className="h-full flex flex-col text-sm" style={{background:'var(--panel-bg)',color:'var(--text-primary)'}}>
      <div className="file-panel-header">Files</div>
      <div
        className={`flex-1 overflow-auto p-2 ${dragOver ? 'file-drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
        onDrop={handleDrop}
      >
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
          <input type="file" multiple className="hidden" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={onFilePicked} />
        </label>
      </div>
      <PromptDialog
        key={pending.length + ':' + (pending[0]?.name ?? '')}
        open={pending.length > 0}
        title="Name asset"
        description="Set a filename for the dropped image before adding it to your project."
        initialValue={pending[0]?.name ?? ''}
        confirmLabel="Add"
        cancelLabel="Discard"
        onCancel={() => setPending([])}
        onConfirm={confirmAsset}
      />
    </div>
  )
}
