/**
 * Web-Seite `/u/<name>` ohne Anmeldung (Teilprojekt 2c, Spec 1.1–1.3, Mockup
 * `docs/profil/mockups/profil-2c.html` Abschnitt 2) und die eine 404-Seite für
 * Web-Link aus, privat, unbekannt und ausgeblendet.
 *
 * Alles kommt aus `profile_view` in der Stufe `web`: Der Server hat schon
 * gefiltert (nur Felder auf „Alle“, Bio nach Textprüfung, Fortschritt nur als
 * Stufe, Abzeichen nach Web-Freigabe, Berichte nur als Anzahl). Die Seite zeigt,
 * was in der Antwort steht, und filtert nichts zusätzlich — sie sortiert nur
 * die Abzeichen und kürzt sie auf eine Reihe.
 */
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { CalendarDays, ChevronRight, Flame, TrendingUp } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import {
  detectWebPlatform, openInHokuTarget, storeConfigFromEnv, type StoreLink,
} from '../../applinks/lib/openInHoku'
import { LegalLinks } from '../../compliance/components/LegalLinks'
import { ReportSheet } from '../../compliance/components/ReportSheet'
import { LEGAL_PATHS } from '../../compliance/legal/texts'
import type { Meldegrund } from '../../compliance/lib/moderation'
import { BADGE_BY_ID, badgeName } from '../lib/badges'
import type { BadgeId } from '../lib/badgeIds'
import { flagOf } from '../lib/profileFields'
import { numberFormat } from '../lib/profileFormat'
import { WEB_PROGRESS_TIERS, type ProfileView, type WebProgressTier } from '../lib/profileView'
import { firstName, memberForText, webBadgeRow } from '../lib/webProfile'
import { useSignedUrl } from '../hooks/useSignedUrl'
import { HokuCode } from './HokuCode'
import { hokuCodeUrl } from '../lib/hokuCode'

const APP_ICON = '/icons/hoku-192.png'
/** Store-Adressen stehen zur Bauzeit fest, die Plattform je Gerät. */
const STORES = storeConfigFromEnv()
const PLATTFORM = typeof navigator === 'undefined' ? 'desktop' : detectWebPlatform(navigator.userAgent, navigator.maxTouchPoints)
/** Store-Knöpfe für „Was ist Hoku?“ und den Rechner: dieselbe Prüfung wie „In Hoku öffnen“. */
const STORE_LINKS: StoreLink[] = (() => {
  const ziel = openInHokuTarget('desktop', 'https://hokuhealth.app/', STORES)
  return ziel.kind === 'desktop' ? ziel.stores : []
})()

// ─── Kopf der Seite (Titel, robots) ─────────────────────────────────────────

/**
 * Titel, `robots` und Smart-App-Banner der Seite. Ab Werk `noindex, nofollow`
 * (Spec 7.2), ohne Tag nur, wenn der Server `web_indexable` meldet — wie
 * `api/u.js`, das dieselben Tags schon ins ausgelieferte HTML setzt. Hier geht
 * es um die Seite, wenn die App sie selbst zeigt (Wechsel innerhalb der App,
 * „Ansehen als“).
 */
function useWebKopf(titel: string, indexierbar: boolean) {
  useEffect(() => {
    const vorher = document.title
    document.title = titel
    const tags: HTMLMetaElement[] = []
    const tag = (name: string, content: string) => {
      document.head.querySelectorAll(`meta[data-web-head][name="${name}"]`).forEach(node => node.remove())
      const meta = document.createElement('meta')
      meta.setAttribute('name', name)
      meta.setAttribute('content', content)
      meta.setAttribute('data-web-head', '')
      document.head.appendChild(meta)
      tags.push(meta)
    }
    if (!indexierbar) tag('robots', 'noindex, nofollow')
    return () => {
      tags.forEach(meta => meta.remove())
      document.title = vorher
    }
  }, [titel, indexierbar])
  // Die Tags aus `api/u.js` (canonical, og:*, robots, Smart App Banner) gehören
  // zu dieser Seite: beim Verlassen weg, sonst trüge /auth noch Maras Vorschau.
  useEffect(() => () => {
    document.head.querySelectorAll('[data-hoku-card]').forEach(node => node.remove())
  }, [])
}

