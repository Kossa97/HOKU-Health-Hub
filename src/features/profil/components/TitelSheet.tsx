/**
 * Sheet „Dein Titel“ (Spec Titel 4): getragener Titel, Rang mit Leiter und
 * Fortschritt, Titel aus Abzeichen (verdiente wählbar, Leitern mit Stufe; die
 * fünf nächsten offenen, Rest über „Alle offenen ansehen“), persönliche Titel
 * (Schalter, Bestätigung je Titel), „Sichtbar für“ und die Fußnote.
 *
 * Nur Anzeige: Wahl, Schalter und Stufe gehen über die Rückrufe an die Seite
 * (`useTitleSettings`, `useFieldVisibility`), die auch den Chip im Profil hält.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ChevronDown, Lock, Users } from 'lucide-react'
import { Sheet } from '../../compliance/components/Sheet'
import { Schalter } from '../../../components/ui/Schalter'
import { GlassSegmented, type SegmentOption } from '../../../components/ui/GlassSegmented'
import { BADGE_BY_ID, badgeName, needsFriends, type BadgeState } from '../lib/badges'
import type { BadgeId } from '../lib/badgeIds'
import { badgeProgressText } from '../lib/progressFormat'
import { visibilityOf, type ProfileField, type Visibility, type VisibilityMap } from '../lib/profileVisibility'
import {
  PERSONAL_TITLE_SOURCE, isPersonalTitle, titleName,
  type PersonalTitleId, type ProfileTitle, type TitleBadgeId, type TitleSettings,
} from '../lib/titles'
import { isWorn, needsConsent, openTitles, rankLadder, stricter, titleOptions, type TitleOption } from '../lib/titleChoices'
import { TitelMarke } from './TitleChip'
import { TitelBestaetigung } from './TitelBestaetigung'
import type { useEigenerTitel } from '../hooks/useTitleSettings'

const OFFEN_ZUERST = 5

export interface TitelSheetProps {
  settings: TitleSettings
  /** Getragener Titel (lokal gerechnet, `wornTitle`). */
  worn: ProfileTitle | null
  /** Stand aller Abzeichen; `null` = lädt noch oder nicht ladbar. */
  states: readonly BadgeState[] | null
  entryDays: number | null
  visibility: VisibilityMap
  onChangeVisibility: (field: ProfileField, v: Visibility) => void
  onChoose: (choice: TitleBadgeId | null) => void
  onPersonalAllowed: (on: boolean) => void
  /** Bestätigt (heute) und trägt den persönlichen Titel. */
  onConsent: (id: PersonalTitleId) => void
  onClose: () => void
}

function Gruppe({ titel, rechts, children }: { titel: string; rechts?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--lg-text-3)]">
        <h3>{titel}</h3>
        {rechts !== undefined && <span className="text-[12px] normal-case tracking-[0.02em] tabular-nums">{rechts}</span>}
      </div>
      {children}
    </section>
  )
}

const LISTE = 'rounded-[18px] bg-[var(--lg-fill)] px-3'
const ZEILE = 'grid w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--lg-separator)] py-2.5 text-left last:border-b-0'

