import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Globe, Pencil, Plus, RefreshCw, Search, Star, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { CycleTimeline } from '../lib/planTimeline'
import { loadCycleTimelines } from '../features/my-stack/services/planLifecycle'
import type { Translate } from '../features/my-stack/lib/planLabels'
import { useMinuteClock } from '../features/my-stack/lib/useMinuteClock'
import { useWischZeile } from '../features/my-stack/page/useWischZeile'
import { ReviewSheet, type ReviewSubstanz } from '../features/reviews/components/ReviewSheet'
import { ReviewDeleteSheet } from '../features/reviews/components/ReviewDeleteSheet'
import {
  entwurfAus,
  gruppiereBewertungen,
  leererEntwurf,
  passtZurSuche,
  unbewerteteZyklen,
  vorgeschlagenerZyklus,
  zyklusKurz,
  zyklusZumDatum,
  type Reihenfolge,
  type Review,
  type ReviewDraft,
} from '../features/reviews/lib/reviewModel'
import { ladeBewertungen, loescheBewertung, speichereBewertung } from '../features/reviews/services/reviews'
import { filterFehlerSchluessel } from '../features/compliance/lib/moderation'

/**
 * Bewertungen: je Substanz eine Gruppe, darin je Zyklus eine Karte — so
 * stehen mehrere Zyklen derselben Substanz nebeneinander. Antippen
 * bearbeitet, nach links wischen zeigt Bearbeiten und Loeschen (wie in My
 * Stack); Loeschen fragt in einem eigenen Sheet nach.
 */
