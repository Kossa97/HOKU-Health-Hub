import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Ban, Flag, FlaskConical, Lock, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { WiederNehmen } from '../features/reviews/lib/reviewModel'
import type { Meldegrund } from '../features/compliance/lib/moderation'
import { ReportSheet } from '../features/compliance/components/ReportSheet'
import { BlockSheet } from '../features/compliance/components/BlockSheet'
import { LegalLinks } from '../features/compliance/components/LegalLinks'

/**
 * Oeffentliches Profil (/u/<name>): Anzeigename, Bio und die Bewertungen,
 * die der Nutzer einzeln freigegeben hat — mehr nicht. Alles kommt aus
 * einer Datenbankfunktion (`public_profile_reviews`), die nur genau das
 * herausgibt; die Tabellen selbst bleiben fuer Besucher zu. Dosis, Zyklus,
 * Alter, Geschlecht und genaue Daten erscheinen hier nie.
 *
 * Jede Erfahrung laesst sich melden (auch ohne Konto), jedes fremde Profil
 * blockieren (angemeldet) — Apple 1.2, Google „User Generated Content".
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

interface OeffentlichesProfil {
  username: string
  display_name: string | null
  public_bio: string | null
  /** Vom Besucher blockiert: dann fehlen Name, Bio und Erfahrungen. */
  blocked?: boolean
  /** Der Besucher sieht sein eigenes Profil. */
  own?: boolean
  reviews?: OeffentlicheBewertung[]
}

