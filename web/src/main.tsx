import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Register Service Worker for PWA
if ('serviceWorker' in navigator && !window.location.hostname.includes('localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(
      (reg) => {
        console.log('PWA ServiceWorker active:', reg.scope);
      },
      (err) => {
        console.debug('ServiceWorker skipped:', err);
      }
    );
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
