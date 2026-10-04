with open('src/storage/cloudStore.ts', 'r') as f:
    code = f.read()

# Add thumbnail to listProjects select
code = code.replace(".select('id, name, folder_id, created_at, updated_at')", ".select('id, name, folder_id, thumbnail, created_at, updated_at')")

# Map thumbnail in listProjects
code = code.replace("folderId: row.folder_id,", "folderId: row.folder_id,\n    thumbnail: row.thumbnail,")

# Map thumbnail in loadProject
code = code.replace("name: projectData.name,", "name: projectData.name,\n      thumbnail: projectData.thumbnail,")

# Upsert thumbnail in saveProject
code = code.replace("name: record.meta.name,", "name: record.meta.name,\n      thumbnail: record.meta.thumbnail,")

with open('src/storage/cloudStore.ts', 'w') as f:
    f.write(code)