function Radio({ an }: { an: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-shadow ${an ? 'shadow-[inset_0_0_0_2px_var(--lg-accent)]' : 'shadow-[inset_0_0_0_2px_var(--lg-text-3)]'}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full bg-[var(--lg-accent)] transition-[opacity,transform] duration-150 ${an ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
    </span>
  )
}

const Symbol = ({ id, gedimmt = false }: { id: BadgeId; gedimmt?: boolean }) => (
  <span aria-hidden="true" className={`grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[var(--lg-surface-2)] text-[17px] ${gedimmt ? 'opacity-50 grayscale' : ''}`}>
    {BADGE_BY_ID[id].icon}
  </span>
)

function Balken({ anteil, akzent = false, breit = false }: { anteil: number; akzent?: boolean; breit?: boolean }) {
  return (
    <span className={`block overflow-hidden rounded-full bg-[var(--lg-surface-2)] ${breit ? 'h-1.5 w-full' : 'h-1 w-full max-w-[120px] flex-1'}`} aria-hidden="true">
      <i className={`block h-full origin-left rounded-full ${akzent ? 'bg-[var(--lg-accent)]' : 'bg-[var(--lg-text-3)]'}`} style={{ transform: `scaleX(${Math.min(1, Math.max(0, anteil)).toFixed(3)})` }} />
    </span>
  )
}

export function TitelSheet({
  settings, worn, states, entryDays, visibility, onChangeVisibility, onChoose, onPersonalAllowed, onConsent, onClose,
}: TitelSheetProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const lang = i18n?.resolvedLanguage ?? locale
  const titelId = `titel-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const [alleOffenen, setAlleOffenen] = useState(false)
  const [bestaetigen, setBestaetigen] = useState<PersonalTitleId | null>(null)
  const fertig = useRef<HTMLButtonElement>(null)
  // Fokus ins Sheet: sonst bliebe er auf der Seite dahinter, und Escape erreichte das Sheet nicht
  useEffect(() => { fertig.current?.focus({ preventScroll: true }) }, [])
  const name = (id: BadgeId) => titleName(id, lang) ?? ''
  const n = (x: number) => new Intl.NumberFormat(locale).format(x)

  const byId = useMemo(() => new Map((states ?? []).map(s => [s.id, s])), [states])
  const options = useMemo(() => (states ? titleOptions(states) : []), [states])
  const normal = options.filter(o => !o.personal)
  const verdient = normal.filter(o => o.earned)
  const offen = openTitles(options)
  const persoenlich = options.filter(o => o.personal)
  const persoenlichVerdient = persoenlich.filter(o => o.earned)

  const titelStufe = visibilityOf(visibility, 'title')
  const quellStufe = (id: PersonalTitleId) => visibilityOf(visibility, PERSONAL_TITLE_SOURCE[id])
  const wornPersonal = worn?.kind === 'badge' && isPersonalTitle(worn.id) ? worn.id : null
  const wirksam = wornPersonal ? stricter(titelStufe, quellStufe(wornPersonal)) : titelStufe

  const waehle = (o: TitleOption) => {
    if (needsConsent(settings, o.choice)) setBestaetigen(o.choice)
    else onChoose(o.choice)
  }

  const ladder = entryDays === null ? null : rankLadder(entryDays)
  const rangName = ladder?.current ? name(ladder.current) : null
  const art = worn ? (worn.kind === 'rank' ? 'rang' : wornPersonal ? 'persoenlich' : 'abzeichen') : null

  const sicht: SegmentOption<Visibility>[] = (['me', 'friends', 'all'] as const).map(v => ({ key: v, label: t(`profil_stufe_${v}`) }))

  const verdientZeile = (o: TitleOption) => {
    const an = isWorn(o, worn)
    const naechste = o.next ? byId.get(o.next) : undefined
    const sub = o.ladder
      ? [badgeName(o.shown, lang), t('titel_stufe', { n: o.level }), o.next && naechste?.need !== undefined ? t('titel_naechste_stufe', { name: name(o.next), n: n(naechste.need) }) : null]
      : [badgeName(o.shown, lang), t('titel_verdient')]
    return (
      <button key={o.choice} type="button" role="radio" aria-checked={an} className={ZEILE} onClick={() => waehle(o)} data-title-option={o.choice} data-title-shown={o.shown}>
        <Symbol id={o.shown} />
        <span className="min-w-0">
          <span className="block text-[15px] leading-tight text-[var(--lg-text)]">{name(o.shown)}</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-[var(--lg-text-3)]">{sub.filter(Boolean).join(' · ')}</span>
        </span>
        <Radio an={an} />
      </button>
    )
  }

  const offenZeile = (o: TitleOption) => {
    const s = o.state
    const stand = s ? (needsFriends(o.shown) ? t('pf_abz_ab_freunde') : badgeProgressText(s, locale)) : null
    const anteil = s?.have !== undefined && s.need ? s.have / s.need : 0
    return (
      <div key={o.choice} className={ZEILE} aria-disabled="true" data-title-open={o.choice}>
        <Symbol id={o.shown} gedimmt />
        <span className="min-w-0">
          <span className="block text-[15px] leading-tight text-[var(--lg-text-2)]">{name(o.shown)}</span>
          <span className="mt-1 flex items-center gap-2">
            <Balken anteil={anteil} />
            <span className="min-w-0 truncate text-[12px] tabular-nums text-[var(--lg-text-3)]" data-title-open-progress>
              {[stand, badgeName(o.shown, lang)].filter(Boolean).join(' · ')}
            </span>
          </span>
        </span>
        <span className="grid w-[22px] place-items-center text-[var(--lg-text-3)]">
          <Lock size={15} aria-hidden="true" />
          <span className="sr-only">{t('titel_nicht_verdient')}</span>
        </span>
      </div>
    )
  }

  const persoenlichZeile = (o: TitleOption) => {
    const id = o.choice as PersonalTitleId
    const an = isWorn(o, worn)
    const quelle = quellStufe(id)
    return (
      <button key={id} type="button" role="radio" aria-checked={an} className={ZEILE} onClick={() => waehle(o)} data-title-personal={id}>
        <Symbol id={id} />
        <span className="min-w-0">
          <span className="block text-[15px] leading-tight text-[var(--lg-text)]">{name(id)}</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-[var(--lg-text-3)]">{badgeName(id, lang)} · {t('titel_verdient')}</span>
          <span className="mt-0.5 flex items-start gap-1 text-[11.5px] leading-snug text-[var(--lg-text-3)]">
            {quelle === 'me' ? <Lock size={11} className="mt-[2px] shrink-0" aria-hidden="true" /> : <Users size={11} className="mt-[2px] shrink-0" aria-hidden="true" />}
            <span className="min-w-0">
              {t('titel_hoechstens', { stufe: t(`profil_stufe_${quelle}`), feld: t(`profil_feld_${PERSONAL_TITLE_SOURCE[id]}`) })}
              {Object.hasOwn(settings.consents, id) && <> · <span data-title-consented>{t('titel_bestaetigt')}</span></>}
            </span>
          </span>
        </span>
        <Radio an={an} />
      </button>
    )
  }

  return (
    <>
      <Sheet labelledBy={titelId} onClose={onClose} tall data-title-sheet>
        <div className="flex items-center justify-between gap-3">
          <h2 id={titelId} className="lg-title2">{t('titel_sheet_titel')}</h2>
          <button ref={fertig} type="button" data-app-back-close onClick={onClose} className="min-h-11 px-1 text-[16px] font-semibold text-[var(--lg-accent-text)]" data-title-sheet-done>
            {t('titel_fertig')}
          </button>
        </div>

        {/* Getragener Titel */}
        <div
          className="mt-3 grid justify-items-center gap-2 rounded-[20px] px-3 pb-4 pt-3.5 text-center"
          style={{ background: 'radial-gradient(80% 90% at 50% 120%, color-mix(in srgb, var(--lg-accent) 22%, transparent), transparent 70%), var(--lg-fill)' }}
          data-title-worn={worn?.id ?? 'none'}
        >
          <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--lg-text-3)]">
            {art ? t('titel_du_traegst', { art: t(`titel_art_${art}`) }) : t('titel_noch_keiner')}
          </span>
          {worn && <TitelMarke name={name(worn.id)} className="!px-3 !py-1.5 !text-[12.5px]" />}
          <span className="mt-0.5 text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--lg-text)]">{worn ? name(worn.id) : name('rank_1')}</span>
          <p className="max-w-[30ch] text-[13px] leading-snug text-[var(--lg-text-2)]" data-title-worn-sight>
            {!worn
              ? t('titel_rang_erster', { rang: name('rank_1') })
              : wirksam === 'all' && wornPersonal ? t('titel_sicht_all_persoenlich') : t(`titel_sicht_${wirksam}`)}
          </p>
        </div>

        {/* Rang */}
        <Gruppe titel={t('titel_art_rang')} rechts={entryDays === null ? undefined : t('titel_tage_mit_eintrag', { count: entryDays, n: n(entryDays) })}>
          <div className={LISTE} role="radiogroup" aria-label={t('titel_art_rang')}>
            <button
              type="button"
              role="radio"
              aria-checked={settings.choice === null || worn?.kind === 'rank'}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--lg-separator)] py-3 text-left"
              onClick={() => onChoose(null)}
              data-title-option="rank"
            >
              <span className="min-w-0">
                <span className="block text-[15px] text-[var(--lg-text)]">{t('titel_rang_tragen')}{rangName ? ` · ${rangName}` : ''}</span>
                <span className="mt-0.5 block text-[12px] text-[var(--lg-text-3)]">{t('titel_rang_steigt')}</span>
              </span>
              <Radio an={settings.choice === null || worn?.kind === 'rank'} />
            </button>
            {ladder ? (
              <ol className="grid py-1.5" aria-label={t('titel_rangleiter')} data-rank-ladder>
                {!ladder.current && ladder.next && <RangFortschritt next={ladder.next} name={name(ladder.next.id)} />}
                {ladder.steps.map(step => (
                  <RangStufe key={step.id} stage={step.stage} name={name(step.id)} rechts={step.stage === 'cur' ? t('titel_rang_aktuell') : t('titel_rang_ab', { n: n(step.days) })} id={step.id}>
                    {step.stage === 'cur' && ladder.next && <RangFortschritt next={ladder.next} name={name(ladder.next.id)} />}
                  </RangStufe>
                ))}
              </ol>
            ) : (
              <div className="my-3 h-[180px] animate-pulse rounded-[14px] bg-[var(--lg-surface-2)]" aria-busy="true" />
            )}
          </div>
        </Gruppe>

        {/* Titel aus Abzeichen */}
        <Gruppe titel={t('titel_gruppe_abzeichen')} rechts={states ? t('titel_verdient_von', { n: verdient.length, gesamt: normal.length }) : undefined}>
          {!states ? (
            <div className="h-[120px] animate-pulse rounded-[18px] bg-[var(--lg-fill)]" aria-busy="true" />
          ) : verdient.length > 0 ? (
            <div className={LISTE} role="radiogroup" aria-label={t('titel_gruppe_abzeichen')} data-title-earned>
              {verdient.map(verdientZeile)}
            </div>
          ) : (
            <p className="px-1.5 text-[13px] leading-snug text-[var(--lg-text-3)]">{t('titel_keine_verdient')}</p>
          )}
        </Gruppe>

        {states && offen.length > 0 && (
          <Gruppe titel={t('titel_gruppe_offen')} rechts={n(offen.length)}>
            <div className={LISTE} data-title-open-list>
              {(alleOffenen ? offen : offen.slice(0, OFFEN_ZUERST)).map(offenZeile)}
              {offen.length > OFFEN_ZUERST && (
                <button
                  type="button"
                  aria-expanded={alleOffenen}
                  onClick={() => setAlleOffenen(a => !a)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left text-[15px] text-[var(--lg-accent-text)]"
                  data-title-open-all
                >
                  {alleOffenen ? t('titel_weniger') : t('titel_alle_offenen', { n: n(offen.length) })}
                  <ChevronDown size={17} aria-hidden="true" className={`transition-transform duration-200 ${alleOffenen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </Gruppe>
        )}

        {/* Persönliche Titel */}
        <Gruppe titel={t('titel_gruppe_persoenlich')} rechts={t('titel_ab_werk_aus')}>
          <div className={LISTE}>
            <button
              type="button"
              role="switch"
              aria-checked={settings.personalAllowed}
              onClick={() => onPersonalAllowed(!settings.personalAllowed)}
              className="flex w-full items-center gap-3 border-b border-[var(--lg-separator)] py-3 text-left last:border-b-0"
              data-title-personal-switch
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-[var(--lg-text)]">{t('titel_persoenlich_erlauben')}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-[var(--lg-text-3)]">{t('titel_persoenlich_sub')}</span>
              </span>
              <Schalter an={settings.personalAllowed} />
            </button>
            {settings.personalAllowed && states && (
              <div role="radiogroup" aria-label={t('titel_gruppe_persoenlich')} data-title-personal-list>
                {persoenlichVerdient.map(persoenlichZeile)}
                <p className="py-2.5 text-[12px] text-[var(--lg-text-3)]">
                  {persoenlichVerdient.length === 0 ? t('titel_persoenlich_keine') : null}
                  {persoenlichVerdient.length === 0 && persoenlich.length > 0 ? ' ' : null}
                  {persoenlich.length > persoenlichVerdient.length ? t('titel_weitere_offen', { count: persoenlich.length - persoenlichVerdient.length }) : null}
                </p>
              </div>
            )}
          </div>
          <p className="mt-2 px-1.5 text-[12px] leading-snug text-[var(--lg-text-3)]" data-title-personal-web>
            {t('titel_persoenlich_web')} {t('titel_persoenlich_widerruf')}
          </p>
        </Gruppe>

        {/* Sichtbar für */}
        <Gruppe titel={t('titel_gruppe_sichtbar')}>
          <div className={`${LISTE} pb-3 pt-2.5`} data-title-visibility>
            <p className="text-[15px] text-[var(--lg-text)]">{t('titel_wer_sieht')}</p>
            <p className="mb-2.5 mt-0.5 text-[12px] leading-snug text-[var(--lg-text-3)]">{t('titel_wer_sieht_sub')}</p>
            <GlassSegmented<Visibility>
              options={sicht}
              value={titelStufe}
              onChange={v => onChangeVisibility('title', v)}
              ariaLabel={t('profil_sichtbarkeit_von', { feld: t('profil_feld_title') })}
              material="fill"
              equal
            />
          </div>
        </Gruppe>

        <p className="mx-1.5 mt-4 text-center text-[12px] leading-snug text-[var(--lg-text-3)]" data-title-footnote>
          <Trans i18nKey="titel_fussnote" components={{ b: <b className="font-semibold text-[var(--lg-text-2)]" /> }} />
        </p>
      </Sheet>

      {bestaetigen && (
        <TitelBestaetigung
          id={bestaetigen}
          sourceVisibility={quellStufe(bestaetigen)}
          onCancel={() => setBestaetigen(null)}
          onConfirm={() => { onConsent(bestaetigen); setBestaetigen(null) }}
        />
      )}
    </>
  )
}

