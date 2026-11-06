/**
 * Titel unter dem Namen (Profil-Zusatz Titel, Spec 4): leise Marke in Mono und
 * Großbuchstaben, umrandet. Eigenes Profil: mit Pfeil (öffnet „Dein Titel“),
 * daneben der Sichtbarkeits-Chip und darunter der nächste Rang-Schritt.
 * Andere: Antippen zeigt kurz, was der Titel bedeutet. Kein Titel → nichts.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { badgeName } from '../lib/badges'
import type { BadgeId } from '../lib/badgeIds'
import { RANKS, isPersonalTitle, titleName, type ProfileTitle } from '../lib/titles'
import { rankLadder } from '../lib/titleChoices'

const MARKE = 'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[5px] font-mono text-[11px] font-medium uppercase leading-none tracking-[0.1em] text-[var(--lg-text-2)] shadow-[inset_0_0_0_1px_var(--lg-separator)]'

/** Die Marke selbst, ohne Verhalten (auch im Sheet „Dein Titel“). */
export function TitelMarke({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`${MARKE} ${className}`} data-title-mark>{name}</span>
}

/** Was der Titel bedeutet (Antippen bei anderen). */
function titelBedeutung(title: ProfileTitle, lang: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (title.kind === 'rank') {
    const days = RANKS.find(r => r.id === title.id)?.days ?? 1
    return t('titel_bedeutung_rang', { count: days })
  }
  const abzeichen = badgeName(title.id, lang)
  return t(isPersonalTitle(title.id) ? 'titel_bedeutung_persoenlich' : 'titel_bedeutung_abzeichen', { abzeichen })
}

/** Fremdes Profil und „Ansehen als“: Marke mit kurzer Erklärung beim Antippen. */
function TitelMitErklaerung({ title }: { title: ProfileTitle }) {
  const { t, i18n } = useTranslation()
  const lang = i18n?.resolvedLanguage ?? i18n?.language ?? 'de'
  const name = titleName(title.id, lang) ?? ''
  const [offen, setOffen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const id = `titel-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`

  useEffect(() => {
    if (!offen) return
    const weg = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOffen(false) }
    const taste = (event: KeyboardEvent) => { if (event.key === 'Escape') setOffen(false) }
    document.addEventListener('pointerdown', weg)
    document.addEventListener('keydown', taste)
    return () => { document.removeEventListener('pointerdown', weg); document.removeEventListener('keydown', taste) }
  }, [offen])

  return (
    <span ref={wrap} className="relative inline-flex max-w-full">
      <button
        type="button"
        className={`${MARKE} relative transition-transform duration-150 active:scale-[0.96] before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']`}
        aria-expanded={offen}
        aria-controls={id}
        aria-label={t('titel_chip_bedeutung', { name })}
        onClick={() => setOffen(o => !o)}
        data-title-chip={title.id}
        data-title-kind={title.kind}
      >
        {name}
      </button>
      <span
        id={id}
        role="note"
        hidden={!offen}
        className="absolute left-0 top-[calc(100%+6px)] z-20 w-[236px] max-w-[64vw] rounded-[14px] bg-[var(--lg-surface-2)] px-3 py-2.5 text-[12.5px] leading-snug text-[var(--lg-text-2)] shadow-[0_12px_30px_rgba(0,0,0,0.45),inset_0_0_0_1px_var(--lg-hair)]"
        data-title-meaning
      >
        <b className="font-semibold text-[var(--lg-text)]">{name}</b> · {titelBedeutung(title, lang, t)} {t('titel_fuer_immer')}
      </span>
    </span>
  )
}

/** Nächster Rang-Schritt in der eigenen Sicht (nur der nächste). */
export function RangHinweis({ entryDays }: { entryDays: number }) {
  const { t, i18n } = useTranslation()
  const lang = i18n?.resolvedLanguage ?? i18n?.language ?? 'de'
  const { current, next } = rankLadder(entryDays)
  const rang = (id: BadgeId) => titleName(id, lang) ?? ''
  let text: ReactNode
  if (!current) text = t('titel_rang_erster', { rang: rang('rank_1') })
  else if (!next) text = t('titel_rang_hoechster', { rang: rang(current) })
  else text = (
    <Trans
      i18nKey="titel_rang_noch"
      count={next.missing}
      values={{ rang: rang(next.id) }}
      components={{ b: <span className="font-semibold tabular-nums text-[var(--lg-accent-text)]" /> }}
    />
  )
  return (
    <p className="mt-2 flex items-center gap-2.5 px-2 text-[12.5px] leading-snug text-[var(--lg-text-3)]" data-rank-hint>
      {current && next && (
        <span className="h-1 w-[54px] shrink-0 overflow-hidden rounded-full bg-[var(--lg-fill)]" aria-hidden="true">
          <i className="block h-full origin-left rounded-full bg-[var(--lg-accent)]" style={{ transform: `scaleX(${next.frac.toFixed(3)})` }} />
        </span>
      )}
      <span className="min-w-0">{text}</span>
    </p>
  )
}

/**
 * Zeile unter dem Namen. `own`: Pfeil zum Sheet und Sichtbarkeits-Chip; ohne
 * Titel steht dort „noch kein Titel“ (nur in der eigenen Sicht).
 */
export function TitleChip({ title, own }: {
  title: ProfileTitle | null
  own?: { onOpen: () => void; visibilityChip: ReactNode }
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n?.resolvedLanguage ?? i18n?.language ?? 'de'
  if (!own) return title ? <span className="mt-1 flex" data-profile-title><TitelMitErklaerung title={title} /></span> : null
  const name = title ? titleName(title.id, lang) ?? '' : null
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1" data-profile-title>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={name ? t('titel_chip_label', { name }) : t('titel_chip_kein_label')}
        onClick={own.onOpen}
        className={`${MARKE} relative transition-transform duration-150 active:scale-[0.96] before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] ${name ? '' : '!text-[var(--lg-text-3)] !shadow-none outline-dashed outline-1 -outline-offset-1 outline-[var(--lg-separator)]'}`}
        data-title-chip={title?.id ?? 'none'}
        data-title-kind={title?.kind ?? 'none'}
      >
        {name ?? t('titel_noch_keiner')}
        <ChevronRight size={11} strokeWidth={2.4} className="-mr-0.5 opacity-80" aria-hidden="true" />
      </button>
      {own.visibilityChip}
    </span>
  )
}
