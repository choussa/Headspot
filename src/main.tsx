import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import './App.css'
import App from './App.tsx'
import { startOfflineSync } from './storage/offlineQueue'
import { saveProject } from './storage/cloudStore'

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
  } else {
    // A service worker in dev serves stale cached modules and breaks HMR.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => { void reg.unregister() })
    }).catch(() => {})
  }
}
startOfflineSync(saveProject)


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
