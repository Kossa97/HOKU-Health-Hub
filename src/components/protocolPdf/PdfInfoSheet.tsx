import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGrid, ListChecks, Share, ShieldCheck, X } from 'lucide-react'
import { PRESETS } from '../../lib/protocolPdf/presets'
import { SECTIONS } from '../../lib/protocolPdf/sections'
import type { PdfLang } from '../../lib/protocolPdf/types'
import { useSheetClose } from '../../lib/useSheetClose'
import { SheetGriff } from '../ui/SheetGriff'

const T: Record<PdfLang, {
  title: string; close: string; intro: string
  steps: { title: string; text: string }[]
  matrixTitle: string; content: string; matrixHint: string; included: string; notIncluded: string
  presetsTitle: string; customLabel: string; customText: string
  anonTitle: string; anonText: string
}> = {
  de: {
    title: 'So funktioniert’s',
    close: 'Schließen',
    intro: 'Aus deinen Einträgen wird ein sauberes PDF — für den Arzttermin, deinen Coach oder zum anonymen Teilen.',
    steps: [
      { title: '1 · Muster', text: 'Für wen ist das PDF?' },
      { title: '2 · Anpassen', text: 'Zeitraum und Häkchen' },
      { title: '3 · Teilen', text: 'Vorschau prüfen, senden' },
    ],
    matrixTitle: 'Was steckt in welchem Muster?',
    content: 'Inhalt',
    matrixHint: 'Ausgefüllt = im Muster enthalten. Inhalte ohne Daten im Zeitraum fallen weg.',
    included: 'enthalten',
    notIncluded: 'nicht enthalten',
    presetsTitle: 'Die Muster',
    customLabel: 'Eigene',
    customText: 'Du setzt die Häkchen selbst. Änderst du ein Muster, wird daraus automatisch „Eigene“.',
    anonTitle: 'Anonym teilen:',
    anonText: 'Ohne „Persönliche Angaben“ stehen weder Name noch Alter im PDF. Das Forum-Muster lässt sie automatisch weg. Das PDF entsteht auf deinem Gerät.',
  },
  en: {
    title: 'How it works',
    close: 'Close',
    intro: 'Your entries become a clean PDF — for your doctor visit, your coach or to share anonymously.',
    steps: [
      { title: '1 · Template', text: 'Who is the PDF for?' },
      { title: '2 · Adjust', text: 'Period and ticks' },
      { title: '3 · Share', text: 'Check preview, send' },
    ],
    matrixTitle: 'What’s in each template?',
    content: 'Content',
    matrixHint: 'Filled = part of the template. Sections without data in the period are left out.',
    included: 'included',
    notIncluded: 'not included',
    presetsTitle: 'The templates',
    customLabel: 'Custom',
    customText: 'You tick the boxes yourself. Change a template and it becomes “Custom” automatically.',
    anonTitle: 'Share anonymously:',
    anonText: 'Without “Personal details” the PDF contains neither name nor age. The Forum template leaves them out automatically. The PDF is created on your device.',
  },
}

const STEP_ICONS = [LayoutGrid, ListChecks, Share]

interface Props {
  lang: PdfLang
  onClose: () => void
}

