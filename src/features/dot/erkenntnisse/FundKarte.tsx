import type { Datenlage } from '../../../../supabase/functions/_shared/erkenntnisse/typen.ts'
import type { GespeicherterFund } from './erkenntnisseService'
import { useErkenntnisseTexte } from './texte'
import { fundText, type Namen } from './vorlagen'

export function DatenlageTag({ datenlage }: { datenlage: Datenlage }) {
  const { et } = useErkenntnisseTexte()
  return (
    <span className="lg-tag shrink-0" data-tone={datenlage === 'deutlich' ? 'accent' : undefined}>
      {et(datenlage === 'deutlich' ? 'datenlage_deutlich' : 'datenlage_hinweis')}
    </span>
  )
}

/** Ein Fund in der Liste „Alle Funde": Titel, Satz; Tippen öffnet das Detail. */
export function FundKarte({ eintrag, namen, onOeffnen }: { eintrag: GespeicherterFund; namen: Namen; onOeffnen(): void }) {
  const { et, lang } = useErkenntnisseTexte()
  const text = fundText(eintrag.fund, lang, namen)
  return (
    <button type="button" onClick={onOeffnen} className="card lg-press flex w-full flex-col gap-2 text-left" data-erkenntnisse-fund={eintrag.fund.id}>
      <span className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-[13px] font-semibold text-[var(--lg-accent-text)]">{text.titel}</span>
        <DatenlageTag datenlage={eintrag.datenlage} />
      </span>
      <span className="text-[15px] leading-snug text-[var(--lg-text)]">{text.satz}</span>
      <span className="text-[13px] font-semibold text-[var(--lg-accent)]">{et('fund_mehr')}</span>
    </button>
  )
}
