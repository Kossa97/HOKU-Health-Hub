import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Ban, ChevronLeft, Flag, Lock, MoreHorizontal, Star, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { WiederNehmen } from '../features/reviews/lib/reviewModel'
import type { Meldegrund } from '../features/compliance/lib/moderation'
import { ReportSheet } from '../features/compliance/components/ReportSheet'
import { BlockSheet } from '../features/compliance/components/BlockSheet'
import { LegalLinks } from '../features/compliance/components/LegalLinks'
import { Sheet } from '../features/compliance/components/Sheet'
import { ProfilKopf } from '../features/profil/components/ProfilKopf'
import { ProfilKarten } from '../features/profil/components/ProfilKarten'
import { FortschrittKarte } from '../features/profil/components/FortschrittKarte'
import { AbzeichenKarte } from '../features/profil/components/AbzeichenKarte'
import { useSignedUrl } from '../features/profil/hooks/useSignedUrl'
import { isWebProgress, parseProfileView, type ProfileView } from '../features/profil/lib/profileView'

/**
 * Fremdes Profil unter /u/<name> (Teilprojekt 2a). Alles kommt aus
 * `profile_view`: Der Server hat schon gefiltert, die Seite zeigt nur, was in
 * der Antwort steht — ohne Chips und ohne Hinweis auf Verborgenes.
 *
 * - Angemeldet: App-Ansicht mit denselben Bausteinen wie das eigene Profil,
 *   Leiste ‹ @nick ⋯ (Melden, Blockieren). Erfahrungsberichte nur, wenn das
 *   Feld freigegeben ist, dann über `public_profile_reviews`.
 * - Ohne Anmeldung: nur Bild, Name, Nickname, Bio und „In Hoku öffnen“ —
 *   keine Berichte. Web-Link aus, privat und unbekannt sehen gleich aus.
 * - „Ansehen als“: `/u/<eigener name>?als=friends|all|web` zeigt die Sicht
 *   der Stufe, oben ein schmales Band mit Zurück.
 */

interface OeffentlicheBewertung {
  id: string
  substanz: string
  rating: number
  title: string | null
  body: string | null
  pros: string | null
  cons: string | null
  wirkung: number | null
  vertraeglichkeit: number | null
  wieder_nehmen: WiederNehmen | null
  /** „2026-09" — nur der Monat. */
  monat: string
}

type AlsStufe = 'friends' | 'all' | 'web'
const alsAus = (wert: string | null): AlsStufe | null =>
  wert === 'friends' || wert === 'all' || wert === 'web' ? wert : null

type Ergebnis = { fuer: string; zustand: 'da' | 'nicht_da' | 'fehler'; view: ProfileView | null }

export function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const [params] = useSearchParams()
  const als = alsAus(params.get('als'))
  const { user, loading } = useAuth()
  const [neuLaden, setNeuLaden] = useState(0)
  // Das Ergebnis merkt sich, wofür es geladen wurde: wechselt Adresse,
  // Stufe oder Anmeldung, gilt es nicht mehr — kein altes Profil unter neuem Namen.
  const schluessel = `${username ?? ''}|${als ?? ''}|${user?.id ?? ''}`
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)

  useEffect(() => {
    if (loading) return
    let aktuell = true
    void supabase.rpc('profile_view', { p_username: username ?? '', p_as: als }).then(({ data, error }) => {
      if (!aktuell) return
      if (error) return setErgebnis({ fuer: schluessel, zustand: 'fehler', view: null })
      const view = parseProfileView(data)
      setErgebnis({ fuer: schluessel, zustand: view ? 'da' : 'nicht_da', view })
    })
    return () => { aktuell = false }
  }, [username, als, loading, schluessel, neuLaden])

  const gilt = ergebnis && ergebnis.fuer === schluessel ? ergebnis : null
  if (!gilt) return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]" aria-busy="true">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
    </div>
  )

  const view = gilt.view
  if (gilt.zustand === 'fehler') return <Leer icon={<Lock size={40} aria-hidden="true" className="opacity-30" />} titel="public_profile_error" />
  if (!view) return user
    ? <Leer icon={<User size={40} aria-hidden="true" className="opacity-30" />} titel="public_profile_not_found" text="public_profile_not_found_desc" data-profile-not-found />
    : <Leer icon={<Lock size={40} aria-hidden="true" className="opacity-30" />} titel="web_page_not_found" data-web-not-found />

  // Eigenes Profil ohne „Ansehen als“: das Schaufenster mit Chips liegt unter /profil.
  if (view.own && !als && user) return <Navigate to="/profil" replace />

  const stufe: AlsStufe | null = view.own ? alsAus(view.as) : null
  const band = stufe ? <AlsBand stufe={stufe} /> : null

  if (!user || stufe === 'web') return <WebAnsicht view={view} band={band} />
  return <AppAnsicht view={view} band={band} onNeuLaden={() => setNeuLaden(n => n + 1)} />
}

