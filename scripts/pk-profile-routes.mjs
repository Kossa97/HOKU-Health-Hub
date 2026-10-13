/**
 * Fuer welche Route die Zahlen eines PK-Profils gelten — die Quelle, aus der
 * `supabase-pk-profile-routes.sql` erzeugt wird (`npm run pk:routes-sql`).
 *
 * WOZU
 * Ein Profil beschreibt die Kinetik EINER Gabe: subkutan gespritztes
 * Semaglutid verlaeuft anders als die Tablette. Passt die Route im
 * Einnahmeplan zu einer der hier genannten, verknuepft die App das Profil
 * ohne Rueckfrage. Passt sie nicht, sagt sie das, statt eine falsche Kurve zu
 * zeigen. Eine leere Liste heisst: unklar — dann bestaetigt der Nutzer selbst.
 *
 * WOHER
 * Aus den Notizen der Profile (`scripts/seed-pk-profiles.ts`,
 * `scripts/pk-profile-source.mjs`). Wo eine Notiz keine Route nennt, gilt die
 * Konvention des Seeds: bioavailability_sc = 1.0 heisst injiziert, also
 * subkutan. Die Werte sind die gespeicherten Woerter aus
 * `src/lib/intakeMethods.ts`.
 *
 * Jedes Profil steht hier genau einmal — der Vertragstest prueft das.
 */

/**
 * Die bekannten Routen — wie `INTAKE_METHODS` in src/lib/intakeMethods.ts;
 * der Vertragstest prueft, dass beide gleich bleiben. Daraus entsteht die
 * Pruefung `pk_profiles_routes_known` in der Datenbank. Sie wird nur einmal
 * angelegt: eine neue Route braucht eine eigene Migration, die sie ersetzt.
 */
export const ROUTEN = ['Subkutan', 'Intramuskulär', 'Nasal', 'Oral', 'Transdermal', 'Intravenös', 'Andere']

const SC = ['Subkutan']
const ORAL = ['Oral']

/** @type {Record<string, string[]>} */
export const PK_ROUTEN = {
  // ── GLP-1 ──────────────────────────────────────────────────────────────
  'Semaglutide': SC,
  'Tirzepatide': SC,
  'Liraglutide': SC,
  'Exenatide': SC,
  'Retatrutide': SC,
  'Cagrilintide': SC,
  'Survodutide': SC,
  'Mazdutide': SC,
  'Orforglipron': ORAL,

  // ── Peptide: Notiz nennt subkutan ──────────────────────────────────────
  'GHK-Cu': SC,
  'KPV': SC,
  'Ipamorelin': SC,
  'GHRP-2': SC,
  'GHRP-6': SC,
  'Tesamorelin': SC,
  'MOTS-c': SC,
  'AOD-9604': SC,
  'Epithalon': SC,
  'SS-31': SC,
  'Humanin': SC,
  // Notiz: subkutan oder intranasal — die Werte gelten fuer subkutan.
  'PT-141': SC,

  // ── Peptide: subkutan nach der Konvention (1.0 = injiziert) ───────────
  'BPC-157': SC,
  'TB-500': SC,
  'CJC-1295 DAC': SC,
  'CJC-1295 no DAC': SC,
  'Hexarelin': SC,
  'Sermorelin': SC,
  'HGH Fragment 176-191': SC,
  'Thymosin Alpha-1': SC,
  'DSIP': SC,
  'Kisspeptin-10': SC,
  'Melanotan II': SC,

  // ── Peptide: nasal ─────────────────────────────────────────────────────
  'Semax': ['Nasal', 'Subkutan'],
  'Selank': ['Nasal', 'Subkutan'],
  'NA-Semax Amidate': ['Nasal'],

  // ── Peptide: unklar, der Nutzer bestaetigt selbst ──────────────────────
  // Werte aus Tierversuchen; die uebliche Anwendung ist oral, die
  // Peak-Skalierung aber 1.0 — beides passt nicht zusammen.
  'Dihexa': [],
  // Gemisch, die Notiz nennt keinen Weg.
  'Cerebrolysin': [],

  'MK-677': ORAL,

  // ── Hormone ────────────────────────────────────────────────────────────
  // Die Ester werden auch subkutan gespritzt; die Halbwertszeit ist praktisch
  // dieselbe, der Gipfel kommt etwas spaeter. Gel ist eine andere Arzneiform
  // ohne Depot und braucht ein eigenes Profil.
  'Testosterone Enanthate': ['Intramuskulär', 'Subkutan'],
  'Testosterone Cypionate': ['Intramuskulär', 'Subkutan'],
  'Testosterone Propionate': ['Intramuskulär', 'Subkutan'],
  'HCG': ['Subkutan', 'Intramuskulär'],
  'IGF-1 LR3': SC,
  'HGH': SC,
  'DHEA': ORAL,
  'Pregnenolon': ORAL,
  'Östradiol': ORAL,
  'Progesteron': ORAL,

  // ── Medikamente und Supplemente: alle oral ─────────────────────────────
  ...Object.fromEntries([
    'Ibuprofen', 'Paracetamol', 'Acetylsalicylsäure', 'Prednisolon', 'Pantoprazol',
    'Omeprazol', 'Atorvastatin', 'Rosuvastatin', 'Simvastatin', 'Ramipril',
    'Bisoprolol', 'Metoprolol', 'Amlodipin', 'Candesartan', 'Sertralin',
    'Escitalopram', 'Venlafaxin', 'Bupropion', 'Methylphenidat', 'Lisdexamfetamin',
    'Modafinil', 'Finasterid', 'Dutasterid', 'Anastrozol', 'Tamoxifen',
    'Enclomifen', 'Levothyroxin', 'Liothyronin', 'Tadalafil', 'Sildenafil',
    'Metformin', 'Dapagliflozin', 'Empagliflozin', 'Allopurinol', 'Cetirizin',
    'Loratadin', 'Amoxicillin', 'Naltrexon', 'Rapamycin', 'Koffein',
    'Melatonin', '5-HTP', 'L-Theanin', 'NAC', 'Coenzym Q10',
  ].map(name => [name, ORAL])),
}
