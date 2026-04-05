import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Portfolio from './pages/Portfolio.jsx'
import './styles.css'

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
