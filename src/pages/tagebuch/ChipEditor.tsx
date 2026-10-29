import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SymptomIcon } from './SymptomChip'
import { UNIT_MINUTES, WHEEL_MAX, fromMinutes, kindColor, toMinutes, unitLabel, type ChipDraft, type DurationMode } from './chips'
import { SheetGriff } from '../../components/ui/SheetGriff'

const ITEM = 34
const NUMS = Array.from({ length: WHEEL_MAX }, (_, i) => i + 1)

/** Eine Walze des Picker-Rads: wischen rastet ein, Pfeiltasten stellen um. */
function Wheel({ values, index, onIndex, label, valueText, disabled }: {
  values: string[]
  index: number
  onIndex: (index: number) => void
  label: string
  valueText: string
  disabled: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const settle = useRef<number | null>(null)
  const placed = useRef(false)
  // Der Timer liest den Wert, der beim Feuern gilt, nicht den beim Scrollen.
  const aktuell = useRef(index)
  useLayoutEffect(() => { aktuell.current = index }, [index])
  // Ziel einer Fahrt, die das Rad selbst ausgelöst hat. Solange es dorthin
  // gleitet, ist die Position kein neuer Wert: stockt das sanfte Scrollen
  // unterwegs (WebKit unter Last), las das Rad sonst die Zwischenstellung als
  // Wahl und sprang kurz zurück — „Fertig" speicherte dann den alten Wert.
  const fahrtZiel = useRef<number | null>(null)

  // Endet eine eigene Fahrt nicht am Ziel (abgebrochen, eingerastet), gilt
  // der Wert, nicht die Position: das Rad springt auf ihn.
  const fahrtAbschliessen = () => {
    const el = ref.current
    fahrtZiel.current = null
    if (el && Math.round(el.scrollTop / ITEM) !== aktuell.current) el.scrollTop = aktuell.current * ITEM
  }
  const warte = (ms: number, dann: () => void) => {
    if (settle.current) window.clearTimeout(settle.current)
    settle.current = window.setTimeout(dann, ms)
  }

  // Beim Öffnen sofort auf dem Wert; später (Tastatur, Antippen) sanft dorthin.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!placed.current) { el.scrollTop = index * ITEM; placed.current = true; return }
    // Laeuft noch eine Fahrt, muss die neue sie ersetzen — auch wenn die
    // Zwischenstellung zufaellig schon auf dem neuen Wert liegt.
    if (fahrtZiel.current != null || Math.round(el.scrollTop / ITEM) !== index) {
      fahrtZiel.current = index
      el.scrollTo({ top: index * ITEM, behavior: 'smooth' })
      warte(400, fahrtAbschliessen)
    }
  }, [index])
  useEffect(() => () => { if (settle.current) window.clearTimeout(settle.current) }, [])

  // Greift der Nutzer selbst ins Rad, zählt wieder seine Position.
  const nutzerGreift = () => { fahrtZiel.current = null }

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    if (fahrtZiel.current != null) {
      if (Math.abs(el.scrollTop - fahrtZiel.current * ITEM) < 1) {
        fahrtZiel.current = null
        if (settle.current) window.clearTimeout(settle.current)
      } else {
        warte(400, fahrtAbschliessen)
      }
      return
    }
    warte(80, () => {
      const next = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM)))
      if (next !== aktuell.current) onIndex(next)
    })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 }[event.key]
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : step ? index + step : null
    if (next == null) return
    event.preventDefault()
    onIndex(Math.max(0, Math.min(values.length - 1, next)))
  }

  return (
    <div ref={ref} onScroll={onScroll} onKeyDown={onKeyDown} tabIndex={0}
      onPointerDown={nutzerGreift} onWheel={nutzerGreift}
      role="spinbutton" aria-label={label} aria-valuemin={0} aria-valuemax={values.length - 1}
      aria-valuenow={index} aria-valuetext={valueText} aria-disabled={disabled}
      className="h-[170px] snap-y snap-mandatory overflow-y-auto overscroll-contain py-[68px] [scrollbar-width:none]
        rounded-[10px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--lg-accent)]"
      style={{ maskImage: 'linear-gradient(to bottom, transparent 0, #000 34%, #000 66%, transparent 100%)' }}>
      {values.map((value, i) => (
        <button key={value} type="button" tabIndex={-1} aria-hidden="true" onClick={() => onIndex(i)}
          className={`flex h-[34px] w-full snap-center items-center justify-center tabular-nums transition-colors ${
            i === index ? 'text-[21px] font-medium text-[var(--lg-text)]' : 'text-[19px] text-[rgba(235,240,255,.42)]'}`}>
          {value}
        </button>
      ))}
    </div>
  )
}