/**
 * Die Web-Seite trägt immer den Look „Soft Dark“ (Mockup 2c: Farben der App,
 * Hoku-Blau für Knöpfe) — unabhängig davon, was auf dem Gerät gespeichert ist.
 * Beim Verlassen (Vorschau des Eigentümers) kommt der eigene Look zurück.
 */
function useWebLook() {
  useEffect(() => {
    const html = document.documentElement
    const vorher = html.getAttribute('data-look')
    html.setAttribute('data-look', 'softdark')
    return () => {
      if (vorher === null) html.removeAttribute('data-look')
      else html.setAttribute('data-look', vorher)
    }
  }, [])
}

// ─── Gerüst ────────────────────────────────────────────────────────────────

/** Gemeinsamer Rahmen von Profil- und 404-Seite: Kopfzeile, Inhalt, „Was ist Hoku?“, Fußzeile. */
function WebRahmen({ band, children, fuss, ...data }: {
  band?: ReactNode
  children: ReactNode
  fuss?: ReactNode
} & Record<`data-${string}`, boolean>) {
  const { t } = useTranslation()
  useWebLook()
  return (
    <div className="min-h-[100svh] bg-[var(--app-bg)] text-[var(--lg-text)]" {...data}>
      {band}
      <div className={`mx-auto w-full max-w-[440px] px-4 ${band ? 'pt-2' : 'pt-[calc(0.5rem+env(safe-area-inset-top,0px))]'} pb-[calc(1rem+env(safe-area-inset-bottom,0px))]`}>
        <header className="flex items-center justify-between gap-3 py-2" data-web-head>
          <span className="inline-flex items-center gap-2">
            <img src={APP_ICON} alt="" width={28} height={28} className="h-7 w-7 rounded-[7px]" />
            <span className="text-[19px] font-semibold tracking-[-0.01em]">Hoku</span>
          </span>
          <a href="#was-ist-hoku" className="lg-gray-btn !min-h-9 !px-3 !text-[13px]" data-web-get-app>{t('web_app_laden')}</a>
        </header>
        {children}
        <WasIstHoku />
        <footer className="flex flex-col items-center gap-2 pb-2 pt-5" data-web-foot>
          <LegalLinks />
          {fuss}
        </footer>
      </div>
    </div>
  )
}

/** Spec 1.3: ehrlich, ohne Heilsversprechen, ohne Substanznamen. Steht auch auf der 404-Seite. */
function WasIstHoku() {
  const { t } = useTranslation()
  return (
    <section id="was-ist-hoku" aria-labelledby="was-ist-hoku-titel" className="mt-7 scroll-mt-4 border-t border-[var(--lg-separator)] px-1 pt-6" data-web-about>
      <div className="mb-3 flex items-center gap-3">
        <img src={APP_ICON} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-[11px]" />
        <div className="min-w-0">
          <h2 id="was-ist-hoku-titel" className="text-[18px] font-semibold">{t('web_was_ist_hoku')}</h2>
          <p className="text-[13px] text-[var(--lg-text-3)]">{t('web_hoku_unterzeile')}</p>
        </div>
      </div>
      <p className="text-[15px] leading-relaxed text-[var(--lg-text-2)]">{t('web_hoku_text')}</p>
      <ul className="mt-3 grid gap-2">
        {(['web_hoku_punkt_1', 'web_hoku_punkt_2', 'web_hoku_punkt_3'] as const).map(key => (
          <li key={key} className="grid grid-cols-[14px_1fr] gap-2 text-[14px] leading-snug text-[var(--lg-text-2)]">
            <span aria-hidden="true" className="ml-[3px] mt-[7px] h-[5px] w-[5px] rounded-full bg-[var(--lg-accent-text)]" />
            {t(key)}
          </li>
        ))}
      </ul>
      <StoreKnoepfe className="mt-4" />
    </section>
  )
}

/** App Store und Google Play, solange es sie noch nicht gibt: die App im Browser. */
function StoreKnoepfe({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  if (STORE_LINKS.length === 0) {
    return (
      <div className={className}>
        <Link to="/auth" className="lg-gray-btn w-full" data-web-browser>{t('web_im_browser')}</Link>
      </div>
    )
  }
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {STORE_LINKS.map(({ store, href }) => (
        <a
          key={store}
          href={href}
          rel="noopener noreferrer"
          data-web-store={store}
          className="grid min-h-11 min-w-0 gap-px rounded-[13px] border border-white/15 bg-white/[0.03] px-3 py-2 text-left [touch-action:manipulation] [user-select:none] active:scale-[0.97]"
        >
          <small className="text-[11px] text-[var(--lg-text-3)]">{t(store === 'app-store' ? 'web_store_ios_klein' : 'web_store_android_klein')}</small>
          <b className="text-[15px] font-semibold">{store === 'app-store' ? 'App Store' : 'Google Play'}</b>
        </a>
      ))}
    </div>
  )
}

