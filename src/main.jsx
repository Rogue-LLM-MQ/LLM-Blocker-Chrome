import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import EventDashboard from './EventDashboard.jsx'
import LLM_Checker from './LLM_Checker.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EventDashboard />
    <LLM_Checker/>
  </StrictMode>,
)