export function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [neuLaden, setNeuLaden] = useState(0)
  // Gemeldet wird eine Erfahrung oder das ganze Profil (Name, Bio).
  const [meldet, setMeldet] = useState<{ art: 'erfahrung'; review: OeffentlicheBewertung } | { art: 'profil' } | null>(null)
  const [blockt, setBlockt] = useState(false)
  const [busy, setBusy] = useState(false)
  // Das Ergebnis merkt sich, fuer wen es geladen wurde: wechselt die
  // Adresse, gilt es nicht mehr — das alte Profil steht nie unter dem neuen Namen.
  const [ergebnis, setErgebnis] = useState<{
    fuer: string
    zustand: 'da' | 'nicht_da' | 'fehler'
    profil: OeffentlichesProfil | null
  } | null>(null)

  useEffect(() => {
    let aktuell = true
    const fuer = username ?? ''
    void supabase.rpc('public_profile_reviews', { p_username: fuer }).then(({ data, error }) => {
      if (!aktuell) return
      if (error) return setErgebnis({ fuer, zustand: 'fehler', profil: null })
      setErgebnis({ fuer, zustand: data ? 'da' : 'nicht_da', profil: (data as OeffentlichesProfil | null) ?? null })
    })
    return () => { aktuell = false }
  }, [username, neuLaden])

  const gilt = ergebnis && ergebnis.fuer === (username ?? '') ? ergebnis : null
  const zustand = gilt?.zustand ?? 'laedt'
  const profil = gilt?.profil ?? null

  if (zustand === 'laedt') return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
    </div>
  )

  // Nicht gefunden und privat sehen gleich aus: von aussen soll man nicht
  // erkennen, ob es ein Konto gibt.
  if (zustand !== 'da' || !profil) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-[var(--lg-text-2)]">
      <Lock size={40} aria-hidden="true" className="opacity-30" />
      <p className="text-[17px] font-semibold text-[var(--lg-text)]">
        {zustand === 'fehler' ? t('public_profile_error') : t('public_profile_unavailable')}
      </p>
      <p className="text-sm">{zustand === 'fehler' ? null : t('public_profile_unavailable_desc', { name: username })}</p>
      <Link to="/auth" className="lg-btn lg-btn-primary mt-2">{t('public_profile_to_app')}</Link>
    </div>
  )

  const istEigenes = profil.own === true

  // Melden geht nur angemeldet — sonst liesse sich die Moderation fluten.
  const meldenOeffnen = (ziel: NonNullable<typeof meldet>) => {
    if (!user) return navigate('/auth')
    setMeldet(ziel)
  }

  const melden = async (grund: Meldegrund, details: string) => {
    if (!meldet) return
    setBusy(true)
    const { error } = meldet.art === 'erfahrung'
      ? await supabase.rpc('report_public_review', { p_review_id: meldet.review.id, p_reason: grund, p_details: details || null })
      : await supabase.rpc('report_public_profile', { p_username: profil.username, p_reason: grund, p_details: details || null })
    setBusy(false)
    if (error) return toast.error(t(error.message?.includes('zu_viele_meldungen') ? 'report_too_many' : 'error'))
    setMeldet(null)
    toast.success(t('report_sent'))
  }

  const setzeBlock = async (blockiert: boolean) => {
    setBusy(true)
    const { error } = await supabase.rpc('set_profile_block', { p_username: profil.username, p_blocked: blockiert })
    setBusy(false)
    if (error) return toast.error(t('error'))
    setBlockt(false)
    toast.success(t(blockiert ? 'block_done' : 'unblock_done'))
    setNeuLaden(n => n + 1)
  }

  if (profil.blocked) return (
    <div data-profile-blocked className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-[var(--lg-text-2)]">
      <Ban size={40} aria-hidden="true" className="opacity-30" />
      <p className="text-[17px] font-semibold text-[var(--lg-text)]">{t('blocked_profile_title')}</p>
      <p className="text-sm">@{profil.username}</p>
      <button type="button" data-unblock disabled={busy} onClick={() => void setzeBlock(false)} data-quiet className="lg-gray-btn">
        {t('unblock_action')}
      </button>
      <LegalLinks className="mt-6" />
    </div>
  )

  const reviews = profil.reviews ?? []

  const monat = (wert: string) => new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${wert}-01T00:00:00.000Z`))

  return (
    <div className="min-h-screen bg-black text-[var(--lg-text)]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <header className="mb-8 flex flex-col items-center text-center">
          <h1 className="text-[28px] font-bold leading-tight">{profil.display_name || profil.username}</h1>
          <p className="mt-0.5 text-[15px] text-[var(--lg-text-2)]">@{profil.username}</p>
          {profil.public_bio && <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-[var(--lg-text)]">{profil.public_bio}</p>}
          <p className="mt-4 flex items-center gap-2 rounded-full bg-[var(--lg-fill)] px-3 py-1.5 text-[13px] text-[var(--lg-text-2)]">
            <FlaskConical size={11} aria-hidden="true" /> {t('public_profile_badge')}
          </p>
          {!istEigenes && (
            <div className="mt-3 flex items-center gap-2">
              <button type="button" data-report-profile onClick={() => meldenOeffnen({ art: 'profil' })} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[13px] text-[var(--lg-text-3)] hover:text-[var(--lg-warn-text)]">
                <Flag size={12} aria-hidden="true" /> {t('report_profile_action')}
              </button>
              {user && (
                <button type="button" data-block-open onClick={() => setBlockt(true)} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[13px] text-[var(--lg-text-3)] hover:text-[var(--lg-bad-text)]">
                  <Ban size={12} aria-hidden="true" /> {t('block_action')}
                </button>
              )}
            </div>
          )}
        </header>

        <section aria-labelledby="public-reviews">
          <h2 id="public-reviews" className="mb-3 flex items-center gap-2 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--lg-text-3)]">
            <Star size={13} aria-hidden="true" /> {t('bewertungen_title')}
          </h2>
          <p data-review-disclaimer className="-mt-1 mb-3 px-1 text-[13px] text-[var(--lg-text-2)]">{t('review_disclaimer')}</p>
          {reviews.length === 0 ? (
            <p className="lg-surface lg-flat px-4 py-8 text-center text-[15px] text-[var(--lg-text-2)]">
              {t('public_profile_no_reviews')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {reviews.map(r => {
                const kriterien = [
                  r.wirkung ? `${t('review_effect')} ${r.wirkung}/5` : null,
                  r.vertraeglichkeit ? `${t('review_tolerability')} ${r.vertraeglichkeit}/5` : null,
                  r.wieder_nehmen ? `${t('review_again')} ${t(`review_again_${r.wieder_nehmen}`)}` : null,
                ].filter(Boolean)
                return (
                  <li key={r.id} data-public-review className="lg-surface lg-flat !rounded-[22px] px-4 py-3.5">
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
                      {!istEigenes && (
                        <button type="button" data-report-open onClick={() => meldenOeffnen({ art: 'erfahrung', review: r })} className="-mr-2 inline-flex min-h-11 items-center gap-1 px-2 text-[12px] text-[var(--lg-text-3)] hover:text-[var(--lg-warn-text)]">
                          <Flag size={11} aria-hidden="true" /> {t('report_action')}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <p className="mt-8 text-center text-[13px] text-[var(--lg-text-3)]">{t('public_profile_footer')}</p>
        <LegalLinks className="mt-3 pb-4" />
        {meldet && <ReportSheet
          titel={t(meldet.art === 'erfahrung' ? 'report_title' : 'report_profile_title')}
          betreff={meldet.art === 'erfahrung' ? meldet.review.substanz : `@${profil.username}`}
          busy={busy} onCancel={() => setMeldet(null)} onSend={(grund, details) => void melden(grund, details)} />}
        {blockt && <BlockSheet username={profil.username} busy={busy} onCancel={() => setBlockt(false)} onConfirm={() => void setzeBlock(true)} />}
      </div>
    </div>
  )
}
