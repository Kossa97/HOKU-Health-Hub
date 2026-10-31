import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { LogOut, Save, User, Globe, Lock, Copy, Check, Star, Bell, BellOff, Send, ShieldCheck, FileText, ChevronRight, HelpCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ResearchDisclaimer } from '../components/ui/DesignSystem'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage, type LanguageCode } from '../i18n'
import { useLook, type Look } from '../lib/look'
import { requestTilt, setTiltWanted, tiltWanted } from '../lib/flashlight'
import { GlassSegmented, type SegmentOption } from '../components/ui/GlassSegmented'
import { Schalter } from '../components/ui/Schalter'
import { usePushNotifications } from '../lib/usePushNotifications'
import { AccountSection } from '../features/compliance/components/AccountSection'
import { PASSKEY_AN } from '../features/auth/lib/passkey'
import { PasskeyEinstellung } from '../features/auth/components/PasskeyEinstellung'
import { KiEinwilligungProfil } from '../features/blutwerte/components/KiEinwilligung'
import { PhotoConsentProfile } from '../features/ernaehrung/components/PhotoConsentProfile'
import { BioProfilKarte } from '../features/blutwerte/components/BioProfil'
import { filterFehlerSchluessel } from '../features/compliance/lib/moderation'
import { setzeStoerungSimuliert, useStoerung } from '../lib/stoerung'

interface Profile {
  username: string; display_name: string; age: number | null
  weight_kg: number | null; height_cm: number | null
  gender: string; notes: string
  is_public: boolean; public_bio: string
  share_peptide: boolean; share_kalender: boolean
  share_tagebuch: boolean; share_bewertungen: boolean
}

const defaultProfile = (): Profile => ({
  username: '', display_name: '', age: null, weight_kg: null,
  height_cm: null, gender: '', notes: '',
  is_public: false, public_bio: '',
  share_peptide: true, share_kalender: false,
  // Bewertungen sind Gesundheitsdaten: Teilen nur, wenn man es einschaltet.
  share_tagebuch: false, share_bewertungen: false,
})


