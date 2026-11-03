import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../index.css'
import '../../styles/liquid-glass.css'
import i18n, { i18nReady } from '../../i18n'
import { MockupApp, type Screen } from './MockupApp'

/**
 * Eine Vorschau der App für die Landing Page: läuft in einem eigenen Fenster
 * (iframe in einem Handy-Rahmen), damit Leiste und Hoku wie in der App mit
 * dem Fenster rechnen. Keine Anmeldung, keine Datenbank — Beispieldaten, die
 * auf Tipps reagieren. Welcher Bildschirm, steht in der Adresse (`?screen=`).
 */
const params = new URL(window.location.href).searchParams
const screen = (['heute', 'kalorien', 'tagebuch'].includes(params.get('screen') ?? '') ? params.get('screen') : 'heute') as Screen
const lang = (params.get('lang') ?? 'de').startsWith('de') ? 'de' : 'en'
document.documentElement.setAttribute('data-look', 'schwarz')

// Die Sprache der Vorschau darf die gespeicherte Wahl der App (tyd_lang, gleiche Herkunft) nicht überschreiben
const gemerkt = (() => { try { return localStorage.getItem('tyd_lang') } catch { return null } })()
const sprachWahlZurueck = () => { try { if (gemerkt === null) localStorage.removeItem('tyd_lang'); else localStorage.setItem('tyd_lang', gemerkt) } catch { /* kein Speicher */ } }
void i18nReady.then(() => i18n.changeLanguage(lang)).finally(() => {
  sprachWahlZurueck()
  createRoot(document.getElementById('root')!).render(
    <StrictMode><MemoryRouter initialEntries={['/']}><MockupApp screen={screen} /></MemoryRouter></StrictMode>,
  )
})