/** Das „i" neben der Überschrift: Ablauf, Muster-Übersicht, Anonymität. */
export function PdfInfoSheet({ lang, onClose }: Props) {
  const t = T[lang]
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const { requestClose, closingProps } = useSheetClose(onClose)

  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus({ preventScroll: true })
    return () => { if (opener instanceof HTMLElement) opener.focus({ preventScroll: true }) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t.close}
        onClick={requestClose}
        {...closingProps}
        className="tyd-backdrop fixed inset-0 z-[70] cursor-pointer bg-black/55"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...closingProps}
        className="lg-sheet lg-sheet-solid tyd-sheet fixed inset-x-0 bottom-0 z-[71] mx-auto flex max-h-[calc(100dvh-var(--tyd-popup-top))] max-w-[560px] flex-col !rounded-b-none"
      >
        <SheetGriff className="mt-2 shrink-0" onClose={requestClose} />
        <div className="flex shrink-0 items-center justify-between pl-5 pr-2 pt-1">
          <h2 id={titleId} className="text-[20px] font-medium tracking-[-0.01em] text-[var(--lg-text)]">{t.title}</h2>
          <button ref={closeRef} type="button" data-app-back-close onClick={requestClose} aria-label={t.close} className="lg-icon-btn !text-[var(--lg-text-2)]">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--lg-fill)]"><X size={17} /></span>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-1">
          <p className="text-[15px] leading-[1.45] text-[var(--lg-text-2)]">{t.intro}</p>

          {/* Ablauf als kleine Grafik: drei Stationen auf einer Linie */}
          <ol className="relative grid grid-cols-3 gap-1.5">
            <span aria-hidden="true" className="absolute left-[16%] right-[16%] top-[25px] h-px bg-[var(--border)]" />
            {t.steps.map((step, i) => {
              const Icon = STEP_ICONS[i]
              return (
                <li key={step.title} className="relative flex flex-col items-center gap-2 text-center">
                  <span
                    aria-hidden="true"
                    className={`grid h-[52px] w-[52px] place-items-center rounded-full ${
                      i === 0
                        ? 'bg-[var(--lg-accent)] text-[var(--accent-contrast)]'
                        : 'bg-[var(--lg-surface-fill,var(--surface))] text-[var(--lg-text-2)] shadow-[inset_0_0_0_1px_var(--border)]'
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                  </span>
                  <span className="text-[13px] font-medium text-[var(--lg-text)]">{step.title}</span>
                  <span className="text-[12px] leading-[1.35] text-[var(--lg-text-2)]">{step.text}</span>
                </li>
              )
            })}
          </ol>

          <div>
            <h3 className="mb-3 text-[15px] font-semibold text-[var(--lg-text)]">{t.matrixTitle}</h3>
            <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--lg-fill)_60%,transparent)] text-left">
              <thead>
                <tr className="text-[12px] font-semibold text-[var(--lg-text-2)]">
                  <th scope="col" className="px-4 py-2 font-semibold">{t.content}</th>
                  {PRESETS.map(p => (
                    <th key={p.id} scope="col" className="w-12 py-2 text-center font-semibold">{p.label[lang]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map(s => (
                  <tr key={s.id}>
                    <th scope="row" lang={lang} className={`border-t border-white/[0.06] px-4 py-2 text-[13px] font-normal leading-tight text-[var(--lg-text)] ${lang === 'de' ? 'hyphens-auto' : ''}`}>
                      {s.label[lang]}
                    </th>
                    {PRESETS.map(p => {
                      const on = p.sections.includes(s.id)
                      return (
                        <td key={p.id} className="border-t border-white/[0.06] text-center">
                          <span
                            role="img"
                            aria-label={on ? t.included : t.notIncluded}
                            className={`mx-auto block h-3 w-3 rounded-full ${on ? 'bg-[var(--lg-accent)]' : 'shadow-[inset_0_0_0_1.5px_rgba(235,240,255,0.3)]'}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 px-1 text-[12px] text-[var(--lg-text-3)]">{t.matrixHint}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-[15px] font-semibold text-[var(--lg-text)]">{t.presetsTitle}</h3>
            {[
              ...PRESETS.map(p => ({ id: p.id, label: p.label[lang], text: p.description[lang] })),
              { id: 'custom', label: t.customLabel, text: t.customText },
            ].map(p => (
              <div key={p.id} className="flex items-start gap-3">
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--lg-fill)] text-[13px] font-medium text-[var(--lg-text-2)]">
                  {p.label.charAt(0)}
                </span>
                <div>
                  <div className="text-[15px] font-medium text-[var(--lg-text)]">{p.label}</div>
                  <div className="text-[13px] leading-[1.4] text-[var(--lg-text-2)]">{p.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] p-4 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent)]">
            <ShieldCheck size={22} className="shrink-0 text-[var(--lg-accent-text)]" aria-hidden="true" />
            <p className="text-[13px] leading-[1.45] text-[var(--lg-text-2)]">
              <strong className="font-semibold text-[var(--lg-text)]">{t.anonTitle}</strong> {t.anonText}
            </p>
          </div>
        </div>
      </section>
    </>,
    document.body,
  )
}
