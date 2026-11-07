import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, FileText, HelpCircle, Lock, LogOut, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ResearchDisclaimer } from '../components/ui/DesignSystem'
import { Schalter } from '../components/ui/Schalter'
import { SheetClose } from '../components/ui/SheetClose'
import { Sheet } from '../features/compliance/components/Sheet'
import { AccountSection } from '../features/compliance/components/AccountSection'
import { PASSKEY_AN } from '../features/auth/lib/passkey'
import { PasskeyEinstellung } from '../features/auth/components/PasskeyEinstellung'
import { KiEinwilligungProfil } from '../features/blutwerte/components/KiEinwilligung'
import { PhotoConsentProfile } from '../features/ernaehrung/components/PhotoConsentProfile'
import { HealthStoreProfile } from '../features/wearables/components/HealthStoreProfile'
import { BioProfilKarte } from '../features/blutwerte/components/BioProfil'
import { LanguageSwitcher, LookSwitcher, PushSettings, StoerungsSchalter } from '../features/profil/components/AppEinstellungen'
import { HokuEintrag } from '../features/dot/HokuEintrag'
import { BlockiertListe } from '../features/profil/components/BlockiertListe'
import { WerSiehtWas } from '../features/profil/components/WerSiehtWas'
import { useBlockiert } from '../features/profil/hooks/useBlockiert'
import { useFieldVisibility } from '../features/profil/hooks/useFieldVisibility'
import { profileUrl } from '../features/profil/lib/profileView'
import { parseVisibilityMap } from '../features/profil/lib/profileVisibility'

/**
 * Einstellungen hinter ⚙︎ im Profil (Teilprojekt 2a): oben Profil &
 * Sichtbarkeit und Kontrolle, darunter alles, was bis dahin auf der langen
 * Profilseite stand (Datenquellen, Einwilligungen, Sprache, Erscheinungsbild,
 * Benachrichtigungen, Passkey, Sicherheit, Hilfe, Abmelden, Konto löschen,
 * Rechtliches). Dazu die Unterseiten „Wer sieht was“ und „Blockiert“.
 */

interface Einstellungen {
  username: string
  privat: boolean
  webLink: boolean
  isAdmin: boolean
  visibility: ReturnType<typeof parseVisibilityMap>
}

function useEinstellungen(userId: string | undefined) {
  const [werte, setWerte] = useState<Einstellungen | null>(null)
  const [fehler, setFehler] = useState(false)
  useEffect(() => {
    if (!userId) return
    let aktiv = true
    void supabase.from('profiles').select('*').eq('id', userId).single().then(({ data, error }) => {
      if (!aktiv) return
      if (error || !data) { setFehler(true); return }
      setWerte({
        username: typeof data.username === 'string' ? data.username : '',
        privat: data.profile_private === true,
        webLink: data.web_link_enabled === true,
        isAdmin: data.is_admin === true,
        visibility: parseVisibilityMap(data.field_visibility),
      })
    })
    return () => { aktiv = false }
  }, [userId])
  return { werte, setWerte, fehler }
}

/** Kopfzeile der Unterseiten: Zurück + großer Titel. */
function Leiste({ titel, zurueck }: { titel: string; zurueck: string }) {
  const { t } = useTranslation()
  return (
    <div className="mb-4">
      <Link
        to={zurueck}
        className="lg-glass lg-btn lg-btn-glass lg-btn-compact mb-3 w-fit !gap-0.5 !pl-2.5 !pr-4"
        data-settings-back
      >
        <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
        {t('back')}
      </Link>
      <h1 className="lg-large-title">{titel}</h1>
    </div>
  )
}

const zeile = 'flex min-h-[52px] w-full items-center gap-3 py-2 text-left'

function Unterzeile({ titel, sub }: { titel: ReactNode; sub?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[16px] text-[var(--lg-text)]">{titel}</span>
      {sub && <span className="mt-0.5 block text-[13px] leading-snug text-[var(--lg-text-3)]">{sub}</span>}
    </span>
  )
}

function SchalterZeile({ titel, sub, an, onClick, disabled, ...data }: {
  titel: string
  sub?: ReactNode
  an: boolean
  onClick: () => void
  disabled?: boolean
} & Record<`data-${string}`, boolean>) {
  return (
    <button type="button" role="switch" aria-checked={an} aria-label={titel} disabled={disabled} onClick={onClick} className={`${zeile} disabled:opacity-60`} {...data}>
      <Unterzeile titel={titel} sub={sub} />
      <Schalter an={an} />
    </button>
  )
}

function Weiter({ wert }: { wert?: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-[15px] text-[var(--lg-text-3)]">
      {wert}
      <ChevronRight size={18} aria-hidden="true" />
    </span>
  )
}

function Gruppe({ titel, children, ...data }: { titel: string; children: ReactNode } & Record<`data-${string}`, boolean>) {
  return (
    <section className="mt-6" {...data}>
      <p className="lg-group-title">{titel}</p>
      {children}
    </section>
  )
}

