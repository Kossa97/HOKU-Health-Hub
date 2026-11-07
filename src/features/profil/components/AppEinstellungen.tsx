/**
 * Einstellungen der App, die bis Profil 2a auf der Profilseite standen und
 * jetzt unter ⚙︎ (/profil/einstellungen) liegen: Sprache, Erscheinungsbild,
 * Benachrichtigungen und der Störungs-Schalter (nur Admins/Entwicklung).
 * Inhalt unverändert übernommen.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, BellOff, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../context/AuthContext'
import { LANGUAGES, setLanguage, type LanguageCode } from '../../../i18n'
import { useLook, type Look } from '../../../lib/look'
import { requestTilt, setTiltWanted, tiltWanted } from '../../../lib/flashlight'
import { GlassSegmented, type SegmentOption } from '../../../components/ui/GlassSegmented'
import { Schalter } from '../../../components/ui/Schalter'
import { usePushNotifications } from '../../../lib/usePushNotifications'
import { setzeStoerungSimuliert, useStoerung } from '../../../lib/stoerung'

// ── LookSwitcher ─────────────────────────────────────────────────────────────

/** `vorschau`: auch Looks zeigen, die noch nicht die ganze App erreichen (nur Admin/Entwicklung). */
export function LookSwitcher({ vorschau = false }: { vorschau?: boolean }) {
  const { t } = useTranslation()
  const { look, setLook } = useLook()
  const options: SegmentOption<Look>[] = [
    { key: 'schwarz', label: String(t('look_black', { defaultValue: 'Schwarz' })) },
    { key: 'softdark', label: String(t('look_softdark', { defaultValue: 'Soft Dark' })) },
    { key: 'frost', label: String(t('look_frost', { defaultValue: 'Frost' })) },
    { key: 'labor', label: String(t('look_lab', { defaultValue: 'Labor' })) },
    { key: 'neon', label: String(t('look_neon', { defaultValue: 'Neon' })) },
    { key: 'tiefsee', label: String(t('look_deepsea', { defaultValue: 'Tiefsee' })) },
    { key: 'obsidian', label: String(t('look_obsidian', { defaultValue: 'Obsidian' })) },
    { key: 'instrument', label: String(t('look_instrument', { defaultValue: 'Instrument' })) },
    { key: 'satin', label: String(t('look_satin', { defaultValue: 'Satin' })) },
    { key: 'licht', label: String(t('look_light', { defaultValue: 'Licht' })) },
    { key: 'nacht', label: String(t('look_night', { defaultValue: 'Nacht' })) },
    ...(vorschau || look === 'papier' ? [{ key: 'papier' as const, label: String(t('look_paper', { defaultValue: 'Papier' })) }] : []),
  ]
  return (
    <div style={{ marginTop: 24 }} data-look-switcher>
      <p className="lg-group-title">
        {t('theme_label', { defaultValue: 'Erscheinungsbild' })}
      </p>
      <div className="card">
      <GlassSegmented
        options={options}
        value={look}
        onChange={setLook}
        ariaLabel={String(t('theme_label', { defaultValue: 'Erscheinungsbild' }))}
        material="fill"
        scroll
      />
      {look === 'schwarz' && <TiltToggle />}
      <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45, color: 'var(--lg-text-3)' }}>
        {t('look_hint', { defaultValue: 'Schwarz: Glaskante, die wie unter einer Taschenlampe glänzt. Satin: matte, dicke Glaskante mit wanderndem Lichtreflex. Licht: farbiges Licht schimmert durch das Glas. Nacht: gedämpftes Licht hinter klarem Glas mit feinem Prismasaum. Instrument: reines Schwarz, klare Flächen, kein Glas – wie ein Messgerät. Soft Dark: weiches Anthrazit, erhabene Flächen mit weichem Schatten, blaue Bedienung. Frost: dunkles Cyan wie mattiertes Glas. Labor: Raster und Eckwinkel wie ein Messgerät. Neon: Kanten wie Leuchtröhren. Tiefsee: Biolumineszenz in Petrol. Obsidian: schwarzes Vulkanglas. In diesen fünf ist Hoku das Licht: wo er ist, leuchten die Kanten.' })}
      </p>
      </div>
    </div>
  )
}

