import type { TypstProject } from '@vedivad/typst-web-service'
import { gunzipSync } from 'fflate'
import { untarSync, type TarEntry } from '../storage/tar'
import { bundleEntries, downloadLocalPackage } from '../storage/packagePublish'
import type { PackageConfig, ProjectFile } from '../state/workspace'

/** Context for resolving `@local/<name>:<version>` imports at compile time. */
export interface LocalPackageCtx {
  ownerId: string | null
  packageConfig?: PackageConfig
}

const LOCAL_IMPORT = /@local\/([A-Za-z0-9][A-Za-z0-9_-]*):(\d+\.\d+\.\d+)/g
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** ownerId -> spec -> gunzipped tarball bytes (null = known missing). */
const downloadCache = new Map<string, Map<string, Uint8Array | null>>()

type Engine = { setFile(path: string, bytes: Uint8Array): Promise<unknown> | void }

function engineOf(vp: TypstProject): Engine {
  return (vp as unknown as { engine: Engine }).engine
}

/** Collect the `name:version` spec of every `@local` import in `text`. */
function specsIn(text: string): Set<string> {
  const out = new Set<string>()
  for (const m of text.matchAll(LOCAL_IMPORT)) out.add(`${m[1]}:${m[2]}`)
  return out
}

/** typst.toml + a lib.typ whose #panic explains exactly what is missing. */
function stubEntries(name: string, version: string): TarEntry[] {
  const spec = `@local/${name}:${version}`
  return [
    { name: 'typst.toml', data: `[package]\nname = "${name}"\nversion = "${version}"\nentrypoint = "lib.typ"\n` },
    { name: 'lib.typ', data: `#panic("Package ${spec} is not available in this workspace. Publish it from its source project via File > Package settings, or ask a collaborator to publish it.")\n` },
  ]
}

async function fetchTarball(ownerId: string, spec: string): Promise<Uint8Array | null> {
  let bySpec = downloadCache.get(ownerId)
  if (!bySpec) {
    bySpec = new Map()
    downloadCache.set(ownerId, bySpec)
  }
  const cached = bySpec.get(spec)
  if (cached !== undefined) return cached
  const [name, version] = spec.split(':')
  const tar = await downloadLocalPackage(`${ownerId}/${name}-${version}.tar.gz`)
  const gz = tar ? gunzipSync(tar) : null
  bySpec.set(spec, gz)
  return gz
}

async function resolveEntries(spec: string, ctx: LocalPackageCtx, files: ProjectFile[]): Promise<TarEntry[]> {
  const [name, version] = spec.split(':')
  const cfg = ctx.packageConfig
  if (cfg && cfg.name === name && cfg.version === version) return bundleEntries(files, cfg)
  if (ctx.ownerId) {
    try {
      const tar = await fetchTarball(ctx.ownerId, spec)
      if (tar) return untarSync(tar)
    } catch {
      // network/RLS failure falls through to the explanatory stub
    }
  }
  return stubEntries(name, version)
}

/**
 * Resolve every `@local/<name>:<version>` import reachable from `files` and
 * push the package files into the worker VFS at `@local/<name>:<version>/<path>`.
 * A self-reference (the current project's own packageConfig) is bundled live from
 * `files`; anything else is downloaded from the private_packages bucket once and
 * cached. Missing packages get a stub whose #panic names the package.
 */
export async function injectLocalPackages(vp: TypstProject, ctx: LocalPackageCtx, files: ProjectFile[]): Promise<void> {
  const engine = engineOf(vp)
  const seen = new Set<string>()
  let frontier: string[] = []

  for (const f of files) {
    if (f.kind !== 'source' || !f.path.endsWith('.typ')) continue
    for (const s of specsIn(f.text ?? '')) frontier.push(s)
  }

  while (frontier.length > 0) {
    const batch = [...new Set(frontier.filter((s) => !seen.has(s)))]
    frontier = []
    if (batch.length === 0) break
    for (const spec of batch) {
      seen.add(spec)
      const entries = await resolveEntries(spec, ctx, files)
      for (const e of entries) {
        if (e.name.endsWith('.typ')) {
          const text = typeof e.data === 'string' ? e.data : decoder.decode(e.data)
          for (const s of specsIn(text)) frontier.push(s)
        }
      }
      for (const e of entries) {
        const data = typeof e.data === 'string' ? encoder.encode(e.data) : e.data
        await engine.setFile(`@local/${spec}/${e.name.replace(/^\//, '')}`, data)
      }
    }
  }
}
