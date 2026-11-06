import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { isMissingColumn } from '../../../lib/dbErrors'
import { badgeName } from '../lib/badges'
import { parseVisibilityMap, visibilityOf, type Visibility, type VisibilityMap } from '../lib/profileVisibility'
import type { TitleMoment } from '../lib/titleMoment'
import { meldeProfilGeaendert } from '../lib/titleMomentStore'
import { isTitleBadgeId, RANKS, titleName, type TitleBadgeId } from '../lib/titles'
import { useFieldVisibility } from '../hooks/useFieldVisibility'
import { prefersReducedMotion, spieleMoment, stufen, traegtSchon, type Animierbar } from './titelMomentAblauf'
import './titelMoment.css'

/**
 * Moment „Neuer Rang“ / „Neuer Titel freigeschaltet“ (Spec Titel 4, Mockup
 * Entwurf 4): dunkler Grund, Hoku-Licht von unten, Chip mit einem Lichtstreif,
 * dann der Name. Darunter jedes Mal „Wer soll deinen Titel sehen?“ — die Wahl
 * schreibt die Stufe des Felds `title` wie die Sichtbarkeits-Chips (2a).
 *
 * Knöpfe: Trägt man den Titel schon (Rang bei `title_choice` null, oder die
 * Leiter des neuen Abzeichens), steigt er von selbst mit → „Fertig“ / „Titel
 * ansehen“. Sonst „Als Titel tragen“ (schreibt `profiles.title_choice`) / „Später“.
 *
 * Selten, darum darf er sich Zeit nehmen; Bewegung nur über transform/opacity
 * per Web Animations API. Erneutes Abspielen bricht den laufenden ab; bei
 * „Bewegung reduzieren“ blendet alles nur ein.
 */

const VIS_ORDER: readonly Visibility[] = ['me', 'friends', 'all']
const CLOSE_MS = 180

/** Stand aus der Profilzeile: Stufen und getragener Titel. */
export interface TitelStand { map: VisibilityMap; choice: TitleBadgeId | null }

