import YAML from 'yaml'

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
}

export async function fetchTemplateIndex(): Promise<TemplateIndexEntry[]> {
  const res = await fetch('/templates/index.json')
  if (!res.ok) return []
  return res.json()
}

export async function fetchTemplateMeta(path: string): Promise<TemplateMeta> {
  const res = await fetch(`/templates/${path}/template.yaml`)
  if (!res.ok) throw new Error('Could not load template')
  const text = await res.text()
  const doc = YAML.parse(text)
  return { name: doc.name ?? path, description: doc.description ?? '', variables: doc.variables ?? [] }
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