function Leer({ icon, titel, text, ...data }: { icon: ReactNode; titel: string; text?: string } & Record<`data-${string}`, boolean>) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--app-bg)] px-6 text-center text-[var(--lg-text-2)]" {...data}>
      {icon}
      <p className="text-[17px] font-semibold text-[var(--lg-text)]">{t(titel)}</p>
      {text && <p className="max-w-xs text-sm">{t(text)}</p>}
      <Link to="/" className="lg-btn lg-btn-primary mt-2">{t('public_profile_to_app')}</Link>
      <LegalLinks className="mt-6" />
    </div>
  )
}

/** Schmales Band über „Ansehen als“ mit Zurück. */
function AlsBand({ stufe }: { stufe: AlsStufe }) {
  const { t } = useTranslation()
  return (
    <div
      className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[var(--lg-fill)] px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-[13px] backdrop-blur"
      data-view-as={stufe}
    >
      <span className="min-w-0 truncate text-[var(--lg-text)]">{t('profil_als_band', { wer: t(`profil_als_wer_${stufe}`) })}</span>
      <Link to="/profil/einstellungen" className="inline-flex min-h-11 shrink-0 items-center font-semibold text-[var(--lg-accent-text)]" data-view-as-back>
        {t('back')}
      </Link>
    </div>
  )
}

/** Ohne Anmeldung: Bild, Name, Nickname, Bio — sonst nichts. */
function WebAnsicht({ view, band }: { view: ProfileView; band: ReactNode }) {
  const { t } = useTranslation()
  const avatarUrl = useSignedUrl(view.avatar)
  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--lg-text)]" data-web-profile>
      {band}
      <div className={`mx-auto flex max-w-sm flex-col items-center px-4 pb-8 text-center ${band ? 'pt-10' : 'pt-[calc(4rem+env(safe-area-inset-top))]'}`}>
        <div className="grid h-[96px] w-[96px] place-items-center overflow-hidden rounded-full bg-[var(--lg-fill)]" data-profile-avatar>
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            : <User size={42} className="text-[var(--lg-text-2)]" aria-hidden="true" />}
        </div>
        <h1 className="mt-4 max-w-full truncate text-[26px] font-bold leading-tight">{view.displayName || view.username}</h1>
        <p className="mt-0.5 text-[15px] text-[var(--lg-text-2)]">@{view.username}</p>
        {view.fields.bio && (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed" data-profile-bio>{view.fields.bio}</p>
        )}
        <Link to="/auth" className="lg-btn lg-btn-primary mt-6 w-full" data-web-open>{t('web_open_in_hoku')}</Link>
        <p className="mt-3 text-[13px] leading-snug text-[var(--lg-text-3)]" data-web-app-only>{t('web_profile_app_only')}</p>
        <LegalLinks className="mt-8" />
      </div>
    </div>
  )
}

