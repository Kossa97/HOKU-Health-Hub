import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomNavigation } from '../../components/navigation/BottomNavigation'
import type { DotApi } from '../../features/dot/engine/dotEngine'
import { MockupDot } from './MockupDot'
import { HeuteScreen } from './screens/HeuteScreen'
import { KalorienScreen } from './screens/KalorienScreen'
import { TagebuchScreen } from './screens/TagebuchScreen'
import { vorschauText, type VorschauTextKey } from './texte'

export type Screen = 'heute' | 'kalorien' | 'tagebuch'
const PFAD: Record<Screen, string> = { heute: '/', kalorien: '/ernaehrung', tagebuch: '/tagebuch' }

/** Was die Bildschirme von Hoku brauchen: ihn sprechen und sich freuen lassen. */
export interface VorschauHoku {
  dot(): DotApi | null
  /** Hoku sagt es, wenn er draußen ist; drinnen bleibt er still (wie in der App). */
  sag(key: VorschauTextKey, ms?: number): void
  freude(key?: VorschauTextKey): void
  t(key: VorschauTextKey): string
}
const Kontext = createContext<VorschauHoku | null>(null)
export const useVorschauHoku = () => useContext(Kontext)!

export function MockupApp({ screen }: { screen: Screen }) {
  const { i18n } = useTranslation()
  const api = useRef<DotApi | null>(null)
  const lang: 'de' | 'en' = i18n.language?.startsWith('de') ? 'de' : 'en'
  const langRef = useRef(lang); useEffect(() => { langRef.current = lang }, [lang])
  const [, setBereit] = useState(false)

  // Nachrichten der Landing Page: Hoku rufen oder heimschicken, Sprache
  useEffect(() => {
    const beiNachricht = (e: MessageEvent) => {
      if (e.source !== window.parent) return
      const d = e.data as { hoku?: boolean; art?: string; lang?: string }
      if (!d?.hoku) return
      const dot = api.current
      if (d.art === 'rein') dot?.klingeln()
      else if (d.art === 'raus') dot?.heimgehen()
      else if (d.art === 'sprache' && d.lang) {
        const gemerkt = (() => { try { return localStorage.getItem('tyd_lang') } catch { return null } })()
        void i18n.changeLanguage(d.lang).finally(() => { try { if (gemerkt === null) localStorage.removeItem('tyd_lang'); else localStorage.setItem('tyd_lang', gemerkt) } catch { /* kein Speicher */ } })
      }
    }
    window.addEventListener('message', beiNachricht)
    return () => window.removeEventListener('message', beiNachricht)
  }, [i18n])

  const t = useCallback((key: VorschauTextKey) => vorschauText(langRef.current, key), [])
  const hoku: VorschauHoku = {
    dot: () => api.current,
    t,
    sag: (key, ms) => { const d = api.current; if (d && d.modus() === 'home') d.sag(t(key), ms ?? 3600) },
    freude: key => {
      const d = api.current
      if (!d || d.modus() !== 'home') return
      d.setStimmung('joy'); if (key) d.sag(t(key), 3200)
      window.setTimeout(() => d.setStimmung('idle'), 2200)
    },
  }

  return (
    <Kontext.Provider value={hoku}>
      <div data-dot-portal style={{ minHeight: '100dvh' }}>
        <main style={{ padding: '52px 16px calc(var(--bottom-nav-height) + 28px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {screen === 'heute' && <HeuteScreen />}
          {screen === 'kalorien' && <KalorienScreen />}
          {screen === 'tagebuch' && <TagebuchScreen />}
        </main>
        <BottomNavigation pathname={PFAD[screen]} quickActionsOpen={false} onToggleQuickActions={() => hoku.sag('plus')} />
        <MockupDot
          gruss={() => t(screen === 'heute' ? 'gruss_heute' : screen === 'kalorien' ? 'gruss_kalorien' : 'gruss_tagebuch')}
          beiAntippen={dot => { dot.setStimmung('speak'); dot.sag(t('angetippt'), 3200); window.setTimeout(() => dot.setStimmung('idle'), 1500) }}
          beiBereit={dot => { api.current = dot; setBereit(true); window.parent.postMessage({ hoku: true, art: 'bereit' }, '*') }}
        />
      </div>
    </Kontext.Provider>
  )
}
