/**
 * Karten unter dem Profilkopf: Über mich, Körper, Einnahmen, Blutwerte,
 * Gesundheit & Wearables, Training, Erfahrungsberichte. Jede Karte zeigt nur
 * die Felder, die in `fields` stehen (der Server hat für fremde Betrachter
 * schon gefiltert) — ohne Lücke: Raster nach Anzahl (`tileLayout`), Karten
 * mit einem Wert paarweise nebeneinander (`arrangeCards`), leere fallen weg.
 *
 * Mit `visibility` (eigene Sicht) trägt jeder Wert seinen Stufen-Chip, und
 * HRV/VO2max stehen ohne Wert mit Strich da. Ohne `visibility` keine Chips.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { tileText, numberFormat, type TileText } from '../lib/profileFormat'
import { LONG_TEXT_FIELDS, PROFILE_CARDS, shownFields, type ProfileCardId, type ProfileViewFields } from '../lib/profileView'
import { arrangeCards, tileLayout, visibilityOf, type ProfileField, type TileLayout, type Visibility, type VisibilityMap } from '../lib/profileVisibility'
import { SichtbarkeitsChip } from './SichtbarkeitsChip'

export interface ProfilKartenProps {
  fields: ProfileViewFields
  visibility?: VisibilityMap
  onChangeVisibility?: (field: ProfileField, next: Visibility) => void
}

type Chip = (field: ProfileField, small?: boolean) => ReactNode

const GRID: Record<TileLayout, string> = {
  r1: 'grid-cols-1',
  r2: 'grid-cols-2',
  'r2-rest': 'grid-cols-2 [&>*:last-child]:col-span-2',
  r3: 'grid-cols-3',
}

export function ProfilKarten({ fields, visibility, onChangeVisibility }: ProfilKartenProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const own = visibility !== undefined
  const chip: Chip = (field, small = false) => visibility && onChangeVisibility
    ? <SichtbarkeitsChip field={field} value={visibilityOf(visibility, field)} onChange={onChangeVisibility} small={small} />
    : null

  const cards = PROFILE_CARDS.map(id => ({ id, keys: shownFields(id, fields, own) }))
  const rows = arrangeCards(cards, card => card.keys.length)
  const text = (field: ProfileField) => tileText(field, fields, t, locale)

  return (
    <div className="flex flex-col gap-3" data-profile-cards>
      {rows.map(row => row.kind === 'pair' ? (
        <div key={row.cards.map(c => c.id).join('+')} className="grid grid-cols-2 gap-3" data-profile-pair>
          {row.cards.map(card => (
            <section key={card.id} className="card !p-3.5 min-w-0" data-profile-card={card.id} aria-labelledby={`profil-karte-${card.id}`}>
              <h2 id={`profil-karte-${card.id}`} className="mb-2.5 truncate text-[16px] font-semibold text-[var(--lg-text)]">{t(`profil_bereich_${card.id}`)}</h2>
              <Kachel field={card.keys[0]} text={text(card.keys[0])} chip={chip} />
            </section>
          ))}
        </div>
      ) : (
        <section key={row.card.id} className="card min-w-0" data-profile-card={row.card.id} aria-labelledby={`profil-karte-${row.card.id}`}>
          <KartenTitel id={row.card.id} fields={fields} />
          {row.card.id === 'training' && row.card.keys.length > 1
            ? <Training keys={row.card.keys} fields={fields} chip={chip} text={text} locale={locale} />
            : <Raster keys={row.card.keys} chip={chip} text={text} />}
        </section>
      ))}
    </div>
  )
}

function KartenTitel({ id, fields }: { id: ProfileCardId; fields: ProfileViewFields }) {
  const { t } = useTranslation()
  const sub = id === 'einnahmen' && fields.adherence
    ? t('profil_letzte_tage', { count: fields.adherence.days })
    : null
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`profil-karte-${id}`} className="min-w-0 truncate text-[17px] font-semibold text-[var(--lg-text)]">{t(`profil_bereich_${id}`)}</h2>
        {sub && <span className="shrink-0 text-[13px] text-[var(--lg-text-3)]">{sub}</span>}
      </div>
      {id === 'gesundheit' && (
        <span className="mt-1.5 inline-block rounded-full bg-[var(--lg-fill)] px-2 py-0.5 text-[11px] text-[var(--lg-text-3)]">{t('profil_quelle_health')}</span>
      )}
    </div>
  )
}

function Raster({ keys, chip, text }: { keys: ProfileField[]; chip: Chip; text: (f: ProfileField) => TileText | null }) {
  const layout = tileLayout(keys.length, keys.some(k => LONG_TEXT_FIELDS.includes(k)))
  return (
    <div className={`grid ${layout === 'r3' ? 'gap-1.5' : 'gap-2.5'} ${GRID[layout]}`} data-tile-layout={layout}>
      {keys.map(k => <Kachel key={k} field={k} text={text(k)} chip={chip} narrow={layout === 'r3'} />)}
    </div>
  )
}

function Kachel({ field, text, chip, narrow = false }: { field: ProfileField; text: TileText | null; chip: Chip; narrow?: boolean }) {
  if (!text) return null
  return (
    <div className={`min-w-0 rounded-[16px] bg-[var(--lg-surface-2)] ${narrow ? 'px-[7px] py-2.5' : 'p-3'}`} data-profile-tile={field}>
      {narrow ? (
        // Schmale Dreier-Kachel: Chip bleibt in der Zeile, notfalls kürzt die Beschriftung
        <div className="flex min-w-0 items-center gap-1 text-[11px] text-[var(--lg-text-3)]">
          <span className="min-w-0 truncate">{text.label}</span>
          {chip(field, true)}
        </div>
      ) : (
        // Breite Kachel: Beschriftung bricht lieber um, als abgeschnitten zu werden; der Chip bleibt ganz
        <div className="text-[12.5px] leading-snug text-[var(--lg-text-3)]">
          {text.label}{chip(field) && <> {chip(field)}</>}
        </div>
      )}
      <div
        className={`mt-1 font-semibold tabular-nums text-[var(--lg-text)] ${text.long ? 'text-[15px] leading-snug' : 'truncate text-[21px] leading-tight'}`}
        data-profile-value
      >
        {text.value}
        {text.unit && <small className="ml-1 text-[12px] font-medium text-[var(--lg-text-3)]">{text.unit}</small>}
      </div>
      {text.sub && <div className="mt-0.5 text-[12px] leading-snug text-[var(--lg-text-3)]">{text.sub}</div>}
    </div>
  )
}

function Training({ keys, fields, chip, text, locale }: {
  keys: ProfileField[]
  fields: ProfileViewFields
  chip: Chip
  text: (f: ProfileField) => TileText | null
  locale: string
}) {
  const { t } = useTranslation()
  const { n } = numberFormat(locale)
  const zeilen = keys.filter(k => k !== 'e1rm')
  const top = keys.includes('e1rm') ? fields.e1rm?.top ?? [] : []
  const layout = tileLayout(top.length)
  return (
    <>
      {zeilen.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--lg-separator)]">
          {zeilen.map(k => {
            const z = text(k)
            if (!z) return null
            return (
              <li key={k} className="flex min-h-11 items-center justify-between gap-3" data-profile-tile={k}>
                <span className="flex min-w-0 items-center gap-1.5 text-[15px] text-[var(--lg-text)]">
                  <span className="min-w-0 truncate">{z.label}</span>
                  {chip(k)}
                </span>
                <span className="min-w-0 truncate text-right text-[15px] text-[var(--lg-text-2)]" data-profile-value>{z.value}</span>
              </li>
            )
          })}
        </ul>
      )}
      {top.length > 0 && (
        <div className={zeilen.length > 0 ? 'mt-3' : ''} data-profile-tile="e1rm">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] text-[var(--lg-text-3)]">
            <span>{t('profil_feld_e1rm')}</span>
            {chip('e1rm')}
          </p>
          <div className={`grid gap-2.5 ${GRID[layout]}`}>
            {top.map(e => (
              <div key={`${e.id}-${e.name}`} className="min-w-0 rounded-[16px] bg-[var(--lg-surface-2)] px-2.5 py-2.5">
                <div className="truncate text-[11.5px] text-[var(--lg-text-3)]">{e.name}</div>
                <div className="mt-1 truncate text-[21px] font-semibold leading-tight tabular-nums text-[var(--lg-text)]">
                  {n(e.v)}<small className="ml-1 text-[12px] font-medium text-[var(--lg-text-3)]">kg</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
