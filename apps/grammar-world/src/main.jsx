import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Extract token from URL query params if present
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');

if (tokenFromUrl) {
  localStorage.setItem('token', tokenFromUrl);
  const cleanUrl = window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
}

// Inject institution branding as CSS variables
(function() {
  try {
    const b = JSON.parse(localStorage.getItem('branding') || '{}');
    const primary = b.primary_color || '#5E1914';
    const secondary = b.secondary_color || '#0A1930';
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primary);
    if (r) {
      document.documentElement.style.setProperty('--gw-brand-primary', primary);
      document.documentElement.style.setProperty('--gw-brand-primary-rgb', `${parseInt(r[1],16)}, ${parseInt(r[2],16)}, ${parseInt(r[3],16)}`);
      document.documentElement.style.setProperty('--gw-brand-secondary', secondary);
    }
  } catch(e) {}
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
