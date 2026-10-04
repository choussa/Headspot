import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    code = f.read()

old_card = """        <Link to={`/editor/${p.id}`} className="block aspect-[1/1.2] w-full rounded-xl bg-white/95 border border-neutral-800 hover:border-blue-500 transition-colors overflow-hidden relative shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-neutral-200/80 to-transparent" />
          <FileText className="absolute bottom-2 right-2 text-neutral-300" size={18} />
          <div className="absolute bottom-2 left-3 right-8 truncate text-xs text-neutral-500">.typ</div>
        </Link>"""

new_card = """        <Link to={`/editor/${p.id}`} className="flex items-center justify-center aspect-[1/1.2] w-full rounded-xl bg-white border border-neutral-800 hover:border-blue-500 transition-colors overflow-hidden relative shadow-sm">
          {p.thumbnail ? (
            <div className="w-full h-full pointer-events-none [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain" dangerouslySetInnerHTML={{ __html: p.thumbnail }} />
          ) : (
            <>
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-neutral-200/80 to-transparent" />
              <FileText className="absolute bottom-2 right-2 text-neutral-300" size={18} />
              <div className="absolute bottom-2 left-3 right-8 truncate text-xs text-neutral-500">.typ</div>
            </>
          )}
        </Link>"""

code = code.replace(old_card, new_card)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(code)
