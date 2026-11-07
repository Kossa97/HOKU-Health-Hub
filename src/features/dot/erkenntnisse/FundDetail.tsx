import { Sheet } from '../../compliance/components/Sheet'
import type { GespeicherterFund } from './erkenntnisseService'
import { DatenlageTag } from './FundKarte'
import { useErkenntnisseTexte } from './texte'
import { datumsSpanne, fundText, type Namen } from './vorlagen'

/** Ein Fund im Detail: Satz, Beleg, Zeitraum; „Nicht hilfreich" blendet ihn aus. */
export function FundDetail({ eintrag, namen, busy = false, onNichtHilfreich, onSchliessen }: {
  eintrag: GespeicherterFund
  namen: Namen
  busy?: boolean
  onNichtHilfreich(): void
  onSchliessen(): void
}) {
  const { et, lang } = useErkenntnisseTexte()
  const { fund } = eintrag
  const text = fundText(fund, lang, namen)
  return (
    <Sheet labelledBy="erkenntnisse-fund-titel" busy={busy} onClose={onSchliessen} data-erkenntnisse-detail>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 id="erkenntnisse-fund-titel" className="min-w-0 text-[17px] font-semibold text-[var(--lg-text)]">{text.titel}</h3>
          <DatenlageTag datenlage={eintrag.datenlage} />
        </div>
        <p className="text-[19px] font-semibold leading-snug text-[var(--lg-text)]">{text.satz}</p>
        <p className="rounded-[18px] bg-[var(--lg-surface-2)] p-3.5 text-[15px] leading-snug text-[var(--lg-text-2)]">{text.beleg}</p>
        <p className="text-[13px] text-[var(--lg-text-3)]">
          {et('detail_zeitraum')}: {datumsSpanne(fund.zeitraum.von, fund.zeitraum.bis, lang)}
        </p>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onNichtHilfreich} disabled={busy}>
            {et('nicht_hilfreich')}
          </button>
          <button type="button" className="btn-primary flex-1" data-app-back-close onClick={onSchliessen} disabled={busy}>
            {et('schliessen')}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
