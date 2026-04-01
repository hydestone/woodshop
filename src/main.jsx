import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Portfolio from './pages/Portfolio.jsx'
import './styles.css'

const isPortfolio = window.location.pathname === '/portfolio'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPortfolio ? <Portfolio /> : <App />}
  </React.StrictMode>
)
