import re

with open('src/pages/EditorPage.tsx', 'r') as f:
    code = f.read()

# Top right boxes replacement:
# The current top right in EditorPage.tsx is:
# <div className="flex items-center gap-1.5 text-fg-2">
# ...
# </div>
# </header>

old_top_right_regex = r'<div className="flex items-center gap-1\.5 text-fg-2">.*?</header>'
new_top_right = """<div className="flex items-center gap-2 text-fg-2">
          
          <div className="flex items-center bg-panel border border-line rounded p-[3px] gap-[2px]">
            <button aria-label="Undo" title="Undo" className="p-1 hover:bg-raised rounded text-fg" onClick={() => { const v = editorViewRef.current; if (v) undo(v) }}><Undo2 size={14} /></button>
            <button aria-label="Redo" title="Redo" className="p-1 hover:bg-raised rounded text-fg" onClick={() => { const v = editorViewRef.current; if (v) redo(v) }}><Redo2 size={14} /></button>
          </div>
          
          <div className="flex items-center bg-panel border border-line rounded p-[3px] gap-[2px]">
            <button aria-label="Zoom out" title="Zoom out" className="p-1 hover:bg-raised rounded text-fg" onClick={() => setZoom(z => Math.max(25, z - 10))}><Minus size={14} /></button>
            <span className="text-[12px] w-9 text-center font-medium text-fg">{zoom}%</span>
            <button aria-label="Zoom in" title="Zoom in" className="p-1 hover:bg-raised rounded text-fg" onClick={() => setZoom(z => Math.min(500, z + 10))}><Plus size={14} /></button>
          </div>

          <div className="flex items-center bg-panel border border-line rounded p-[3px]">
            <button
              aria-label="Toggle preview"
              title="Show/hide preview panel"
              className={`p-1 hover:bg-raised rounded text-fg`}
              onClick={() => update('showBothPanels', !prefs.showBothPanels)}
            >
              <Layout size={14} />
            </button>
          </div>

          <button
            onClick={onShareLink}
            className="flex items-center h-[28px] px-3 ml-2 text-[13px] font-medium rounded border border-line bg-panel hover:bg-raised text-fg transition-colors"
          >
            {copied ? 'Copied' : 'Share'}
          </button>

          <div className="flex items-center bg-panel border border-line rounded h-[28px] text-fg transition-colors">
            <button
              onClick={() => setExportPanelOpen((v) => !v)}
              className="flex items-center px-2 h-full hover:bg-raised rounded-l border-r border-line"
              title="Export"
            >
              <Download size={14} />
            </button>
            <button
              onClick={() => setExportPanelOpen((v) => !v)}
              className="flex items-center px-1.5 h-full hover:bg-raised rounded-r"
            >
              <ChevronDown size={14} />
            </button>
          </div>
          
        </div>
      </header>"""

if re.search(old_top_right_regex, code, re.DOTALL):
    code = re.sub(old_top_right_regex, new_top_right, code, flags=re.DOTALL)
else:
    print("Could not find top right block")


# Formatting toolbar replacement:
# The current formatting-tools block is:
# <div className="workspace-toolbar">
#   <div className="formatting-tools" aria-label="Formatting toolbar">
# ...
#   </div>
# </div>
# Wait, the screenshot shows the formatting toolbar sitting ABOVE the code block, with a dark background.
# We will wrap it in a thin box `bg-panel border border-line rounded-lg p-[3px] gap-[2px]` and remove `workspace-toolbar` background.
old_format_tools = r'<div className="workspace-toolbar">\s*<div className="formatting-tools" aria-label="Formatting toolbar">.*?</div>\s*</div>'

new_format_tools = """<div className="flex px-4 py-2 border-b border-line bg-app">
            <div className="flex items-center bg-panel border border-line rounded-md p-[3px] gap-[2px]" aria-label="Formatting toolbar">
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg text-[12px] font-medium flex items-center justify-center transition-colors" title="Text" aria-label="Insert text" onClick={() => wrapSelection('', '', 'Text')}>Ag</button>
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg text-[12px] font-bold flex items-center justify-center transition-colors" title="Bold" aria-label="Bold" onClick={() => wrapSelection('*', '*', 'bold text')}>B</button>
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg text-[12px] italic font-serif flex items-center justify-center transition-colors" title="Italic" aria-label="Italic" onClick={() => wrapSelection('_', '_', 'italic text')}>I</button>
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg text-[12px] underline flex items-center justify-center transition-colors" title="Underline" aria-label="Underline" onClick={() => wrapSelection('#underline[', ']', 'underlined')}>U</button>
              <div className="w-[1px] h-[18px] bg-line mx-1" />
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg text-[12px] font-medium flex items-center justify-center transition-colors" title="Heading" aria-label="Heading" onClick={() => prefixLine('= ')}>H</button>
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg flex items-center justify-center transition-colors" title="Bulleted list" aria-label="Bulleted list" onClick={() => prefixLine('- ')}><List size={14} /></button>
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg flex items-center justify-center transition-colors" title="Numbered list" aria-label="Numbered list" onClick={() => prefixLine('+ ')}><ListOrdered size={14} /></button>
              <div className="w-[1px] h-[18px] bg-line mx-1" />
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg flex items-center justify-center transition-colors" title="Math block" aria-label="Math block" onClick={() => wrapSelection('$$\\n', '\\n$$', 'x^2 + y^2 = z^2')}><Sigma size={14} /></button>
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg flex items-center justify-center transition-colors" title="Code block" aria-label="Code block" onClick={() => wrapSelection('```typst\\n', '\\n```', '#let x = 1')}><Code size={14} /></button>
              <button className="h-[26px] min-w-[26px] px-1.5 rounded hover:bg-raised text-fg flex items-center justify-center transition-colors" title="Mention / reference" aria-label="Mention or reference" onClick={() => wrapSelection('@', '', 'figure-1')}><AtSign size={14} /></button>
            </div>
          </div>"""

if re.search(old_format_tools, code, re.DOTALL):
    code = re.sub(old_format_tools, new_format_tools, code, flags=re.DOTALL)
else:
    print("Could not find formatting tools block")

with open('src/pages/EditorPage.tsx', 'w') as f:
    f.write(code)

