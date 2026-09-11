import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "./css/styles.css"
import "./css/responsive.css"
import "./css/dashboard.css"
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
