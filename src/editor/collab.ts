import * as Y from 'yjs'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface CollabUser { name: string; color: string; colorLight: string }

type AwarenessListener = (event: { added: number[]; updated: number[]; removed: number[] }) => void

/** Minimal awareness-compatible shim over a Supabase Realtime broadcast channel. */
export class SupabaseAwareness {
  managerBus: BroadcastChannel | null = null
  states = new Map<number, Record<string, unknown> | null>()
  private listeners = new Set<AwarenessListener>()
  doc: Y.Doc
  private channel: RealtimeChannel
  private path: string

  constructor(doc: Y.Doc, channel: RealtimeChannel, path: string) {
    this.doc = doc
    this.channel = channel
    this.path = path
  }

  on(type: string, listener: AwarenessListener) {
    if (type === 'change') this.listeners.add(listener)
  }
  off(type: string, listener: AwarenessListener) {
    if (type === 'change') this.listeners.delete(listener)
  }

  getLocalState() {
    return this.states.get(this.doc.clientID) ?? null
  }

  setLocalState(state: Record<string, unknown> | null) {
    const updated = this.states.has(this.doc.clientID)
    this.states.set(this.doc.clientID, state)
    this.emit({ added: updated ? [] : [this.doc.clientID], updated: updated ? [this.doc.clientID] : [], removed: [] })
    void this.channel.send({ type: 'broadcast', event: 'collab', payload: { type: 'awareness', path: this.path, clientId: this.doc.clientID, state } })
    this.managerBus?.postMessage({ type: 'awareness', path: this.path, clientId: this.doc.clientID, state })
  }

  setLocalStateField(field: string, value: unknown) {
    const cur = { ...(this.getLocalState() ?? {}) }
    cur[field] = value
    this.setLocalState(cur)
  }

  getStates() {
    return this.states
  }

  applyRemote(clientId: number, state: Record<string, unknown> | null) {
    const isNew = !this.states.has(clientId)
    this.states.set(clientId, state)
    this.emit({ added: isNew ? [clientId] : [], updated: isNew ? [] : [clientId], removed: [] })
  }

  private emit(event: { added: number[]; updated: number[]; removed: number[] }) {
    for (const l of this.listeners) l(event)
  }
}

export interface CollabSession {
  ydoc: Y.Doc
  ytext: Y.Text
  awareness: SupabaseAwareness
  path: string
  ready: Promise<void>
  resolveReady: () => void
  canAcceptFullState: () => boolean
  markRemoteState: () => void
  hasRemoteState: () => boolean
}

const PALETTE = ['#e5484d', '#3e63dd', '#12a594', '#f76b15', '#8e4ec6', '#0091ff']

function base64Encode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function base64Decode(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export class CollabManager {
  private channel: RealtimeChannel
  private sessions = new Map<string, CollabSession>()
  private user: CollabUser | null = null
  private localBus: BroadcastChannel | null = null

  constructor(projectId: string) {
    this.localBus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`headspot-project-${projectId}`) : null
    this.channel = supabase.channel(`project:${projectId}`)
    this.channel.on('broadcast', { event: 'collab' }, ({ payload }) => this.onPayload(payload))
    void this.channel.subscribe()
    this.localBus?.addEventListener('message', (e) => this.onPayload(e.data))
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? 'Anonymous'
      this.user = {
        name: email.split('@')[0],
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        colorLight: '#30bced33',
      }
    })
  }

  sessionFor(path: string, initialText: string): CollabSession {
    const existing = this.sessions.get(path)
    if (existing) return existing

    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('text')
    const awareness = new SupabaseAwareness(ydoc, this.channel, path)
    awareness.managerBus = this.localBus

    ydoc.on('update', (update: Uint8Array, origin) => {
      if (origin === 'remote' || origin === 'local-seed') return
      void this.channel.send({
        type: 'broadcast',
        event: 'collab',
        payload: { type: 'update', path, update: base64Encode(update) },
      })
      this.localBus?.postMessage({ type: 'update', path, update: base64Encode(update) })
    })

    let seeded = false
    let gotRemoteState = false
    let resolveReady!: () => void
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve
      const finish = () => {
        if (seeded || gotRemoteState) return
        seeded = true
        if (ytext.length === 0) {
          ydoc.transact(() => ytext.insert(0, initialText), 'local-seed')
          void this.broadcastFullState(path, ydoc)
        }
        resolve()
      }
      window.setTimeout(finish, 750)
    })

    const session: CollabSession = {
      ydoc,
      ytext,
      awareness,
      path,
      ready: ready.then(() => {
        if (this.user) awareness.setLocalState({ user: this.user })
        return undefined
      }),
      resolveReady: () => resolveReady(),
      canAcceptFullState: () => !seeded,
      markRemoteState: () => { gotRemoteState = true },
      hasRemoteState: () => gotRemoteState,
    }

    const sp = { type: 'sync-request', path }; void this.channel.send({ type: 'broadcast', event: 'collab', payload: sp }); this.localBus?.postMessage(sp)
    this.sessions.set(path, session)
    return session
  }

  private broadcastFullState(path: string, ydoc: Y.Doc) {
    const payload = { type: 'full-state', path, update: base64Encode(Y.encodeStateAsUpdate(ydoc)) }
    void this.channel.send({ type: 'broadcast', event: 'collab', payload })
    this.localBus?.postMessage(payload)
  }

  private onPayload(payload: any) {
    if (!payload || typeof payload !== 'object') return
    switch (payload.type) {
      case 'update': {
        const s = this.sessions.get(payload.path)
        if (s) {
          s.markRemoteState()
          Y.applyUpdate(s.ydoc, base64Decode(payload.update), 'remote')
        }
        break
      }
      case 'full-state': {
        const s = this.sessions.get(payload.path)
        if (!s) break
        if (s.canAcceptFullState()) {
          Y.applyUpdate(s.ydoc, base64Decode(payload.update), 'remote')
          s.markRemoteState()
          s.resolveReady()
        }
        break
      }
      case 'sync-request': {
        const s = this.sessions.get(payload.path)
        if (s) this.broadcastFullState(payload.path, s.ydoc)
        else { const np = { type: 'no-session', path: payload.path }; void this.channel.send({ type: 'broadcast', event: 'collab', payload: np }); this.localBus?.postMessage(np) }
        break
      }
      case 'awareness': {
        const s = this.sessions.get(payload.path)
        if (s) s.awareness.applyRemote(payload.clientId, payload.state)
        break
      }
    }
  }

  async destroy() {
    await supabase.removeChannel(this.channel)
    this.sessions.clear()
  }
}