/** Angemeldet: App-Ansicht wie das eigene Profil, ohne Chips. */
function AppAnsicht({ view, band, onNeuLaden }: { view: ProfileView; band: ReactNode; onNeuLaden: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fremd = !view.own
  const [mehr, setMehr] = useState(false)
  const [meldet, setMeldet] = useState<{ art: 'erfahrung'; review: OeffentlicheBewertung } | { art: 'profil' } | null>(null)
  const [blockt, setBlockt] = useState(false)
  const [busy, setBusy] = useState(false)

  const melden = async (grund: Meldegrund, details: string) => {
    if (!meldet) return
    setBusy(true)
    const { error } = meldet.art === 'erfahrung'
      ? await supabase.rpc('report_public_review', { p_review_id: meldet.review.id, p_reason: grund, p_details: details || null })
      : await supabase.rpc('report_public_profile', { p_username: view.username, p_reason: grund, p_details: details || null })
    setBusy(false)
    if (error) return toast.error(t(error.message?.includes('zu_viele_meldungen') ? 'report_too_many' : 'error'))
    setMeldet(null)
    toast.success(t('report_sent'))
  }

  const setzeBlock = async (blockiert: boolean) => {
    setBusy(true)
    const { error } = await supabase.rpc('set_profile_block', { p_username: view.username, p_blocked: blockiert })
    setBusy(false)
    if (error) return toast.error(t('error'))
    setBlockt(false)
    toast.success(t(blockiert ? 'block_done' : 'unblock_done'))
    onNeuLaden()
  }

  if (view.blocked) return (
    <div data-profile-blocked className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--app-bg)] px-6 text-center text-[var(--lg-text-2)]">
      <Ban size={40} aria-hidden="true" className="opacity-30" />
      <p className="text-[17px] font-semibold text-[var(--lg-text)]">{t('blocked_profile_title')}</p>
      <p className="text-sm">@{view.username}</p>
      <button type="button" data-unblock disabled={busy} onClick={() => void setzeBlock(false)} data-quiet className="lg-gray-btn">
        {t('unblock_action')}
      </button>
      <LegalLinks className="mt-6" />
    </div>
  )

  const zurueck = () => {
    // Direkt geöffneter Link: kein Verlauf in der App, dann zur Startseite
    if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1)
    else navigate('/')
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--lg-text)]" data-public-profile>
      {band}
      <div className={`mx-auto max-w-lg px-4 pb-8 ${band ? 'pt-2' : 'pt-[calc(0.5rem+env(safe-area-inset-top))]'}`}>
        <nav className="mb-3 grid grid-cols-[44px_1fr_44px] items-center" data-profile-bar>
          {band ? <span /> : (
            <button type="button" onClick={zurueck} aria-label={t('back')} className="grid h-11 w-11 place-items-center rounded-full text-[var(--lg-text)]" data-profile-back>
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
          )}
          <p className="min-w-0 truncate text-center text-[17px] font-semibold">@{view.username}</p>
          {fremd ? (
            <button type="button" onClick={() => setMehr(true)} aria-label={t('public_profile_more')} className="grid h-11 w-11 place-items-center rounded-full text-[var(--lg-text)]" data-profile-more>
              <MoreHorizontal size={22} aria-hidden="true" />
            </button>
          ) : <span />}
        </nav>

        <ProfilKopf
          name={view.displayName || view.username}
          username={view.username}
          avatarPath={view.avatar}
          fields={view.private ? {} : view.fields}
        />

        {view.private ? (
          <section className="card flex items-center gap-3" data-profile-private>
            <Lock size={20} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold">{t('profil_privat')}</h2>
              <p className="text-[14px] text-[var(--lg-text-2)]">{t('public_profile_private_text')}</p>
            </div>
          </section>
        ) : (
          <>
            {/* 2b: nur bei Freigabe; ohne Chips, ohne Einzelwerte, ohne Zeitreise.
                Stufe web bringt nur {tier}: das zeigt die Web-Ansicht (2c, Task 4). */}
            {view.fields.progress && !isWebProgress(view.fields.progress) && (
              <FortschrittKarte summary={{ total: view.fields.progress.total, areas: view.fields.progress.areas, since: view.fields.progress.since }} />
            )}
            {view.fields.badges && <AbzeichenKarte own={false} ids={view.fields.badges} />}
            <ProfilKarten fields={view.fields} />
            {view.fields.reviews && (
              <Berichte username={view.username} fremd={fremd} onMelden={review => setMeldet({ art: 'erfahrung', review })} />
            )}
          </>
        )}

        <LegalLinks className="mt-8 pb-4" />
      </div>

      {mehr && (
        <Sheet labelledBy="profil-mehr-titel" onClose={() => setMehr(false)} data-profile-more-sheet>
          <h2 id="profil-mehr-titel" className="lg-title2 truncate pb-3 pt-2">@{view.username}</h2>
          <div className="space-y-2">
            <button type="button" className="lg-gray-btn w-full" data-report-profile onClick={() => { setMehr(false); setMeldet({ art: 'profil' }) }}>
              <Flag size={15} aria-hidden="true" /> {t('report_profile_action')}
            </button>
            <button type="button" data-tone="bad" className="lg-gray-btn w-full" data-block-open onClick={() => { setMehr(false); setBlockt(true) }}>
              <Ban size={15} aria-hidden="true" /> {t('block_action')}
            </button>
            <button type="button" className="lg-gray-btn w-full" onClick={() => setMehr(false)}>{t('cancel')}</button>
          </div>
        </Sheet>
      )}
      {meldet && <ReportSheet
        titel={t(meldet.art === 'erfahrung' ? 'report_title' : 'report_profile_title')}
        betreff={meldet.art === 'erfahrung' ? meldet.review.substanz : `@${view.username}`}
        busy={busy} onCancel={() => setMeldet(null)} onSend={(grund, details) => void melden(grund, details)} />}
      {blockt && <BlockSheet username={view.username} busy={busy} onCancel={() => setBlockt(false)} onConfirm={() => void setzeBlock(true)} />}
    </div>
  )
}

