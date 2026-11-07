import type { Fund } from '../../../../supabase/functions/_shared/erkenntnisse/typen.ts'
import { PFLICHTSATZ, pruefeText, type Sprache } from '../../../../supabase/functions/_shared/erkenntnisse/waechter.ts'
import { tagePlus } from '../../../../supabase/functions/_shared/erkenntnisse/zeit.ts'
import { erkenntnisseText, type ErkenntnisseTextKey } from './texte'

/**
 * Was Hoku über einen Fund sagt: Titel, ein Satz, der Beleg. Die Wörter stehen
 * in `texte.ts`, hier werden nur die Zahlen aus `fund.werte` eingesetzt. Jede
 * Zahl im Text stammt aus `werte` (oder ist ihr Betrag) — so prüft es der
 * Regelwächter; Daten zeigt die Oberfläche getrennt vom Text.
 */

export interface FundText { titel: string; satz: string; beleg: string }
export interface Namen { uebung(id: string): string }

type Vars = Record<string, string | number>

/** Zahl ohne Tausendertrennung, im Deutschen mit Komma. */
function zahl(wert: Fund['werte'][string] | undefined, sprache: Sprache): string {
  if (typeof wert !== 'number') return String(wert ?? '')
  const s = String(wert)
  return sprache === 'de' ? s.replace('.', ',') : s
}

function lokalerTag(tag: string): Date {
  const [j, m, t] = tag.split('-').map(Number)
  return new Date(j, m - 1, t)
}

/**
 * Zeitraum als lokalisierte Daten („21. Sept. 2026 – 1. Nov. 2026"). Steht in
 * der Oberfläche neben dem Text, nie im geprüften Satz oder Beleg.
 */
export function datumsSpanne(von: string, bis: string, sprache: Sprache, mitJahr = true): string {
  const f = new Intl.DateTimeFormat(sprache, { day: 'numeric', month: 'short', ...(mitJahr ? { year: 'numeric' } : {}) })
  return `${f.format(lokalerTag(von))} – ${f.format(lokalerTag(bis))}`
}

/**
 * Woche (lokaler Sonntag des Laufs) als die Tage, die in `tage_eingeflossen` gezählt sind:
 * Sonntag davor bis Samstag (woche − 7 … woche − 1).
 */
export function wochenSpanne(sonntag: string, sprache: Sprache): string {
  return datumsSpanne(tagePlus(sonntag, -7), tagePlus(sonntag, -1), sprache, false)
}

export function fundText(fund: Fund, sprache: Sprache, namen: Namen): FundText {
  const w = fund.werte
  const n = (wert: Fund['werte'][string] | undefined) => zahl(wert, sprache)
  const text = (key: ErkenntnisseTextKey, vars?: Vars) => erkenntnisseText(sprache, key, vars)
  const vergleich = (beleg: string) => `${beleg} ${PFLICHTSATZ[sprache]}`
  const gruppen: Vars = { n_a: n(w.n_a), n_b: n(w.n_b), mittel_a: n(w.mittel_a), mittel_b: n(w.mittel_b) }

  switch (fund.id) {
    case 'H1':
      return {
        titel: text('h1_titel'),
        satz: text(w.gruppe_a === 'ab_grenze' ? 'h1_satz_ab' : 'h1_satz_vor', { grenze: n(w.grenze), differenz: n(w.differenz) }),
        beleg: vergleich(text('h1_beleg', gruppen)),
      }
    case 'E2': {
      // Satz immer aus Sicht der Trainingstage; die Richtung kommt aus dem Vorzeichen.
      const trainingIstA = w.gruppe_a !== 'ruhetag'
      const differenz = Number(w.differenz)
      const trainingMinusRuhe = trainingIstA ? differenz : -differenz
      return {
        titel: text('e2_titel'),
        satz: text(trainingMinusRuhe >= 0 ? 'e2_satz_mehr' : 'e2_satz_weniger', { differenz: n(Math.abs(differenz)) }),
        beleg: vergleich(text('e2_beleg', trainingIstA
          ? { n_training: n(w.n_a), n_ruhe: n(w.n_b), mittel_training: n(w.mittel_a), mittel_ruhe: n(w.mittel_b) }
          : { n_training: n(w.n_b), n_ruhe: n(w.n_a), mittel_training: n(w.mittel_b), mittel_ruhe: n(w.mittel_a) })),
      }
    }
    case 'W1':
      return {
        titel: text('w1_titel'),
        satz: text(w.gruppe_a === 'schlaf_unter_grenze' ? 'w1_satz_unter' : 'w1_satz_ab', { grenze: n(w.grenze), differenz: n(w.differenz) }),
        beleg: vergleich(text('w1_beleg', gruppen)),
      }
    case 'T7':
      return { titel: text('t7_titel'), satz: text('t7_satz', { tage: n(w.tage) }), beleg: text('t7_beleg') }
    case 'R4': {
      // Der Übungsname ist fremder Text (eigene Übungen, Katalognamen mit Ziffern): bleibt der
      // Satz damit am Regelwächter hängen, kommt er ohne Namen.
      const zahlen = { kg: n(w.kg), vorher: n(w.vorher) }
      const beleg = text('r4_beleg')
      const mitName = text('r4_satz', { uebung: namen.uebung(fund.bezug ?? ''), ...zahlen })
      const satz = pruefeText(`${mitName} ${beleg}`, sprache, fund).ok ? mitName : text('r4_satz_ohne_name', zahlen)
      return { titel: text('r4_titel'), satz, beleg }
    }
  }
}
