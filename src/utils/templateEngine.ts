import { parse } from 'smol-toml'

export interface TemplateVariable {
  id: string
  type: 'string'
  default?: string
}

export interface TemplateMeta {
  name: string
  description: string
  variables: TemplateVariable[]
}

export interface TemplateIndexEntry {
  id: string
  name: string
  description: string
  path: string
  category?: string
  discipline?: string
  author?: string
  thumbnailUrl?: string
}

export async function fetchTemplateIndex(): Promise<TemplateIndexEntry[]> {
  const res = await fetch('/templates/index.json')
  if (!res.ok) return []
  return res.json()
}

export async function fetchTemplateMeta(path: string): Promise<TemplateMeta> {
  const res = await fetch(`/templates/${path}/typst.toml`)
  if (!res.ok) throw new Error('Could not load template')
  const text = await res.text()
  const doc = parse(text) as any
  
  const packageMeta = doc.package || {}
  
  // Custom extension: allow template variables in [template.variables]
  let variables = []
  if (doc.template && Array.isArray(doc.template.variables)) {
    variables = doc.template.variables
  }

  return { 
    name: packageMeta.name ?? path, 
    description: packageMeta.description ?? '', 
    variables 
  }
}

export async function fetchTemplateSource(path: string): Promise<string> {
  const res = await fetch(`/templates/${path}/main.typ`)
  if (!res.ok) throw new Error('Could not load template source')
  return res.text()
}

export function renderTemplate(source: string, values: Record<string, string>): string {
  let out = source
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{{${key}}}`).join(value)
  }
  return out
}
