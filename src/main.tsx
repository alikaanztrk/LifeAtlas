import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { applyPreferences, initialPreferences } from './locales/i18n'
import './styles/base.css'
import './styles/exploration.css'

applyPreferences(initialPreferences)
const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)
