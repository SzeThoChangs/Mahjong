import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { asset } from '@/lib/asset';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// Register the service worker in a built app only. In dev it would serve yesterday's bundle from
// cache and make every edit look like it did nothing, which is a long afternoon to debug.
if (import.meta.env.PROD && !window.__SINGLE_FILE && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(asset('sw.js'), { scope: import.meta.env.BASE_URL }).catch(() => { /* offline is a bonus, never a blocker */ });
  });
}
