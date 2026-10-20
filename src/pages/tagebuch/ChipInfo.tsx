import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../features/compliance/components/Sheet'
import { SymptomChip } from './SymptomChip'
import { labelIn, symptomByKey } from './chips'

/** Teile des Beispiel-Chips, von links nach rechts — Buchstaben wie in der Legende. */
const PARTS = [['A', 'art'], ['B', 'name'], ['C', 'dauer'], ['D', 'intensitaet']] as const

/**
 * Markierungen unter dem Beispiel-Chip: je Teil ein Buchstabe mit kurzem Strich,
 * gemessen an der Mitte des Teils (der Chip ist vergrößert, die Breite hängt an Sprache und Schrift).
 */
function useMarkers(figure: React.RefObject<HTMLElement | null>) {
  const [marks, setMarks] = useState<{ letter: string; x: number; top: number }[]>([])
  useLayoutEffect(() => {
    const box = figure.current
    if (!box) return
    const measure = () => {
      const origin = box.getBoundingClientRect()
      setMarks(PARTS.flatMap(([letter, part]) => {
        const el = box.querySelector<HTMLElement>(`[data-part="${part}"]`)
        if (!el) return []
        const r = el.getBoundingClientRect()
        const chip = el.closest<HTMLElement>('[data-tagebuch-chip]')!.getBoundingClientRect()
        return [{ letter, x: r.left + r.width / 2 - origin.left, top: chip.bottom - origin.top }]
      }))
    }
    measure()
    void document.fonts?.ready.then(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [figure])
  return marks
}

/** „So ist ein Chip aufgebaut" — Beispiel-Chip mit markierten Teilen und Legende. */
export function ChipInfo({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const label = (key: string) => labelIn(symptomByKey(key)!.label, lang)
  // Fokus auf „Verstanden", ohne das Blatt dorthin zu scrollen — der Titel bleibt sichtbar.
  const done = useRef<HTMLButtonElement>(null)
  useEffect(() => { done.current?.focus({ preventScroll: true }) }, [])
  const figure = useRef<HTMLElement>(null)
  const marks = useMarkers(figure)
  const rows = [
    ['A', t('tagebuch_info_art'), t('tagebuch_info_art_text')],
    ['B', t('tagebuch_chip_name'), t('tagebuch_info_name_text')],
    ['C', t('dauer'), t('tagebuch_info_dauer_text')],
    ['D', t('tagebuch_intensitaet'), t('tagebuch_info_intensitaet_text')],
  ] as const
  return (
    <Sheet labelledBy="tagebuch-info-title" onClose={onClose} tall data-tagebuch-info>
      <h2 id="tagebuch-info-title" className="lg-title2">{t('tagebuch_info_titel')}</h2>
      <figure ref={figure} className="relative mt-4 flex flex-col items-center rounded-2xl bg-[rgba(118,118,128,.12)] px-4 pt-7 pb-14">
        <div className="origin-center scale-[1.12] min-[380px]:scale-[1.3]">
          <SymptomChip kind="side_effect" label={label('nausea')} iconKey="nausea" selected severity={3} duration={`2 ${t('tagebuch_einheit_std', { count: 2 })}`} />
        </div>
        {marks.map(mark => (
          <span key={mark.letter} aria-hidden="true" className="absolute flex w-5 -translate-x-1/2 flex-col items-center" style={{ left: mark.x, top: mark.top + 4 }}>
            <span className="h-3 w-px bg-[var(--lg-accent-text)] opacity-70" />
            <span className="size-5 rounded-full text-center text-[11px] font-bold leading-5 text-[var(--lg-accent-text)] shadow-[inset_0_0_0_1.5px_var(--lg-accent-text)]">{mark.letter}</span>
          </span>
        ))}
        <figcaption className="sr-only">{t('tagebuch_info_beispiel')}</figcaption>
      </figure>
      <dl className="mt-4 grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 gap-y-3 text-[15px] leading-snug">
        {rows.map(([letter, name, text]) => (
          <div key={letter} className="contents">
            <dt className="size-5 rounded-full text-center text-[11px] font-bold leading-5 text-[var(--lg-accent-text)] shadow-[inset_0_0_0_1.5px_var(--lg-accent-text)]">{letter}</dt>
            <dd><strong className="font-semibold">{name}</strong> <span className="text-[var(--lg-text-2)]">– {text}</span></dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13px] text-[var(--lg-text-2)]">{t('tagebuch_info_hinweis')}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <SymptomChip kind="effect" label={label('more_energy')} iconKey="more_energy" selected severity={4} small />
        <SymptomChip kind="side_effect" label={label('swelling')} iconKey="swelling" selected severity={2} duration={t('tagebuch_haelt_an_kurz')} small />
        <SymptomChip kind="side_effect" label={label('headache')} iconKey="headache" selected={false} small />
      </div>
      <button ref={done} type="button" data-app-back-close className="lg-btn lg-btn-primary mt-5 w-full" onClick={onClose}>
        {t('tagebuch_info_verstanden')}
      </button>
    </Sheet>
  )
}