export function Bewertungen() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const tr = t as Translate
  const language = i18n.resolvedLanguage ?? i18n.language
  const now = useMinuteClock()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  const [reviews, setReviews] = useState<Review[]>([])
  const [ladeZustand, setLadeZustand] = useState<'laedt' | 'fertig' | 'fehler'>('laedt')
  const [stackItems, setStackItems] = useState<ReviewSubstanz[]>([])
  const [timelines, setTimelines] = useState<CycleTimeline[]>([])
  const [suche, setSuche] = useState('')
  const [reihenfolge, setReihenfolge] = useState<Reihenfolge>('neueste')
  // Offenes Sheet: neu (id null) oder eine bestehende Bewertung.
  const [sheet, setSheet] = useState<{ id: string | null; start: ReviewDraft } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loeschen, setLoeschen] = useState<Review | null>(null)
  const [loescht, setLoescht] = useState(false)
  const [offeneZeile, setOffeneZeile] = useState<string | null>(null)
  const [kontextGeladen, setKontextGeladen] = useState(false)
  // Aus „Plan beenden" kommend: ?bewerten=<Substanz>&zyklus=<Zyklus>.
  const [parameter, setParameter] = useSearchParams()

  const load = async () => {
    try {
      setReviews(await ladeBewertungen(supabase, user!.id))
      setLadeZustand('fertig')
    } catch {
      setLadeZustand('fehler')
    }
  }

  const loadKontext = async () => {
    const [items, zyklen] = await Promise.allSettled([
      supabase.from('stack_items').select('id, display_name, archived').eq('user_id', user!.id).order('display_name'),
      loadCycleTimelines(supabase as never, user!.id, { includeUnavailable: true }),
    ])
    if (items.status === 'fulfilled' && items.value.data) setStackItems(items.value.data as ReviewSubstanz[])
    if (zyklen.status === 'fulfilled') setTimelines(zyklen.value)
    setKontextGeladen(true)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); void loadKontext() }, [])

  // Ein Tipp ausserhalb der offenen Zeile schliesst sie wieder.
  useEffect(() => {
    if (!offeneZeile) return
    const schliessen = (event: PointerEvent) => {
      const ziel = event.target as Element | null
      if (ziel?.closest?.(`[data-review-row="${CSS.escape(offeneZeile)}"]`)) return
      setOffeneZeile(null)
    }
    document.addEventListener('pointerdown', schliessen)
    return () => document.removeEventListener('pointerdown', schliessen)
  }, [offeneZeile])

  const zyklusVon = useMemo(() => new Map(timelines.map(timeline => [timeline.cycle.id, timeline])), [timelines])
  /** Zyklen mit Bewertung — ohne die gerade bearbeitete. */
  const bewertet = useMemo(() => new Set(
    reviews.filter(r => r.cycle_id && r.id !== sheet?.id).map(r => r.cycle_id!),
  ), [reviews, sheet?.id])
  const gruppen = useMemo(
    () => gruppiereBewertungen(reviews.filter(r => passtZurSuche(r, suche)), timelines, reihenfolge),
    [reviews, suche, timelines, reihenfolge],
  )

  const openNew = () => {
    const erste = stackItems.find(item => !item.archived)
    if (!erste) return toast.error(t('zuerst_peptid'))
    const belegt = new Set(reviews.filter(r => r.cycle_id).map(r => r.cycle_id!))
    setSheet({ id: null, start: leererEntwurf(erste.id, vorgeschlagenerZyklus(timelines, erste.id, belegt, now)) })
  }

  const openEdit = (r: Review) => {
    setOffeneZeile(null)
    const start = entwurfAus(r)
    // Alte Bewertung ohne Zyklus: den passenden vorschlagen (nach Datum).
    if (!start.cycle_id) {
      const vorschlag = zyklusZumDatum(timelines, r.stack_item_id, r.created_at, timeZone)
      const belegt = reviews.some(other => other.id !== r.id && other.cycle_id === vorschlag)
      if (vorschlag && !belegt) start.cycle_id = vorschlag
    }
    setSheet({ id: r.id, start })
  }

  const aktiveSubstanzen = useMemo(() => new Set(stackItems.filter(item => !item.archived).map(item => item.id)), [stackItems])
  const offen = useMemo(() => unbewerteteZyklen(timelines, reviews, aktiveSubstanzen, now), [timelines, reviews, aktiveSubstanzen, now])

  /** Einen bestimmten Zyklus bewerten — oder, ist er schon bewertet, die Bewertung oeffnen. */
  const bewerteZyklus = (stackItemId: string, cycleId: string | null) => {
    const vorhanden = cycleId ? reviews.find(r => r.cycle_id === cycleId) : undefined
    if (vorhanden) return openEdit(vorhanden)
    const passt = cycleId && timelines.some(z => z.cycle.id === cycleId && z.cycle.stack_item_id === stackItemId)
    setSheet({ id: null, start: leererEntwurf(stackItemId, passt ? cycleId : null) })
  }

  useEffect(() => {
    const stackItemId = parameter.get('bewerten')
    if (!stackItemId || ladeZustand !== 'fertig' || !kontextGeladen) return
    if (stackItems.some(item => item.id === stackItemId)) bewerteZyklus(stackItemId, parameter.get('zyklus'))
    // Nur einmal: Zurueck oder Neuladen oeffnet das Sheet nicht erneut.
    setParameter({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameter, ladeZustand, kontextGeladen])

  const save = async (draft: ReviewDraft) => {
    if (!sheet) return
    setSaving(true)
    try {
      await speichereBewertung(supabase, draft, user!.id, reviews.find(r => r.id === sheet.id) ?? null)
      toast.success(sheet.id ? t('bewertung_aktualisiert') : t('bewertung_gespeichert'))
      setSheet(null)
      await load()
    } catch (fehler) {
      // Der Filter fuer oeffentliche Texte sagt, was nicht geht — das Sheet
      // bleibt offen, damit man es aendern oder privat lassen kann.
      const schluessel = filterFehlerSchluessel(fehler instanceof Error ? fehler.message : null)
      toast.error(schluessel ? t(schluessel) : t('error'), { duration: schluessel ? 6000 : undefined })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r: Review) => {
    setLoescht(true)
    try {
      await loescheBewertung(supabase, r.id)
      toast.success(t('deleted'))
      setLoeschen(null)
      await load()
    } catch {
      toast.error(t('error'))
    } finally {
      setLoescht(false)
    }
  }

  const zyklusText = (r: Review) => {
    const timeline = r.cycle_id ? zyklusVon.get(r.cycle_id) : undefined
    return timeline ? zyklusKurz(timeline, now, timeZone, language, tr) : String(t('review_cycle_none'))
  }

  return (
    <div className="pb-14">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="lg-large-title min-w-0 truncate">{t('bewertungen_title')}</h1>
        {/* Schmale Geräte: nur das Plus, damit der Titel ganz bleibt */}
        <button className="lg-btn lg-btn-tint lg-btn-compact shrink-0 max-[379px]:!w-11 max-[379px]:!px-0" onClick={openNew}>
          <Plus size={18} aria-hidden="true" /> <span className="max-[379px]:sr-only">{t('new')}</span>
        </button>
      </div>
      {/* Persoenliche Notizen, keine Produktbewertung: das steht da, damit
          niemand Sterne als Empfehlung einer Substanz liest. */}
      <p data-review-disclaimer className="mb-5 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('review_disclaimer')}</p>

      {ladeZustand === 'fehler' && (
        <div role="alert" data-tone="bad" className="lg-surface lg-flat mb-4 flex items-center justify-between gap-3 py-2 pl-4 pr-2">
          <p className="text-[15px] text-[var(--lg-bad-text)]">{t('review_load_error')}</p>
          <button type="button" onClick={() => { setLadeZustand('laedt'); void load() }} className="flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-[15px] font-semibold text-[var(--lg-accent-text)]">
            <RefreshCw size={14} aria-hidden="true" /> {t('review_retry')}
          </button>
        </div>
      )}

      {/* Erst ab vier Bewertungen — aber nie verschwinden, solange eine Suche
          filtert: sonst bliebe der Filter unsichtbar aktiv. */}
      {offen.length > 0 && ladeZustand === 'fertig' && (
        <div data-review-unrated className="lg-surface lg-flat mb-4 flex items-center justify-between gap-3 py-2.5 pl-4 pr-2.5">
          <p className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold text-[var(--lg-text)]">
            <Star size={16} aria-hidden="true" className="shrink-0 text-amber-400" fill="currentColor" />
            {offen.length === 1 ? t('review_unrated_one') : t('review_unrated_many', { n: offen.length })}
          </p>
          <button
            type="button"
            onClick={() => bewerteZyklus(offen[0].cycle.stack_item_id, offen[0].cycle.id)}
            className="lg-gray-btn shrink-0 !min-h-9 !px-3.5 !text-[14px]"
          >
            {t('review_unrated_action')}
          </button>
        </div>
      )}

      {(reviews.length > 3 || suche !== '') && (
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lg-text-3)]" />
            <input
              className="min-h-11 w-full rounded-full border-0 bg-[var(--lg-fill)] py-2.5 pl-10 pr-4 text-[16px] text-[var(--lg-text)] outline-none placeholder:text-[var(--lg-text-3)] focus-visible:ring-2 focus-visible:ring-[var(--lg-accent)]"
              aria-label={String(t('bewertung_suchen'))}
              placeholder={String(t('bewertung_suchen'))}
              value={suche}
              onChange={e => setSuche(e.target.value)}
            />
          </div>
          <select
            className="min-h-11 w-auto shrink-0 cursor-pointer rounded-full border-0 bg-[var(--lg-fill)] pl-4 pr-8 text-[15px] text-[var(--lg-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lg-accent)]"
            aria-label={String(t('review_order'))}
            value={reihenfolge}
            onChange={e => setReihenfolge(e.target.value as Reihenfolge)}
          >
            <option value="neueste">{t('neueste')}</option>
            <option value="beste">{t('review_order_best')}</option>
          </select>
        </div>
      )}

      {ladeZustand === 'fertig' && reviews.length === 0 && (
        <div className="lg-surface lg-flat px-5 py-10 text-center">
          <Star size={32} aria-hidden="true" className="mx-auto mb-3 text-[var(--lg-text-3)]" />
          <p className="text-[17px] font-semibold text-[var(--lg-text)]">{t('noch_keine_bewertungen')}</p>
          <p className="mx-auto mt-1 max-w-xs text-[15px] text-[var(--lg-text-2)]">{t('review_empty_hint')}</p>
        </div>
      )}

      {suche && gruppen.length === 0 && reviews.length > 0 && (
        <p className="lg-surface lg-flat px-4 py-8 text-center text-[15px] text-[var(--lg-text-2)]">
          {t('nichts_gefunden', { search: suche })}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {gruppen.map(gruppe => (
          <section key={gruppe.stackItemId} data-review-group={gruppe.stackItemId} aria-labelledby={`review-group-${gruppe.stackItemId}`}>
            <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
              <h2 id={`review-group-${gruppe.stackItemId}`} className="lg-title2 min-w-0 truncate">
                {gruppe.name}
                {gruppe.archiviert && <span className="ml-2 text-[13px] font-medium text-[var(--lg-text-3)]">{t('review_archived')}</span>}
              </h2>
              <p className="flex shrink-0 items-center gap-1 text-[13px] font-semibold tabular-nums text-[var(--lg-text-2)]">
                <Star size={12} aria-hidden="true" className="text-amber-400" fill="currentColor" />
                {gruppe.schnitt.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span className="font-medium text-[var(--lg-text-3)]">
                  · {gruppe.bewertungen.length === 1 ? t('review_count_one') : t('review_count_many', { n: gruppe.bewertungen.length })}
                </span>
              </p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {gruppe.bewertungen.map(r => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  zyklus={zyklusText(r)}
                  datum={new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(r.created_at))}
                  offen={offeneZeile === r.id}
                  onOffen={offen => setOffeneZeile(offen ? r.id : null)}
                  onEdit={() => openEdit(r)}
                  onRemove={() => { setOffeneZeile(null); setLoeschen(r) }}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {sheet && (
        <ReviewSheet
          key={sheet.id ?? 'neu'}
          titel={String(sheet.id ? t('bewertung_bearbeiten') : t('neue_bewertung'))}
          start={sheet.start}
          substanzen={stackItems}
          timelines={timelines}
          bewertet={bewertet}
          now={now}
          timeZone={timeZone}
          busy={saving}
          onClose={() => setSheet(null)}
          onSave={save}
        />
      )}

      {loeschen && (
        <ReviewDeleteSheet
          name={loeschen.stack_items?.display_name ?? ''}
          zyklus={zyklusText(loeschen)}
          busy={loescht}
          onCancel={() => setLoeschen(null)}
          onConfirm={() => void remove(loeschen)}
        />
      )}
    </div>
  )
}

/** Symbol und Text der Wischaktionen kommen mit dem Wischen (wie in My Stack). */
const AKTION_SYMBOL: CSSProperties = {
  opacity: 'var(--wisch-fortschritt, 0)',
  transform: 'scale(calc(0.6 + 0.4 * var(--wisch-fortschritt, 0)))',
}
const AKTION_TEXT: CSSProperties = {
  opacity: 'clamp(0, calc((var(--wisch-fortschritt, 0) - 0.8) * 5), 1)',
}

function ReviewRow({ review: r, zyklus, datum, offen, onOffen, onEdit, onRemove }: {
  review: Review
  zyklus: string
  datum: string
  offen: boolean
  onOffen: (offen: boolean) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const { zeileRef, vorneRef, aktionenRef, klickVerschlucken } = useWischZeile({ offen, onOffen, onVoll: onRemove })
  const kriterien = [
    r.wirkung ? `${t('review_effect')} ${r.wirkung}/5` : null,
    r.vertraeglichkeit ? `${t('review_tolerability')} ${r.vertraeglichkeit}/5` : null,
    r.wieder_nehmen ? `${t('review_again')} ${t(`review_again_${r.wieder_nehmen}`)}` : null,
  ].filter(Boolean)

  return (
    <li
      ref={zeileRef}
      data-review-row={r.id}
      data-list-open={offen || undefined}
      className="lg-surface lg-flat touch-pan-y select-none overflow-hidden !rounded-[22px]"
    >
      <div
        ref={aktionenRef}
        aria-hidden={!offen || undefined}
        className="group/aktionen invisible absolute inset-y-0 right-0 flex w-0 overflow-hidden"
      >
        <button
          type="button"
          tabIndex={offen ? 0 : -1}
          onClick={() => { if (!klickVerschlucken()) onEdit() }}
          aria-label={String(t('bearbeiten'))}
          className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 overflow-hidden whitespace-nowrap bg-[#0a84ff] text-[11px] font-semibold text-white transition-[flex-grow] duration-300 ease-out group-data-[voll]/aktionen:grow-0"
        >
          <Pencil size={17} aria-hidden="true" style={AKTION_SYMBOL} />
          <span style={AKTION_TEXT}>{t('bearbeiten')}</span>
        </button>
        <button
          type="button"
          tabIndex={offen ? 0 : -1}
          onClick={() => { if (!klickVerschlucken()) onRemove() }}
          aria-label={String(t('loeschen'))}
          className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 overflow-hidden whitespace-nowrap bg-[var(--lg-bad)] text-[11px] font-semibold text-white group-data-[voll]/aktionen:items-start group-data-[voll]/aktionen:pl-7"
        >
          <Trash2 size={17} aria-hidden="true" style={AKTION_SYMBOL} />
          <span style={AKTION_TEXT}>{t('loeschen')}</span>
        </button>
      </div>

      <button
        ref={vorneRef}
        type="button"
        aria-label={String(t('review_open', { name: r.stack_items?.display_name ?? '', cycle: zyklus }))}
        onClick={() => {
          if (klickVerschlucken()) return
          if (offen) { onOffen(false); return }
          onEdit()
        }}
        className="relative block w-full touch-pan-y select-none px-4 py-3.5 text-left [-webkit-touch-callout:none] active:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lg-accent)]"
      >
        <span className="flex items-center justify-between gap-3">
          <span data-review-cycle className="min-w-0 truncate text-[13px] font-semibold text-[var(--lg-text-2)]">{zyklus}</span>
          <span className="flex shrink-0 items-center gap-2">
            {r.hidden_by_moderation
              ? <span data-review-hidden className="lg-tag !min-h-[22px] !px-2 !text-[11px]" data-tone="warn">{t('review_hidden_by_moderation')}</span>
              : r.is_public && <Globe size={13} className="text-[var(--lg-text-3)]" aria-label={String(t('review_public'))} />}
            <Sterne wert={r.rating} />
          </span>
        </span>
        {r.title && <span className="mt-1 block text-[17px] font-semibold text-[var(--lg-text)]">{r.title}</span>}
        {kriterien.length > 0 && (
          <span data-review-criteria className="mt-1 block text-[13px] text-[var(--lg-text-2)]">{kriterien.join(' · ')}</span>
        )}
        {r.body && <span className="mt-1.5 line-clamp-2 block text-[15px] leading-snug text-[var(--lg-text)]">{r.body}</span>}
        {(r.pros || r.cons) && (
          <span className="mt-2 flex flex-col gap-1 text-[13px]">
            {r.pros && <span className="line-clamp-1"><span className="font-semibold text-[var(--lg-good-text)]">+ </span><span className="text-[var(--lg-text-2)]">{r.pros}</span></span>}
            {r.cons && <span className="line-clamp-1"><span className="font-semibold text-[var(--lg-bad-text)]">− </span><span className="text-[var(--lg-text-2)]">{r.cons}</span></span>}
          </span>
        )}
        <span className="mt-2 block text-[12px] text-[var(--lg-text-3)]">{datum}</span>
      </button>
    </li>
  )
}

function Sterne({ wert }: { wert: number }) {
  const { t } = useTranslation()
  return (
    <span className="flex gap-0.5" role="img" aria-label={String(t(wert === 1 ? 'review_star_one' : 'review_star_many', { n: wert }))}>
      {[1, 2, 3, 4, 5].map(stern => (
        <Star
          key={stern}
          size={13}
          aria-hidden="true"
          className={stern <= wert ? 'text-amber-400' : 'text-[var(--lg-text-3)]'}
          fill={stern <= wert ? 'currentColor' : 'transparent'}
        />
      ))}
    </span>
  )
}
