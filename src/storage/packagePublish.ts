import { supabase } from '../lib/supabase'
import type { TarEntry } from './tar'
import type { PackageConfig, ProjectFile } from '../state/workspace'

export const PACKAGE_BUCKET = 'private_packages'

/** typst.toml manifest for a package/template. */
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

/** Download a locally available package tarball; null when missing. */
export async function downloadLocalPackage(storagePath: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabase.storage.from(PACKAGE_BUCKET).download(storagePath)
    if (error || !data) return null
    return new Uint8Array(await data.arrayBuffer())
  } catch {
    return null
  }
}