/**
 * Licht folgt dem Kippen (Taschenlampen-Kante in „Schwarz"). Auf dem iPhone
 * fragt Safari einmal nach „Bewegung und Ausrichtung" — das muss aus diesem
 * Tippen kommen.
 */
function TiltToggle() {
  const { t } = useTranslation()
  const [on, setOn] = useState(tiltWanted)
  const [denied, setDenied] = useState(false)
  const toggle = async () => {
    if (on) {
      setTiltWanted(false)
      setOn(false)
      return
    }
    const granted = await requestTilt()
    setDenied(!granted)
    setTiltWanted(granted)
    setOn(granted)
  }
  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => void toggle()}
        data-tilt-toggle
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ flex: 1, fontSize: 15, color: 'var(--lg-text)' }}>
          {t('look_tilt', { defaultValue: 'Licht folgt dem Kippen' })}
        </span>
        <Schalter an={on} />
      </button>
      {denied && (
        <p role="status" style={{ marginTop: 6, fontSize: 13, color: 'var(--lg-warn-text)' }}>
          {t('look_tilt_denied', { defaultValue: 'Bewegungssensor nicht freigegeben. Das Licht bleibt über der Bildschirmmitte.' })}
        </p>
      )}
    </div>
  )
}

// ── StoerungsSchalter ────────────────────────────────────────────────────────

/** Lässt Supabase und alle anderen Dienste ausfallen (lib/stoerung.ts). */
export function StoerungsSchalter() {
  const { t } = useTranslation()
  const { simuliert } = useStoerung()
  return (
    <div className="mt-6" data-stoerungs-schalter>
      <p className="lg-group-title">{t('stoerung_test_titel')}</p>
      <div className="card">
        <button
          type="button"
          role="switch"
          aria-checked={simuliert}
          onClick={() => setzeStoerungSimuliert(!simuliert)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ flex: 1, fontSize: 15, color: 'var(--lg-text)' }}>{t('stoerung_schalter')}</span>
          <Schalter an={simuliert} />
        </button>
        <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45, color: 'var(--lg-text-3)' }}>
          {t('stoerung_schalter_hinweis')}
        </p>
      </div>
    </div>
  )
}

// ── PushSettings ─────────────────────────────────────────────────────────────