// ─── „In Hoku öffnen“ ──────────────────────────────────────────────────────

/**
 * Ziel nach `openInHokuTarget` (Spec 5.1): iPhone in den App Store, Android über
 * `intent://` in die App oder den Play Store, ohne Store-Einträge `/auth`
 * (Frage 2). Am Rechner klappt der Knopf den Hoku-Code zum Scannen und die
 * Store-Knöpfe auf (Frage 21) — auch ohne Store-Einträge, dann mit „Im Browser öffnen“.
 */
function InHokuOeffnen({ username, className = '', children }: { username: string; className?: string; children: ReactNode }) {
  const { t } = useTranslation()
  const [offen, setOffen] = useState(false)
  const panelId = useId()
  // Feste Adresse wie im Hoku-Code: nur hokuhealth.app öffnet die App
  const adresse = hokuCodeUrl(username)
  if (PLATTFORM !== 'desktop') {
    const ziel = openInHokuTarget(PLATTFORM, adresse, STORES)
    if (ziel.kind === 'auth') return <Link to={ziel.href} className={className} data-web-open>{children}</Link>
    if (ziel.kind !== 'desktop') return <a href={ziel.href} rel="noopener noreferrer" className={className} data-web-open>{children}</a>
  }
  return (
    <>
      <button type="button" className={className} aria-expanded={offen} aria-controls={panelId} onClick={() => setOffen(o => !o)} data-web-open>
        {children}
      </button>
      {offen && (
        <div id={panelId} className="card mt-1 flex items-center gap-4 !p-4" data-web-desktop-open>
          <HokuCode url={adresse} className="h-[124px] w-[124px] rounded-[14px] bg-white p-2" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{t('web_desktop_scan_titel')}</p>
            <p className="mt-1 text-[13px] leading-snug text-[var(--lg-text-2)]">{t('web_desktop_scan_text')}</p>
            <StoreKnoepfe className="mt-3" />
          </div>
        </div>
      )}
    </>
  )
}

// ─── Bausteine der Profilseite ─────────────────────────────────────────────

/** Gesamtfortschritt nur als Stufe „über X %“ (Entscheidung 04.11.): keine Zahl, keine Bereiche, kein Start. */
function WebFortschritt({ tier, username }: { tier: WebProgressTier; username: string }) {
  const { t } = useTranslation()
  return (
    <section className="card mb-3" aria-labelledby="web-fortschritt-titel" data-web-progress={tier}>
      <h2 id="web-fortschritt-titel" className="text-[17px] font-semibold">{t('web_fortschritt_titel')}</h2>
      <p className="mt-3 flex items-baseline gap-2 font-semibold tabular-nums tracking-[-0.03em]">
        <TrendingUp size={24} aria-hidden="true" className="self-center text-[var(--lg-good)]" />
        <small className="text-[15px] font-medium tracking-normal text-[var(--lg-text-2)]">{t('web_fortschritt_ueber')}</small>
        <span className="text-[40px] leading-none text-[var(--lg-good)]">{t('web_fortschritt_prozent', { tier })}</span>
      </p>
      <p className="mt-2 text-[13px] leading-snug text-[var(--lg-text-2)]">{t('web_fortschritt_lab')}</p>
      <div role="img" aria-label={t('web_fortschritt_aria', { tier })} className="mt-3.5">
        <div className="grid grid-cols-6 gap-[3px]" aria-hidden="true">
          {WEB_PROGRESS_TIERS.map(x => (
            <i key={x} className={`h-1.5 rounded-[3px] ${x <= tier ? 'bg-[var(--lg-good)]' : 'bg-[color-mix(in_srgb,var(--lg-good)_18%,transparent)]'}`} />
          ))}
        </div>
        <div className="mt-1 grid grid-cols-6 gap-[3px] text-right font-mono text-[10.5px] text-[var(--lg-text-3)]" aria-hidden="true">
          {WEB_PROGRESS_TIERS.map(x => <span key={x}>{x === 100 ? t('web_fortschritt_prozent', { tier: x }) : x}</span>)}
        </div>
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-[var(--lg-separator)] pt-3 text-[13px] leading-snug text-[var(--lg-text-3)]">
        <span className="min-w-0">{t('web_fortschritt_app')}</span>
        <InHokuOeffnen username={username} className="inline-flex min-h-11 shrink-0 items-center font-medium text-[var(--lg-accent-text)] [touch-action:manipulation]">
          {t('web_in_hoku_ansehen')}
        </InHokuOeffnen>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-[var(--lg-text-3)]">{t('web_fortschritt_note')}</p>
    </section>
  )
}