/** Freigegebene Erfahrungsberichte (nur angemeldet, nur bei Feld „Erfahrungsberichte“ auf „Alle“). */
function Berichte({ username, fremd, onMelden }: { username: string; fremd: boolean; onMelden: (r: OeffentlicheBewertung) => void }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [liste, setListe] = useState<{ fuer: string; reviews: OeffentlicheBewertung[] } | null>(null)

  useEffect(() => {
    let aktuell = true
    void supabase.rpc('public_profile_reviews', { p_username: username }).then(({ data, error }) => {
      if (!aktuell) return
      const reviews = !error && data && Array.isArray((data as { reviews?: unknown }).reviews)
        ? (data as { reviews: OeffentlicheBewertung[] }).reviews
        : []
      setListe({ fuer: username, reviews })
    })
    return () => { aktuell = false }
  }, [username])

  const reviews = liste?.fuer === username ? liste.reviews : []
  if (reviews.length === 0) return null

  const monat = (wert: string) => new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${wert}-01T00:00:00.000Z`))

  return (
    <section className="mt-3" aria-label={t('bewertungen_title')} data-public-reviews>
      <p data-review-disclaimer className="mb-3 px-1 text-[13px] text-[var(--lg-text-2)]">{t('review_disclaimer')}</p>
      <ul className="flex flex-col gap-3">
        {reviews.map(r => {
          const kriterien = [
            r.wirkung ? `${t('review_effect')} ${r.wirkung}/5` : null,
            r.vertraeglichkeit ? `${t('review_tolerability')} ${r.vertraeglichkeit}/5` : null,
            r.wieder_nehmen ? `${t('review_again')} ${t(`review_again_${r.wieder_nehmen}`)}` : null,
          ].filter(Boolean)
          return (
            <li key={r.id} data-public-review className="card !rounded-[22px] !px-4 !py-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[15px] font-semibold text-[var(--lg-accent-text)]">{r.substanz}</p>
                <span className="flex shrink-0 gap-0.5" role="img" aria-label={String(t(r.rating === 1 ? 'review_star_one' : 'review_star_many', { n: r.rating }))}>
                  {[1, 2, 3, 4, 5].map(stern => (
                    <Star key={stern} size={13} aria-hidden="true" className={stern <= r.rating ? 'text-amber-400' : 'text-[var(--lg-text-3)]'} fill={stern <= r.rating ? 'currentColor' : 'transparent'} />
                  ))}
                </span>
              </div>
              {r.title && <p className="mt-1 text-[17px] font-semibold text-[var(--lg-text)]">{r.title}</p>}
              {kriterien.length > 0 && <p className="mt-1 text-[13px] text-[var(--lg-text-2)]">{kriterien.join(' · ')}</p>}
              {r.body && <p className="mt-1.5 text-[15px] leading-snug text-[var(--lg-text)]">{r.body}</p>}
              {r.pros && <p className="mt-1.5 text-[13px]"><span className="font-semibold text-[var(--lg-good-text)]">+ </span><span className="text-[var(--lg-text-2)]">{r.pros}</span></p>}
              {r.cons && <p className="mt-1 text-[13px]"><span className="font-semibold text-[var(--lg-bad-text)]">− </span><span className="text-[var(--lg-text-2)]">{r.cons}</span></p>}
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-[12px] text-[var(--lg-text-3)]">{monat(r.monat)}</p>
                {fremd && (
                  <button type="button" data-report-open onClick={() => onMelden(r)} className="-mr-2 inline-flex min-h-11 items-center gap-1 px-2 text-[12px] text-[var(--lg-text-3)] hover:text-[var(--lg-warn-text)]">
                    <Flag size={11} aria-hidden="true" /> {t('report_action')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
