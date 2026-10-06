import re

with open('src/pages/EditorPage.tsx', 'r') as f:
    code = f.read()

# Add missing lucide imports
imports = "import {\n  ArrowLeft, PanelLeft, Search, PenLine, Settings, Share2, Download, Undo2, Redo2, Loader2,\n  LogOut, RotateCw, Minus, Plus, Maximize2, ChevronDown, List, ListOrdered, Sigma, Code, AtSign,\n  TriangleAlert, Check,\n  Globe, BookOpen, Package, Leaf, CircleHelp, Cloud, Terminal, Layout, Book\n} from 'lucide-react'"

code = re.sub(r'import \{[^}]+\}\s*from \'lucide-react\'', imports, code)

# Replace <header> to </aside>
old_header_aside = re.search(r'<header className="topbar">.*?</aside>', code, re.DOTALL)
if old_header_aside:
    new_header_aside = """<header className="topbar px-4 py-2 border-b border-line bg-topbar flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="text-fg-2 hover:text-fg" title="Back to dashboard" aria-label="Back to dashboard" onClick={() => navigate('/')}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-3 text-[13px] font-medium text-fg">
            <Link to="/" className="hover:text-white mr-1" style={{ textDecoration: 'none' }}>Typst</Link>
            <button className="hover:text-white">File</button>
            <button className="hover:text-white">Edit</button>
            <div style={{ position: 'relative' }}>
              <button className="hover:text-white" onClick={() => setViewMenuOpen((v) => !v)}>View</button>
              {viewMenuOpen && <Menu items={viewItems} close={() => setViewMenuOpen(false)} />}
            </div>
            <button className="hover:text-white">Help</button>
          </div>
        </div>
        
        <div className="flex items-center text-[13px] font-medium text-fg-2">
          <Cloud size={14} className="mr-2" />
          <span className="hover:text-white cursor-pointer">black</span>
          <span className="mx-1.5 text-line-2">›</span>
          <span className="hover:text-white cursor-pointer">{record?.meta.name ?? 'Untitled'}</span>
          <span className="mx-1.5 text-line-2">›</span>
          <span className="text-white font-semibold">{activeFilePath.replace(/^\\//, '')}</span>
        </div>

        <div className="flex items-center gap-1.5 text-fg-2">
          <button className="p-1 hover:bg-raised rounded text-fg" onClick={() => { const v = editorViewRef.current; if (v) undo(v) }}><Undo2 size={15} /></button>
          <button className="p-1 hover:bg-raised rounded text-fg" onClick={() => { const v = editorViewRef.current; if (v) redo(v) }}><Redo2 size={15} /></button>
          <div className="w-px h-4 bg-line mx-1" />
          <button className="p-1 hover:bg-raised rounded text-fg"><Terminal size={15} /></button>
          <div className="w-px h-4 bg-line mx-1" />
          <button className="p-1 hover:bg-raised rounded text-fg" onClick={() => setZoom(z => Math.max(25, z - 10))}><Minus size={15} /></button>
          <span className="text-xs w-10 text-center font-medium">{zoom}%</span>
          <button className="p-1 hover:bg-raised rounded text-fg" onClick={() => setZoom(z => Math.min(500, z + 10))}><Plus size={15} /></button>
          <div className="w-px h-4 bg-line mx-1" />
          <button className="p-1 hover:bg-raised rounded text-fg"><Layout size={15} /></button>
          <button className="p-1 hover:bg-raised rounded text-fg"><Book size={15} /></button>
          <div className="w-px h-4 bg-line mx-2" />
          <button className="flex items-center h-[26px] px-3 text-[13px] font-medium rounded border border-line bg-panel hover:bg-raised text-fg transition-colors">Share</button>
          <div className="relative">
            <button className="flex items-center h-[26px] px-2 text-[13px] font-medium rounded border border-line bg-panel hover:bg-raised text-fg transition-colors gap-1">
              <Download size={14} />
              <div className="w-px h-3 bg-line-2 mx-1"></div>
              <ChevronDown size={12} />
            </button>
          </div>
        </div>
      </header>
      <div className="workbench">
        <aside className="activity-rail flex flex-col w-[48px] border-r border-line bg-topbar py-3 items-center gap-3 shrink-0">
          <button className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'search' ? 'text-white' : ''}`} onClick={() => { const v = editorViewRef.current; if (v) openSearchPanel(v) }}>
            <Search size={18} />
          </button>
          <button className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'outline' ? 'text-white' : ''}`} onClick={() => setActivePanel(activePanel === 'outline' ? null : 'outline')}>
            <BookOpen size={18} />
          </button>
          <button className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'packages' ? 'text-white' : ''}`} onClick={() => setActivePanel(activePanel === 'packages' ? null : 'packages')}>
            <Package size={18} />
          </button>
          <button className={`relative p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'globe' ? 'text-white' : ''}`} onClick={() => setActivePanel(activePanel === 'globe' ? null : 'globe')}>
            <Globe size={18} />
            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-brand-fill rounded-full border-[1.5px] border-topbar flex items-center justify-center text-[9px] text-white font-bold">5</span>
          </button>
          <button className={`p-2 rounded text-fg-2 hover:text-fg ${activePanel === 'settings' ? 'text-white border-l-2 border-accent-fill -ml-[2px] pl-[6px]' : ''}`} onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}>
            <Settings size={18} />
          </button>
          
          <div className="flex-1" />
          
          <button className="p-2 rounded text-fg-2 hover:text-fg">
            <Leaf size={18} />
          </button>
          <button className="p-2 rounded text-fg-2 hover:text-fg">
            <CircleHelp size={18} />
          </button>
          <div className="rail-wordmark" aria-hidden="true">typst</div>
        </aside>"""
    code = code[:old_header_aside.start()] + new_header_aside + code[old_header_aside.end():]

# We need to mount SettingsPanel alongside FileTree inside workspace-main if activePanel === 'settings'
mount_re = re.search(r'<main className="workspace-main">.*?{activePanel === \'files\' && \(.*?</main>', code, re.DOTALL)
if mount_re:
    new_mount = """<main className="workspace-main flex flex-row h-full">
          {activePanel === 'files' && (
            <div className="file-sidebar">
              <FileTree
                files={record?.files ?? []}
                activePath={activeFilePath}
                onSelect={setActiveFilePath}
                onCreateFile={(path) => void run(() => setRecord(prev => prev ? createProjectFile(prev, path, 'source', '') : prev))}
                onDeleteFile={(path) => void run(() => setRecord(prev => prev ? deleteProjectFile(prev, path) : prev))}
                onUploadAsset={onUploadAsset}
              />
            </div>
          )}
          {activePanel === 'settings' && record && (
            <SettingsPanel 
              prefs={prefs} 
              update={updatePref} 
              onRequestDelete={() => setDialog({ kind: 'delete' })} 
              record={record}
            />
          )}
          <div className="flex-1 flex flex-col min-w-0 h-full">"""
    
    # Actually, we need to restructure workspace-main to include settings panel properly, 
    # but the original code has a flex-col layout for the whole main, with SplitPane inside.
    # Let's see original code:
    pass

with open('src/pages/EditorPage.tsx', 'w') as f:
    f.write(code)
