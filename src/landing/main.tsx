import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import '../styles/liquid-glass.css'
import './landing.css'
import { LandingPage } from './LandingPage'

/**
 * Die Landing Page (meethoku.com): Hoku stellt sich vor, die App zeigt sich in
 * echten Vorschauen. Eigener Einstieg neben der App (landing.html), ohne
 * Anmeldung, ohne Supabase, ohne Service Worker.
 */
document.documentElement.setAttribute('data-look', 'schwarz')
createRoot(document.getElementById('root')!).render(<StrictMode><LandingPage /></StrictMode>)