export function Profil() {
  const { user, signOut } = useAuth()
  const { t } = useTranslation()
  const [profile, setProfile] = useState<Profile>(defaultProfile())
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', user!.id).single().then(({ data }) => {
      if (data) setIsAdmin(data.is_admin === true)
      if (data) setProfile({
        username: data.username ?? '', display_name: data.display_name ?? '',
        age: data.age, weight_kg: data.weight_kg, height_cm: data.height_cm,
        gender: data.gender ?? '', notes: data.notes ?? '',
        is_public: data.is_public ?? false, public_bio: data.public_bio ?? '',
        share_peptide: data.share_peptide ?? true,
        share_kalender: data.share_kalender ?? false,
        share_tagebuch: data.share_tagebuch ?? false,
        share_bewertungen: data.share_bewertungen ?? false,
      })
    })
  }, [])

  const save = async () => {
    if (!profile.username.trim()) return toast.error(t('benutzername_req'))
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user!.id,
      username: profile.username.trim().toLowerCase(),
      display_name: profile.display_name || null,
      // age/gender gehoeren zu Geburtsdatum/Geschlecht (eigene Karte) — hier nicht zurueckschreiben.
      weight_kg: profile.weight_kg, height_cm: profile.height_cm,
      notes: profile.notes || null,
      is_public: profile.is_public, public_bio: profile.public_bio || null,
      share_peptide: profile.share_peptide,
      share_kalender: profile.share_kalender,
      share_tagebuch: profile.share_tagebuch,
      share_bewertungen: profile.share_bewertungen,
    })
    // Oeffentliche Profile laufen durch den Textfilter — dann sagen, warum.
    const filter = error ? filterFehlerSchluessel(error.message) : null
    if (error) toast.error(filter ? t(filter) : t('fehler_speichern'), { duration: filter ? 6000 : undefined })
    else toast.success(t('profil_gespeichert'))
    setSaving(false)
  }

  const profileUrl = `${window.location.origin}/u/${profile.username?.toLowerCase() || '...'}`

  const copyLink = async () => {
    if (!profile.username) return toast.error(t('zuerst_username'))
    await navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    toast.success(t('link_kopiert'))
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="lg-large-title min-w-0 truncate">{t('mein_profil')}</h1>
        <button data-tone="bad" className="lg-gray-btn shrink-0 !min-h-10 !px-4 !text-[14px]"
          onClick={() => { if (confirm(t('abmelden_confirm'))) signOut() }}>
          <LogOut size={16} strokeWidth={1.5} /> {t('abmelden_btn')}
        </button>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div className="mb-2 grid h-20 w-20 place-items-center rounded-full bg-[var(--lg-fill)]">
          <User size={38} strokeWidth={1.5} className="text-[var(--lg-text-2)]" />
        </div>
        <p className="text-[15px] text-[var(--lg-text-2)]">{user?.email}</p>
      </div>

      {/* ── Profil teilen ─────────────────────────────────────────────────── */}
      <div className="card mb-4">
        {/* Haupt-Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {profile.is_public
              ? <Globe size={18} strokeWidth={1.5} className="text-[var(--lg-accent-text)]" />
              : <Lock size={18} strokeWidth={1.5} className="text-[var(--lg-text-2)]" />}
            <h2 className="text-[17px] font-medium text-[var(--lg-text)]">{t('profil_teilen')}</h2>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={profile.is_public}
            aria-label={t('profil_teilen')}
            onClick={() => setProfile(p => ({ ...p, is_public: !p.is_public }))}
            className="shrink-0"
          >
            <Schalter an={profile.is_public} />
          </button>
        </div>

        {profile.is_public ? (
          <div className="space-y-3">
            {/* Teilen-Link */}
            <div className="flex gap-2">
              <div className="input flex-1 !text-[var(--lg-accent-text)] text-sm truncate py-2 cursor-default">
                {profileUrl}
              </div>
              <button className="btn-secondary px-3 shrink-0" onClick={copyLink}>
                {copied
                  ? <Check size={16} strokeWidth={1.5} className="text-[var(--lg-good-text)]" />
                  : <Copy size={16} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Öffentliche Bio */}
            <div>
              <label className="label">{t('public_bio_label')}</label>
              <textarea className="input resize-none" rows={2}
                placeholder={t('public_bio_placeholder')}
                value={profile.public_bio}
                onChange={e => setProfile(p => ({ ...p, public_bio: e.target.value }))} />
            </div>

            {/* Was Besucher sehen: nur einzeln freigegebene Bewertungen.
                Stack, Kalender und Tagebuch sind (noch) nie oeffentlich —
                die alten Schalter wirkten fuer Besucher nie und sind weg. */}
            <div data-profile-public-content className="rounded-[12px] bg-[var(--lg-surface-2)] p-4">
              <p className="flex items-center gap-2 text-[15px] font-medium text-[var(--lg-text)]">
                <Star size={16} strokeWidth={1.5} aria-hidden="true" className="text-[var(--lg-text-3)]" /> {t('review_public_profile_title')}
              </p>
              <p className="mt-1 text-[13px] text-[var(--lg-text-2)]">{t('review_public_profile_desc')}</p>
              <Link to="/bewertungen" className="mt-1 inline-flex min-h-11 items-center text-[15px] font-medium text-[var(--lg-accent-text)]">
                {t('review_public_profile_link')}
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-[var(--lg-text-2)] text-[15px] leading-snug">
            {t('profil_teilen_hint')}
          </p>
        )}
      </div>

      {/* ── Sicherheit & Datenschutz ── */}
      <div className="card mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} strokeWidth={1.5} className="text-[var(--lg-text-2)]" />
          <h2 className="text-[17px] font-medium text-[var(--lg-text)]">{t('profil_safety_title')}</h2>
        </div>
        <ResearchDisclaimer
          compact
          title={t('safety_banner_title')}
          body={t('safety_banner_body')}
        />
        <ul className="space-y-2 text-[15px] text-[var(--lg-text-2)] leading-snug">
          <li className="flex gap-2">
            <FileText size={16} strokeWidth={1.5} className="text-[var(--lg-text-3)] shrink-0 mt-0.5" />
            <span>{t('profil_safety_export')}</span>
          </li>
          <li className="flex gap-2">
            <Lock size={16} strokeWidth={1.5} className="text-[var(--lg-text-3)] shrink-0 mt-0.5" />
            <span>{t('profil_safety_data')}</span>
          </li>
          <li>{t('profil_safety_medical')}</li>
        </ul>
        <Link to="/protokoll" data-quiet className="lg-gray-btn w-full">
          <FileText size={16} strokeWidth={1.5} />
          {t('tile_protokoll')}
        </Link>
      </div>

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <div className="card space-y-4 mb-4">
        <h2 className="text-[17px] font-medium text-[var(--lg-text)]">Account</h2>
        <div>
          <label className="label">{t('benutzername_pflicht')}</label>
          <input className="input" placeholder={t('username_placeholder')}
            value={profile.username}
            onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} />
          <p className="text-[var(--lg-text-3)] text-xs mt-1.5">{t('benutzername_hinweis')}</p>
        </div>
        <div>
          <label className="label">{t('anzeigename')}</label>
          <input className="input" placeholder={t('anzeigename_ph')}
            value={profile.display_name}
            onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} />
        </div>
      </div>

      <button className="lg-btn lg-btn-primary w-full" onClick={save} disabled={saving}>
        <Save size={16} strokeWidth={1.5} /> {saving ? t('saving') : t('profil_speichern')}
      </button>

      {/* ── Sprache / Language ── */}
      <LanguageSwitcher />

      {/* ── Erscheinungsbild: Schwarz oder Licht ── */}
      <LookSwitcher />

      {/* ── Push-Notifications ── */}
      <PushSettings />

      {/* Hilfe: FAQ und App-Anleitung */}
      <div className="mt-6">
        <p className="lg-group-title">{t('tile_faq_desc')}</p>
        <Link to="/faq" data-profile-faq className="flex min-h-[52px] items-center gap-3 rounded-[var(--r-xl)] bg-[var(--lg-surface-2)] px-4 transition-colors active:bg-white/[0.1]">
          <span className="lg-icon-tile" style={{ background: 'var(--lg-good)' }}><HelpCircle size={18} strokeWidth={1.5} aria-hidden="true" /></span>
          <span className="flex-1 text-[16px] font-medium text-[var(--lg-text)]">{t('tile_faq')}</span>
          <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" className="text-[var(--lg-text-3)]" />
        </Link>
      </div>

      {/* ── Alter und Geschlecht für die Blutwerte-Bereiche (eigenes Speichern) ── */}
      <div className="mt-6">
        <BioProfilKarte />
      </div>

      {/* ── Einwilligung KI-Auswertung von Befunden (Widerruf) ── */}
      <div>
        <KiEinwilligungProfil />
        <PhotoConsentProfile />
      </div>

      {/* ── Face ID / Passkeys ── */}
      {PASSKEY_AN && <PasskeyEinstellung />}

      {/* ── Blockierte Profile, Rechtstexte, Konto löschen ── */}
      <AccountSection />

      {/* ── Nur Admins und Entwicklung: Ausfall der Dienste nachstellen ── */}
      {(isAdmin || import.meta.env.DEV) && <StoerungsSchalter />}
    </div>
  )
}

