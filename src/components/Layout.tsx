import { useState, useEffect, useRef } from 'react'
import {
  CalendarDays, FlaskConical,
  Syringe, Activity, Droplets, Calculator, Microscope, BookHeart, CheckCircle2, Dumbbell, Utensils,
} from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LanguageGate } from './LanguageGate'
import { useAuth } from '../context/AuthContext'
import { usePushNotifications } from '../lib/usePushNotifications'
import { PushNotificationListener } from './PushNotificationListener'
import { BottomNavigation } from './navigation/BottomNavigation'
import { routeLayoutMode } from './layoutMode'
import { useAbdruckNehmen } from './ui/umrissAbdruck'
import { AmbientLightProvider } from './ambient/AmbientLight'
import { ambientForPath } from './ambient/palettes'
import { dotStore } from '../features/dot/dotStore'
import { PASSKEY_AN } from '../features/auth/lib/passkey'
import { PasskeyNachfrage } from '../features/auth/components/PasskeyNachfrage'

const QUICK_ACTIONS = [
  { icon: CheckCircle2, label: 'Einnahme bestätigen', path: '/kalender#due-intakes', color: '#10b981' },
  { icon: FlaskConical, label: 'Substanz hinzufügen', path: '/my-stack#new-substance', color: '#00ccf5' },
  { icon: Syringe,      label: 'Injektion loggen',  path: '/injektionen',  color: '#10b981' },
  { icon: Dumbbell,     label: 'Training',          path: '/training',     color: '#f97316' },
  { icon: Utensils,     label: 'Essen eintragen',   path: '/ernaehrung',   color: '#f59e0b' },
  { icon: CalendarDays, label: 'Kalender / Zyklus', path: '/kalender',     color: '#8b5cf6' },
  { icon: Activity,     label: 'Blutspiegel',       path: '/simulation',   color: '#06b6d4' },
  { icon: Droplets,     label: 'Blutwerte',         path: '/blutwerte',    color: '#f43f5e' },
] as const

const QUICK_TILES = [
  { icon: Calculator,  label: 'Rechner',   path: '/rechner', color: '#3b82f6' },
  { icon: Microscope,  label: 'The Lab',   path: '/lab',     color: '#8b5cf6' },
  { icon: BookHeart,   label: 'Tagebuch',  path: '/tagebuch',color: '#ec4899' },
  { icon: FlaskConical,label: 'Peptipedia',path: '/lab/peptipedia', color: '#06b6d4' },
] as const

