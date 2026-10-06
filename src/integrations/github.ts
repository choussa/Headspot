export interface GithubConfig { token: string; repo: string; branch: string }

export function loadGithubConfig(): GithubConfig {
  try {
    return { token: '', repo: '', branch: 'main', ...JSON.parse(localStorage.getItem('typst:github') ?? '{}') }
  } catch {
    return { token: '', repo: '', branch: 'main' }
  }
}

export function saveGithubConfig(cfg: GithubConfig): void {
  localStorage.setItem('typst:github', JSON.stringify(cfg))
}

export async function pushToGitHub(cfg: GithubConfig, files: { path: string; text: string }[], message: string): Promise<void> {
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  for (const f of files) {
    const p = f.path.replace(/^\//, '')
    const api = `https://api.github.com/repos/${cfg.repo}/contents/${p}`
    const existing = await fetch(`${api}?ref=${cfg.branch}`, { headers })
    const sha = existing.ok ? (await existing.json()).sha : undefined
    const res = await fetch(api, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        branch: cfg.branch,
        content: btoa(unescape(encodeURIComponent(f.text))),
        ...(sha ? { sha } : {}),
      }),
    })
    if (!res.ok) throw new Error(`Failed to push ${f.path}: ${res.status} ${await res.text()}`)
  }
}
