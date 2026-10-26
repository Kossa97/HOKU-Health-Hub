import { normalizeMarker, type KategorieFilter, type MarkerDef } from './markerCatalog'
import { aktiveSprache, istDeutsch } from './sprache'

/**
 * Englische Anzeige des Markerkatalogs.
 *
 * Die deutschen Namen in `markerCatalog.ts` sind zugleich die Schluessel in
 * der Datenbank (`bloodwork.marker`) und bleiben unveraendert — Englisch ist
 * nur eine Schicht fuer die Anzeige. Ein Test sorgt dafuer, dass jeder
 * Katalogmarker hier steht. Andere Sprachen sehen Englisch (Start nur
 * Deutsch und Englisch, siehe CLAUDE.md).
 */

export const MARKER_EN: Record<string, { name: string; erklaerung: string }> = {
  'Testosteron': { name: 'Testosterone', erklaerung: 'The most important male sex hormone. It affects muscle growth, bone density, libido and mood. Low levels can show up as lack of drive and muscle loss.' },
  'Freies Testosteron': { name: 'Free testosterone', erklaerung: 'The share of testosterone that is not bound to transport proteins and therefore directly active. More meaningful than the total value when SHBG is abnormal.' },
  'Östradiol': { name: 'Estradiol', erklaerung: 'The most important estrogen, which men also make from testosterone. High levels can promote water retention and breast tissue growth; low levels harm joints and libido.' },
  'SHBG': { name: 'SHBG', erklaerung: 'A transport protein that binds sex hormones in the blood. The higher SHBG, the less testosterone is freely available — the total value alone then says little.' },
  'LH': { name: 'LH', erklaerung: 'A control hormone from the pituitary gland that stimulates the body’s own testosterone production. Low LH with low testosterone points to a problem with this control.' },
  'FSH': { name: 'FSH', erklaerung: 'A control hormone from the pituitary gland that stimulates sperm production in men and egg maturation in women.' },
  'Prolaktin': { name: 'Prolactin', erklaerung: 'A hormone from the pituitary gland. Persistently high levels can dampen libido and testosterone production and should be checked by a doctor.' },
  'IGF-1': { name: 'IGF-1', erklaerung: 'A growth factor made mainly in the liver in response to growth hormone. It is considered a stable indicator of growth hormone activity because it barely changes over the day.' },
  'GH': { name: 'GH (growth hormone)', erklaerung: 'Growth hormone itself. Its level fluctuates strongly over the day, so a single measurement says little — IGF-1 is the more reliable indicator.' },
  'Kortisol': { name: 'Cortisol', erklaerung: 'The central stress hormone. It is highest in the morning, so the time of the blood draw is decisive for interpreting it.' },
  'DHEA-S': { name: 'DHEA-S', erklaerung: 'A precursor of testosterone and estrogen from the adrenal glands. It naturally declines with age.' },
  'Progesteron': { name: 'Progesterone', erklaerung: 'A sex hormone that regulates the menstrual cycle in women. In men it is normally very low.' },
  'TSH': { name: 'TSH', erklaerung: 'The thyroid’s control hormone and the most important screening test. A high value points more to an underactive thyroid, a low value to an overactive one — it moves opposite to the thyroid hormones.' },
  'fT3': { name: 'fT3', erklaerung: 'The active thyroid hormone that controls how much energy cells use. It affects metabolic rate, body temperature and drive.' },
  'fT4': { name: 'fT4', erklaerung: 'The storage form of thyroid hormone, which the body converts into active fT3 as needed.' },
  'Hämoglobin': { name: 'Hemoglobin', erklaerung: 'The red blood pigment that carries oxygen in the blood. Low values mean anemia; high values make the blood thicker.' },
  'Hämatokrit': { name: 'Hematocrit', erklaerung: 'The share of blood cells in the blood volume — simply put, how thick the blood is. Strongly raised values put strain on the heart and circulation.' },
  'Erythrozyten': { name: 'Red blood cells', erklaerung: 'The number of red blood cells, which carry oxygen through the body.' },
  'Leukozyten': { name: 'White blood cells', erklaerung: 'The white blood cells of the immune system. Raised values typically occur with infections.' },
  'Thrombozyten': { name: 'Platelets', erklaerung: 'Platelets take care of blood clotting and closing wounds.' },
  'MCV': { name: 'MCV', erklaerung: 'The average size of the red blood cells. It helps narrow down the cause of anemia.' },
  'MCH': { name: 'MCH', erklaerung: 'The average amount of hemoglobin in a single red blood cell.' },
  'MCHC': { name: 'MCHC', erklaerung: 'The hemoglobin concentration in the red blood cells.' },
  'RDW': { name: 'RDW', erklaerung: 'Describes how much the size of red blood cells varies. Raised values can be an early sign of a nutrient deficiency.' },
  'GOT (AST)': { name: 'AST (GOT)', erklaerung: 'A liver enzyme that is also found in muscle. It can be raised after hard training without the liver being affected.' },
  'GPT (ALT)': { name: 'ALT (GPT)', erklaerung: 'The most liver-specific of the standard liver enzymes. Raised values point to strain on or damage to liver cells.' },
  'Gamma-GT': { name: 'Gamma-GT (GGT)', erklaerung: 'A liver enzyme that reacts sensitively to alcohol, medication and bile congestion. It is considered a sensitive early indicator of liver strain.' },
  'Alkalische Phosphatase': { name: 'Alkaline phosphatase', erklaerung: 'An enzyme from the liver, bile ducts and bones. Increases can come from either area.' },
  'Bilirubin gesamt': { name: 'Total bilirubin', erklaerung: 'A breakdown product of the red blood pigment that the liver excretes. Strongly raised values show up as yellowing of the skin.' },
  'Albumin': { name: 'Albumin', erklaerung: 'The most important transport protein in the blood, made by the liver. It reflects the liver’s production capacity and nutritional status.' },
  'Kreatinin': { name: 'Creatinine', erklaerung: 'A breakdown product of muscle metabolism that the kidneys excrete. With a lot of muscle mass or creatine intake it is raised even without a kidney problem.' },
  'eGFR': { name: 'eGFR', erklaerung: 'An estimate of the kidneys’ filtering capacity calculated from creatinine. The higher, the better.' },
  'Harnstoff': { name: 'Urea', erklaerung: 'A breakdown product of protein metabolism. It rises with high protein intake and with declining kidney function.' },
  'Harnsäure': { name: 'Uric acid', erklaerung: 'A breakdown product that can crystallize in joints at strongly raised levels and trigger gout.' },
  'Cystatin C': { name: 'Cystatin C', erklaerung: 'A kidney marker that, unlike creatinine, does not depend on muscle mass — which makes it more meaningful for athletes.' },
  'Cholesterin gesamt': { name: 'Total cholesterol', erklaerung: 'All cholesterol in the blood. For assessing risk, the split into LDL and HDL says more than the total.' },
  'LDL-Cholesterin': { name: 'LDL cholesterol', erklaerung: 'The “bad” cholesterol, which can be deposited in vessel walls. A high value is considered a risk factor for cardiovascular disease.' },
  'HDL-Cholesterin': { name: 'HDL cholesterol', erklaerung: 'The “good” cholesterol, which carries excess cholesterol back to the liver. Here, higher values are better.' },
  'Triglyceride': { name: 'Triglycerides', erklaerung: 'Blood fats that react strongly to diet and alcohol. For a reliable measurement you should be fasting.' },
  'Lipoprotein (a)': { name: 'Lipoprotein(a)', erklaerung: 'A largely genetically determined risk factor for cardiovascular disease. It barely changes over a lifetime, so one measurement is usually enough.' },
  'ApoB': { name: 'ApoB', erklaerung: 'Counts the number of particles that can damage blood vessels and is considered by many a more precise risk marker than LDL alone.' },
  'CRP': { name: 'CRP', erklaerung: 'The most important inflammation marker. It rises sharply with acute infections; slightly raised long-term values point to silent inflammation.' },
  'BSG': { name: 'ESR', erklaerung: 'An older, non-specific inflammation marker. It reacts more slowly than CRP and is usually looked at in addition.' },
  'Homocystein': { name: 'Homocysteine', erklaerung: 'An amino acid that rises with a lack of B vitamins. Raised values are considered a risk factor for vascular disease.' },
  'Vitamin D': { name: 'Vitamin D', erklaerung: 'Important for bones, the immune system and hormones. In northern latitudes it is often too low in winter, because the body needs sunlight to make it.' },
  'Vitamin B12': { name: 'Vitamin B12', erklaerung: 'Needed for blood formation and the nervous system. A deficiency develops gradually and particularly affects people on a purely plant-based diet.' },
  'Holo-Transcobalamin': { name: 'Holotranscobalamin', erklaerung: 'The part of vitamin B12 the body can actually use. It shows a deficiency earlier than total B12.' },
  'Folsäure': { name: 'Folate', erklaerung: 'Important for cell division and blood formation and closely linked to vitamin B12 metabolism.' },
  'Ferritin': { name: 'Ferritin', erklaerung: 'The body’s iron store and the best single value for iron status. Note: ferritin rises with inflammation and can mask a deficiency.' },
  'Eisen': { name: 'Iron', erklaerung: 'The iron currently circulating in the blood. It fluctuates strongly over the day — ferritin is more meaningful.' },
  'Transferrinsättigung': { name: 'Transferrin saturation', erklaerung: 'Shows how well the iron transport protein is loaded and complements the assessment of iron status.' },
  'Magnesium': { name: 'Magnesium', erklaerung: 'Involved in muscle and nerve function. Since most of it sits inside cells, the blood value can look normal despite a deficiency.' },
  'Kalium': { name: 'Potassium', erklaerung: 'An electrolyte that is decisive for heart rhythm and muscle work. Both high and low values matter.' },
  'Natrium': { name: 'Sodium', erklaerung: 'An electrolyte that controls the body’s water balance.' },
  'Kalzium': { name: 'Calcium', erklaerung: 'Important for bones, muscle contraction and blood clotting.' },
  'Zink': { name: 'Zinc', erklaerung: 'A trace element for the immune system, wound healing and hormones.' },
  'Glukose': { name: 'Glucose', erklaerung: 'Blood sugar, usually measured fasting. Persistently raised values point to impaired sugar metabolism.' },
  'HbA1c': { name: 'HbA1c', erklaerung: '“Long-term blood sugar”: it reflects the average blood sugar of the last two to three months and is therefore independent of the last meal.' },
  'Insulin': { name: 'Insulin', erklaerung: 'The hormone that moves sugar into the cells. A high fasting value with normal blood sugar can be an early sign of insulin resistance.' },
  'HOMA-Index': { name: 'HOMA-IR', erklaerung: 'A value for insulin sensitivity calculated from fasting glucose and insulin. Lower is better.' },
  'Neutrophile %': { name: 'Neutrophils %', erklaerung: 'The percentage of neutrophil granulocytes among the white blood cells. They are the front line against bacterial infections.' },
  'Neutrophile absolut': { name: 'Neutrophils (absolute)', erklaerung: 'The absolute number of neutrophil granulocytes. Very low values weaken the defence against bacterial infections.' },
  'Lymphozyten %': { name: 'Lymphocytes %', erklaerung: 'The percentage of lymphocytes among the white blood cells. They direct the targeted immune response against viruses and the production of antibodies.' },
  'Lymphozyten absolut': { name: 'Lymphocytes (absolute)', erklaerung: 'The absolute number of lymphocytes, the carriers of the targeted immune response.' },
  'Monozyten %': { name: 'Monocytes %', erklaerung: 'The percentage of monocytes. They clear away pathogens and cell debris and are part of the immune defence.' },
  'Monozyten absolut': { name: 'Monocytes (absolute)', erklaerung: 'The absolute number of monocytes, which take up pathogens and cell debris.' },
  'Eosinophile %': { name: 'Eosinophils %', erklaerung: 'The percentage of eosinophil granulocytes. Raised values often occur with allergies and parasites.' },
  'Eosinophile absolut': { name: 'Eosinophils (absolute)', erklaerung: 'The absolute number of eosinophil granulocytes. Raised values often point to allergies or parasites.' },
  'Basophile %': { name: 'Basophils %', erklaerung: 'The percentage of basophil granulocytes, the rarest white blood cells. They are involved in allergic reactions.' },
  'Basophile absolut': { name: 'Basophils (absolute)', erklaerung: 'The absolute number of basophil granulocytes, which are involved in allergic reactions.' },
  'LDH': { name: 'LDH', erklaerung: 'An enzyme found in almost all body cells. Raised values are a non-specific sign of cell damage, for example in muscle, liver or blood.' },
  'Kreatinkinase': { name: 'Creatine kinase (CK)', erklaerung: 'A muscle enzyme. After intense training it is often clearly raised without any disease — the timing of the measurement matters.' },
  'Amylase': { name: 'Amylase', erklaerung: 'A digestive enzyme from the pancreas and salivary glands. Strongly raised values can point to inflammation of the pancreas.' },
  'Lipase': { name: 'Lipase', erklaerung: 'A fat-splitting enzyme of the pancreas. It is the most specific value for inflammation of the pancreas.' },
  'Chlorid': { name: 'Chloride', erklaerung: 'An electrolyte that, together with sodium, regulates water and acid-base balance.' },
  'Phosphat': { name: 'Phosphate', erklaerung: 'Important for bones, energy metabolism and cell function. It is regulated closely together with calcium and kidney function.' },
  'Gesamteiweiß': { name: 'Total protein', erklaerung: 'The total amount of protein in the blood, mostly albumin and antibodies. It reflects nutritional status and liver and kidney function.' },
}