function WebAbzeichenKachel({ id }: { id: BadgeId }) {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'de'
  return (
    <div className="grid min-w-0 content-start justify-items-center gap-2 overflow-hidden rounded-2xl bg-[var(--lg-fill)] px-1 pb-3 pt-3.5 text-center" data-badge={id}>
      <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-[color-mix(in_srgb,var(--lg-accent)_16%,transparent)] text-[20px]">
        {BADGE_BY_ID[id].icon}
      </span>
      <span lang={lang.toLowerCase().startsWith('de') ? 'de' : 'en'} className="text-[11.5px] leading-tight text-[var(--lg-text-2)] [hyphens:auto] [overflow-wrap:anywhere]">
        {badgeName(id, lang)}
      </span>
    </div>
  )
}

/**
 * Eine Reihe, die schwersten zuerst (Mockup 2c): bis drei offen, sonst zwei
 * offen und die dritte weichgezeichnet mit „+x“. Unter der Unschärfe liegt nur
 * ein Platzhalter, nie das echte Abzeichen.
 */
function WebAbzeichen({ ids, username }: { ids: readonly BadgeId[]; username: string }) {
  const { t } = useTranslation()
  const { open, more } = webBadgeRow(ids)
  return (
    <section className="card mb-3" aria-labelledby="web-abzeichen-titel" data-web-badges>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="web-abzeichen-titel" className="text-[17px] font-semibold">{t('profil_feld_badges')}</h2>
        <span className="text-[13px] tabular-nums text-[var(--lg-text-3)]" data-web-badges-count>{open.length + more}</span>
      </div>
      <div className="grid grid-cols-3 gap-2" data-web-badges-row>
        {open.map(id => <WebAbzeichenKachel key={id} id={id} />)}
        {more > 0 && (
          <div
            role="img"
            aria-label={t('web_abzeichen_weitere_aria', { count: more })}
            className="relative grid min-w-0 overflow-hidden rounded-2xl bg-[var(--lg-fill)]"
            data-web-badges-more={more}
          >
            <div aria-hidden="true" className="grid justify-items-center gap-2 px-1 pb-3 pt-3.5 opacity-40 blur-[5px]">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[color-mix(in_srgb,var(--lg-accent)_16%,transparent)] text-[20px]">🏅</span>
              <span className="grid w-full justify-items-center gap-1">
                <i className="h-[7px] w-4/5 rounded bg-white/35" />
                <i className="h-[7px] w-[55%] rounded bg-white/35" />
              </span>
            </div>
            <div aria-hidden="true" className="absolute inset-0 grid place-content-center gap-0.5 text-center">
              <b className="text-[24px] font-semibold leading-none tabular-nums">+{more}</b>
              <small className="text-[11.5px] text-[var(--lg-text-2)]">{t('web_abzeichen_weitere')}</small>
            </div>
          </div>
        )}
      </div>
      {more > 0 && (
        <InHokuOeffnen username={username} className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 text-[13px] font-medium text-[var(--lg-accent-text)] [touch-action:manipulation]">
          {t('web_abzeichen_alle')} <ChevronRight size={14} aria-hidden="true" />
        </InHokuOeffnen>
      )}
    </section>
  )
}

// ─── Profil melden ohne Konto ──────────────────────────────────────────────

/** Fehler der Web-Meldung: Code aus `report_public_profile_web` → Hinweis. */
type WebMeldeFehler = 'zu_viele' | 'kontakt' | 'fehler'

function webMeldeFehler(message: string | undefined): WebMeldeFehler {
  if (message?.includes('zu_viele_meldungen')) return 'zu_viele'
  if (message?.includes('kontakt_ungueltig')) return 'kontakt'
  return 'fehler'
}

