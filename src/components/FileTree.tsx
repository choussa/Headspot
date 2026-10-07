import { useRef, useState } from 'react'
import { FileText, Folder, FolderOpen, Image as ImageIcon, Plus, X } from 'lucide-react'
import { buildTree, type TreeNode, type ProjectFile } from '../state/workspace'
import { PromptDialog } from './Dialogs'

interface Props {
  files: ProjectFile[]
  activePath: string
  onOpenFile: (path: string) => void
  onNewFile: (path: string) => void
  onRequestDeleteFile: (path: string) => void
  onUploadAsset: (path: string, data: Uint8Array) => void
  onMoveFile: (fromPath: string, toFolder: string) => void
}

const MOVE_MIME = 'application/x-headspot-path'

function Node({ node, activePath, depth, onOpenFile, onRequestDeleteFile, onMoveFile }: {
  node: TreeNode
  activePath: string
  depth: number
  onOpenFile: (path: string) => void
  onRequestDeleteFile: (path: string) => void
  onMoveFile: (fromPath: string, toFolder: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [dropOver, setDropOver] = useState(false)
  if (node.kind === 'folder') {
    return (
      <div
        className={dropOver ? 'file-drag-over rounded' : ''}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropOver(true) }}
        onDragLeave={() => setDropOver(false)}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation(); setDropOver(false)
          const from = e.dataTransfer.getData(MOVE_MIME)
          if (from) onMoveFile(from, node.path)
        }}
      >
        <button
          className="file-row w-full text-left text-xs py-1"
          style={{ paddingLeft: depth * 12 }}
          role="treeitem"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <FolderOpen size={13} className="inline -mt-0.5 mr-1" /> : <Folder size={13} className="inline -mt-0.5 mr-1" />}{node.name}
        </button>
        {open && (
          <div role="group">
            {node.children.map((c) => (
              <Node key={c.path} node={c} activePath={activePath} depth={depth + 1} onOpenFile={onOpenFile} onRequestDeleteFile={onRequestDeleteFile} onMoveFile={onMoveFile} />
            ))}
          </div>
        )}
      </div>
    )
  }
  const isMain = node.path === '/main.typ'
  const isActive = node.path === activePath
  return (
    <div className="group flex items-center" style={{ paddingLeft: depth * 12 }} draggable={!isMain} onDragStart={(e) => e.dataTransfer.setData(MOVE_MIME, node.path)}>
      <button
        className={`file-row flex-1 text-left text-xs py-1 truncate ${isActive ? 'file-row-active' : ''}`}
        role="treeitem"
        aria-selected={isActive}
        aria-current={isActive}
        onClick={() => onOpenFile(node.path)}
      >
        {node.kind === 'asset' ? <ImageIcon size={12} className="inline -mt-0.5 mr-1" /> : <FileText size={12} className="inline -mt-0.5 mr-1" />}{node.name}
      </button>
      {!isMain && (
        <button
          className="rounded px-1 text-xs text-fg-3 opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 pointer-fine:opacity-0 pointer-coarse:opacity-100"
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

export function FileTree({ files, activePath, onOpenFile, onNewFile, onRequestDeleteFile, onUploadAsset, onMoveFile }: Props) {
  const tree = buildTree(files)
  const [newPath, setNewPath] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [pending, setPending] = useState<{ name: string; data: Uint8Array }[]>([])
  const treeRef = useRef<HTMLDivElement>(null)
  const assetInputRef = useRef<HTMLInputElement>(null)

  const onTreeKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])
    const idx = items.indexOf(document.activeElement as HTMLElement)
    if (idx === -1) return
    const current = items[idx]
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[Math.min(idx + 1, items.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[Math.max(idx - 1, 0)]?.focus()
    } else if (e.key === 'ArrowLeft') {
      if (current.getAttribute('aria-expanded') === 'true') {
        e.preventDefault()
        current.click()
      } else {
        const parentItem = current.closest('[role="group"]')?.previousElementSibling as HTMLElement | null
        if (parentItem) { e.preventDefault(); parentItem.focus() }
      }
    } else if (e.key === 'ArrowRight') {
      if (current.getAttribute('aria-expanded') === 'false') {
        e.preventDefault()
        current.click()
      }
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

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
    const internal = e.dataTransfer.getData(MOVE_MIME)
    if (internal) { onMoveFile(internal, '/'); return } // drop on root moves to top level
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
    <div className="h-full flex flex-col text-sm bg-panel text-fg">
      <div className="file-panel-header">Files</div>
      <div
        ref={treeRef}
        role="tree"
        aria-label="Project files"
        className={`flex-1 overflow-auto p-2 ${dragOver ? 'file-drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.dataTransfer.types.includes(MOVE_MIME)) setDragOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
        onDrop={handleDrop}
        onKeyDown={onTreeKeyDown}
      >
        {tree.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-fg-3">No files yet — create one below.</p>
        ) : (
          tree.map((n) => (
            <Node key={n.path} node={n} activePath={activePath} depth={0} onOpenFile={onOpenFile} onRequestDeleteFile={onRequestDeleteFile} onMoveFile={onMoveFile} />
          ))
        )}
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
        <button
          type="button"
          className="file-asset-btn rounded px-2 py-1 text-xs"
          title="New file"
          aria-label="Create new file"
          disabled={!newPath.trim()}
          onClick={() => { onNewFile(newPath.trim()); setNewPath('') }}
        >
          <Plus size={13} />
        </button>
        <button
          type="button"
          className="file-asset-btn rounded px-2 py-1 text-xs"
          onClick={() => assetInputRef.current?.click()}
        >
          Asset+
        </button>
        <input
          ref={assetInputRef}
          type="file"
          multiple
          className="sr-only"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg"
          onChange={onFilePicked}
        />
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
