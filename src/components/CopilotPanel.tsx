import { useState } from 'react'

const KEY = 'typst:ai'

export interface AiConfig { baseUrl: string; apiKey: string; model: string }

export function loadAiConfig(): AiConfig {
  try {
    return { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '', ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' }
  }
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

const SYSTEM = 'You are a Typst markup expert. Answer concisely. When you provide code, wrap it in a fenced code block with language `typst`.'

export async function askAi(config: AiConfig, prompt: string, history: ChatMsg[]): Promise<string> {
  const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: SYSTEM }, ...history.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? ''
}

export function CopilotPanel({ onInsert, getSelection }: { onInsert: (code: string) => void; getSelection?: () => string }) {
  const [config, setConfig] = useState<AiConfig>(loadAiConfig)
  const [history, setHistory] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [saved, setSaved] = useState(false)

  const send = async () => {
    const prompt = input.trim()
    if (!prompt || busy) return
    setInput('')
    setBusy(true)
    const next = [...history, { role: 'user' as const, content: prompt }]
    setHistory(next)
    try {
      const answer = await askAi(config, prompt, history)
      setHistory([...next, { role: 'assistant', content: answer }])
    } catch (e) {
      setHistory([...next, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'AI request failed'}. Check the API key and base URL in Settings.` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="file-panel">
      <div className="h-full flex flex-col text-sm bg-panel">
        <div className="file-panel-header flex items-center justify-between">
          <span>Copilot</span>
          <button className="text-xs text-fg-3 hover:text-fg" aria-expanded={showSettings} aria-controls="copilot-settings" onClick={() => setShowSettings((v) => !v)}>Settings</button>
        </div>
        {showSettings && (
          <div id="copilot-settings" className="p-2 flex flex-col gap-2 border-b border-line text-xs">
            <input aria-label="API base URL" className="file-input rounded px-2 py-1" placeholder="Base URL" value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} />
            <input aria-label="Model" className="file-input rounded px-2 py-1" placeholder="Model" value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} />
            <input aria-label="API key" className="file-input rounded px-2 py-1" placeholder="API key" type="password" autoComplete="off" value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} />
            <div className="flex items-center gap-2">
              <button className="rounded border border-line px-2 py-1" onClick={() => { localStorage.setItem(KEY, JSON.stringify(config)); setSaved(true); window.setTimeout(() => setSaved(false), 1500) }}>Save</button>
              <span role="status" aria-live="polite" className="text-fg-3">{saved ? 'Saved' : ''}</span>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto p-2 flex flex-col gap-3" aria-busy={busy} aria-live="polite">
          {history.length === 0 && <p className="text-xs text-fg-3">Ask anything about Typst, e.g. &quot;How do I create a 3-column table with a blue header?&quot;</p>}
          {history.map((m, i) => (
            <div key={i} className={`text-xs ${m.role === 'user' ? 'text-fg' : 'text-fg-2'}`}>
              <div className="font-semibold mb-0.5">{m.role === 'user' ? 'You' : 'Copilot'}</div>
              <div className="whitespace-pre-wrap">{renderWithInsert(m.content, onInsert)}</div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-line flex flex-col gap-2">
          {getSelection && (
            <button
              className="rounded border border-line px-2 py-1 text-xs text-fg-2 hover:text-fg self-start"
              disabled={busy}
              onClick={async () => {
                const sel = getSelection().trim()
                if (!sel || busy) return
                setBusy(true)
                const prompt = `Fix the syntax of this Typst math code and return only the corrected code in a typst code block:\n\n${sel}`
                const next = [...history, { role: 'user' as const, content: prompt }]
                setHistory(next)
                try {
                  const answer = await askAi(config, prompt, history)
                  setHistory([...next, { role: 'assistant', content: answer }])
                } catch (e) {
                  setHistory([...next, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'AI request failed'}. Check the API key and base URL in Settings.` }])
                } finally {
                  setBusy(false)
                }
              }}
            >
              Fix selected math
            </button>
          )}
          <div className="flex gap-1">
          <input
            className="file-input flex-1 rounded px-2 py-1 text-xs"
            placeholder="Ask Copilot…"
            aria-label="Ask Copilot"
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
          />
          <button className="rounded border border-line px-2 py-1 text-xs disabled:opacity-50" disabled={busy || !input.trim()} onClick={() => void send()}>{busy ? '…' : 'Send'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderWithInsert(text: string, onInsert: (code: string) => void) {
  const parts = text.split(/```(?:typst)?\n?/)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <div key={i} className="my-1">
        <pre className="bg-app rounded p-2 font-mono text-[11px] overflow-auto">{part.trim()}</pre>
        <button className="mt-1 rounded border border-line px-2 py-0.5 text-[11px]" onClick={() => onInsert(part.trim())}>Insert into document</button>
      </div>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}
