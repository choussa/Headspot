import { get, set } from 'idb-keyval'

export interface StoredProject {
  id: string
  name: string
  source: string
  updatedAt: number
}

const KEY = 'headspot-project'

export async function loadProject(): Promise<StoredProject | undefined> {
  return get<StoredProject>(KEY)
}

export async function saveProject(p: StoredProject): Promise<void> {
  await set(KEY, p)
}