export function Layout() {
  const location = useLocation()
  const { pathname } = location
  const navigate = useNavigate()
  const { user } = useAuth()
  // Nur fuer den Abgleich der gespeicherten Zeitzone beim Start. Nach der
  // Erlaubnis fragt nicht mehr die App beim Start, sondern die Stelle, die sie
  // braucht: Erinnerung im Stack, Pausen-Hinweis im Training, Profil.
  usePushNotifications(user)

  const [showQuickActions,  setShowQuickActions]   = useState(false)

  // Close quick-action sheet on any route change
  useEffect(() => { setShowQuickActions(false) }, [pathname])

  const handleQuickNav = (path: string) => {
    setShowQuickActions(false)
    const hashIndex = path.indexOf('#')
    if (hashIndex >= 0) {
      navigate({ pathname: path.slice(0, hashIndex), hash: path.slice(hashIndex + 1) })
      return
    }
    navigate(path)
  }

  const { lockViewport, hideBottomNav, hideTabBar } = routeLayoutMode(pathname)
  // Hat die Seite geladen, merkt sich ihre Silhouette, wie sie aussieht
  const mainRef = useRef<HTMLElement>(null)
  useAbdruckNehmen(mainRef, pathname)
  const ambient = ambientForPath(pathname)
  // Dot lebt über den Routen (App.tsx); hier sagt das Gerüst nur, wie die Seite aussieht
  useEffect(() => { dotStore.setApp({ mitLeiste: !hideTabBar, schnellzugriff: showQuickActions }) }, [hideTabBar, showQuickActions])
  useEffect(() => () => dotStore.setApp(null), [])

  return (
    // Umgebungslicht hinter allen Seiten — Farbe und Stärke je Bereich.
    // Die Hülle ist das Portal nach der Anmeldung: Dot schneidet sie Bild für Bild frei.
    <div data-dot-portal>
    <AmbientLightProvider palette={ambient.palette} level={ambient.level} off={hideBottomNav}>
    <div
      className={`flex w-full flex-col overflow-x-hidden ${lockViewport ? 'overflow-y-hidden' : 'min-h-dvh'}`}
      style={{
        maxWidth: '100vw',
        height: lockViewport
          ? 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))'
          : undefined,
      }}
    >

      <main
        ref={mainRef}
        className={`min-h-0 flex-1 w-full overflow-x-hidden ${hideBottomNav ? 'h-dvh px-0 pt-0 overflow-hidden overscroll-none' : lockViewport ? 'overflow-y-hidden px-3 pt-4' : 'px-3 pt-4'}`}
        style={{
          paddingBottom: hideBottomNav
            ? 0
            : hideTabBar
              ? 'calc(1rem + env(safe-area-inset-bottom))'
              : lockViewport
                ? 'var(--bottom-nav-height)'
                : 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))',
          paddingTop: hideBottomNav ? 0 : undefined,
        }}
      >
        <Outlet />
      </main>
      {/* Schleier hinter Uhrzeit und Akku, damit der Inhalt darunter abtaucht */}
      {!hideBottomNav && <div aria-hidden="true" className="lg-statusbar-scrim" />}

      <LanguageGate />
      {PASSKEY_AN && <PasskeyNachfrage />}
      <PushNotificationListener />


      {/* ── Quick-Action backdrop + sheet ──────────────────────────────────── */}
      {!hideTabBar && showQuickActions && (
        <>
          <div
            onClick={() => setShowQuickActions(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(0,0,0,0.45)' }}
          />
          {/* Glas-Menü, das aus dem Plus-Knopf unten rechts herauswächst */}
          <div className="lg-glass lg-menu" style={{
            position: 'fixed',
            bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 10px)',
            left: 'max(16px, env(safe-area-inset-left))',
            right: 'max(16px, env(safe-area-inset-right))',
            maxWidth: 480,
            marginInline: 'auto',
            zIndex: 46,
            borderRadius: 28,
            overflow: 'hidden',
          }}
            data-app-modal
            role="dialog"
            aria-modal="true"
            aria-label="Schnellaktionen"
            tabIndex={-1}
            onKeyDown={event => {
              if (event.key === 'Escape') setShowQuickActions(false)
            }}
          >
            {/* Action list */}
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={action.path + action.label}
                onClick={() => handleQuickNav(action.path)}
                className="lg-menu-row"
                data-last={i === QUICK_ACTIONS.length - 1}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: action.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff',
                }}>
                  <action.icon size={17} strokeWidth={2.2} />
                </div>
                <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--text)' }}>
                  {action.label}
                </span>
              </button>
            ))}

            {/* Tile grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 10 }}>
              {QUICK_TILES.map(tile => (
                <button
                  key={tile.path + tile.label}
                  onClick={() => handleQuickNav(tile.path)}
                  className="lg-menu-tile"
                >
                  <tile.icon size={20} color={tile.color} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {tile.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom nav ─────────────────────────────────────────────────────
          Die Leiste selbst liegt in `navigation/`: Modell, Optik und
          Verdrahtung getrennt, damit im nativen iOS-Bau Apples echte Tab-Bar
          an die Stelle der Web-Nachbildung treten kann. */}
      {!hideTabBar && (
        <BottomNavigation
          pathname={pathname}
          quickActionsOpen={showQuickActions}
          onToggleQuickActions={() => setShowQuickActions(v => !v)}
        />
      )}
    </div>
    </AmbientLightProvider>
    </div>
  )
}
