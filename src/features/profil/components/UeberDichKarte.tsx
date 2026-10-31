/**
 * „Über dich" im Profil: Ziele, Land und Geschlecht. Alles freiwillig, jede
 * Änderung wird sofort in die eigene Profilzeile geschrieben. Das Geschlecht
 * ist nur Anzeige (Symbol am Namen) und ändert `bio_sex` nicht.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ChevronRight, Search, UserRound } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { GlassSegmented, type SegmentOption } from '../../../components/ui/GlassSegmented'
import { SheetClose } from '../../../components/ui/SheetClose'
import { Sheet } from '../../compliance/components/Sheet'
import { GOAL_TAGS, countryOptions, type GoalTag, type ProfileGender } from '../lib/profileFields'

export interface UeberDichWerte {
  goals: GoalTag[]
  country: string | null
  profile_gender: ProfileGender | null
}

interface Props {
  userId: string
  goals: GoalTag[]
  country: string | null
  gender: ProfileGender | null
  /** Neuer Stand eines Feldes; bei einem Speicherfehler kommt der alte zurück. */
  onChange: (patch: Partial<UeberDichWerte>) => void
}

type GenderKey = ProfileGender | 'none'

export function UeberDichKarte({ userId, goals, country, gender, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const [landOffen, setLandOffen] = useState(false)
  const locale = i18n?.language?.split('-')[0] || 'en'
  const laender = useMemo(() => countryOptions(locale), [locale])
  const aktuellesLand = laender.find(l => l.code === country)

  /** Neuer Stand sofort sichtbar, dann speichern; bei Fehler zurück und melden. */
  const speichere = async <K extends keyof UeberDichWerte>(feld: K, neu: UeberDichWerte[K], alt: UeberDichWerte[K]) => {
    onChange({ [feld]: neu })
    const { error } = await supabase.from('profiles').update({ [feld]: neu }).eq('id', userId)
    if (error) {
      onChange({ [feld]: alt })
      toast.error(t('fehler_speichern'))
    }
  }

  const schalteZiel = (tag: GoalTag) => {
    const neu = goals.includes(tag) ? goals.filter(g => g !== tag) : [...goals, tag]
    void speichere('goals', neu, goals)
  }

  const geschlechtOptionen: SegmentOption<GenderKey>[] = [
    { key: 'male', label: t('geschlecht_male') },
    { key: 'female', label: t('geschlecht_female') },
    { key: 'diverse', label: t('geschlecht_diverse') },
    { key: 'none', label: t('geschlecht_none') },
  ]

  return (
    <div className="card mb-4 space-y-4" data-ueber-dich-card>
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--lg-text)]">
        <UserRound size={17} className="text-[var(--lg-accent-text)]" aria-hidden="true" /> {t('profil_ueber_dich')}
      </h2>

      <div>
        <p className="label" id="ueber-dich-ziele">{t('profil_ziele')}</p>
        <div
          role="group"
          aria-labelledby="ueber-dich-ziele"
          data-goals-row
          className="no-scrollbar -mx-1 flex gap-2 px-1"
          style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          {GOAL_TAGS.map(tag => {
            const aktiv = goals.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={aktiv}
                onClick={() => schalteZiel(tag)}
                className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold transition-colors ${aktiv ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)]' : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'}`}
              >
                {t(`ziel_${tag}`)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="label">{t('profil_land')}</p>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${t('profil_land')}: ${aktuellesLand ? aktuellesLand.name : t('tagebuch_keine_angabe')}`}
          onClick={() => setLandOffen(true)}
          className="flex min-h-11 w-full items-center gap-2 rounded-[14px] bg-[var(--lg-fill)] px-3.5 text-left text-[16px] text-[var(--lg-text)]"
          data-country-open
        >
          <span className="flex-1 truncate">
            {aktuellesLand ? `${aktuellesLand.flag} ${aktuellesLand.name}` : <span className="text-[var(--lg-text-3)]">{t('tagebuch_keine_angabe')}</span>}
          </span>
          <ChevronRight size={18} className="shrink-0 text-[var(--lg-text-3)]" aria-hidden="true" />
        </button>
      </div>

      <div>
        <p className="label">{t('profil_geschlecht')}</p>
        <GlassSegmented<GenderKey>
          options={geschlechtOptionen}
          value={gender ?? 'none'}
          onChange={key => void speichere('profile_gender', key === 'none' ? null : key, gender)}
          ariaLabel={String(t('profil_geschlecht'))}
          material="fill"
          scroll
        />
      </div>

      {landOffen && (
        <LandSheet
          laender={laender}
          aktuell={country}
          onWahl={code => { setLandOffen(false); if (code !== country) void speichere('country', code, country) }}
          onClose={() => setLandOffen(false)}
        />
      )}
    </div>
  )
}

function LandSheet({ laender, aktuell, onWahl, onClose }: {
  laender: { code: string; name: string; flag: string }[]
  aktuell: string | null
  onWahl: (code: string | null) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [suche, setSuche] = useState('')
  const q = suche.trim().toLocaleLowerCase()
  const treffer = q ? laender.filter(l => l.name.toLocaleLowerCase().includes(q) || l.code.toLowerCase() === q) : laender
  const zeile = (aktiv: boolean) =>
    `flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[16px] ${aktiv ? 'bg-[var(--lg-fill-selected)] font-semibold' : ''} text-[var(--lg-text)]`
  return (
    <Sheet labelledBy="land-sheet-title" tall onClose={onClose} data-country-sheet>
      <div className="flex items-start justify-between gap-3">
        <h2 id="land-sheet-title" className="lg-title2 pt-2">{t('profil_land')}</h2>
        <SheetClose onClick={onClose} />
      </div>
      <div className="relative my-3">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--lg-text-3)]" aria-hidden="true" />
        <input
          type="search"
          className="input !pl-9"
          placeholder={t('profil_land_suchen')}
          aria-label={t('profil_land_suchen')}
          value={suche}
          onChange={e => setSuche(e.target.value)}
        />
      </div>
      <div className="space-y-0.5">
        {!q && (
          <button type="button" aria-pressed={aktuell === null} data-country-option="" onClick={() => onWahl(null)} className={zeile(aktuell === null)}>
            {t('tagebuch_keine_angabe')}
          </button>
        )}
        {treffer.map(l => (
          <button key={l.code} type="button" aria-pressed={aktuell === l.code} data-country-option={l.code} onClick={() => onWahl(l.code)} className={zeile(aktuell === l.code)}>
            <span aria-hidden="true">{l.flag}</span>
            <span className="truncate">{l.name}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
