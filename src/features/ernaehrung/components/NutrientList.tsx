import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NUTRIENT_GROUPS, type NutrientGroup, type NutrientId, type NutrientStatus, formatAmount, gapsOf, inFrame } from '../lib/nutrientTargets'
import { MUTED } from '../styles'

/**
 * Nährstoffe des Tages in „Dein Tag → Heute“: Lücken zuerst, darunter die Gruppen
 * (zugeklappt, damit das Blatt kurz bleibt). Eine Zeile antippen öffnet den Wert.
 */
export function NutrientList({ list, dayDone, onOpen }: {
  list: readonly NutrientStatus[]
  /** Tag weit genug für Lücken (vergangener Tag oder 70 % des Ziels gegessen). */
  dayDone: boolean
  onOpen: (id: NutrientId) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Partial<Record<NutrientGroup, boolean>>>({})
  const gaps = gapsOf(list)
  const known = list.filter(s => s.known > 0)

  return (
    <section aria-labelledby="nutr-nut-title" className="space-y-2">
      <div className="px-1 pt-2">
        <h3 id="nutr-nut-title" className="text-[17px] font-bold text-[var(--lg-text)]">{t('nutr_nut_title')}</h3>
        <p className={`mt-0.5 text-[13px] ${MUTED}`}>
          {known.length
            ? t('nutr_nut_summary', { count: list.length, ok: list.filter(inFrame).length })
            : t('nutr_nut_none')}
        </p>
      </div>

      {!dayDone && known.length > 0 && (
        <p className={`rounded-[14px] bg-[var(--lg-surface-2)] px-4 py-3 text-[13px] leading-snug ${MUTED}`}>{t('nutr_nut_wait')}</p>
      )}

      {gaps.length > 0 && (
        <div>
          <h4 className="px-1 pb-1 text-[13px] font-semibold text-[var(--lg-warn-text)]">{t('nutr_nut_gaps', { count: gaps.length })}</h4>
          <ul className="rounded-[18px] bg-[var(--lg-surface-2)] px-4">
            {gaps.map(s => <NutrientRow key={s.def.id} s={s} onOpen={onOpen} />)}
          </ul>
        </div>
      )}

      {NUTRIENT_GROUPS.map(g => {
        const items = list.filter(s => s.def.group === g)
        const isOpen = !!open[g]
        return (
          <div key={g}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(o => ({ ...o, [g]: !o[g] }))}
              className="flex min-h-11 w-full items-center justify-between gap-2 px-1 text-left">
              <span className="text-[13px] font-semibold text-[var(--lg-text-2)]">{t(`nutr_nut_group_${g}`)}</span>
              <span className={`flex items-center gap-1.5 text-[12px] ${MUTED}`}>
                {t('nutr_nut_group_ok', { ok: items.filter(inFrame).length, count: items.length })}
                <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
              </span>
            </button>
            {isOpen && (
              <ul className="rounded-[18px] bg-[var(--lg-surface-2)] px-4">
                {items.map(s => <NutrientRow key={s.def.id} s={s} onOpen={onOpen} />)}
              </ul>
            )}
          </div>
        )
      })}
      <p className={`px-1 pt-1 text-[11px] leading-relaxed ${MUTED}`}>{t('nutr_nut_source')}</p>
    </section>
  )
}

export function NutrientRow({ s, onOpen }: { s: NutrientStatus; onOpen: (id: NutrientId) => void }) {
  const { t, i18n } = useTranslation()
  const note = s.lowData && s.entries > 0
    ? t('nutr_nut_low_data', { known: s.known, count: s.entries })
    : s.own ? t('nutr_nut_own') : ''
  return (
    <li className="border-b border-[var(--lg-separator)] last:border-0">
      <button type="button" onClick={() => onOpen(s.def.id)}
        className={`grid min-h-[52px] w-full grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 py-1.5 text-left ${s.lowData ? 'opacity-60' : ''}`}>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-[var(--lg-text)]">{t(`nutr_n_${s.def.id}`)}</span>
          {note && <span className={`block truncate text-[11px] ${s.own && !s.lowData ? 'text-[var(--lg-accent-text)]' : MUTED}`}>{note}</span>}
        </span>
        <NutrientBar s={s} />
        <span className="whitespace-nowrap text-right text-[13px] tabular-nums text-[var(--lg-text-2)]">
          <b className="font-semibold text-[var(--lg-text)]">{formatAmount(s.value, i18n.language)}</b>
          {' / '}{formatAmount(s.target, i18n.language)} {s.def.unit}{s.def.kind === 'max' ? ` ${t('nutr_nut_max')}` : ''}
        </span>
      </button>
    </li>
  )
}

/**
 * Balken: das Ziel steht bei 91 % der Breite (ein Strich), damit „drüber“ sichtbar bleibt.
 * Mindestwerte: unter der Hälfte warm, dann neutral, ab 90 % Akzent. Grenzen: neutral,
 * ab 80 % orange — nie rot. Die Obergrenze (EFSA) als feiner zweiter Strich.
 */
export function NutrientBar({ s, big = false }: { s: NutrientStatus; big?: boolean }) {
  const color = s.def.kind === 'max'
    ? (s.p >= 0.8 ? 'var(--lg-warn)' : 'var(--lg-text-3)')
    : s.p < 0.5 ? 'var(--lg-warn-text)' : s.p < 0.9 ? 'var(--lg-text-3)' : 'var(--accent)'
  const ulAt = s.def.ul && s.target > 0 ? (s.def.ul / s.target) * 91 : null
  return (
    <span aria-hidden="true" className={`relative block rounded-full bg-[var(--lg-fill)] ${big ? 'h-2.5' : 'h-2'}`}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, s.p * 91)}%`, background: color }} />
      <span className="absolute -top-[3px] h-[calc(100%+6px)] w-[2px] rounded-full bg-[var(--lg-text-3)]" style={{ left: '91%' }} />
      {ulAt !== null && ulAt <= 100 && (
        <span className="absolute -top-[3px] h-[calc(100%+6px)] w-px bg-[var(--lg-text-3)] opacity-60" style={{ left: `${ulAt}%` }} />
      )}
    </span>
  )
}