/**
 * Das Sheet für die eigene Sicht, verdrahtet mit `useEigenerTitel` und der
 * Feld-Stufe der Seite (Profil, Einstellungen, Abzeichen).
 */
export function EigenerTitelSheet({ titel, sichtbarkeit, onClose }: {
  titel: ReturnType<typeof useEigenerTitel>
  sichtbarkeit: { map: VisibilityMap; setField: (field: ProfileField, v: Visibility) => Promise<boolean> }
  onClose: () => void
}) {
  return (
    <TitelSheet
      settings={titel.settings}
      worn={titel.worn}
      states={titel.states}
      entryDays={titel.entryDays}
      visibility={sichtbarkeit.map}
      onChangeVisibility={(field, v) => void sichtbarkeit.setField(field, v)}
      onChoose={choice => void titel.choose(choice)}
      onPersonalAllowed={on => void titel.setPersonalAllowed(on)}
      onConsent={id => void titel.consent(id)}
      onClose={onClose}
    />
  )
}

function RangStufe({ id, stage, name, rechts, children }: {
  id: BadgeId
  stage: 'done' | 'cur' | 'todo'
  name: string
  rechts: string
  children?: ReactNode
}) {
  return (
    <>
      <li
        className="relative grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 py-1.5 before:absolute before:bottom-1/2 before:left-[10.5px] before:top-[-6px] before:w-px before:bg-[var(--lg-separator)] before:content-[''] first:before:hidden"
        data-rank-step={id}
        data-rank-stage={stage}
        aria-current={stage === 'cur' ? 'step' : undefined}
      >
        <span className="relative z-[1] grid h-[22px] w-[22px] place-items-center" aria-hidden="true">
          <i className={stage === 'cur'
            ? 'h-3 w-3 rounded-full bg-[var(--lg-accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--lg-accent)_25%,transparent)]'
            : stage === 'done' ? 'h-[9px] w-[9px] rounded-full bg-[var(--lg-text-2)]'
              : 'h-[9px] w-[9px] rounded-full shadow-[inset_0_0_0_1.5px_var(--lg-text-3)]'} />
        </span>
        <span className={`min-w-0 text-[14px] ${stage === 'cur' ? 'font-semibold text-[var(--lg-text)]' : stage === 'done' ? 'text-[var(--lg-text-2)]' : 'text-[var(--lg-text-3)]'}`}>{name}</span>
        <span className={`whitespace-nowrap font-mono text-[11.5px] tabular-nums ${stage === 'cur' ? 'text-[var(--lg-accent-text)]' : 'text-[var(--lg-text-3)]'}`}>{rechts}</span>
      </li>
      {children}
    </>
  )
}

function RangFortschritt({ next, name }: { next: { missing: number; frac: number }; name: string }) {
  const { t } = useTranslation()
  return (
    <li className="mb-1.5 ml-8 mt-0.5 grid gap-1.5 rounded-[14px] bg-[var(--lg-surface-2)] px-3 py-2.5" data-rank-progress>
      <Balken anteil={next.frac} akzent breit />
      <span className="text-[12.5px] text-[var(--lg-text-2)]">
        <Trans
          i18nKey="titel_rang_bis"
          count={next.missing}
          values={{ rang: name }}
          components={{ b: <b className="font-semibold tabular-nums text-[var(--lg-accent-text)]" /> }}
        />
      </span>
      <small className="text-[11.5px] leading-snug text-[var(--lg-text-3)]">{t('titel_rang_zaehlt')}</small>
    </li>
  )
}
