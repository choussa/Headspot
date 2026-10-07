import { gzipSync } from 'fflate'
import { supabase } from '../lib/supabase'
import { tarSync, type TarEntry } from './tar'
import type { PackageConfig, ProjectFile, ProjectRecord } from '../state/workspace'

export const PACKAGE_BUCKET = 'private_packages'

export interface PackageVersion {
  id: string
  projectId: string | null
  ownerId: string
  name: string
  version: string
  description: string
  entrypoint: string
  isTemplate: boolean
  storagePath: string
  createdAt: number
}

/** typst.toml manifest for a published package/template. */
export function packageToml(cfg: PackageConfig): string {
  const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const strip = (p?: string) => (p ?? '').replace(/^\//, '')
  let out = '[package]\n'
  out += `name = ${q(cfg.name)}\n`
  out += `version = ${q(cfg.version)}\n`
  out += `description = ${q(cfg.description ?? '')}\n`
  out += `entrypoint = ${q(strip(cfg.entrypoint) || 'main.typ')}\n`
  if (cfg.isTemplate) {
    out += '\n[template]\n'
    out += `path = ${q(strip(cfg.templateDir) || 'template')}\n`
    out += `entrypoint = ${q(strip(cfg.templateEntrypoint) || cfg.entrypoint || 'template/main.typ')}\n`
  }
  return out
}

/** All project files plus a generated typst.toml, ready for tar. */
export function bundleEntries(files: ProjectFile[], cfg: PackageConfig): TarEntry[] {
  const entries: TarEntry[] = [{ name: 'typst.toml', data: packageToml(cfg) }]
  for (const f of files) {
    const name = f.path.replace(/^\//, '')
    if (!name) continue
    entries.push({ name, data: f.kind === 'source' ? (f.text ?? '') : (f.data ?? new Uint8Array()) })
  }
  return entries
}

function fromRow(row: Record<string, unknown>): PackageVersion {
  return {
    id: String(row.id),
    projectId: (row.project_id as string) ?? null,
    ownerId: String(row.owner_id ?? ''),
    name: String(row.name ?? ''),
    version: String(row.version ?? ''),
    description: String(row.description ?? ''),
    entrypoint: String(row.entrypoint ?? 'main.typ'),
    isTemplate: Boolean(row.is_template),
    storagePath: String(row.storage_path ?? ''),
    createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
  }
}

/** Bundle the project as a .tar.gz and upload it to the private_packages bucket. */
export async function publishPackage(opts: {
  ownerId: string
  record: ProjectRecord
  config: PackageConfig
}): Promise<PackageVersion> {
  const { ownerId, record, config } = opts
  const gz = gzipSync(tarSync(bundleEntries(record.files, config)))
  const storagePath = `${ownerId}/${config.name}-${config.version}.tar.gz`

  const { error: upErr } = await supabase.storage
    .from(PACKAGE_BUCKET)
    .upload(storagePath, new Blob([gz], { type: 'application/gzip' }), {
      upsert: true,
      contentType: 'application/gzip',
    })
  if (upErr) throw new Error(upErr.message || 'Upload failed')

  const { data, error: insErr } = await supabase
    .from('package_versions')
    .upsert(
      {
        project_id: record.meta.id,
        owner_id: ownerId,
        name: config.name,
        version: config.version,
        description: config.description ?? '',
        entrypoint: config.entrypoint,
        is_template: config.isTemplate,
        storage_path: storagePath,
      },
      { onConflict: 'owner_id,name,version' },
    )
    .select()
  if (insErr) throw new Error(insErr.message || 'Could not record the release')
  const row = Array.isArray(data) ? data[0] : data
  return row ? fromRow(row) : {
    id: '', projectId: record.meta.id, ownerId, name: config.name, version: config.version,
    description: config.description ?? '', entrypoint: config.entrypoint, isTemplate: config.isTemplate,
    storagePath, createdAt: Date.now(),
  }
}

/** All releases published by this user, newest first. */
export async function listPackageVersions(ownerId: string): Promise<PackageVersion[]> {
  try {
    const { data, error } = await supabase
      .from('package_versions')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map(fromRow)
  } catch {
    return []
  }
}

/** Download a published tarball; null when missing. */
export async function downloadLocalPackage(storagePath: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabase.storage.from(PACKAGE_BUCKET).download(storagePath)
    if (error || !data) return null
    return new Uint8Array(await data.arrayBuffer())
  } catch {
    return null
  }
}
