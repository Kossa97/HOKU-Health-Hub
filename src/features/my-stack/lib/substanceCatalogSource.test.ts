import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STACK_CATEGORIES } from './categories'
import { INTAKE_METHODS } from '../../../lib/intakeMethods'
import { DOSAGE_FORMS, getDosageForm } from './dosageForms'
import type { DosageFormKey, StackCategory } from '../types'

// Der Vertrag des Substanzkatalogs.
//
// Die Quelldatei ist Daten, kein Code — und Daten werden durch Abschreiben
// falsch, nicht durch Denkfehler. Ein Alias, der zweimal vorkommt, macht die
// Suche mehrdeutig; ein PK-Profilname mit Tippfehler laesst die Verknuepfung
// ins Leere laufen, ohne dass irgendwo etwas kaputtgeht. Diese Faelle faengt
// kein Typ ab, nur ein Test.
//
// Der Lueckentest am Ende ist der wichtigste: er sagt, welche
// Darreichungsform noch keine einzige Substanz hat.

interface SubstanceSeed {
  name: string
  aliases: string[]
  category: StackCategory
  dosageForms: DosageFormKey[]
  units: string[]
  pkProfile: string | null
  components?: string[]
}

const quelle = await import(
  pathToFileURL(resolve('scripts/substance-catalog-source.mjs')).href
) as { SUBSTANCE_CATALOG: SubstanceSeed[] }
const KATALOG = quelle.SUBSTANCE_CATALOG

// Abgeleitet, nicht abgeschrieben: sonst haette der Katalog eine zweite
// Kategorienliste, die still veraltet. `other` ist ausgenommen — es ist das
// Auffangfach fuer eine eigene Substanz im Formular. Ein KURATIERTER Eintrag,
// den niemand einsortieren konnte, ist kein Auffangfall, sondern eine Luecke:
// dann fehlt die Kategorie, nicht die Substanz.
const KATEGORIEN = STACK_CATEGORIES
  .map(option => option.key)
  .filter(key => key !== 'other') as StackCategory[]
const FORMSCHLUESSEL = new Set(DOSAGE_FORMS.map(form => form.key))

interface PkSeed {
  name: string
  aliases: string[]
  half_life_hours: number
  tmax_hours: number
  bioavailability_sc: number
  category: string
  notes: string
}

const pkQuelle = await import(
  pathToFileURL(resolve('scripts/pk-profile-source.mjs')).href
) as { PK_PROFILE_ERWEITERUNG: PkSeed[] }
const PK_ERWEITERUNG = pkQuelle.PK_PROFILE_ERWEITERUNG

// Die 44 aelteren Profile aus `scripts/seed-pk-profiles.ts`. Der Generator
// liest sie ohnehin — der Test nimmt dasselbe Ergebnis, statt die Datei ein
// zweites Mal zu zerlegen. Gilt beides fuer sie wie fuer die neuen: sie
// stehen in derselben Tabelle und speisen dieselbe Kurve.
const pkGenerator = await import(
  pathToFileURL(resolve('scripts/generate-pk-profiles-sql.mjs')).href
) as { SEED_PROFILE: (PkSeed & { notes: string | null })[] }
const PK_SEED = pkGenerator.SEED_PROFILE
const PK_ALLE = [...PK_SEED, ...PK_ERWEITERUNG]

/** Die PK-Profile aus dem alten Seed-Skript — Namen und Aliase. */
function seedProfilNamen(): Set<string> {
  const text = readFileSync(resolve('scripts/seed-pk-profiles.ts'), 'utf8')
  const namen = new Set<string>()
  for (const treffer of text.matchAll(/\bname: '([^']+)'/g)) namen.add(treffer[1].toLowerCase())
  for (const treffer of text.matchAll(/\baliases: \[([^\]]*)\]/g)) {
    for (const alias of treffer[1].matchAll(/'([^']+)'/g)) namen.add(alias[1].toLowerCase())
  }
  return namen
}

/** Alle Profile, die es geben wird: der alte Seed plus die Erweiterung. */
function pkProfilNamen(): Set<string> {
  const namen = seedProfilNamen()
  for (const profil of PK_ERWEITERUNG) {
    namen.add(profil.name.toLowerCase())
    for (const alias of profil.aliases) namen.add(alias.toLowerCase())
  }
  return namen
}

