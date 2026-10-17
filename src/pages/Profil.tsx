import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { LogOut, Save, User, Globe, Lock, Copy, Check, Star, Languages, Bell, BellOff, Send, ShieldCheck, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ResearchDisclaimer } from '../components/ui/DesignSystem'
import { useTranslation } from 'react-i18next'
import { OnboardingRestartButton } from '../components/Onboarding'
import { LANGUAGES, applyDirection } from '../i18n'
import { usePushNotifications } from '../lib/usePushNotifications'
import { AccountSection } from '../features/compliance/components/AccountSection'
import { KiEinwilligungProfil } from '../features/blutwerte/components/KiEinwilligung'
import { BioProfilKarte } from '../features/blutwerte/components/BioProfil'
import { filterFehlerSchluessel } from '../features/compliance/lib/moderation'

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

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', user!.id).single().then(({ data }) => {
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('mein_profil')}</h1>
        <button className="btn-danger flex items-center gap-2 text-sm"
          onClick={() => { if (confirm(t('abmelden_confirm'))) signOut() }}>
          <LogOut size={15} /> {t('abmelden_btn')}
        </button>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div className="bg-sky-500/10 p-5 rounded-full mb-2">
          <User size={36} className="text-sky-400" />
        </div>
        <p className="text-slate-400 text-sm">{user?.email}</p>
      </div>

      {/* ── Profil teilen ─────────────────────────────────────────────────── */}
      <div className={`card mb-4 border transition-colors ${
        profile.is_public ? 'border-sky-500/30' : 'border-slate-800'
      }`}>
        {/* Haupt-Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {profile.is_public
              ? <Globe size={16} className="text-sky-400" />
              : <Lock size={16} className="text-slate-400" />}
            <h2 className="font-semibold text-slate-300">{t('profil_teilen')}</h2>
          </div>
          <button
            onClick={() => setProfile(p => ({ ...p, is_public: !p.is_public }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              profile.is_public ? 'bg-sky-500' : 'bg-slate-700'
            }`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
              profile.is_public ? 'left-7' : 'left-1'
            }`} />
          </button>
        </div>

        {profile.is_public ? (
          <div className="space-y-3">
            {/* Teilen-Link */}
            <div className="flex gap-2">
              <div className="input flex-1 text-sky-400 text-sm truncate py-2 cursor-default">
                {profileUrl}
              </div>
              <button className="btn-secondary px-3 shrink-0" onClick={copyLink}>
                {copied
                  ? <Check size={16} className="text-emerald-400" />
                  : <Copy size={16} />}
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
            <div data-profile-public-content className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <Star size={15} aria-hidden="true" className="text-amber-400" /> {t('review_public_profile_title')}
              </p>
              <p className="mt-1 text-xs text-slate-400">{t('review_public_profile_desc')}</p>
              <Link to="/bewertungen" className="mt-2 inline-block text-xs font-semibold text-sky-400">
                {t('review_public_profile_link')}
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">
            {t('profil_teilen_hint')}
          </p>
        )}
      </div>

      {/* ── Sicherheit & Datenschutz ── */}
      <div className="card mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-amber-400" />
          <h2 className="font-semibold text-slate-300">{t('profil_safety_title')}</h2>
        </div>
        <ResearchDisclaimer
          compact
          title={t('safety_banner_title')}
          body={t('safety_banner_body')}
        />
        <ul className="space-y-2 text-sm text-slate-400 leading-relaxed">
          <li className="flex gap-2">
            <FileText size={14} className="text-sky-400 shrink-0 mt-0.5" />
            <span>{t('profil_safety_export')}</span>
          </li>
          <li className="flex gap-2">
            <Lock size={14} className="text-sky-400 shrink-0 mt-0.5" />
            <span>{t('profil_safety_data')}</span>
          </li>
          <li>{t('profil_safety_medical')}</li>
        </ul>
        <Link to="/protokoll" className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
          <FileText size={15} />
          {t('tile_protokoll')}
        </Link>
      </div>

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <div className="card space-y-4 mb-4">
        <h2 className="font-semibold text-slate-300">Account</h2>
        <div>
          <label className="label">{t('benutzername_pflicht')}</label>
          <input className="input" placeholder={t('username_placeholder')}
            value={profile.username}
            onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} />
          <p className="text-slate-600 text-xs mt-1">{t('benutzername_hinweis')}</p>
        </div>
        <div>
          <label className="label">{t('anzeigename')}</label>
          <input className="input" placeholder={t('anzeigename_ph')}
            value={profile.display_name}
            onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} />
        </div>
      </div>

      <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={save} disabled={saving}>
        <Save size={16} /> {saving ? t('saving') : t('profil_speichern')}
      </button>

      {/* ── Sprache / Language ── */}
      <LanguageSwitcher />

      {/* ── Push-Notifications ── */}
      <PushSettings />

      {/* App-Anleitung */}
      <div className="mt-3">
        <OnboardingRestartButton />
      </div>

      {/* ── Alter und Geschlecht für die Blutwerte-Bereiche (eigenes Speichern) ── */}
      <div className="mt-6">
        <BioProfilKarte />
      </div>

      {/* ── Einwilligung KI-Auswertung von Befunden (Widerruf) ── */}
      <div>
        <KiEinwilligungProfil />
      </div>

      {/* ── Blockierte Profile, Rechtstexte, Konto löschen ── */}
      <AccountSection />
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
    loading:             'var(--text-muted)',
    unsupported:         'var(--text-muted)',
    'ios-needs-install': '#f59e0b',
    'ios-native-app':    '#f59e0b',
    denied:              '#f43f5e',
    default:             'var(--text-muted)',
    subscribed:          '#10b981',
  }

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
        Benachrichtigungen
      </p>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 18, padding: '14px 16px',
      }}>
        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
            background: state === 'subscribed' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${stateColors[state] ?? 'rgba(255,255,255,0.08)'}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {state === 'subscribed'
              ? <Bell size={16} color="#10b981" />
              : <BellOff size={16} color="var(--text-muted)" />}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)' }}>
              Einnahme-Erinnerungen
            </p>
            <p style={{ fontSize: '0.62rem', marginTop: 2, color: stateColors[state] ?? 'var(--text-muted)', fontWeight: 700 }}>
              {stateLabels[state] ?? state}
            </p>
          </div>
        </div>

        {/* iOS install hint */}
        {state === 'ios-needs-install' && (
          <div style={{
            padding: '10px 12px', borderRadius: 12, marginBottom: 10,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <p style={{ fontSize: '0.72rem', color: 'rgba(245,158,11,0.9)', lineHeight: 1.5 }}>
              1. Tippe unten auf das <strong>Teilen-Symbol ↑</strong>{'\n'}
              2. Wähle <strong>„Zum Home-Bildschirm"</strong>{'\n'}
              3. App vom Home-Bildschirm öffnen → Notifications aktivieren
            </p>
          </div>
        )}


        {state === 'ios-native-app' && (
          <div style={{
            padding: '10px 12px', borderRadius: 12, marginBottom: 10,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <p style={{ fontSize: '0.72rem', color: 'rgba(245,158,11,0.9)', lineHeight: 1.5 }}>
              Store-/Xcode-App: keine Web-Push-Mitteilungszentrale. Safari → <strong>Zum Home-Bildschirm</strong> → Icon-App nutzen.
            </p>
          </div>
        )}

        {state === 'subscribed' && (
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 10 }}>
            iPhone: Einstellungen → Mitteilungen → TYD erlauben. Test mit geschlossener App oder gesperrtem Display.
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(state === 'default') && (
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
                color: 'var(--accent)', fontSize: '0.76rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: subscribing ? 0.5 : 1,
              }}
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
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 12,
                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)',
                  color: '#10b981', fontSize: '0.76rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: testing ? 0.5 : 1,
                }}
              >
                <Send size={14} />
                {testing ? 'Sende…' : 'Test senden'}
              </button>
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                style={{
                  padding: '10px 12px', borderRadius: 12,
                  background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
                  color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 800,
                  opacity: reconnecting ? 0.5 : 1,
                }}
              >
                {reconnecting ? '…' : 'Neu'}
              </button>
              <button
                onClick={handleUnsubscribe}
                style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)',
                  color: '#f43f5e', fontSize: '0.76rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <BellOff size={14} />
                Aus
              </button>
            </>
          )}

          {state === 'denied' && (
            <p style={{ fontSize: '0.7rem', color: 'rgba(244,63,94,0.7)', lineHeight: 1.5 }}>
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
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(i18n.language)
  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0]

  function apply() {
    i18n.changeLanguage(selected)
    localStorage.setItem('tyd_lang', selected)
    applyDirection(selected)
    setOpen(false)
  }

  return (
    <div className="mt-4">
      <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
        {t('language')}
      </p>

      <button
        onClick={() => { setOpen(o => !o); setSelected(i18n.language) }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderRadius: 13,
          background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
          color: 'var(--accent)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Languages size={15} />
          <span>{current.flag} {current.name}</span>
        </div>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          marginTop: 6, borderRadius: 13, overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {LANGUAGES.map(lang => {
              const isSelected = lang.code === selected
              return (
                <div
                  key={lang.code}
                  style={{
                    display: 'flex', alignItems: 'center',
                    borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'var(--accent-weak)' : 'transparent',
                  }}
                >
                  <button
                    onClick={() => setSelected(lang.code)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px', textAlign: 'left', cursor: 'pointer',
                      color: isSelected ? 'var(--accent)' : 'var(--text-dim)',
                      fontWeight: isSelected ? 700 : 400,
                      fontSize: '0.875rem',
                      background: 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>

                  {isSelected && (
                    <button
                      onClick={apply}
                      style={{
                        margin: '6px 10px 6px 0',
                        padding: '6px 14px',
                        borderRadius: 8,
                        background: lang.code !== i18n.language
                          ? 'linear-gradient(135deg, #00ccf5, #0088dd)'
                          : 'var(--accent-weak)',
                        border: '1px solid var(--accent-border)',
                        color: lang.code !== i18n.language ? '#07091a' : 'var(--accent)',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lang.code !== i18n.language ? t('apply') : <Check size={14} />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
