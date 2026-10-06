import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    code = f.read()

# Replace header in Dashboard
old_header = re.search(r'<header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-topbar px-5">.*?</header>', code, re.DOTALL)
new_header = """<header className="flex h-[36px] shrink-0 items-center justify-between border-b border-line bg-topbar px-4 text-[13px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 font-medium text-fg">
            <span className="text-white cursor-pointer font-bold mr-1">Typst</span>
            <button className="hover:text-white transition-colors cursor-pointer text-white">Project</button>
            <button className="hover:text-white transition-colors cursor-pointer text-fg-2">Team</button>
            <button className="hover:text-white transition-colors cursor-pointer text-fg-2">View</button>
            <button className="hover:text-white transition-colors cursor-pointer text-fg-2">Help</button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-fg-2 mr-2">
          <Cloud size={14} />
          <span className="hover:text-white cursor-pointer text-fg">black's Typst</span>
        </div>
      </header>"""

if old_header:
    code = code[:old_header.start()] + new_header + code[old_header.end():]
else:
    print("Header not found")

# Replace aside in Dashboard
old_aside = re.search(r'<aside className="dashboard-rail flex w-14 shrink-0 flex-col items-center border-r border-line bg-topbar py-3">.*?</aside>', code, re.DOTALL)
new_aside = """<aside className="dashboard-rail flex w-[48px] shrink-0 flex-col items-center border-r border-line bg-topbar py-3 gap-3">
          <span
            className="mb-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-danger-fill text-[13px] font-bold text-white cursor-pointer"
            title="User"
          >
            b
          </span>
          <button className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-white hover:text-white bg-raised hover:bg-line cursor-pointer mt-1" title="New document" onClick={handleCreateEmpty}>
            <Plus size={16} />
          </button>
          <div className="flex-1" />
          <button className="p-2 rounded text-fg-2 hover:text-fg cursor-pointer">
            <Settings size={18} />
          </button>
          <button className="p-2 rounded text-fg-2 hover:text-fg cursor-pointer">
            <Leaf size={18} />
          </button>
          <button className="p-2 rounded text-fg-2 hover:text-fg cursor-pointer">
            <CircleHelp size={18} />
          </button>
          <div className="rail-wordmark" aria-hidden="true">typst</div>
        </aside>"""

if old_aside:
    code = code[:old_aside.start()] + new_aside + code[old_aside.end():]
else:
    print("Aside not found")

# Add Leaf to imports if not there
if "Leaf" not in code:
    code = code.replace("Settings, CircleHelp,", "Settings, CircleHelp, Leaf,")

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(code)