/**
 * DSA Art. 16 (Spec 7.4, Frage 8): melden ohne Konto, Grund und freiwillig eine
 * E-Mail, an `report_public_profile_web` (supabase-profil-p2c-web.sql, Abschnitt
 * 7: landet in `content_reports` mit `source = 'web'`, Grenzen 5 je Profil und
 * 200 insgesamt je Stunde). Scheitert das Senden, nennt die Seite den Weg über
 * das Impressum; eine unvollständige E-Mail meldet sie eigens.
 */
function ProfilMeldenWeb({ username, onClose }: { username: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<WebMeldeFehler | null>(null)
  const senden = async (grund: Meldegrund, details: string, email: string) => {
    setBusy(true)
    setFehler(null)
    let error: { message?: string } | null
    try {
      ({ error } = await supabase.rpc('report_public_profile_web', {
        p_username: username, p_reason: grund, p_details: details.trim() || null, p_contact: email || null,
      }))
    } catch {
      error = {}
    } finally {
      setBusy(false)
    }
    if (error) return setFehler(webMeldeFehler(error.message))
    onClose()
    toast.success(t('report_sent'))
  }
  return (
    <ReportSheet
      titel={t('report_profile_title')}
      betreff={`@${username}`}
      busy={busy}
      kontakt
      onCancel={onClose}
      onSend={(grund, details, email) => void senden(grund, details, email)}
      hinweis={fehler && (
        <p role="alert" className="text-[13px] leading-snug text-[var(--lg-warn-text)]" data-report-web-error={fehler}>
          {t(fehler === 'zu_viele' ? 'report_web_too_many' : fehler === 'kontakt' ? 'report_email_invalid' : 'report_web_failed')}{' '}
          {fehler !== 'kontakt' && (
            <Link to={LEGAL_PATHS.impressum} className="font-semibold underline underline-offset-2" data-report-web-imprint>
              {t('report_web_failed_link')}
            </Link>
          )}
        </p>
      )}
    />
  )
}

// ─── Seiten ────────────────────────────────────────────────────────────────

/** Ohne Anmeldung und für „Ansehen als › Web-Link“: die feste Web-Seite. */
export function WebAnsicht({ view, band }: { view: ProfileView; band?: ReactNode }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'de'
  const { n } = numberFormat(locale)
  const f = view.fields
  const name = view.displayName || view.username
  const avatarUrl = useSignedUrl(view.avatar)
  const coverUrl = useSignedUrl(f.cover ?? null)
  const [meldet, setMeldet] = useState(false)
  useWebKopf(`${name} (@${view.username}) · Hoku`, view.webIndexable === true)

  const tier = f.progress && 'tier' in f.progress ? f.progress.tier : null
  const member = view.card?.memberFor ? memberForText(view.card.memberFor) : null
  const werte = view.card?.webValueCount ?? null

  return (
    <WebRahmen
      band={band}
      data-web-profile
      fuss={(
        <button
          type="button"
          onClick={() => setMeldet(true)}
          // In der eigenen Vorschau: sich selbst melden geht nicht
          disabled={view.own}
          className="inline-flex min-h-11 items-center px-2 text-[13px] text-[var(--lg-text-3)] underline-offset-2 [touch-action:manipulation] disabled:opacity-50"
          data-web-report
        >
          {t('report_profile_action')}
        </button>
      )}
    >
      {/* Titelbild nur geprüft und auf „Alle“; sonst dieselbe ruhige Fläche */}
      <div className="relative h-[132px] overflow-hidden rounded-[22px] bg-[radial-gradient(90%_120%_at_15%_0%,color-mix(in_srgb,var(--lg-accent)_22%,transparent),transparent_60%),linear-gradient(160deg,#2a2c32,#1f2024)]" data-web-cover>
        {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="relative z-[1] -mt-8 flex items-end gap-3 px-2">
        <div className="grid h-[84px] w-[84px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-[var(--app-bg)] bg-[linear-gradient(140deg,#2b6fd0,#1b3f78)] text-[30px] font-semibold text-white" data-profile-avatar>
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            : <span aria-hidden="true">{(Array.from(name.trim())[0] ?? '').toLocaleUpperCase(locale)}</span>}
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="min-w-0 max-w-full truncate text-[21px] font-semibold leading-tight tracking-[-0.01em]" data-profile-name>{name}</h1>
            {f.country && (
              <span className="rounded-lg bg-[var(--lg-fill)] px-[7px] py-0.5 text-[12px] font-semibold tracking-[0.04em] text-[var(--lg-text-2)]" data-profile-country>
                <span aria-hidden="true">{flagOf(f.country)}</span> {f.country}
              </span>
            )}
          </div>
          <p className="truncate text-[14px] text-[var(--lg-text-2)]" data-profile-nick>@{view.username}</p>
        </div>
      </div>

      {f.bio && <p className="mt-3.5 whitespace-pre-line break-words px-2 text-[15px] leading-relaxed" data-profile-bio>{f.bio}</p>}

      {(f.streak || member) && (
        <ul className="mt-3.5 grid gap-1.5 px-2 text-[13px] text-[var(--lg-text-2)]" data-web-facts>
          {f.streak && (
            <li className="flex items-center gap-2" data-web-streak>
              <Flame size={15} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
              <span><b className="font-semibold tabular-nums text-[var(--lg-text)]">{t('web_streak_tage', { count: f.streak.days })}</b> {t('web_streak_in_folge')}</span>
            </li>
          )}
          {member && (
            <li className="flex items-center gap-2" data-web-member>
              <CalendarDays size={15} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
              <span>{t(member.key, { count: member.count })}</span>
            </li>
          )}
        </ul>
      )}

      {f.goals && f.goals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 px-2" data-profile-goals>
          {f.goals.map(g => (
            <span key={g} className="rounded-full bg-[var(--lg-fill)] px-2.5 py-1 text-[12px] text-[var(--lg-text-2)]">{t(`ziel_${g}`)}</span>
          ))}
        </div>
      )}

      {werte !== null && (
        <p className="mx-2 mt-4 flex flex-wrap items-baseline gap-x-1.5 border-t border-[var(--lg-separator)] pt-3.5 text-[14px] text-[var(--lg-text-2)]" data-web-values={werte}>
          {t('web_trackt_vor', { name: firstName(view.displayName, view.username) })}
          <b className="text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--lg-text)]">{n(werte)}</b>
          {t('web_trackt_nach', { count: werte })}
        </p>
      )}

      <div className="mt-5 grid gap-2">
        <InHokuOeffnen username={view.username} className="lg-btn lg-btn-primary w-full">{t('web_open_in_hoku')}</InHokuOeffnen>
        {f.reviews && f.reviews.count > 0 && (
          <p className="text-center text-[12.5px] leading-snug text-[var(--lg-text-3)]" data-web-reviews-hint>
            {t('web_berichte_hinweis', { count: f.reviews.count, n: n(f.reviews.count) })}
          </p>
        )}
      </div>

      {(tier !== null || f.badges) && (
        <div className="mt-5">
          {tier !== null && <WebFortschritt tier={tier} username={view.username} />}
          {f.badges && f.badges.length > 0 && <WebAbzeichen ids={f.badges} username={view.username} />}
        </div>
      )}

      {meldet && <ProfilMeldenWeb username={view.username} onClose={() => setMeldet(false)} />}
    </WebRahmen>
  )
}

/**
 * Eine Antwort für Web-Link aus, privat, unbekannt und ausgeblendet (Spec 1.2):
 * dieselbe Seite ohne jeden Hinweis auf den Namen. Status und Kopfzeilen der
 * Antwort setzt `api/u.js` (Task 6); die App selbst kennt keinen Status.
 */
export function WebNichtGefunden({ band }: { band?: ReactNode }) {
  const { t } = useTranslation()
  useWebKopf(`${t('web_page_not_found')} · Hoku`, false)
  return (
    <WebRahmen band={band} data-web-not-found>
      <div className="grid justify-items-center gap-2.5 px-4 pb-2 pt-14 text-center">
        <p aria-hidden="true" className="text-[54px] font-semibold leading-none tracking-[-0.02em] text-[var(--lg-text-3)] opacity-40">404</p>
        <h1 className="text-[21px] font-semibold">{t('web_page_not_found')}</h1>
        <p className="max-w-[30ch] text-[15px] leading-snug text-[var(--lg-text-2)]">{t('web_page_not_found_text')}</p>
      </div>
    </WebRahmen>
  )
}
