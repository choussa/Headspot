import re

with open('src/storage/cloudStore.ts', 'r') as f:
    code = f.read()

code = code.replace("const { data, error } = await supabase", "const { data, error: err } = await supabase")
code = code.replace("if (error) {", "if (err) {")
code = code.replace("console.error('Error fetching projects:', error)", "console.error('Error fetching projects:', err)")

# Also handle "return data.map(" since data could be null
code = code.replace("return data.map(", "return (data || []).map(")

with open('src/storage/cloudStore.ts', 'w') as f:
    f.write(code)