// ── LookSwitcher ─────────────────────────────────────────────────────────────

function LookSwitcher() {
  const { t } = useTranslation()
  const { look, setLook } = useLook()
  const options: SegmentOption<Look>[] = [
    { key: 'hoku', label: String(t('look_hoku', { defaultValue: 'HOKU' })) },
    { key: 'schwarz', label: String(t('look_black', { defaultValue: 'Schwarz' })) },
    { key: 'softdark', label: String(t('look_softdark', { defaultValue: 'Soft Dark' })) },
    { key: 'instrument', label: String(t('look_instrument', { defaultValue: 'Instrument' })) },
    { key: 'satin', label: String(t('look_satin', { defaultValue: 'Satin' })) },
    { key: 'licht', label: String(t('look_light', { defaultValue: 'Licht' })) },
    { key: 'nacht', label: String(t('look_night', { defaultValue: 'Nacht' })) },
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
      <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.45, color: 'var(--lg-text-3)' }}>
        {t('look_hint', { defaultValue: 'HOKU: ruhiges Graphit, klare Flächen, Blau nur für das Wichtige. Schwarz: Glaskante, die wie unter einer Taschenlampe glänzt. Satin: matte, dicke Glaskante mit wanderndem Lichtreflex. Licht: farbiges Licht schimmert durch das Glas. Nacht: gedämpftes Licht hinter klarem Glas mit feinem Prismasaum. Instrument: reines Schwarz, klare Flächen, kein Glas – wie ein Messgerät. Soft Dark: weiches Anthrazit, erhabene Flächen mit weichem Schatten, blaue Bedienung.' })}
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
function StoerungsSchalter() {
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
        <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.45, color: 'var(--lg-text-3)' }}>
          {t('stoerung_schalter_hinweis')}
        </p>
      </div>
    </div>
  )
}