/** Uebersetzungsschluessel je Kategorie (de/en in den Locale-Dateien). */
export const KATEGORIE_KEY: Record<KategorieFilter, string> = {
  'Hormone': 'bw_cat_hormones',
  'Schilddrüse': 'bw_cat_thyroid',
  'Blutbild': 'bw_cat_blood_count',
  'Leber': 'bw_cat_liver',
  'Enzyme': 'bw_cat_enzymes',
  'Niere': 'bw_cat_kidneys',
  'Lipide': 'bw_cat_lipids',
  'Entzündung': 'bw_cat_inflammation',
  'Vitamine & Mineralstoffe': 'bw_cat_vitamins',
  'Stoffwechsel': 'bw_cat_metabolism',
  'Sonstige': 'bw_cat_other',
}

/**
 * Anzeigename eines Markers. Auf Deutsch bleibt der gespeicherte Name, wie er
 * ist; sonst wird er ueber den Katalog (auch Synonyme wie „Testosteron
 * gesamt") aufgeloest. Unbekannte Marker aus Befunden bleiben, wie sie sind.
 */
export function markerName(name: string, sprache: string = aktiveSprache()): string {
  if (istDeutsch(sprache)) return name
  const def = normalizeMarker(name)
  return (def && MARKER_EN[def.name]?.name) ?? name
}

/** Erklaerung eines Katalogmarkers in der Anzeigesprache. */
export function markerErklaerung(def: MarkerDef, sprache: string = aktiveSprache()): string {
  if (istDeutsch(sprache)) return def.erklaerung
  return MARKER_EN[def.name]?.erklaerung ?? def.erklaerung
}