export function ProfilEinstellungen() {
  const { user, signOut } = useAuth()
  const { t } = useTranslation()
  const { werte, setWerte, fehler } = useEinstellungen(user?.id)
  const { liste: blockiert } = useBlockiert(user?.id)
  const [ansehenAls, setAnsehenAls] = useState(false)

  /** Schalter sofort umlegen, dann speichern; bei Fehler zurück und melden. */
  const schalte = async (spalte: 'profile_private' | 'web_link_enabled', feld: 'privat' | 'webLink') => {
    if (!werte || !user) return
    const neu = !werte[feld]
    setWerte(w => w && { ...w, [feld]: neu })
    const { error } = await supabase.from('profiles').update({ [spalte]: neu }).eq('id', user.id)
    if (error) {
      setWerte(w => w && { ...w, [feld]: !neu })
      toast.error(t('fehler_speichern'))
    }
  }

  const link = werte?.username ? profileUrl(werte.username) : null

  return (
    <div data-profile-settings-page>
      <Leiste titel={t('profil_einstellungen')} zurueck="/profil" />

      {/* ── Profil & Sichtbarkeit ── */}
      <section className="card !py-1" aria-labelledby="einst-sichtbarkeit" data-settings-visibility>
        <h2 id="einst-sichtbarkeit" className="pb-1 pt-3 text-[17px] font-semibold text-[var(--lg-text)]">{t('profil_einst_sichtbarkeit')}</h2>
        <div className="flex flex-col divide-y divide-[var(--lg-separator)]">
          <SchalterZeile
            titel={t('profil_privat')}
            sub={t('profil_privat_sub')}
            an={werte?.privat ?? false}
            disabled={!werte}
            onClick={() => void schalte('profile_private', 'privat')}
            data-setting-private
          />
          <Link to="/profil/sichtbarkeit" className={zeile} data-setting-wer>
            <Unterzeile titel={t('profil_wer_sieht_was')} sub={t('profil_wer_sieht_was_sub')} />
            <Weiter />
          </Link>
          <button type="button" className={zeile} aria-haspopup="dialog" disabled={!werte?.username} onClick={() => setAnsehenAls(true)} data-setting-ansehen>
            <Unterzeile titel={t('profil_ansehen_als')} sub={t('profil_ansehen_als_sub')} />
            <Weiter />
          </button>
          <div className={zeile} data-setting-default>
            <Unterzeile titel={t('profil_neue_felder')} />
            <span className="flex shrink-0 items-center gap-1 text-[15px] text-[var(--lg-text-3)]">
              <Lock size={13} aria-hidden="true" /> {t('profil_stufe_me')}
            </span>
          </div>
          <SchalterZeile
            titel={t('profil_web_link')}
            sub={<>{link && <span className="block truncate">{link.replace(/^https?:\/\//, '')}</span>}{t('profil_web_link_sub')}</>}
            an={werte?.webLink ?? false}
            disabled={!werte}
            onClick={() => void schalte('web_link_enabled', 'webLink')}
            data-setting-weblink
          />
        </div>
      </section>
      {fehler && <p role="alert" className="mt-2 px-1 text-[13px] text-[var(--lg-bad-text)]">{t('profil_laden_fehler')}</p>}

      {/* ── Kontrolle ── */}
      <section className="card mt-4 !py-1" aria-labelledby="einst-kontrolle" data-settings-control>
        <h2 id="einst-kontrolle" className="pb-1 pt-3 text-[17px] font-semibold text-[var(--lg-text)]">{t('profil_kontrolle')}</h2>
        <Link to="/profil/blockiert" className={zeile} data-setting-blocked>
          <Unterzeile titel={t('blocked_list_title')} />
          <Weiter wert={blockiert ? String(blockiert.length) : undefined} />
        </Link>
      </section>

      {/* ── Datenquellen & Einwilligungen ── */}
      <Gruppe titel={t('profil_einst_datenquellen')} data-settings-sources>
        <HealthStoreProfile />
        <div className="mt-3"><KiEinwilligungProfil /></div>
        <PhotoConsentProfile />
        <div className="mt-3"><BioProfilKarte /></div>
      </Gruppe>

      {/* ── Konto & App ── */}
      <LanguageSwitcher />
      <LookSwitcher vorschau={werte?.isAdmin || import.meta.env.DEV} />
      {/* Hoku: Farbe, Bewegung und Hinweise auf eigener Seite mit Bühne */}
      <HokuEintrag />
      <PushSettings />
      {PASSKEY_AN && <PasskeyEinstellung />}

      {/* ── Sicherheit & Datenschutz ── */}
      <Gruppe titel={t('profil_safety_title')} data-settings-safety>
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-[var(--lg-warn-text)]" aria-hidden="true" />
            <h2 className="text-[17px] font-semibold text-[var(--lg-text)]">{t('profil_safety_title')}</h2>
          </div>
          <ResearchDisclaimer compact title={t('safety_banner_title')} body={t('safety_banner_body')} />
          <ul className="space-y-2 text-[15px] leading-snug text-[var(--lg-text-2)]">
            <li className="flex gap-2">
              <FileText size={15} className="mt-0.5 shrink-0 text-[var(--lg-accent-text)]" aria-hidden="true" />
              <span>{t('profil_safety_export')}</span>
            </li>
            <li className="flex gap-2">
              <Lock size={15} className="mt-0.5 shrink-0 text-[var(--lg-accent-text)]" aria-hidden="true" />
              <span>{t('profil_safety_data_2a')}</span>
            </li>
            <li>{t('profil_safety_medical')}</li>
          </ul>
          <Link to="/protokoll" data-quiet className="lg-gray-btn w-full">
            <FileText size={15} aria-hidden="true" />
            {t('tile_protokoll')}
          </Link>
        </div>
      </Gruppe>

      {/* ── Hilfe ── */}
      <Gruppe titel={t('tile_faq_desc')}>
        <Link to="/faq" data-profile-faq className="flex min-h-[52px] items-center gap-3 rounded-[var(--r-xl)] bg-[var(--lg-surface-2)] px-4 transition-colors active:bg-white/[0.1]">
          <span className="lg-icon-tile" style={{ background: '#30d158' }}><HelpCircle size={17} aria-hidden="true" /></span>
          <span className="flex-1 text-[16px] font-medium text-[var(--lg-text)]">{t('tile_faq')}</span>
          <ChevronRight size={18} aria-hidden="true" className="text-[var(--lg-text-3)]" />
        </Link>
      </Gruppe>

      {/* ── Abmelden, Konto löschen, Rechtliches ── */}
      <button
        type="button"
        data-tone="bad"
        className="lg-gray-btn mt-6 w-full !min-h-12"
        onClick={() => { if (confirm(t('abmelden_confirm'))) void signOut() }}
        data-settings-signout
      >
        <LogOut size={15} aria-hidden="true" /> {t('abmelden_btn')}
      </button>
      <AccountSection />

      {/* ── Nur Admins und Entwicklung: Ausfall der Dienste nachstellen ── */}
      {(werte?.isAdmin || import.meta.env.DEV) && <StoerungsSchalter />}

      {ansehenAls && werte?.username && (
        <AnsehenAlsSheet username={werte.username} onClose={() => setAnsehenAls(false)} />
      )}
    </div>
  )
}

function AnsehenAlsSheet({ username, onClose }: { username: string; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ziele = [
    { als: 'friends', titel: t('profil_als_freund'), sub: t('profil_stufe_freunde_hinweis') },
    { als: 'all', titel: t('profil_als_app_nutzer'), sub: t('profil_als_app_nutzer_sub') },
    { als: 'web', titel: t('profil_als_web'), sub: t('profil_als_web_sub') },
  ] as const
  return (
    <Sheet labelledBy="ansehen-als-titel" onClose={onClose} data-ansehen-als-sheet>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ansehen-als-titel" className="lg-title2 pt-2">{t('profil_ansehen_als')}</h2>
          <p className="mt-1 text-[14px] text-[var(--lg-text-2)]">{t('profil_ansehen_als_intro')}</p>
        </div>
        <SheetClose onClick={onClose} />
      </div>
      <div className="mt-3 flex flex-col divide-y divide-[var(--lg-separator)]">
        {ziele.map(z => (
          <button
            key={z.als}
            type="button"
            className={zeile}
            data-ansehen-als={z.als}
            onClick={() => { onClose(); navigate(`/u/${encodeURIComponent(username.toLowerCase())}?als=${z.als}`) }}
          >
            <Unterzeile titel={z.titel} sub={z.sub} />
            <Weiter />
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export function ProfilSichtbarkeit() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { werte, fehler } = useEinstellungen(user?.id)
  const sichtbarkeit = useFieldVisibility(user?.id, werte?.visibility ?? null)

  return (
    <div data-profile-visibility-page>
      <Leiste titel={t('profil_wer_sieht_was')} zurueck="/profil/einstellungen" />
      {fehler && <p role="alert" className="card text-[15px] text-[var(--lg-text-2)]">{t('profil_laden_fehler')}</p>}
      {!werte && !fehler && <div className="h-[320px] animate-pulse rounded-[24px] bg-[var(--lg-surface-2)]" aria-busy="true" />}
      {werte && (
        <WerSiehtWas
          map={sichtbarkeit.map}
          privat={werte.privat}
          onSetField={(field, v) => void sichtbarkeit.setField(field, v)}
          onSetSection={(section, v) => void sichtbarkeit.setSection(section, v)}
        />
      )}
    </div>
  )
}

export function ProfilBlockiert() {
  const { t } = useTranslation()
  return (
    <div data-profile-blocked-page>
      <Leiste titel={t('blocked_list_title')} zurueck="/profil/einstellungen" />
      <BlockiertListe />
      <p className="mt-3 px-1 text-[13px] leading-snug text-[var(--lg-text-3)]">{t('profil_blockiert_hinweis')}</p>
    </div>
  )
}
