import re

with open('src/pages/EditorPage.tsx', 'r') as f:
    code = f.read()

# We want to remove the `<div className="preview-tools">` block completely.
# It ends with `</div>\n          </div>\n          )}`
# Let's find `<div className="preview-tools">` and remove until its closing tag.
# Because regex with HTML can be tricky, let's use string manipulation or a specific regex.

pattern = r'<div className="preview-tools">.*?</div>\s*</div>\s*\)\}'
replacement = r'</div>\n          )}\n' # The first </div> closes `formatting-tools` or `workspace-toolbar`?
# Wait, `workspace-toolbar` contains `formatting-tools` and `preview-tools`.
# Let's look at the structure:
#           <div className="workspace-toolbar">
#             <div className="formatting-tools" aria-label="Formatting toolbar"> ... </div>
#             <div className="preview-tools"> ... </div>
#           </div>
#           )}

# Let's do a precise string replacement:
start_str = '<div className="preview-tools">'
end_str = '</div>\n          </div>\n          )}'

idx_start = code.find(start_str)
if idx_start != -1:
    idx_end = code.find(end_str, idx_start)
    if idx_end != -1:
        # replace with just closing `workspace-toolbar`
        code = code[:idx_start] + '</div>\n          )}\n' + code[idx_end + len(end_str):]

with open('src/pages/EditorPage.tsx', 'w') as f:
    f.write(code)