async function ladeTitelStand(userId: string): Promise<TitelStand> {
  const first = await supabase.from('profiles').select('field_visibility, title_choice').eq('id', userId).maybeSingle()
  // Vor der Titel-Migration fehlt `title_choice`: dann trägt man den Rang.
  const res = isMissingColumn(first.error)
    ? await supabase.from('profiles').select('field_visibility').eq('id', userId).maybeSingle()
    : first
  if (res.error) throw res.error
  const row = (res.data ?? {}) as Record<string, unknown>
  return { map: parseVisibilityMap(row.field_visibility), choice: isTitleBadgeId(row.title_choice) ? row.title_choice : null }
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function TitelMoment({ moment, userId, onDone, laden = ladeTitelStand }: {
  moment: TitleMoment
  userId: string
  /** Nach dem Ausblenden: Moment aus dem Briefkasten nehmen. */
  onDone: () => void
  /** Zum Testen austauschbar. */
  laden?: (userId: string) => Promise<TitelStand>
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  // undefined = lädt noch, null = Laden gescheitert (dann ohne Frage, nichts überschreiben)
  const [stand, setStand] = useState<TitelStand | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const vorher = useRef<Element | null>(null)
  const zu = useRef(false)
  const { map, setField } = useFieldVisibility(userId, stand ? stand.map : null)

  useEffect(() => {
    let aktiv = true
    laden(userId).then(s => { if (aktiv) setStand(s) }, () => { if (aktiv) setStand(null) })
    return () => { aktiv = false }
  }, [userId, laden])

  const bereit = stand !== undefined
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!bereit || !root) return
    vorher.current = document.activeElement
    dialogRef.current?.focus({ preventScroll: true })
    spieleMoment(root, prefersReducedMotion())
    return () => {
      if (typeof root.getAnimations === 'function') root.getAnimations({ subtree: true }).forEach(a => a.cancel())
      const el = vorher.current
      if (el instanceof HTMLElement && el.isConnected) el.focus({ preventScroll: true })
    }
  }, [bereit])

  const geschrieben = useRef(false)
  const schliessen = useCallback((danach?: () => void) => {
    if (zu.current) return
    zu.current = true
    const root = rootRef.current as Animierbar | null
    // erst weiter (Titel ansehen), dann den Moment aus dem Briefkasten nehmen
    let einmal = false
    const fertig = () => {
      // Abbrechen beim Aushängen meldet sich auch noch: nur einmal weiter
      if (einmal) return
      einmal = true
      // Die offene Profilseite soll Wahl und Sichtbarkeit aus dem Moment übernehmen
      if (geschrieben.current) meldeProfilGeaendert()
      danach?.()
      onDone()
    }
    if (!root?.animate) { fertig(); return }
    root.setAttribute('data-closing', '')
    if (typeof root.getAnimations === 'function') root.getAnimations({ subtree: true }).forEach(a => a.finish())
    const aus = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: 'ease-out', fill: 'forwards' })
    aus.onfinish = fertig
    aus.oncancel = fertig
  }, [onDone])

  if (!bereit) return null

  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'de'
  const name = titleName(moment.id, lang) ?? ''
  const choice = stand?.choice ?? null
  // Ohne Stand (Laden gescheitert) nichts schreiben: Fertig / Titel ansehen
  const schon = !stand || traegtSchon(moment, choice)
  const getragen = choice ? titleName(choice, lang) : null
  const leiste = stufen(moment)
  const vis = visibilityOf(map, 'title')

  const line = moment.kind === 'rank'
    ? t('titel_moment_ab_heute', { name })
    : t('titel_moment_aus_abzeichen', { badge: badgeName(moment.id, lang) })
  const rankDays = moment.kind === 'rank' ? RANKS.find(r => r.id === moment.id)?.days ?? 0 : 0
  const sub = [
    moment.kind === 'rank' ? t('titel_moment_rang_sub', { count: rankDays }) : null,
    schon
      ? stand ? t(moment.kind === 'rank' ? 'titel_moment_rang_getragen' : 'titel_moment_steigt_mit') : null
      : getragen ? t('titel_moment_traegst', { name: getragen }) : null,
  ].filter(Boolean).join(' ')

  const tragen = async () => {
    setBusy(true)
    const { error } = await supabase.from('profiles')
      .update({ title_choice: moment.kind === 'rank' ? null : moment.id }).eq('id', userId)
    setBusy(false)
    if (error) { toast.error(t('fehler_speichern')); return }
    geschrieben.current = true
    toast.success(t('titel_moment_getragen', { name }))
    schliessen()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (!busy) schliessen()
      return
    }
    if (event.key !== 'Tab') return
    // Fokus bleibt im Moment
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    if (items.length === 0) return
    const first = items[0], last = items[items.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialogRef.current)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
  }

  return (
    <div ref={rootRef} className="tm-root" data-app-modal data-titel-moment={moment.kind} data-titel-moment-id={moment.id}>
      <div className="tm-scrim" aria-hidden="true" />
      <div className="tm-light" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titel-moment-name"
        aria-describedby="titel-moment-line"
        tabIndex={-1}
        className="tm-dialog"
        onKeyDown={onKeyDown}
      >
        <div className="tm-body">
          <p className="tm-eye">{t(moment.kind === 'rank' ? 'titel_moment_neuer_rang' : 'titel_moment_neuer_titel')}</p>
          <span className="tm-chip" aria-hidden="true">{name}<span className="tm-shine" /></span>
          <h2 id="titel-moment-name" className="tm-name">{name}</h2>
          <p id="titel-moment-line" className="tm-line" data-titel-moment-line>{line}</p>
          {sub && <p className="tm-sub">{sub}</p>}
          {leiste && (
            <div className="tm-steps" aria-hidden="true" style={{ width: leiste.count * 28 }}>
              {Array.from({ length: leiste.count }, (_, k) => (
                <i key={k} data-step={k < leiste.at ? 'on' : k === leiste.at ? 'new' : 'off'} />
              ))}
            </div>
          )}
          {stand && (
            <div className="tm-ask">
              <span id="titel-moment-frage">{t('titel_moment_frage')}</span>
              <div className="tm-seg" role="group" aria-labelledby="titel-moment-frage" data-titel-moment-vis={vis}>
                {VIS_ORDER.map(v => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={vis === v}
                    data-vis-option={v}
                    title={v === 'friends' ? `${t('profil_stufe_friends')} — ${t('profil_stufe_freunde_hinweis')}` : undefined}
                    onClick={() => { if (vis !== v) { geschrieben.current = true; void setField('title', v) } }}
                  >
                    {t(`profil_stufe_${v}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="tm-btns">
          {schon ? (
            <>
              <button type="button" className="lg-btn lg-btn-primary" data-titel-moment-act="fertig" onClick={() => schliessen()}>
                {t('titel_moment_fertig')}
              </button>
              <button type="button" className="tm-ghost" data-titel-moment-act="ansehen" onClick={() => schliessen(() => navigate('/profil'))}>
                {t('titel_moment_ansehen')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="lg-btn lg-btn-primary" disabled={busy} data-titel-moment-act="tragen" onClick={() => void tragen()}>
                {t('titel_moment_tragen')}
              </button>
              <button type="button" className="tm-ghost" disabled={busy} data-titel-moment-act="spaeter" onClick={() => schliessen()}>
                {t('titel_moment_spaeter')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