describe('Substanzkatalog (Quelldatei)', () => {
  it('haelt jeden Namen und jeden Alias genau einmal — auch ueber Eintraege hinweg', () => {
    // Der Unique-Index in Postgres prueft dasselbe fuer den Namen. Die Aliase
    // pruefte bisher niemand, und ein doppelter macht die Suche mehrdeutig.
    const gesehen = new Map<string, string>()
    for (const eintrag of KATALOG) {
      for (const bezeichnung of [eintrag.name, ...eintrag.aliases]) {
        const schluessel = bezeichnung.trim().toLowerCase()
        expect(schluessel.length, `${eintrag.name}: leere Bezeichnung`).toBeGreaterThan(0)
        const schon = gesehen.get(schluessel)
        expect(schon, `„${bezeichnung}" steht bei ${schon} und bei ${eintrag.name}`).toBeUndefined()
        gesehen.set(schluessel, eintrag.name)
      }
    }
  })

  it('gibt jedem Eintrag eine gueltige Kategorie, und keinem „Sonstiges"', () => {
    for (const eintrag of KATALOG) {
      expect(KATEGORIEN, eintrag.name).toContain(eintrag.category)
    }
  })

  it('nennt nur Darreichungsformen, die es gibt — und keinen Eintrag ohne', () => {
    for (const eintrag of KATALOG) {
      expect(eintrag.dosageForms.length, `${eintrag.name}: keine Form`).toBeGreaterThan(0)
      for (const form of eintrag.dosageForms) {
        expect(FORMSCHLUESSEL.has(form), `${eintrag.name}: „${form}"`).toBe(true)
      }
      expect(new Set(eintrag.dosageForms).size, `${eintrag.name}: Form doppelt`)
        .toBe(eintrag.dosageForms.length)
    }
  })

  it('nennt nur Einheiten, die zu einer der genannten Formen passen', () => {
    // „g" bei einem Vial waere kein Tippfehler, den man sieht — die Form
    // bietet die Einheit gar nicht an, und der Vorschlag liefe ins Leere.
    for (const eintrag of KATALOG) {
      expect(eintrag.units.length, `${eintrag.name}: keine Einheit`).toBeGreaterThan(0)
      const erlaubt = new Set(
        eintrag.dosageForms.flatMap(form => getDosageForm(form).suggestedUnits),
      )
      for (const einheit of eintrag.units) {
        expect(erlaubt.has(einheit), `${eintrag.name}: „${einheit}" passt zu keiner seiner Formen`)
          .toBe(true)
      }
    }
  })

  it('verweist nur auf PK-Profile, die es wirklich gibt', () => {
    // Ein Tippfehler hier bricht nichts — die Unterabfrage findet einfach
    // nichts, und die Substanz hat still kein PK-Profil mehr.
    const profile = pkProfilNamen()
    for (const eintrag of KATALOG) {
      if (eintrag.pkProfile === null) continue
      expect(profile.has(eintrag.pkProfile.toLowerCase()), `${eintrag.name} → „${eintrag.pkProfile}"`)
        .toBe(true)
    }
  })

  it('fuehrt zu jedem eingedeutschten Namen die englische Schreibweise als Alias', () => {
    // Der Fall, an dem es schon einmal scheiterte: der Katalog schrieb
    // „Semaglutid", das PK-Profil „Semaglutide" — ohne Alias finden sich die
    // beiden nie, und die Suche nach dem englischen Namen geht ins Leere.
    for (const eintrag of KATALOG) {
      if (eintrag.pkProfile === null) continue
      if (eintrag.pkProfile.toLowerCase() === eintrag.name.toLowerCase()) continue
      const aliase = eintrag.aliases.map(alias => alias.toLowerCase())
      expect(aliase, `${eintrag.name}: „${eintrag.pkProfile}" fehlt als Alias`)
        .toContain(eintrag.pkProfile.toLowerCase())
    }
  })

  it('deckt jede Darreichungsform mit mindestens einer Substanz ab', () => {
    // Die Lueckenanzeige. Schlaegt sie fehl, nennt sie die Form, fuer die
    // niemand etwas anlegen kann, ohne den Namen selbst zu tippen.
    // 'other' ist ausgenommen: das ist der Auffangkorb fuer alles, was die
    // Liste nicht kennt, kein Produkt, das jemand kauft.
    const belegt = new Set(KATALOG.flatMap(eintrag => eintrag.dosageForms))
    const fehlend = DOSAGE_FORMS
      .map(form => form.key)
      .filter(key => key !== 'other' && !belegt.has(key))

    expect(fehlend, `Formen ohne Substanz: ${fehlend.join(', ')}`).toEqual([])
  })

  it('nennt als Bestandteil nur, was auch einzeln im Katalog steht', () => {
    // Die Aufloesung laeuft im Formular ueber den Namen. Ein Tippfehler hier
    // bricht nichts sichtbar: die Zutatenzeile entstuende ohne Katalogbezug,
    // also ohne Einheitenvorschlag und ohne PK-Profil — und niemand merkt es.
    const bekannt = new Map<string, SubstanceSeed>()
    for (const eintrag of KATALOG) {
      bekannt.set(eintrag.name.toLowerCase(), eintrag)
      for (const alias of eintrag.aliases) bekannt.set(alias.toLowerCase(), eintrag)
    }

    for (const eintrag of KATALOG) {
      if (!eintrag.components) continue
      for (const bestandteil of eintrag.components) {
        const gefunden = bekannt.get(bestandteil.trim().toLowerCase())
        expect(gefunden, `${eintrag.name}: „${bestandteil}" steht nicht im Katalog`).toBeDefined()
        expect(gefunden?.components ?? [], `${eintrag.name}: „${bestandteil}" ist selbst eine Kombination`)
          .toEqual([])
      }
    }
  })

  it('gibt jeder Kombination mindestens zwei verschiedene Bestandteile', () => {
    // Eine Kombination aus einem Stoff ist keine; ein Stoff, der zweimal
    // dasteht, legt zwei Zeilen fuer denselben Wirkstoff an.
    for (const eintrag of KATALOG) {
      if (!eintrag.components) continue
      expect(eintrag.components.length, `${eintrag.name}: zu wenige Bestandteile`)
        .toBeGreaterThanOrEqual(2)
      const klein = eintrag.components.map(name => name.toLowerCase())
      expect(new Set(klein).size, `${eintrag.name}: Bestandteil doppelt`).toBe(klein.length)
      expect(klein, `${eintrag.name}: enthaelt sich selbst`).not.toContain(eintrag.name.toLowerCase())
    }
  })

  it('laesst eine Kombination kein eigenes PK-Profil tragen', () => {
    // Die Bestandteile haben verschiedene Halbwertszeiten. Ein gemeinsames
    // Profil waere eine erfundene Kurve — gerechnet wird je Wirkstoff.
    for (const eintrag of KATALOG) {
      if (!eintrag.components) continue
      expect(eintrag.pkProfile, `${eintrag.name}: traegt ein eigenes PK-Profil`).toBeNull()
    }
  })

  it('gibt jeder Kombination eine Form, die ihre Bestandteile auch haben', () => {
    // Ein Kombipraeparat aus einem Pflaster und einer Tablette gibt es nicht.
    // Teilt ein Bestandteil keine einzige Form mit der Kombination, stimmt
    // eine der beiden Angaben nicht.
    const nachName = new Map<string, SubstanceSeed>()
    for (const eintrag of KATALOG) {
      nachName.set(eintrag.name.toLowerCase(), eintrag)
      for (const alias of eintrag.aliases) nachName.set(alias.toLowerCase(), eintrag)
    }

    for (const eintrag of KATALOG) {
      if (!eintrag.components) continue
      const formen = new Set(eintrag.dosageForms)
      for (const bestandteil of eintrag.components) {
        const teil = nachName.get(bestandteil.trim().toLowerCase())
        if (!teil) continue
        const gemeinsam = teil.dosageForms.filter(form => formen.has(form))
        expect(gemeinsam.length, `${eintrag.name}: „${bestandteil}" teilt keine Form`)
          .toBeGreaterThan(0)
      }
    }
  })

  it('erntet jedes PK-Profil, das die App kennt', () => {
    // Der Befund, mit dem diese Welle anfing: 44 Profile in der Datenbank,
    // rund 30 davon ohne Katalogeintrag. Die App kannte ihre Pharmakokinetik,
    // aber man konnte sie nicht auswaehlen.
    const verknuepft = new Set(
      KATALOG.map(eintrag => eintrag.pkProfile?.toLowerCase()).filter(Boolean),
    )
    const text = readFileSync(resolve('scripts/seed-pk-profiles.ts'), 'utf8')
    const profilNamen = [...text.matchAll(/\bname: '([^']+)'/g)].map(treffer => treffer[1])
    const ohneEintrag = profilNamen.filter(name => !verknuepft.has(name.toLowerCase()))

    expect(ohneEintrag, `PK-Profile ohne Substanz: ${ohneEintrag.join(', ')}`).toEqual([])
  })
})

