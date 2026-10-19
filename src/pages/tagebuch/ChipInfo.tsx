import { useTranslation } from 'react-i18next'
import { Sheet } from '../../features/compliance/components/Sheet'
import { SymptomChip } from './SymptomChip'
import { labelIn, symptomByKey } from './chips'

/** „So ist ein Chip aufgebaut" — Beispiel-Chip und die vier Teile erklärt. */
export function ChipInfo({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const label = (key: string) => labelIn(symptomByKey(key)!.label, lang)
  const rows = [
    ['A', t('tagebuch_chip_name'), t('tagebuch_info_name_text')],
    ['B', t('dauer'), t('tagebuch_info_dauer_text')],
    ['C', t('tagebuch_intensitaet'), t('tagebuch_info_intensitaet_text')],
    ['D', t('tagebuch_info_art'), t('tagebuch_info_art_text')],
  ] as const
  return (
    <Sheet labelledBy="tagebuch-info-title" onClose={onClose} tall data-tagebuch-info>
      <h2 id="tagebuch-info-title" className="lg-title2">{t('tagebuch_info_titel')}</h2>
      <figure className="mt-4 flex flex-col items-center gap-1 rounded-2xl bg-[rgba(118,118,128,.12)] px-4 py-6 [--tb-base:rgb(39_39_42)]">
        <div className="origin-center scale-[1.3]">
          <SymptomChip kind="side_effect" label={label('nausea')} iconKey="nausea" selected severity={3} duration={`2 ${t('tagebuch_einheit_std', { count: 2 })}`} />
        </div>
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
      <div className="mt-2 flex flex-wrap [--tb-base:var(--lg-sheet-solid)]">
        <SymptomChip kind="effect" label={label('more_energy')} iconKey="more_energy" selected severity={4} small />
        <SymptomChip kind="side_effect" label={label('swelling')} iconKey="swelling" selected severity={2} duration={t('tagebuch_haelt_an_kurz')} small />
        <SymptomChip kind="side_effect" label={label('headache')} iconKey="headache" selected={false} small />
      </div>
      <button type="button" autoFocus data-app-back-close className="lg-btn lg-btn-primary mt-5 w-full" onClick={onClose}>
        {t('tagebuch_info_verstanden')}
      </button>
    </Sheet>
  )
}
