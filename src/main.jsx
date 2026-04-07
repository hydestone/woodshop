import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Portfolio from './pages/Portfolio.jsx'
import './styles.css'

// Register service worker for PWA / offline support (not needed on portfolio page)
if ('serviceWorker' in navigator && window.location.pathname !== '/portfolio') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(err => console.warn('[SW] Registration failed:', err))
  })
}

const isPortfolio = window.location.pathname === '/portfolio'

// Must run synchronously before React renders and before CSS locks in
if (isPortfolio) {
  document.documentElement.classList.add('portfolio-page')
} else {
  document.documentElement.classList.remove('portfolio-page')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  isPortfolio ? <Portfolio /> : <App />
)