export function PushSettings() {
  const { user } = useAuth()
  const { state, subscribe, unsubscribe, reconnect, sendTestPush } = usePushNotifications(user)
  const [testing, setTesting] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const handleSubscribe = async () => {
    setSubscribing(true)
    const ok = await subscribe()
    setSubscribing(false)
    if (ok) toast.success('Notifications aktiviert ✓')
    else toast.error('Activation fehlgeschlagen – Permission verweigert?')
  }

  const handleUnsubscribe = async () => {
    await unsubscribe()
    toast.success('Notifications deaktiviert')
  }

  const handleReconnect = async () => {
    setReconnecting(true)
    const ok = await reconnect()
    setReconnecting(false)
    if (ok) toast.success('Push neu verbunden – bitte erneut testen')
    else toast.error('Neu verbinden fehlgeschlagen')
  }

  const handleTest = async () => {
    setTesting(true)
    const result = await sendTestPush()
    setTesting(false)
    if (result.ok) {
      if (result.delivered) {
        toast.success('Push angekommen! (In-App-Banner sichtbar)', { duration: 7000 })
      } else {
        toast.success(
          'Server hat gesendet. Für Mitteilungszentrale: App schließen oder iPhone sperren, dann testen. Oder „Neu“ tippen.',
          { duration: 10000 },
        )
      }
    } else {
      toast.error(`Test fehlgeschlagen: ${result.error ?? 'Unbekannter Fehler'}`, { duration: 6000 })
    }
  }

  const stateLabels: Record<string, string> = {
    loading:             'Wird geladen…',
    unsupported:         'Nicht unterstützt (Browser)',
    'ios-needs-install': 'App am Home-Bildschirm installieren',
    'ios-native-app':    'Nur Home-Bildschirm-App',
    denied:              'Vom Browser blockiert',
    default:             'Nicht aktiviert',
    subscribed:          'Aktiv ✓',
  }
  const stateColors: Record<string, string> = {
    loading:             'var(--lg-text-2)',
    unsupported:         'var(--lg-text-2)',
    'ios-needs-install': 'var(--lg-warn-text)',
    'ios-native-app':    'var(--lg-warn-text)',
    denied:              'var(--lg-bad-text)',
    default:             'var(--lg-text-2)',
    subscribed:          'var(--lg-good-text)',
  }

  return (
    <div style={{ marginTop: 24 }}>
      <p className="lg-group-title">
        Benachrichtigungen
      </p>
      <div className="card">
        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span className="lg-icon-tile" style={{ background: state === 'subscribed' ? '#30d158' : '#636366' }}>
            {state === 'subscribed' ? <Bell size={16} /> : <BellOff size={16} />}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--lg-text)' }}>
              Einnahme-Erinnerungen
            </p>
            <p style={{ fontSize: 13, marginTop: 1, color: stateColors[state] ?? 'var(--lg-text-2)', fontWeight: 500 }}>
              {stateLabels[state] ?? state}
            </p>
          </div>
        </div>

        {/* iOS install hint */}
        {state === 'ios-needs-install' && (
          <div style={{ padding: '10px 12px', borderRadius: 14, marginBottom: 10, background: 'var(--lg-surface-2)' }}>
            <p style={{ fontSize: 13, color: 'var(--lg-warn-text)', lineHeight: 1.5 }}>
              1. Tippe unten auf das <strong>Teilen-Symbol ↑</strong>{'\n'}
              2. Wähle <strong>„Zum Home-Bildschirm"</strong>{'\n'}
              3. App vom Home-Bildschirm öffnen → Notifications aktivieren
            </p>
          </div>
        )}


        {state === 'ios-native-app' && (
          <div style={{ padding: '10px 12px', borderRadius: 14, marginBottom: 10, background: 'var(--lg-surface-2)' }}>
            <p style={{ fontSize: 13, color: 'var(--lg-warn-text)', lineHeight: 1.5 }}>
              Store-/Xcode-App: keine Web-Push-Mitteilungszentrale. Safari → <strong>Zum Home-Bildschirm</strong> → Icon-App nutzen.
            </p>
          </div>
        )}

        {state === 'subscribed' && (
          <p style={{ fontSize: 13, color: 'var(--lg-text-2)', lineHeight: 1.45, marginBottom: 10 }}>
            iPhone: Einstellungen → Mitteilungen → HOKU erlauben. Test mit geschlossener App oder gesperrtem Display.
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(state === 'default') && (
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="lg-gray-btn flex-1"
            >
              <Bell size={14} />
              {subscribing ? 'Aktiviere…' : 'Aktivieren'}
            </button>
          )}

          {state === 'subscribed' && (
            <>
              <button
                onClick={handleTest}
                disabled={testing}
                data-tone="good"
                className="lg-gray-btn flex-1"
              >
                <Send size={14} />
                {testing ? 'Sende…' : 'Test senden'}
              </button>
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="lg-gray-btn !px-3.5"
              >
                {reconnecting ? '…' : 'Neu'}
              </button>
              <button
                onClick={handleUnsubscribe}
                data-tone="bad"
                className="lg-gray-btn !px-3.5"
              >
                <BellOff size={14} />
                Aus
              </button>
            </>
          )}

          {state === 'denied' && (
            <p style={{ fontSize: 13, color: 'var(--lg-bad-text)', lineHeight: 1.5 }}>
              Notifications in den Browser-Einstellungen erneut erlauben, dann Seite neu laden.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = LANGUAGES.find(l => l.code === i18n.language?.split('-')[0])?.code ?? 'en'
  const options: SegmentOption<LanguageCode>[] = LANGUAGES.map(l => ({ key: l.code, label: `${l.flag} ${l.name}` }))
  return (
    <div className="mt-6">
      <p className="lg-group-title">
        {t('language')}
      </p>
      <div className="card">
        <GlassSegmented
          options={options}
          value={current}
          onChange={setLanguage}
          ariaLabel={String(t('language'))}
          material="fill"
          equal
        />
      </div>
    </div>
  )
}