/**
 * Chip-Editor: Intensität 1–5 und Dauer (Picker-Rad, „hält noch an" oder
 * keine Angabe). Liegt als zweites Sheet über dem Formular; Fokus wandert
 * hinein, bleibt drin und kehrt beim Schließen zum Chip zurück.
 */
export function ChipEditor({ chip, label, isNew, onDone, onRemove, onClose }: {
  chip: ChipDraft
  label: string
  isNew: boolean
  onDone: (chip: ChipDraft) => void
  onRemove: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const start = chip.durationMinutes ? fromMinutes(chip.durationMinutes) : { num: 1, unit: 1 }
  const [severity, setSeverity] = useState<number | null>(isNew ? null : chip.severity)
  const [mode, setMode] = useState<DurationMode>(chip.ongoing ? 'ongoing' : chip.durationMinutes ? 'set' : 'none')
  const [num, setNum] = useState(start.num)
  const [unit, setUnit] = useState(start.unit)
  const [customLabel, setCustomLabel] = useState(chip.customLabel ?? '')
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)

  const isCustom = !chip.key
  const color = kindColor(chip.kind)
  const severityWords = [t('sehr_leicht'), t('leicht'), t('mittel'), t('stark'), t('sehr_stark')]
  const canFinish = severity != null && (!isCustom || customLabel.trim().length > 0)

  useEffect(() => {
    opener.current = document.activeElement
    const box = panel.current
    const target = isCustom ? box?.querySelector<HTMLElement>('input')
      : box?.querySelector<HTMLElement>('fieldset button[aria-pressed="true"]') ?? box?.querySelector<HTMLElement>('fieldset button')
    target?.focus()
    return () => { if (opener.current instanceof HTMLElement && document.contains(opener.current)) opener.current.focus() }
  }, [isCustom])

  const finish = () => {
    if (!canFinish) return
    onDone({
      ...chip,
      customLabel: isCustom ? customLabel.trim() : null,
      severity,
      ongoing: mode === 'ongoing',
      durationMinutes: mode === 'set' ? toMinutes(num, unit) : null,
    })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
    if (event.key !== 'Tab' || !panel.current) return
    const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]'))
      .filter(el => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.offsetParent !== null)
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  const durSummary = mode === 'set' ? `${num} ${unitLabel(unit, num, t)}` : mode === 'ongoing' ? t('tagebuch_haelt_an') : t('tagebuch_keine_angabe')
  const segment = (active: boolean, tint?: string) =>
    `relative min-h-[34px] rounded-full text-[14px] font-semibold transition-colors after:absolute after:inset-x-0 after:top-[calc(50%-22px)] after:bottom-[calc(50%-22px)] after:content-[''] ${
      active ? 'bg-[var(--lg-fill-selected)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'}` + (active && !tint ? ' text-[var(--lg-text)]' : '')

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center pt-[var(--tyd-popup-top)]" data-app-modal>
      <button type="button" tabIndex={-1} aria-label={t('close')} className="absolute inset-0 cursor-default bg-black/50" onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="chip-editor-title" onKeyDown={onKeyDown}
        className="lg-sheet lg-sheet-solid relative max-h-full w-full max-w-lg space-y-[18px] overflow-y-auto overscroll-contain px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] !bg-[#2c2c2e]">
        <SheetGriff className="!mb-1" onClose={onClose} />
        <div className="flex items-center gap-3.5">
          <span aria-hidden="true" className="flex size-[52px] shrink-0 items-center justify-center rounded-full"
            style={{ color, background: `color-mix(in srgb, ${color} 28%, transparent)` }}>
            <SymptomIcon iconKey={chip.key} size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-[.04em]" style={{ color }}>
              {t(chip.kind === 'effect' ? 'wirkung' : 'nebenwirkung')}
            </p>
            {isCustom ? (
              <input id="chip-editor-title" aria-label={t('tagebuch_chip_name')} placeholder={t('tagebuch_chip_name_placeholder')}
                value={customLabel} onChange={e => setCustomLabel(e.target.value)} maxLength={80}
                className="w-full border-0 border-b border-[var(--lg-separator)] bg-transparent py-1 text-[24px] font-bold text-[var(--lg-text)] outline-none" />
            ) : (
              <h2 id="chip-editor-title" className="truncate text-[24px] font-bold tracking-[-0.02em] text-[var(--lg-text)]">{label}</h2>
            )}
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 flex w-full justify-between text-[13px] text-[var(--lg-text-2)]">
            <span>{t('tagebuch_intensitaet')}</span>
            <span className="text-[var(--lg-text)]">{severity ? `${severity} · ${severityWords[severity - 1]}` : t('tagebuch_intensitaet_waehlen')}</span>
          </legend>
          <div className="grid grid-cols-5 gap-0.5 rounded-full bg-[var(--lg-fill)] p-0.5">
            {[1, 2, 3, 4, 5].map(level => (
              <button key={level} type="button" aria-pressed={severity === level} aria-label={`${level} – ${severityWords[level - 1]}`}
                onClick={() => setSeverity(level)} className={`${segment(severity === level, color)} !min-h-[38px] text-[16px]`}
                style={severity === level ? { color } : undefined}>
                {level}
              </button>
            ))}
          </div>
          <div aria-hidden="true" className="mt-1.5 flex justify-between px-1.5 text-[12px] text-[rgba(235,240,255,.62)]">
            <span>{t('sehr_leicht')}</span><span>{t('sehr_stark')}</span>
          </div>
        </fieldset>

        <div className="space-y-2.5">
          <div className="flex justify-between text-[13px] text-[var(--lg-text-2)]">
            <span id="chip-editor-dauer">{t('dauer')}</span><span className="text-[var(--lg-text)]">{durSummary}</span>
          </div>
          <div role="group" aria-labelledby="chip-editor-dauer" className="grid grid-cols-3 gap-0.5 rounded-full bg-[var(--lg-fill)] p-0.5">
            {([['set', t('dauer')], ['ongoing', t('tagebuch_haelt_an')], ['none', t('tagebuch_keine_angabe')]] as const).map(([value, text]) => (
              <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}
                className={`${segment(mode === value)} text-[13px]`}>{text}</button>
            ))}
          </div>
          <div className={`relative rounded-[14px] bg-[rgba(118,118,128,.12)] px-2 transition-opacity ${mode === 'set' ? '' : 'opacity-35'}`}>
            <div aria-hidden="true" className="absolute inset-x-2 top-[68px] h-[34px] rounded-[9px] bg-[rgba(118,118,128,.28)]" />
            <div className="relative grid grid-cols-2 gap-1">
              <Wheel values={NUMS.map(String)} index={num - 1} disabled={mode !== 'set'}
                label={t('tagebuch_dauer_zahl')} valueText={mode === 'set' ? String(num) : t('tagebuch_keine_angabe')}
                onIndex={i => { setNum(i + 1); setMode('set') }} />
              <Wheel values={UNIT_MINUTES.map((_, u) => unitLabel(u, num, t))} index={unit} disabled={mode !== 'set'}
                label={t('tagebuch_dauer_einheit')} valueText={mode === 'set' ? unitLabel(unit, num, t) : t('tagebuch_keine_angabe')}
                onIndex={u => { setUnit(u); setMode('set') }} />
            </div>
            {mode !== 'set' && (
              <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 cursor-pointer" onClick={() => setMode('set')} />
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" data-quiet className={`lg-gray-btn flex-1 !min-h-12 !text-[17px] ${isNew ? '' : '!text-[var(--lg-bad-text)]'}`}
            onClick={isNew ? onClose : onRemove}>
            {isNew ? t('cancel') : t('entfernen')}
          </button>
          <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" disabled={!canFinish} onClick={finish}>
            {t('tagebuch_fertig')}
          </button>
        </div>
      </div>
    </div>
  )
}
