import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// Register the service worker in a built app only. In dev it would serve yesterday's bundle from
// cache and make every edit look like it did nothing, which is a long afternoon to debug.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline is a bonus, never a blocker */ });
  });
}
