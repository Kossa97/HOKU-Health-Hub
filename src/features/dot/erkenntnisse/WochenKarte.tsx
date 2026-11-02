import type { GespeicherterFund, Woche } from './erkenntnisseService'
import { useErkenntnisseTexte } from './texte'
import { fundText, wochenSpanne, type Namen } from './vorlagen'

/**
 * Das Wochen-Update: die Funde der Woche als Sätze. `funde` sind nur die, die
 * noch gelten und nicht ausgeblendet sind (`sichtbareWochenFunde`); ist keiner
 * übrig, steht dort ehrlich, dass sich nichts Neues ergeben hat.
 */
export function WochenKarte({ woche, funde, namen, onOeffnen }: {
  woche: Woche
  funde: GespeicherterFund[]
  namen: Namen
  onOeffnen(eintrag: GespeicherterFund): void
}) {
  const { et, lang } = useErkenntnisseTexte()
  const tage = woche.tageEingeflossen
  return (
    <section className="card flex flex-col gap-3" aria-labelledby="erkenntnisse-woche-kopf" data-erkenntnisse-woche>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="erkenntnisse-woche-kopf" className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--lg-accent-text)]">
          {et('woche_kopf')}
        </h2>
        <span className="shrink-0 text-[12px] text-[var(--lg-text-3)]">{wochenSpanne(woche.woche, lang)}</span>
      </div>
      {funde.length === 0 ? (
        <p className="text-[15px] leading-snug text-[var(--lg-text-2)]">{et('woche_leer', { tage })}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {funde.map(eintrag => (
              <li key={eintrag.id}>
                <button
                  type="button"
                  onClick={() => onOeffnen(eintrag)}
                  className="lg-press w-full rounded-[16px] bg-[var(--lg-surface-2)] px-3.5 py-3 text-left text-[15px] leading-snug text-[var(--lg-text)]"
                >
                  {fundText(eintrag.fund, lang, namen).satz}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-[var(--lg-text-3)]">{et('woche_tage', { tage })}</p>
        </>
      )}
    </section>
  )
}
