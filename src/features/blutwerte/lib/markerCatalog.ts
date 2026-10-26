export type Kategorie =
  | 'Hormone'
  | 'Schilddrüse'
  | 'Blutbild'
  | 'Leber'
  | 'Enzyme'
  | 'Niere'
  | 'Lipide'
  | 'Entzündung'
  | 'Vitamine & Mineralstoffe'
  | 'Stoffwechsel'

export const KATEGORIEN: Kategorie[] = [
  'Hormone',
  'Schilddrüse',
  'Blutbild',
  'Leber',
  'Enzyme',
  'Niere',
  'Lipide',
  'Entzündung',
  'Vitamine & Mineralstoffe',
  'Stoffwechsel',
]

/** Kategorie-Label für Marker, die nicht im Katalog stehen. */
export const SONSTIGE = 'Sonstige' as const

export type KategorieFilter = Kategorie | typeof SONSTIGE

export interface MarkerDef {
  /** Kanonischer Anzeigename. */
  name: string
  /** Alternative Schreibweisen, wie sie auf Laborbefunden auftauchen. */
  synonyme: string[]
  kategorie: Kategorie
  /** Standard-Einheit für manuelle Eingaben. */
  einheit: string
  refMin?: number
  refMax?: number
  /** Steuert die Trend-Farbe: bei true ist ein sinkender Wert gut. */
  lowerIsBetter?: boolean
  /** 1–3 Sätze in Laiendeutsch: was der Wert bedeutet und wann er relevant ist. */
  erklaerung: string
}