describe('PK-Profile (Quelldatei)', () => {
  it('gehoert zu jedem Profil eine Substanz im Katalog — unter demselben Namen', () => {
    // Die Verknuepfung in der Migration laeuft ueber den Namen. Ein Profil,
    // das keinen Katalogeintrag gleichen Namens hat, haengt ins Leere und
    // faellt niemandem auf.
    const katalogNamen = new Set(KATALOG.map(eintrag => eintrag.name.toLowerCase()))
    const ohneSubstanz = PK_ERWEITERUNG
      .map(profil => profil.name)
      .filter(name => !katalogNamen.has(name.toLowerCase()))

    expect(ohneSubstanz, `Profile ohne Katalogeintrag: ${ohneSubstanz.join(', ')}`).toEqual([])
  })

  it('haelt jeden Profilnamen genau einmal und kollidiert nicht mit dem alten Seed', () => {
    const seed = seedProfilNamen()
    const gesehen = new Set<string>()
    for (const profil of PK_ERWEITERUNG) {
      const schluessel = profil.name.toLowerCase()
      expect(gesehen.has(schluessel), `„${profil.name}" steht zweimal`).toBe(false)
      expect(seed.has(schluessel), `„${profil.name}" steht schon im alten Seed`).toBe(false)
      gesehen.add(schluessel)
    }
  })

  it('laesst den Gipfel nur dort an der Halbwertszeit liegen, wo das stimmt', () => {
    // Liegt tmax bei oder ueber der Halbwertszeit, faellt die Kurve schon
    // waehrend sie noch steigt. Meist ist das ein Fehler — bei der ASS war es
    // einer: dort standen die Zahlen der Muttersubstanz, die binnen zwanzig
    // Minuten zerfaellt, statt die des Salicylats.
    //
    // Vier Faelle sind echt, und nur diese vier. Wer einen fuenften eintraegt,
    // muss ihn hier eintragen und damit begruenden.
    const echt = new Set([
      // Oral, wo die Aufnahme verzoegert oder gleich schnell ist:
      'Pantoprazol',  // magensaftresistent: Aufnahme beginnt erst im Darm
      'Omeprazol',    // dasselbe
      'Amoxicillin',  // Aufnahme und Ausscheidung laufen fast gleich schnell
      'Melatonin',    // Gipfel und Halbwertszeit liegen beide bei ~45 Minuten

      // Subkutan gespritzte Peptide mit Halbwertszeiten von Minuten: dort
      // dauert die Aufnahme aus dem Depot laenger als die Ausscheidung, und
      // der Spiegel folgt nicht mehr der Elimination, sondern der Aufnahme.
      // Das ist kein Fehler, sondern der Normalfall bei diesen Stoffen.
      'AOD-9604',              // HWZ 18 min, Gipfel nach 24 min
      'HGH Fragment 176-191',  // beides bei rund 24 min
      'Kisspeptin-10',         // HWZ 4 min, Gipfel nach 6 min
      'Melanotan II',          // HWZ 60 min, Gipfel nach 75 min
    ])
    const auffaellig = PK_ALLE
      .filter(profil => profil.tmax_hours >= profil.half_life_hours)
      .map(profil => profil.name)
      .filter(name => !echt.has(name))

    expect(auffaellig, `tmax ab Halbwertszeit ohne Begruendung: ${auffaellig.join(', ')}`)
      .toEqual([])
  })

  it('nennt nur Zahlen, aus denen sich eine Kurve rechnen laesst', () => {
    // Eine Halbwertszeit von 0 teilt durch null, ein tmax groesser als die
    // Halbwertszeit ergibt eine Kurve, die faellt bevor sie steigt, und eine
    // Bioverfuegbarkeit ueber 1 behauptet mehr im Blut als geschluckt wurde.
    for (const profil of PK_ALLE) {
      expect(profil.half_life_hours, profil.name).toBeGreaterThan(0)
      expect(profil.tmax_hours, profil.name).toBeGreaterThan(0)
      expect(profil.tmax_hours, `${profil.name}: tmax ueber der Halbwertszeit`)
        .toBeLessThan(profil.half_life_hours * 3)
      expect(profil.bioavailability_sc, profil.name).toBeGreaterThan(0)
      expect(profil.bioavailability_sc, profil.name).toBeLessThanOrEqual(1)
    }
  })

  it('gibt jeder Zahl eine Herkunft', () => {
    // Ein Profil ohne Notiz ist eine Zahl ohne Quelle. Bei pharmakologischen
    // Werten ist das der Unterschied zwischen „nachgeschlagen" und „geraten".
    for (const profil of PK_ALLE) {
      expect(profil.notes?.trim().length ?? 0, `${profil.name}: keine Notiz`).toBeGreaterThan(20)
    }
  })

  it('liest aus dem alten Seed so viele Profile, wie darin stehen', () => {
    // Der Generator zerlegt `seed-pk-profiles.ts` mit einem Regex. Wenn dort
    // jemand die Schreibweise aendert, faellt ein Eintrag still hinten runter
    // und sein Profil verschwindet aus der Datenbank. Dieser Test zaehlt nach.
    const text = readFileSync(resolve('scripts/seed-pk-profiles.ts'), 'utf8')
    const eintraege = [...text.matchAll(/\{\s*name: '[^']+',\s*aliases: \[/g)].length

    expect(PK_SEED.length, 'Der Generator hat Eintraege uebersehen').toBe(eintraege)
  })

  it('laesst Vitamine, Mineralien und schwankende Extrakte bewusst aus', () => {
    // Ein Blutspiegel von Zink nach Einzeldosis beschreibt nichts; bei
    // Ashwagandha haengt die Aufnahme am Extrakt, nicht am Stoff. Beides
    // waeren rechenbare, aber irrefuehrende Kurven. Dieser Test haelt die
    // Entscheidung fest, damit sie nicht versehentlich zurueckgenommen wird.
    const ausgelassen = [
      'Vitamin C', 'Vitamin A', 'Vitamin E', 'Vitamin B12', 'Vitamin D3', 'Vitamin K2',
      'Zink', 'Eisen', 'Calcium', 'Magnesium', 'Selen', 'Jod',
      'Ashwagandha', 'Kurkuma', 'Rhodiola rosea', 'Ginkgo biloba', 'Mariendistel', 'Baldrian',
      'Creatin', 'Kollagen', 'Whey Protein',
    ]
    const profilNamen = new Set(PK_ERWEITERUNG.map(profil => profil.name))
    for (const name of ausgelassen) {
      expect(profilNamen.has(name), `${name} hat ein PK-Profil bekommen`).toBe(false)
    }
  })
})

const pkRouten = await import(
  pathToFileURL(resolve('scripts/pk-profile-routes.mjs')).href
) as { PK_ROUTEN: Record<string, string[]>; ROUTEN: string[] }

describe('PK-Routen (Quelldatei)', () => {
  it('nennt fuer jedes Profil seine Routen — und nur fuer Profile, die es gibt', () => {
    const profile = PK_ALLE.map(profil => profil.name).sort()
    expect(Object.keys(pkRouten.PK_ROUTEN).sort()).toEqual(profile)
  })

  it('kennt dieselben Routen wie die App — daraus entsteht die Pruefung in der Datenbank', () => {
    expect(pkRouten.ROUTEN).toEqual([...INTAKE_METHODS])
  })

  it('nennt nur Routen, die die App kennt, jede hoechstens einmal', () => {
    for (const [name, routen] of Object.entries(pkRouten.PK_ROUTEN)) {
      for (const route of routen) expect(INTAKE_METHODS, `${name}: „${route}"`).toContain(route)
      expect(new Set(routen).size, `${name}: Route doppelt`).toBe(routen.length)
    }
  })

  it('haelt orale Profile (Peak-Skalierung unter 1) bei oral', () => {
    for (const profil of PK_ALLE.filter(p => p.bioavailability_sc < 1)) {
      expect(pkRouten.PK_ROUTEN[profil.name], profil.name).toEqual(['Oral'])
    }
  })
})
