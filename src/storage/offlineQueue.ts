import { get, set } from 'idb-keyval'
import type { ProjectRecord } from '../state/workspace'

const KEY = 'typst:offline-queue'

interface SerializedFile { path: string; kind: 'source' | 'asset'; text?: string; dataB64?: string }

function toB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function serializeRecord(r: ProjectRecord): unknown {
  return {
    meta: r.meta,
    files: r.files.map((f): SerializedFile => (f.data ? { path: f.path, kind: f.kind, dataB64: toB64(f.data) } : { path: f.path, kind: f.kind, text: f.text })),
  }
}

export function deserializeRecord(s: any): ProjectRecord {
  return {
    meta: s.meta,
    files: (s.files as SerializedFile[]).map((f) => (f.dataB64 ? { path: f.path, kind: f.kind, data: fromB64(f.dataB64) } : { path: f.path, kind: f.kind, text: f.text })),
  }
}

export async function queueRecord(record: ProjectRecord): Promise<void> {
  const q = ((await get(KEY)) as unknown[]) ?? []
  q.push(serializeRecord(record))
  await set(KEY, q.slice(-50))
}

export async function flushQueue(save: (r: ProjectRecord) => Promise<void>): Promise<void> {
  const q = ((await get(KEY)) as unknown[]) ?? []
  if (q.length === 0) return
  await set(KEY, [])
  for (const item of q) {
    try {
      await save(deserializeRecord(item))
    } catch {
      // re-queue the rest on failure
      const rest = q.slice(q.indexOf(item))
      await set(KEY, rest)
      return
    }
  }
}

export function startOfflineSync(save: (r: ProjectRecord) => Promise<void>): void {
  window.addEventListener('online', () => void flushQueue(save))
}