export const MARKER_CATALOG: MarkerDef[] = [
  // ---------- Hormone ----------
  {
    name: 'Testosteron',
    synonyme: ['Testosteron gesamt', 'Gesamttestosteron', 'Testosteron, gesamt', 'Testo'],
    kategorie: 'Hormone',
    einheit: 'ng/dL',
    refMin: 400,
    refMax: 900,
    erklaerung:
      'Das wichtigste männliche Sexualhormon. Es beeinflusst Muskelaufbau, Knochendichte, Libido und Stimmung. Zu niedrige Werte können sich durch Antriebslosigkeit und Muskelabbau zeigen.',
  },
  {
    name: 'Freies Testosteron',
    synonyme: ['Testosteron frei', 'Freies Testo'],
    kategorie: 'Hormone',
    einheit: 'pg/mL',
    refMin: 50,
    refMax: 210,
    erklaerung:
      'Der Anteil des Testosterons, der nicht an Transportproteine gebunden und damit direkt wirksam ist. Aussagekräftiger als der Gesamtwert, wenn SHBG auffällig ist.',
  },
  {
    name: 'Östradiol',
    synonyme: ['Estradiol', 'E2', 'Oestradiol'],
    kategorie: 'Hormone',
    einheit: 'pg/mL',
    refMin: 20,
    refMax: 50,
    erklaerung:
      'Das wichtigste Östrogen, das auch bei Männern aus Testosteron entsteht. Zu hohe Werte können Wassereinlagerungen und Brustgewebswachstum begünstigen, zu niedrige schaden Gelenken und Libido.',
  },
  {
    name: 'SHBG',
    synonyme: ['Sexualhormon-bindendes Globulin', 'Sexualhormonbindendes Globulin'],
    kategorie: 'Hormone',
    einheit: 'nmol/L',
    refMin: 20,
    refMax: 60,
    erklaerung:
      'Ein Transportprotein, das Sexualhormone im Blut bindet. Je höher SHBG, desto weniger Testosteron ist frei verfügbar — der Gesamtwert allein sagt dann wenig aus.',
  },
  {
    name: 'LH',
    synonyme: ['Luteinisierendes Hormon', 'Luteinizing Hormone'],
    kategorie: 'Hormone',
    einheit: 'mIU/mL',
    refMin: 1.7,
    refMax: 8.6,
    erklaerung:
      'Ein Steuerhormon aus der Hirnanhangdrüse, das die körpereigene Testosteronproduktion anregt. Niedrige Werte bei niedrigem Testosteron deuten auf eine Störung der Steuerung hin.',
  },
  {
    name: 'FSH',
    synonyme: ['Follikelstimulierendes Hormon', 'Follitropin'],
    kategorie: 'Hormone',
    einheit: 'mIU/mL',
    refMin: 1.5,
    refMax: 12.4,
    erklaerung:
      'Steuerhormon aus der Hirnanhangdrüse, das bei Männern die Spermienbildung und bei Frauen die Eizellreifung anregt.',
  },
  {
    name: 'Prolaktin',
    synonyme: ['PRL'],
    kategorie: 'Hormone',
    einheit: 'ng/mL',
    refMax: 15,
    lowerIsBetter: true,
    erklaerung:
      'Ein Hormon der Hirnanhangdrüse. Dauerhaft erhöhte Werte können Libido und Testosteronproduktion dämpfen und sollten ärztlich abgeklärt werden.',
  },
  {
    name: 'IGF-1',
    synonyme: ['Insulin-like Growth Factor 1', 'Somatomedin C', 'IGF1'],
    kategorie: 'Hormone',
    einheit: 'ng/mL',
    refMin: 100,
    refMax: 300,
    erklaerung:
      'Ein Wachstumsfaktor, der überwiegend als Antwort auf Wachstumshormon in der Leber gebildet wird. Er gilt als stabiler Indikator für die Wachstumshormon-Aktivität, da er über den Tag kaum schwankt.',
  },
  // Kein lowerIsBetter: Für Nutzer von GH-Peptiden ist ein steigender Wert das Ziel,
  // ein fallender kein Erfolg. Der Trendpfeil folgt deshalb der Standard-Richtung.
  {
    name: 'GH',
    synonyme: ['Wachstumshormon', 'Somatotropin', 'HGH', 'STH'],
    kategorie: 'Hormone',
    einheit: 'ng/mL',
    refMax: 3.0,
    erklaerung:
      'Das Wachstumshormon selbst. Sein Spiegel schwankt im Tagesverlauf stark, weshalb eine Einzelmessung wenig aussagt — IGF-1 ist der verlässlichere Indikator.',
  },
  {
    name: 'Kortisol',
    synonyme: ['Cortisol'],
    kategorie: 'Hormone',
    einheit: 'µg/dL',
    refMin: 10,
    refMax: 20,
    erklaerung:
      'Das zentrale Stresshormon. Der Wert ist morgens am höchsten, die Uhrzeit der Blutentnahme ist deshalb entscheidend für die Beurteilung.',
  },
  {
    name: 'DHEA-S',
    synonyme: ['DHEA-Sulfat', 'Dehydroepiandrosteron-Sulfat', 'DHEAS'],
    kategorie: 'Hormone',
    einheit: 'µg/dL',
    refMin: 150,
    refMax: 500,
    erklaerung:
      'Eine Vorstufe von Testosteron und Östrogen aus der Nebenniere. Der Wert sinkt natürlicherweise mit dem Alter.',
  },
  {
    name: 'Progesteron',
    synonyme: ['Progesteron gesamt'],
    kategorie: 'Hormone',
    einheit: 'ng/mL',
    // Kein Standardbereich: bei Frauen haengt er vom Zyklustag ab (zweite Haelfte
    // und Schwangerschaft deutlich hoeher), bei Maennern liegt er sehr niedrig.
    // Gilt der Bereich des Labors aus dem Befund.
    erklaerung:
      'Ein Sexualhormon, das bei Frauen den Zyklus steuert. Bei Männern liegt es normalerweise sehr niedrig.',
  },

  // ---------- Schilddrüse ----------
  {
    name: 'TSH',
    synonyme: ['Thyreotropin', 'Thyreoidea-stimulierendes Hormon', 'TSH basal'],
    kategorie: 'Schilddrüse',
    einheit: 'mIU/L',
    refMin: 0.4,
    refMax: 4.0,
    erklaerung:
      'Das Steuerhormon der Schilddrüse und der wichtigste Suchtest. Ein hoher Wert spricht eher für eine Unterfunktion, ein niedriger für eine Überfunktion — es verhält sich also gegenläufig zu den Schilddrüsenhormonen.',
  },
  {
    name: 'fT3',
    synonyme: ['Freies T3', 'Freies Trijodthyronin', 'Trijodthyronin frei'],
    kategorie: 'Schilddrüse',
    einheit: 'pg/mL',
    refMin: 2.3,
    refMax: 4.2,
    erklaerung:
      'Das aktive Schilddrüsenhormon, das den Energieverbrauch der Zellen steuert. Es beeinflusst Stoffwechseltempo, Körpertemperatur und Antrieb.',
  },
  {
    name: 'fT4',
    synonyme: ['Freies T4', 'Freies Thyroxin', 'Thyroxin frei'],
    kategorie: 'Schilddrüse',
    einheit: 'ng/dL',
    refMin: 0.8,
    refMax: 1.8,
    erklaerung:
      'Die Speicherform des Schilddrüsenhormons, die der Körper bei Bedarf in das aktive fT3 umwandelt.',
  },

  // ---------- Blutbild ----------
  {
    name: 'Hämoglobin',
    synonyme: ['Hb', 'Haemoglobin', 'HGB'],
    kategorie: 'Blutbild',
    einheit: 'g/dL',
    refMin: 13.5,
    refMax: 17.5,
    erklaerung:
      'Der rote Blutfarbstoff, der den Sauerstoff im Blut transportiert. Zu niedrige Werte bedeuten Blutarmut, zu hohe machen das Blut zähflüssiger.',
  },
  {
    name: 'Hämatokrit',
    synonyme: ['Hkt', 'Haematokrit', 'HCT'],
    kategorie: 'Blutbild',
    einheit: '%',
    refMin: 40,
    refMax: 52,
    erklaerung:
      'Der Anteil fester Blutzellen am Blutvolumen — vereinfacht: wie dickflüssig das Blut ist. Stark erhöhte Werte belasten Herz und Kreislauf.',
  },
  {
    name: 'Erythrozyten',
    synonyme: ['Rote Blutkörperchen', 'RBC', 'Ery'],
    kategorie: 'Blutbild',
    einheit: 'Mio/µL',
    refMin: 4.5,
    refMax: 5.9,
    erklaerung: 'Die Anzahl roter Blutkörperchen, die den Sauerstoff durch den Körper transportieren.',
  },
  {
    name: 'Leukozyten',
    synonyme: ['Weiße Blutkörperchen', 'WBC', 'Leuko'],
    kategorie: 'Blutbild',
    einheit: '/nL',
    refMin: 4.0,
    refMax: 10.0,
    erklaerung:
      'Die weißen Blutkörperchen der Immunabwehr. Erhöhte Werte treten typischerweise bei Infektionen auf.',
  },
  {
    name: 'Thrombozyten',
    synonyme: ['Blutplättchen', 'PLT', 'Thrombo'],
    kategorie: 'Blutbild',
    einheit: '/nL',
    refMin: 150,
    refMax: 400,
    erklaerung: 'Die Blutplättchen sorgen für die Blutgerinnung und das Verschließen von Wunden.',
  },
  {
    name: 'MCV',
    synonyme: ['Mittleres korpuskuläres Volumen'],
    kategorie: 'Blutbild',
    einheit: 'fL',
    refMin: 80,
    refMax: 96,
    erklaerung:
      'Die durchschnittliche Größe der roten Blutkörperchen. Sie hilft, die Ursache einer Blutarmut einzugrenzen.',
  },
  {
    name: 'MCH',
    synonyme: ['Mittlerer korpuskulärer Hämoglobingehalt', 'HbE'],
    kategorie: 'Blutbild',
    einheit: 'pg',
    refMin: 28,
    refMax: 33,
    erklaerung: 'Der durchschnittliche Hämoglobingehalt eines einzelnen roten Blutkörperchens.',
  },
  {
    name: 'MCHC',
    synonyme: ['Mittlere korpuskuläre Hämoglobinkonzentration'],
    kategorie: 'Blutbild',
    einheit: 'g/dL',
    refMin: 33,
    refMax: 36,
    erklaerung: 'Die Hämoglobinkonzentration in den roten Blutkörperchen.',
  },
  {
    name: 'RDW',
    synonyme: ['Erythrozytenverteilungsbreite'],
    kategorie: 'Blutbild',
    einheit: '%',
    refMin: 11.5,
    refMax: 14.5,
    erklaerung:
      'Beschreibt, wie unterschiedlich groß die roten Blutkörperchen sind. Erhöhte Werte können ein früher Hinweis auf einen Nährstoffmangel sein.',
  },

  // ---------- Leber ----------
  {
    name: 'GOT (AST)',
    synonyme: ['GOT', 'AST', 'ASAT', 'Aspartat-Aminotransferase'],
    kategorie: 'Leber',
    einheit: 'U/L',
    refMax: 50,
    lowerIsBetter: true,
    erklaerung:
      'Ein Leberenzym, das auch in Muskeln vorkommt. Nach hartem Training kann es erhöht sein, ohne dass die Leber betroffen ist.',
  },
  {
    name: 'GPT (ALT)',
    synonyme: ['GPT', 'ALT', 'ALAT', 'Alanin-Aminotransferase'],
    kategorie: 'Leber',
    einheit: 'U/L',
    refMax: 50,
    lowerIsBetter: true,
    erklaerung:
      'Das leberspezifischste der Standard-Leberenzyme. Erhöhte Werte deuten auf eine Belastung oder Schädigung der Leberzellen hin.',
  },
  {
    name: 'Gamma-GT',
    synonyme: ['GGT', 'γ-GT', 'Gamma-Glutamyltransferase'],
    kategorie: 'Leber',
    einheit: 'U/L',
    refMax: 60,
    lowerIsBetter: true,
    erklaerung:
      'Ein Leberenzym, das empfindlich auf Alkohol, Medikamente und Gallenstau reagiert. Es gilt als sensibler Frühindikator für Leberbelastung.',
  },
  {
    name: 'Alkalische Phosphatase',
    synonyme: ['AP', 'ALP'],
    kategorie: 'Leber',
    einheit: 'U/L',
    refMin: 40,
    refMax: 130,
    erklaerung: 'Ein Enzym aus Leber, Gallenwegen und Knochen. Erhöhungen können aus beiden Bereichen stammen.',
  },
  {
    name: 'Bilirubin gesamt',
    synonyme: ['Bilirubin', 'Gesamtbilirubin'],
    kategorie: 'Leber',
    einheit: 'mg/dL',
    refMax: 1.2,
    lowerIsBetter: true,
    erklaerung:
      'Ein Abbauprodukt des roten Blutfarbstoffs, das die Leber ausscheidet. Stark erhöhte Werte machen sich als Gelbfärbung bemerkbar.',
  },
  {
    name: 'Albumin',
    synonyme: [],
    kategorie: 'Leber',
    einheit: 'g/dL',
    refMin: 3.5,
    refMax: 5.2,
    erklaerung:
      'Das wichtigste Transportprotein im Blut, das die Leber herstellt. Es zeigt die Syntheseleistung der Leber und den Ernährungszustand.',
  },

  // ---------- Niere ----------
  {
    name: 'Kreatinin',
    synonyme: ['Creatinin'],
    kategorie: 'Niere',
    einheit: 'mg/dL',
    refMin: 0.7,
    refMax: 1.3,
    erklaerung:
      'Ein Abbauprodukt aus dem Muskelstoffwechsel, das die Nieren ausscheiden. Bei viel Muskelmasse oder Kreatin-Einnahme ist der Wert auch ohne Nierenproblem erhöht.',
  },
  {
    name: 'eGFR',
    synonyme: ['GFR', 'Glomeruläre Filtrationsrate'],
    kategorie: 'Niere',
    einheit: 'mL/min/1.73m²',
    // Unter 60 gilt die Nierenfunktion als eingeschraenkt; 60–90 ist im Alter
    // haeufig normal (mit 70 Jahren etwa 75).
    refMin: 60,
    erklaerung:
      'Ein aus dem Kreatinin berechneter Schätzwert für die Filterleistung der Nieren. Je höher, desto besser.',
  },
  // BUN ist bewusst kein Synonym: Es misst nur den Stickstoffanteil (~Faktor 2,14)
  // und würde gegen den Harnstoff-Referenzbereich falsch bewertet.
  {
    name: 'Harnstoff',
    synonyme: ['Urea'],
    kategorie: 'Niere',
    einheit: 'mg/dL',
    refMin: 17,
    refMax: 43,
    erklaerung:
      'Ein Abbauprodukt des Eiweißstoffwechsels. Der Wert steigt bei hoher Proteinzufuhr und bei nachlassender Nierenfunktion.',
  },
  {
    name: 'Harnsäure',
    synonyme: ['Urat'],
    kategorie: 'Niere',
    einheit: 'mg/dL',
    refMax: 7.0,
    lowerIsBetter: true,
    erklaerung:
      'Ein Abbauprodukt, das bei stark erhöhten Werten in Gelenken auskristallisieren und Gicht auslösen kann.',
  },
  {
    name: 'Cystatin C',
    synonyme: [],
    kategorie: 'Niere',
    einheit: 'mg/L',
    refMin: 0.5,
    refMax: 1.0,
    erklaerung:
      'Ein Nierenwert, der anders als Kreatinin nicht von der Muskelmasse abhängt — deshalb bei Sportlern aussagekräftiger.',
  },

  // ---------- Lipide ----------
  {
    name: 'Cholesterin gesamt',
    synonyme: ['Gesamtcholesterin', 'Cholesterin'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 200,
    lowerIsBetter: true,
    erklaerung:
      'Das gesamte Cholesterin im Blut. Für die Risikobeurteilung ist die Aufteilung in LDL und HDL aussagekräftiger als der Gesamtwert.',
  },
  {
    name: 'LDL-Cholesterin',
    synonyme: ['LDL', 'LDL-C'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 130,
    lowerIsBetter: true,
    erklaerung:
      'Das „schlechte" Cholesterin, das sich in Gefäßwänden ablagern kann. Ein hoher Wert gilt als Risikofaktor für Herz-Kreislauf-Erkrankungen.',
  },
  {
    name: 'HDL-Cholesterin',
    synonyme: ['HDL', 'HDL-C'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMin: 40,
    erklaerung:
      'Das „gute" Cholesterin, das überschüssiges Cholesterin zurück zur Leber transportiert. Hier sind höhere Werte günstiger.',
  },
  {
    name: 'Triglyceride',
    synonyme: ['Triglyzeride'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 150,
    lowerIsBetter: true,
    erklaerung:
      'Blutfette, die stark auf Ernährung und Alkohol reagieren. Für eine verlässliche Messung sollte man nüchtern sein.',
  },
  {
    name: 'Lipoprotein (a)',
    synonyme: ['Lp(a)', 'Lipoprotein a'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 30,
    lowerIsBetter: true,
    erklaerung:
      'Ein weitgehend genetisch festgelegter Risikofaktor für Herz-Kreislauf-Erkrankungen. Der Wert ändert sich im Leben kaum, eine einmalige Messung genügt meist.',
  },
  {
    name: 'ApoB',
    synonyme: ['Apolipoprotein B'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 100,
    lowerIsBetter: true,
    erklaerung:
      'Zählt die Anzahl potenziell gefäßschädigender Partikel und gilt vielen als präziserer Risikomarker als LDL allein.',
  },

  // ---------- Entzündung ----------
  {
    name: 'CRP',
    synonyme: ['C-reaktives Protein', 'hs-CRP', 'CRP hochsensitiv'],
    kategorie: 'Entzündung',
    einheit: 'mg/L',
    // Standard-CRP: bis 5 mg/L unauffaellig. Der hochsensitive Test (hs-CRP)
    // bewertet kleinere Werte anders — dann gilt der Laborbereich aus dem Befund.
    refMax: 5,
    lowerIsBetter: true,
    erklaerung:
      'Der wichtigste Entzündungsmarker. Er steigt bei akuten Infekten stark an; leicht erhöhte Dauerwerte deuten auf stille Entzündungsprozesse hin.',
  },
  {
    name: 'BSG',
    synonyme: ['Blutsenkung', 'Blutsenkungsgeschwindigkeit', 'ESR'],
    kategorie: 'Entzündung',
    einheit: 'mm/h',
    refMax: 15,
    lowerIsBetter: true,
    erklaerung:
      'Ein älterer, unspezifischer Entzündungsmarker. Er reagiert träger als CRP und wird meist ergänzend betrachtet.',
  },
  {
    name: 'Homocystein',
    synonyme: [],
    kategorie: 'Entzündung',
    einheit: 'µmol/L',
    refMax: 12,
    lowerIsBetter: true,
    erklaerung:
      'Eine Aminosäure, die bei Mangel an B-Vitaminen ansteigt. Erhöhte Werte gelten als Risikofaktor für Gefäßerkrankungen.',
  },

  // ---------- Vitamine & Mineralstoffe ----------
  {
    name: 'Vitamin D',
    synonyme: ['25-OH-Vitamin D', 'Vitamin D3', '25-OH-D', 'Calcidiol'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'ng/mL',
    refMin: 40,
    refMax: 80,
    erklaerung:
      'Wichtig für Knochen, Immunsystem und Hormonhaushalt. In unseren Breiten ist der Wert im Winter häufig zu niedrig, da die Bildung Sonnenlicht braucht.',
  },
  {
    name: 'Vitamin B12',
    synonyme: ['B12', 'Cobalamin'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'pg/mL',
    refMin: 300,
    refMax: 900,
    erklaerung:
      'Notwendig für Blutbildung und Nervensystem. Ein Mangel entwickelt sich schleichend und betrifft besonders Menschen mit rein pflanzlicher Ernährung.',
  },
  {
    name: 'Holo-Transcobalamin',
    synonyme: ['Holo-TC', 'Aktives B12'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'pmol/L',
    refMin: 50,
    erklaerung:
      'Der tatsächlich verwertbare Anteil von Vitamin B12. Er zeigt einen Mangel früher an als der Gesamt-B12-Wert.',
  },
  {
    name: 'Folsäure',
    synonyme: ['Folat', 'Vitamin B9'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'ng/mL',
    refMin: 4.6,
    refMax: 18.7,
    erklaerung: 'Wichtig für Zellteilung und Blutbildung und eng mit dem Vitamin-B12-Stoffwechsel verknüpft.',
  },
  {
    name: 'Ferritin',
    synonyme: [],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'ng/mL',
    refMin: 30,
    refMax: 300,
    erklaerung:
      'Der Eisenspeicher des Körpers und der beste Einzelwert für den Eisenstatus. Achtung: Bei Entzündungen steigt Ferritin an und kann einen Mangel verschleiern.',
  },
  {
    name: 'Eisen',
    synonyme: ['Serumeisen'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'µg/dL',
    refMin: 60,
    refMax: 170,
    erklaerung:
      'Das aktuell im Blut zirkulierende Eisen. Der Wert schwankt im Tagesverlauf stark — Ferritin ist aussagekräftiger.',
  },
  {
    name: 'Transferrinsättigung',
    synonyme: ['TSAT', 'Transferrin-Sättigung'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: '%',
    // IQWiG (gesundheitsinformation.de): 16–45 % für Frauen und Männer.
    refMin: 16,
    refMax: 45,
    erklaerung: 'Zeigt, wie gut das Eisentransportprotein beladen ist, und ergänzt die Beurteilung des Eisenstatus.',
  },
  {
    name: 'Magnesium',
    synonyme: [],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mg/dL',
    refMin: 1.7,
    refMax: 2.4,
    erklaerung:
      'Beteiligt an Muskel- und Nervenfunktion. Da der Großteil in den Zellen sitzt, kann der Blutwert trotz Mangel normal aussehen.',
  },
  {
    name: 'Kalium',
    synonyme: ['K'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mmol/L',
    refMin: 3.5,
    refMax: 5.1,
    erklaerung:
      'Ein Elektrolyt, das für Herzrhythmus und Muskelarbeit entscheidend ist. Sowohl zu hohe als auch zu niedrige Werte sind relevant.',
  },
  {
    name: 'Natrium',
    synonyme: ['Na'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mmol/L',
    refMin: 135,
    refMax: 145,
    erklaerung: 'Ein Elektrolyt, das den Wasserhaushalt des Körpers steuert.',
  },
  {
    name: 'Kalzium',
    synonyme: ['Calcium', 'Ca'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mg/dL',
    refMin: 8.6,
    refMax: 10.3,
    erklaerung: 'Wichtig für Knochen, Muskelkontraktion und Blutgerinnung.',
  },
  {
    name: 'Zink',
    synonyme: [],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'µg/dL',
    refMin: 70,
    refMax: 120,
    erklaerung: 'Ein Spurenelement für Immunsystem, Wundheilung und Hormonhaushalt.',
  },

  // ---------- Stoffwechsel ----------
  {
    name: 'Glukose',
    synonyme: ['Blutzucker', 'Glucose', 'Nüchternglukose'],
    kategorie: 'Stoffwechsel',
    einheit: 'mg/dL',
    refMin: 70,
    refMax: 99,
    erklaerung:
      'Der Blutzuckerwert, üblicherweise nüchtern gemessen. Dauerhaft erhöhte Werte sind ein Hinweis auf eine gestörte Zuckerverwertung.',
  },
  {
    name: 'HbA1c',
    synonyme: ['Langzeitzucker', 'Hämoglobin A1c'],
    kategorie: 'Stoffwechsel',
    einheit: '%',
    refMax: 5.7,
    lowerIsBetter: true,
    erklaerung:
      'Der „Langzeitzucker": Er bildet den durchschnittlichen Blutzucker der letzten zwei bis drei Monate ab und ist deshalb unabhängig von der letzten Mahlzeit.',
  },
  {
    name: 'Insulin',
    synonyme: ['Nüchterninsulin'],
    kategorie: 'Stoffwechsel',
    einheit: 'µIU/mL',
    refMin: 2,
    refMax: 10,
    erklaerung:
      'Das Hormon, das Zucker in die Zellen schleust. Ein hoher Nüchternwert bei normalem Blutzucker kann ein früher Hinweis auf Insulinresistenz sein.',
  },
  {
    name: 'HOMA-Index',
    synonyme: ['HOMA-IR', 'HOMA'],
    kategorie: 'Stoffwechsel',
    einheit: '',
    refMax: 2.0,
    lowerIsBetter: true,
    erklaerung:
      'Ein aus Nüchternzucker und Insulin berechneter Wert für die Insulinempfindlichkeit. Niedriger ist besser.',
  },

  // ---------- Differentialblutbild ----------
  // Diese Zellarten erscheinen im Befund doppelt: als Prozentanteil und als
  // Absolutzahl. Sie werden bewusst als getrennte Marker geführt.
  {
    name: 'Neutrophile %',
    synonyme: ['Neutrophile relativ', 'Neutrophile Granulozyten %', 'Segmentkernige %', 'Neutro %'],
    kategorie: 'Blutbild',
    einheit: '%',
    refMin: 40,
    refMax: 75,
    erklaerung:
      'Der prozentuale Anteil der neutrophilen Granulozyten an den weißen Blutkörperchen. Sie sind die vorderste Abwehr gegen bakterielle Infektionen.',
  },
  {
    name: 'Neutrophile absolut',
    synonyme: ['Neutrophile Granulozyten absolut', 'Neutrophile abs', 'Segmentkernige absolut', 'Neutro abs'],
    kategorie: 'Blutbild',
    einheit: '/nL',
    refMin: 1.8,
    refMax: 7.7,
    erklaerung:
      'Die absolute Anzahl neutrophiler Granulozyten. Sehr niedrige Werte schwächen die Abwehr gegen bakterielle Infektionen.',
  },
  {
    name: 'Lymphozyten %',
    synonyme: ['Lymphozyten relativ', 'Lympho %'],
    kategorie: 'Blutbild',
    einheit: '%',
    refMin: 20,
    refMax: 45,
    erklaerung:
      'Der prozentuale Anteil der Lymphozyten an den weißen Blutkörperchen. Sie steuern die gezielte Immunabwehr gegen Viren und die Bildung von Antikörpern.',
  },
  {
    name: 'Lymphozyten absolut',
    synonyme: ['Lymphozyten abs', 'Lympho abs'],
    kategorie: 'Blutbild',
    einheit: '/nL',
    refMin: 1.0,
    refMax: 4.0,
    erklaerung: 'Die absolute Anzahl der Lymphozyten, der Träger der gezielten Immunabwehr.',
  },
  {
    name: 'Monozyten %',
    synonyme: ['Monozyten relativ', 'Mono %'],
    kategorie: 'Blutbild',
    einheit: '%',
    refMin: 2,
    refMax: 10,
    erklaerung:
      'Der prozentuale Anteil der Monozyten. Sie beseitigen Krankheitserreger und Zelltrümmer und sind Teil der Immunabwehr.',
  },
  {
    name: 'Monozyten absolut',
    synonyme: ['Monozyten abs', 'Mono abs'],
    kategorie: 'Blutbild',
    einheit: '/nL',
    refMin: 0.2,
    refMax: 0.8,
    erklaerung: 'Die absolute Anzahl der Monozyten, die Krankheitserreger und Zelltrümmer aufnehmen.',
  },
  {
    name: 'Eosinophile %',
    synonyme: ['Eosinophile relativ', 'Eosinophile Granulozyten %', 'Eos %'],
    kategorie: 'Blutbild',
    einheit: '%',
    refMax: 6,
    lowerIsBetter: true,
    erklaerung:
      'Der prozentuale Anteil der eosinophilen Granulozyten. Erhöhte Werte treten häufig bei Allergien und Parasitenbefall auf.',
  },
  {
    name: 'Eosinophile absolut',
    synonyme: ['Eosinophile Granulozyten absolut', 'Eosinophile abs', 'Eos abs'],
    kategorie: 'Blutbild',
    einheit: '/nL',
    refMax: 0.5,
    lowerIsBetter: true,
    erklaerung:
      'Die absolute Anzahl eosinophiler Granulozyten. Erhöhte Werte weisen oft auf Allergien oder Parasiten hin.',
  },
  {
    name: 'Basophile %',
    synonyme: ['Basophile relativ', 'Basophile Granulozyten %', 'Baso %'],
    kategorie: 'Blutbild',
    einheit: '%',
    refMax: 2,
    lowerIsBetter: true,
    erklaerung:
      'Der prozentuale Anteil der basophilen Granulozyten, der seltensten weißen Blutkörperchen. Sie sind an allergischen Reaktionen beteiligt.',
  },
  {
    name: 'Basophile absolut',
    synonyme: ['Basophile Granulozyten absolut', 'Basophile abs', 'Baso abs'],
    kategorie: 'Blutbild',
    einheit: '/nL',
    refMax: 0.2,
    lowerIsBetter: true,
    erklaerung: 'Die absolute Anzahl der basophilen Granulozyten, die an allergischen Reaktionen beteiligt sind.',
  },

  // ---------- Enzyme ----------
  {
    name: 'LDH',
    synonyme: ['Laktatdehydrogenase', 'Lactatdehydrogenase'],
    kategorie: 'Enzyme',
    einheit: 'U/L',
    refMax: 250,
    lowerIsBetter: true,
    erklaerung:
      'Ein Enzym, das in fast allen Körperzellen vorkommt. Erhöhte Werte sind ein unspezifischer Hinweis auf Zellschäden, etwa in Muskel, Leber oder Blut.',
  },
  {
    name: 'Kreatinkinase',
    synonyme: ['CK', 'CK gesamt', 'Creatinkinase', 'CPK'],
    kategorie: 'Enzyme',
    einheit: 'U/L',
    refMax: 190,
    lowerIsBetter: true,
    erklaerung:
      'Ein Muskelenzym. Nach intensivem Training ist es oft deutlich erhöht, ohne dass eine Erkrankung vorliegt — der Zeitpunkt der Messung ist wichtig.',
  },
  {
    name: 'Amylase',
    synonyme: ['Alpha-Amylase', 'α-Amylase', 'Pankreas-Amylase'],
    kategorie: 'Enzyme',
    einheit: 'U/L',
    refMax: 100,
    lowerIsBetter: true,
    erklaerung:
      'Ein Verdauungsenzym aus Bauchspeicheldrüse und Speicheldrüsen. Stark erhöhte Werte können auf eine Entzündung der Bauchspeicheldrüse hindeuten.',
  },
  {
    name: 'Lipase',
    synonyme: [],
    kategorie: 'Enzyme',
    einheit: 'U/L',
    refMax: 60,
    lowerIsBetter: true,
    erklaerung:
      'Ein fettspaltendes Enzym der Bauchspeicheldrüse. Es ist der spezifischste Wert für eine Entzündung der Bauchspeicheldrüse.',
  },

  // ---------- Weitere Elektrolyte & Eiweiß ----------
  {
    name: 'Chlorid',
    synonyme: ['Chlor'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mmol/L',
    refMin: 98,
    refMax: 107,
    erklaerung: 'Ein Elektrolyt, das gemeinsam mit Natrium den Wasser- und Säure-Basen-Haushalt reguliert.',
  },
  {
    name: 'Phosphat',
    synonyme: ['Anorganisches Phosphat', 'Phosphat anorganisch', 'Phosphor'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mmol/L',
    refMin: 0.81,
    refMax: 1.45,
    erklaerung:
      'Wichtig für Knochen, Energiestoffwechsel und Zellfunktion. Der Wert wird eng mit Kalzium und der Nierenfunktion reguliert.',
  },
  {
    name: 'Gesamteiweiß',
    synonyme: ['Gesamtprotein', 'Eiweiß gesamt', 'Serumeiweiß', 'Protein gesamt'],
    kategorie: 'Leber',
    einheit: 'g/dL',
    refMin: 6.4,
    refMax: 8.3,
    erklaerung:
      'Die Gesamtmenge an Eiweiß im Blut, überwiegend Albumin und Antikörper. Sie spiegelt Ernährungszustand, Leber- und Nierenfunktion wider.',
  },
]

const LOOKUP: Map<string, MarkerDef> = new Map()
MARKER_CATALOG.forEach(def => {
  LOOKUP.set(def.name.toLowerCase(), def)
  def.synonyme.forEach(syn => LOOKUP.set(syn.toLowerCase(), def))
})

/** Kanonische Markernamen — u.a. für den Extraktions-Prompt. */
export const CATALOG_MARKER_NAMES: string[] = MARKER_CATALOG.map(def => def.name)

/**
 * Ordnet einen Rohnamen (z.B. von einem Laborbefund) einem Katalog-Marker zu.
 * Gibt null zurück, wenn der Marker nicht im Katalog steht (Custom-Marker).
 */
export function normalizeMarker(raw: string): MarkerDef | null {
  const key = raw.trim().toLowerCase()
  if (!key) return null
  return LOOKUP.get(key) ?? null
}
