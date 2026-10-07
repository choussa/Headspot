import { useEffect, useState, useMemo } from 'react'
import { X, Search, ChevronDown, Star, Layers, Loader2 } from 'lucide-react'
import {
  fetchTemplateIndex,
  fetchTemplateMeta,
  fetchTemplateSource,
  renderTemplate,
  type TemplateIndexEntry,
  type TemplateMeta
} from '../utils/templateEngine'

interface Props {
  onClose: () => void
  onCreate: (name: string, source: string) => void
}

export function TemplateDialog({ onClose, onCreate }: Props) {
  const [index, setIndex] = useState<TemplateIndexEntry[]>([])
  const [selected, setSelected] = useState<TemplateIndexEntry | null>(null)
  const [meta, setMeta] = useState<TemplateMeta | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)

  // Dropdown states (mocked for UI purposes)
  const [selectedCategory] = useState('All categories')
  const [selectedDiscipline] = useState('All disciplines')

  useEffect(() => {
    fetchTemplateIndex()
      .then(setIndex)
      .catch(() => setError('Could not load templates'))
  }, [])

  useEffect(() => {
    if (!selected) {
      setMeta(null)
      setValues({})
      return
    }
    
    // Clear previous meta while loading
    setMeta(null)
    fetchTemplateMeta(selected.path)
      .then((m) => {
        setMeta(m)
        setValues(Object.fromEntries(m.variables.map((v) => [v.id, v.default ?? ''])))
      })
      .catch(() => setError('Could not load template metadata'))
  }, [selected])

  const filteredIndex = useMemo(() => {
    return index.filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [index, searchQuery])

  const handleCreate = async () => {
    if (!selected) return
    setCreating(true)
    setError(null)
    try {
      const src = await fetchTemplateSource(selected.path)
      onCreate(meta?.name ?? selected.name, renderTemplate(src, values))
    } catch (e) {
      setError('Could not create from template')
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-[#1a1a1e] rounded-xl shadow-2xl w-full max-w-[960px] h-[650px] flex flex-col text-fg relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-line shrink-0">
          <h2 className="text-lg font-semibold text-white">Configure new project</h2>
          <button onClick={onClose} className="text-fg-2 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-4 p-5 pb-0 shrink-0">
          <div className="flex-1 bg-panel border border-line rounded-md px-3 py-1.5 text-sm focus-within:border-brand focus-within:ring-1 focus-within:ring-brand flex items-center gap-2">
            <Search size={16} className="text-fg-2" />
            <input 
              type="text" 
              placeholder="Search templates" 
              className="bg-transparent border-none outline-none text-white w-full placeholder:text-fg-3"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="bg-panel border border-line rounded-md px-3 py-1.5 text-sm flex items-center justify-between gap-4 cursor-pointer hover:bg-raised min-w-[160px] text-white">
            <Layers size={14} className="text-fg-2" />
            <span className="flex-1">{selectedCategory}</span>
            <ChevronDown size={14} className="text-fg-2" />
          </div>

          <div className="bg-panel border border-line rounded-md px-3 py-1.5 text-sm flex items-center justify-between gap-4 cursor-pointer hover:bg-raised min-w-[160px] text-white">
            <span className="flex-1">{selectedDiscipline}</span>
            <ChevronDown size={14} className="text-fg-2" />
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex flex-1 min-h-0 p-5 gap-5">
          {/* Left Pane (Grid) */}
          <div className="flex-1 bg-panel/30 border border-line rounded-lg p-5 overflow-y-auto">
            {error && !selected && <div className="text-danger mb-4">{error}</div>}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredIndex.map((t) => {
                const isSelected = selected?.id === t.id
                return (
                  <button 
                    key={t.id} 
                    className="flex flex-col items-center gap-3 cursor-pointer group w-full outline-none"
                    onClick={() => {
                      setSelected(t)
                      setError(null)
                    }}
                  >
                    <div className={`w-full aspect-[1/1.4] bg-white rounded shadow-sm relative overflow-hidden flex items-center justify-center transition-all ${isSelected ? 'ring-2 ring-brand ring-offset-2 ring-offset-[#1a1a1e]' : 'border border-line-2'}`}>
                      {t.thumbnailUrl ? (
                         <img src={t.thumbnailUrl} alt={t.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-gray-300 flex flex-col items-center gap-2">
                           <Layers size={32} />
                           <span className="text-xs font-medium px-4 text-center text-gray-400">{t.name}</span>
                        </div>
                      )}
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <div className="bg-[#1a1a1e] text-white p-2 rounded shadow-lg">
                          <Search size={18} />
                        </div>
                      </div>
                    </div>
                    
                    <div className={`border rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1.5 transition-colors ${isSelected ? 'bg-brand/20 border-brand/40 text-brand' : 'bg-panel border-line text-white group-hover:bg-raised'}`}>
                      <Star size={12} className={isSelected ? 'fill-brand text-brand' : ''} />
                      {t.name}
                    </div>
                  </button>
                )
              })}
              
              {filteredIndex.length === 0 && !error && (
                <div className="col-span-full text-center text-fg-2 py-12">
                  No templates found matching your search.
                </div>
              )}
            </div>
          </div>

          {/* Right Pane (Details) */}
          <div className="w-[280px] flex flex-col shrink-0">
            {!selected ? (
              <div className="flex flex-col items-center text-center mt-12 gap-4">
                <Layers size={64} className="text-fg-3" />
                <h3 className="text-white font-medium text-lg">Select a template to get started</h3>
                <p className="text-sm text-fg-2 leading-relaxed">
                  Choose a template to kick off your project. You can change everything later!
                </p>
                <p className="text-sm text-fg-2 leading-relaxed mt-4">
                  You can also browse all available templates on <a href="#" className="text-brand hover:underline">Typst Universe</a> to get inspired.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 overflow-y-auto pr-2 pb-4">
                <h3 className="text-white font-semibold text-lg">{meta?.name ?? selected.name}</h3>
                
                {selected.author && (
                  <p className="text-sm text-fg-2">By {selected.author}</p>
                )}
                
                <p className="text-sm text-fg-2 leading-relaxed">
                  {meta?.description ?? selected.description}
                </p>

                {meta && meta.variables.length > 0 && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
                    <h4 className="text-sm font-medium text-white">Template Variables</h4>
                    {meta.variables.map((v) => (
                      <label key={v.id} className="flex flex-col gap-1.5 text-xs font-medium text-fg-2">
                        {v.id.toUpperCase()}
                        <input
                          className="rounded border border-line bg-panel px-2.5 py-2 text-sm text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                          value={values[v.id] ?? ''}
                          onChange={(e) => setValues({ ...values, [v.id]: e.target.value })}
                        />
                      </label>
                    ))}
                  </div>
                )}
                
                {error && <div className="text-danger text-sm mt-2">{error}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-line p-4 flex justify-end shrink-0 bg-panel/50">
          <button
            disabled={!selected || creating}
            onClick={handleCreate}
            className="text-white font-medium px-6 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: !selected ? 'var(--bg-raised)' : 'var(--accent-fill)' }}
          >
            {creating && <Loader2 size={16} className="animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