// ── PushSettings ─────────────────────────────────────────────────────────────

function PushSettings() {
  const { user } = useAuth()
  const { state, subscribe, unsubscribe, reconnect, sendTestPush } = usePushNotifications(user)
  const [testing, setTesting] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const handleSubscribe = async () => {
    setSubscribing(true)
    const ok = await subscribe()
    setSubscribing(false)
    if (ok) toast.success('Notifications aktiviert')
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
    subscribed:          'Aktiv',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span className="lg-icon-tile" style={{ background: state === 'subscribed' ? 'var(--lg-good)' : 'var(--lg-fill-selected)' }}>
            {state === 'subscribed' ? <Bell size={16} strokeWidth={1.5} /> : <BellOff size={16} strokeWidth={1.5} />}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--lg-text)' }}>
              Einnahme-Erinnerungen
            </p>
            <p style={{ fontSize: 13, marginTop: 2, color: stateColors[state] ?? 'var(--lg-text-2)', fontWeight: 500 }}>
              {stateLabels[state] ?? state}
            </p>
          </div>
        </div>

        {/* iOS install hint */}
        {state === 'ios-needs-install' && (
          <div style={{ padding: 12, borderRadius: 12, marginBottom: 12, background: 'var(--lg-surface-2)' }}>
            <p style={{ fontSize: 13, color: 'var(--lg-warn-text)', lineHeight: 1.5 }}>
              1. Tippe unten auf das <strong>Teilen-Symbol ↑</strong>{'\n'}
              2. Wähle <strong>„Zum Home-Bildschirm"</strong>{'\n'}
              3. App vom Home-Bildschirm öffnen → Notifications aktivieren
            </p>
          </div>
        )}


        {state === 'ios-native-app' && (
          <div style={{ padding: 12, borderRadius: 12, marginBottom: 12, background: 'var(--lg-surface-2)' }}>
            <p style={{ fontSize: 13, color: 'var(--lg-warn-text)', lineHeight: 1.5 }}>
              Store-/Xcode-App: keine Web-Push-Mitteilungszentrale. Safari → <strong>Zum Home-Bildschirm</strong> → Icon-App nutzen.
            </p>
          </div>
        )}

        {state === 'subscribed' && (
          <p style={{ fontSize: 13, color: 'var(--lg-text-2)', lineHeight: 1.45, marginBottom: 12 }}>
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
              <Bell size={16} strokeWidth={1.5} />
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
                <Send size={16} strokeWidth={1.5} />
                {testing ? 'Sende…' : 'Test senden'}
              </button>
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="lg-gray-btn !px-4"
              >
                {reconnecting ? '…' : 'Neu'}
              </button>
              <button
                onClick={handleUnsubscribe}
                data-tone="bad"
                className="lg-gray-btn !px-4"
              >
                <BellOff size={16} strokeWidth={1.5} />
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

function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = LANGUAGES.find(l => l.code === i18n.language?.split('-')[0])?.code ?? 'en'
  const options: SegmentOption<LanguageCode>[] = LANGUAGES.map(l => ({ key: l.code, label: l.name }))
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
