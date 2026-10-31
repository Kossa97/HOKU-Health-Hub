import { useState, useEffect, useRef } from 'react'
import {
  CalendarDays, FlaskConical, Bell, X, Share,
  Syringe, Activity, Droplets, Calculator, Microscope, BookHeart, CheckCircle2, Dumbbell, Utensils,
} from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { useHealthDailySync } from '../features/wearables/hooks/useHealthDailySync'

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

const PUSH_DISMISSED_KEY    = 'tyd_push_dismissed'
const IOS_INSTALL_SHOWN_KEY = 'tyd_ios_install_shown'

export function Layout() {
  const location = useLocation()
  const { pathname } = location
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { state: pushState, subscribe } = usePushNotifications(user)
  // Tageswerte aus Apple Health / Health Connect — nur nativ und nur mit Einwilligung.
  useHealthDailySync()

  const [showPushBanner,    setShowPushBanner]    = useState(false)
  const [showIOSBanner,     setShowIOSBanner]      = useState(false)
  const [showQuickActions,  setShowQuickActions]   = useState(false)

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => {
      if (pushState === 'ios-needs-install') {
        if (localStorage.getItem(IOS_INSTALL_SHOWN_KEY) !== 'true') setShowIOSBanner(true)
      } else if (pushState === 'default') {
        if (localStorage.getItem(PUSH_DISMISSED_KEY) !== 'true') setShowPushBanner(true)
      }
    }, 1200)
    return () => clearTimeout(timer)
  }, [user, pushState])

  const handlePushAccept = async () => {
    setShowPushBanner(false)
    await subscribe()
  }
  const handlePushDismiss = () => {
    setShowPushBanner(false)
    localStorage.setItem(PUSH_DISMISSED_KEY, 'true')
  }
  const handleIOSDismiss = () => {
    setShowIOSBanner(false)
    localStorage.setItem(IOS_INSTALL_SHOWN_KEY, 'true')
  }

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

      {/* ── iOS install guide banner ── */}
      {showIOSBanner && (
        <PushBanner
          icon={<Share size={15} color="#f59e0b" />}
          iconBg="rgba(245,158,11,0.15)"
          iconBorder="rgba(245,158,11,0.28)"
          title="App installieren für Notifications"
          desc={'Tippe auf ↑ Teilen → „Zum Home-Bildschirm" → dann Notifications aktivieren'}
          ctaLabel={undefined}
          ctaColor="#f59e0b"
          onCta={undefined}
          onDismiss={handleIOSDismiss}
        />
      )}

      {/* ── Push permission banner ── */}
      {showPushBanner && (
        <PushBanner
          icon={<Bell size={15} color="#00ccf5" />}
          iconBg="rgba(0,204,245,0.15)"
          iconBorder="rgba(0,204,245,0.28)"
          title={t('push_banner_title', { defaultValue: 'Einnahme-Erinnerungen' })}
          desc={t('push_banner_desc', { defaultValue: 'Zur eingestellten Zeit automatisch benachrichtigt werden.' })}
          ctaLabel={t('push_banner_allow', { defaultValue: 'Aktivieren' })}
          ctaColor="#00ccf5"
          onCta={handlePushAccept}
          onDismiss={handlePushDismiss}
        />
      )}

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
          paddingTop: hideBottomNav ? 0 : (showPushBanner || showIOSBanner)
            ? 'calc(1rem + 72px + env(safe-area-inset-top))'
            : undefined,
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

// ── PushBanner ────────────────────────────────────────────────────────────────

function PushBanner({
  icon, iconBg, iconBorder, title, desc,
  ctaLabel, ctaColor, onCta, onDismiss,
}: {
  icon: React.ReactNode
  iconBg: string
  iconBorder: string
  title: string
  desc: string
  ctaLabel?: string
  ctaColor: string
  onCta?: () => void
  onDismiss: () => void
}) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      padding: '12px 14px',
      paddingTop: 'calc(12px + env(safe-area-inset-top))',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 11, flexShrink: 0,
        background: iconBg, border: `1px solid ${iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
          {title}
        </p>
        <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
          {desc}
        </p>
      </div>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          style={{
            padding: '7px 12px', borderRadius: 11, flexShrink: 0,
            background: `${ctaColor}22`, border: `1px solid ${ctaColor}40`,
            color: ctaColor, fontSize: '0.7rem', fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {ctaLabel}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Schließen"
        style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}
