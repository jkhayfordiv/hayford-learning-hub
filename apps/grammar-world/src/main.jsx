import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Extract token from URL query params if present
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');

if (tokenFromUrl) {
  // Store token in localStorage
  localStorage.setItem('token', tokenFromUrl);
  
  // Remove token from URL for clean navigation
  const cleanUrl = window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
