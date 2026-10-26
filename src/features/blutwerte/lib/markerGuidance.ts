/**
 * Einordnung „Zu niedrig / Im Bereich / Zu hoch" fuer einzelne Marker.
 *
 * Allgemeine Information, fuer alle Nutzer gleich — nie nach dem eigenen Wert
 * ausgewaehlt oder aufgeklappt. Keine Medikamente, keine Dosierungen, keine
 * Diagnose („kann hinweisen auf"). Jeder Abschnitt endet mit dem Weg zum Arzt.
 * Abgeglichen am 08.10.2026 mit den unten genannten Quellen; Nicht-Belegtes
 * wurde gestrichen. Nur Deutsch und Englisch.
 */
import { istDeutsch } from './sprache'
import { GUIDANCE_PAKETE } from './guidance'

export interface GuidanceItem {
  /** Fettgedruckte Ueberschrift, z. B. „Mögliche Ursachen". */
  label?: string
  text: string
}

export interface GuidanceText {
  /** Wann und wie gemessen wird — steht ueber den drei Abschnitten. */
  hinweis: string
  niedrig: GuidanceItem[]
  bereich: GuidanceItem[]
  hoch: GuidanceItem[]
}

export interface MarkerGuidance {
  de: GuidanceText
  en: GuidanceText
  quellen: Array<{ label: string; url: string }>
}

/** Monat/Jahr der letzten Quellenpruefung. */
export const GUIDANCE_STAND = '2026-10'

const U = { de: 'Mögliche Ursachen', en: 'Possible causes' }
const A = { de: 'Typische Anzeichen', en: 'Typical signs' }
const F = { de: 'Mögliche Folgen', en: 'Possible consequences' }

const GUIDANCE: Record<string, MarkerGuidance> = {
  'Testosteron': {
    de: {
      hinweis: 'Testosteron ist früh morgens am höchsten und wird daher zwischen 8 und 10 Uhr morgens bestimmt; bei Frauen möglichst 3 bis 5 Tage nach Beginn der Monatsblutung. Ob man nüchtern kommen soll, sagt die Praxis. Manchmal ist der Wert nur vorübergehend niedrig, etwa bei viel Stress oder nach längerer körperlicher Arbeit – ein einzelner Wert reicht für eine Aussage deshalb nicht.',
      niedrig: [
        { label: U.de, text: 'Der Wert sinkt mit dem Alter langsam. Außerdem starkes Übergewicht, chronische Erkrankungen (z. B. von Leber oder Niere), übermäßiger Alkoholkonsum, bestimmte Medikamente, Erkrankungen der Hoden oder der Hirnanhangdrüse. Nach dem Absetzen von zugeführtem Testosteron oder Anabolika kann die körpereigene Bildung gedrosselt sein; die Erholung kann Monate, manchmal länger dauern.' },
        { label: A.de, text: 'Nachlassende Lust auf Sex, Erektionsprobleme, gedrückte Stimmung, Schlafprobleme, weniger Muskelmasse, vergrößertes Brustgewebe. Müdigkeit und Antriebslosigkeit kommen vor, haben aber oft andere Ursachen.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Geringere Knochendichte, mehr Bauchumfang, Blutarmut.' },
        { text: 'Bei Beschwerden ärztlich abklären.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Beschwerden können trotzdem andere Ursachen haben.' }],
      hoch: [
        { label: U.de, text: 'Vor allem die Zufuhr von Testosteron oder Anabolika; selten ein Tumor im Hoden oder eine Erkrankung der Nebennieren. Bei Frauen u. a. das PCO-Syndrom.' },
        { label: A.de, text: 'Akne, Haarausfall, Reizbarkeit, Stimmungsschwankungen, Wassereinlagerungen; bei Frauen vermehrte Gesichts- und Körperbehaarung und unregelmäßige Regelblutungen.' },
        { label: 'Mögliche Folgen, vor allem bei Zufuhr', text: 'Mehr rote Blutkörperchen (höherer Hämatokrit), steigender Blutdruck, ungünstige Blutfette, kleinere Hoden und verminderte Fruchtbarkeit, Wachstum der Brustdrüse. Bei Missbrauch steigt das Risiko für Herzinfarkt, Schlaganfall, Thrombosen sowie Leber- und Nierenschäden.' },
        { text: 'Ärztlich abklären, besonders bei Zufuhr, bei Kinderwunsch oder bei Frauen mit neuen Zeichen von Vermännlichung.' },
      ],
    },
    en: {
      hinweis: 'Testosterone is highest early in the morning, so it is measured between 8 and 10 am; in women ideally 3 to 5 days after the start of the period. Your practice will tell you whether to come fasting. Sometimes the level is only temporarily low, for example with a lot of stress or after prolonged physical work – a single value is therefore not enough to draw conclusions.',
      niedrig: [
        { label: U.en, text: 'The level slowly falls with age. Also severe obesity, chronic illnesses (e.g. of the liver or kidneys), excessive alcohol, certain medicines, diseases of the testicles or the pituitary gland. After stopping supplied testosterone or anabolic steroids, the body’s own production can be suppressed; recovery can take months, sometimes longer.' },
        { label: A.en, text: 'Reduced interest in sex, erection problems, low mood, sleep problems, less muscle mass, enlarged breast tissue. Tiredness and lack of drive occur, but often have other causes.' },
        { label: 'Possible long-term consequences', text: 'Lower bone density, larger waist, anaemia.' },
        { text: 'Have it checked by a doctor if you have symptoms.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. Symptoms can still have other causes.' }],
      hoch: [
        { label: U.en, text: 'Mainly supplied testosterone or anabolic steroids; rarely a testicular tumour or a disease of the adrenal glands. In women, among others, polycystic ovary syndrome (PCOS).' },
        { label: A.en, text: 'Acne, hair loss, irritability, mood swings, fluid retention; in women increased facial and body hair and irregular periods.' },
        { label: 'Possible consequences, especially when supplied', text: 'More red blood cells (higher haematocrit), rising blood pressure, unfavourable blood lipids, smaller testicles and reduced fertility, breast growth. With misuse, the risk of heart attack, stroke, thrombosis and liver and kidney damage rises.' },
        { text: 'Have it checked by a doctor, especially when supplying testosterone, when trying for a child, or in women with new signs of masculinisation.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Testosteron', url: 'https://www.gesundheitsinformation.de/testosteron.html' },
      { label: 'MSD Manual: Verringerte Libido bei Männern', url: 'https://www.msdmanuals.com/de/heim/gesundheitsprobleme-von-m%C3%A4nnern/sexualfunktion-und-sexuelle-funktionsst%C3%B6rungen-bei-m%C3%A4nnern/verringerte-libido-bei-m%C3%A4nnern' },
      { label: 'MSD Manual: Männlicher Hypogonadismus', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/m%C3%A4nnliche-geschlechtsorgane-endokrinologie-and-verwandte-erkrankungen/m%C3%A4nnlicher-hypogonadismus' },
      { label: 'MSD Manual: Anabol-androgene Steroide', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/m%C3%A4nnliche-geschlechtsorgane-endokrinologie-and-verwandte-erkrankungen/anabol-androgene-steroide' },
      { label: 'MedlinePlus: Testosterone Levels Test', url: 'https://medlineplus.gov/lab-tests/testosterone-levels-test/' },
      { label: 'NHS: Anabolic steroid misuse', url: 'https://www.nhs.uk/conditions/anabolic-steroid-misuse/' },
    ],
  },

  'Östradiol': {
    de: {
      hinweis: 'Bei Frauen schwankt Östradiol stark mit dem Zyklus und fällt nach den Wechseljahren ab. Die Texte beziehen sich vor allem auf Männer. Zu niedrigem Östradiol beim Mann gibt es in Patientenquellen kaum Angaben.',
      niedrig: [
        { text: 'Östrogen ist auch bei Männern wichtig für die Knochen. Ein Mangel kann auf Dauer die Knochendichte verringern (Osteoporose).' },
        { text: 'Zusammen mit dem Testosteronwert ärztlich einordnen lassen, besonders nach Knochenbrüchen ohne größere Belastung.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors.' }],
      hoch: [
        { label: U.de, text: 'Bei Männern ändert sich der Östrogenspiegel im Leben wenig; ein hoher Wert kann daher auf eine Ursache hinweisen, z. B. starkes Übergewicht, eine Lebererkrankung, die Einnahme von Hormonen oder Anabolika oder selten einen hormonbildenden Tumor.' },
        { label: A.de, text: 'Vergrößerung der Brustdrüse auf einer oder beiden Seiten, oft druckempfindlich.' },
        { label: F.de, text: 'Die Brustvergrößerung bildet sich oft zurück, wenn die Ursache behoben ist, kann aber bleiben. Ein hoher Wert kann mit verminderter Fruchtbarkeit und Erektionsproblemen zusammenhängen.' },
        { text: 'Neue oder schmerzhafte Brustvergrößerung ärztlich abklären. Zeitnah bei einem einseitigen harten Knoten, einer eingezogenen Brustwarze, Hautveränderung oder Flüssigkeit bzw. Blut aus der Brustwarze.' },
      ],
    },
    en: {
      hinweis: 'In women, oestradiol varies strongly with the menstrual cycle and falls after menopause. These texts mainly refer to men. Patient sources say little about low oestradiol in men.',
      niedrig: [
        { text: 'Oestrogen is important for the bones in men too. A deficiency can reduce bone density over time (osteoporosis).' },
        { text: 'Have it assessed by a doctor together with the testosterone level, especially after fractures without major strain.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range.' }],
      hoch: [
        { label: U.en, text: 'In men, the oestrogen level changes little over life; a high value can therefore point to a cause, e.g. severe obesity, liver disease, taking hormones or anabolic steroids, or rarely a hormone-producing tumour.' },
        { label: A.en, text: 'Enlargement of the breast gland on one or both sides, often tender.' },
        { label: F.en, text: 'Breast enlargement often regresses once the cause is removed, but can remain. A high level can be linked to reduced fertility and erection problems.' },
        { text: 'Have new or painful breast enlargement checked by a doctor. Promptly if there is a hard lump on one side, an inverted nipple, skin changes, or fluid or blood from the nipple.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Brusterkrankungen bei Männern', url: 'https://www.msdmanuals.com/de/heim/gesundheitsprobleme-von-m%C3%A4nnern/fortpflanzungssystem-des-mannes/brusterkrankungen-bei-m%C3%A4nnern' },
      { label: 'gesund.bund.de: Brustkrebs', url: 'https://gesund.bund.de/brustkrebs' },
      { label: 'MSD Manual: Osteoporose', url: 'https://www.msdmanuals.com/de/heim/knochen-gelenk-und-muskelerkrankungen/osteoporose/osteoporose' },
      { label: 'MedlinePlus: Estrogen Levels Test', url: 'https://medlineplus.gov/lab-tests/estrogen-levels-test/' },
      { label: 'MedlinePlus: Breast enlargement in males', url: 'https://medlineplus.gov/ency/article/003165.htm' },
    ],
  },

  'Hämatokrit': {
    de: {
      hinweis: 'Der Normalbereich hängt von Geschlecht, Alter, Rauchen und der Höhe des Wohnorts ab.',
      niedrig: [
        { label: U.de, text: 'Häufig eine Blutarmut, z. B. durch Blutverlust, Eisen-, Vitamin-B12- oder Folsäuremangel oder chronische Erkrankungen; seltener Erkrankungen des Knochenmarks. In der Schwangerschaft oder nach rascher Zufuhr von Infusionen kann der Wert sinken, weil das Blut mehr Flüssigkeit enthält.' },
        { label: A.de, text: 'Eine leichte Blutarmut macht oft keine Beschwerden oder nur Müdigkeit, Schwäche und Blässe. Stärker ausgeprägt sind Schwindel, Herzklopfen und Kurzatmigkeit möglich, oft zuerst bei Belastung.' },
        { label: F.de, text: 'Eine ausgeprägte, unbehandelte Blutarmut kann das Herz belasten.' },
        { text: 'Ärztlich abklären, damit die Ursache gefunden wird.' },
      ],
      bereich: [{ text: 'Der Anteil der roten Blutkörperchen liegt im üblichen Bereich. Ein einzelner Wert sagt allein wenig aus.' }],
      hoch: [
        { label: U.de, text: 'Am häufigsten Flüssigkeitsmangel, z. B. nach wenig Trinken, Durchfall oder Erbrechen – dann sind nicht zu viele Zellen im Blut, sondern zu wenig Flüssigkeit. Außerdem Rauchen, Leben in großer Höhe, Lungen- oder Herzerkrankungen, Nierenprobleme, Testosteron oder anabole Steroide, selten eine Knochenmarkerkrankung (Polycythaemia vera).' },
        { label: A.de, text: 'Oft keine. Möglich sind Kopfschmerzen, Schwindel, Müdigkeit, gerötete Haut (besonders im Gesicht), verschwommenes Sehen und Juckreiz nach dem Duschen oder Baden.' },
        { label: F.de, text: 'Das Blut kann dicker werden; dadurch kann das Risiko für Blutgerinnsel, Herzinfarkt und Schlaganfall steigen.' },
        { text: 'Ein dauerhaft erhöhter Wert gehört ärztlich abgeklärt. Sofort Hilfe holen bei einem schmerzenden, geschwollenen, geröteten Bein, plötzlicher Atemnot oder Brustschmerz; bei Verdacht auf Herzinfarkt oder Schlaganfall den Notruf 112 wählen.' },
      ],
    },
    en: {
      hinweis: 'The normal range depends on sex, age, smoking and the altitude where you live.',
      niedrig: [
        { label: U.en, text: 'Often anaemia, e.g. from blood loss, iron, vitamin B12 or folate deficiency, or chronic illness; less often bone marrow disease. In pregnancy or after rapid infusions the level can fall because the blood contains more fluid.' },
        { label: A.en, text: 'Mild anaemia often causes no symptoms, or only tiredness, weakness and paleness. When more pronounced, dizziness, palpitations and shortness of breath are possible, often first on exertion.' },
        { label: F.en, text: 'Pronounced, untreated anaemia can strain the heart.' },
        { text: 'Have it checked by a doctor so the cause can be found.' },
      ],
      bereich: [{ text: 'The share of red blood cells is in the usual range. A single value on its own says little.' }],
      hoch: [
        { label: U.en, text: 'Most often a lack of fluid, e.g. after drinking little, diarrhoea or vomiting – then there are not too many cells in the blood, but too little fluid. Also smoking, living at high altitude, lung or heart disease, kidney problems, testosterone or anabolic steroids, rarely a bone marrow disease (polycythaemia vera).' },
        { label: A.en, text: 'Often none. Possible are headaches, dizziness, tiredness, reddened skin (especially on the face), blurred vision and itching after a shower or bath.' },
        { label: F.en, text: 'The blood can become thicker; this can raise the risk of blood clots, heart attack and stroke.' },
        { text: 'A persistently raised value should be checked by a doctor. Get help immediately for a painful, swollen, red leg, sudden shortness of breath or chest pain; if a heart attack or stroke is suspected, call the emergency number (112 in Europe).' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Hämatokrit', url: 'https://www.gesundheitsinformation.de/haematokrit.html' },
      { label: 'gesund.bund.de: Blutarmut', url: 'https://gesund.bund.de/blutarmut-anaemie' },
      { label: 'MSD Manual: Blutarmut', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/an%C3%A4mie/%C3%BCberblick-%C3%BCber-an%C3%A4mie' },
      { label: 'MSD Manual: Sekundäre Erythrozytose', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/myeloproliferative-erkrankungen/sekund%C3%A4re-erythrozytose' },
      { label: 'MedlinePlus: Hematocrit Test', url: 'https://medlineplus.gov/lab-tests/hematocrit-test/' },
      { label: 'NHS: Erythrocytosis', url: 'https://www.nhs.uk/conditions/erythrocytosis/' },
    ],
  },

  'LDL-Cholesterin': {
    de: {
      hinweis: 'Es gibt keinen festen Wert, ab dem das Risiko plötzlich steigt: Je höher das LDL, desto höher das Risiko. Welcher Wert günstig ist, hängt vom persönlichen Herz-Kreislauf-Risiko ab, z. B. von Blutdruck, Diabetes, Rauchen, Alter und Familiengeschichte.',
      niedrig: [
        { label: U.de, text: 'Erbliche Anlage, cholesterinsenkende Medikamente, Schilddrüsenüberfunktion, Unterernährung. Manchmal stecken andere Erkrankungen dahinter, etwa Lebererkrankungen, Blutarmut, chronische Infektionen, eine gestörte Nährstoffaufnahme im Darm oder Krebs.' },
        { label: A.de, text: 'Meist keine.' },
        { label: F.de, text: 'Ein niedriger Wert verursacht selten Probleme.' },
        { text: 'Ein unerwartet sehr niedriger Wert ohne cholesterinsenkende Medikamente gehört ärztlich abgeklärt.' },
      ],
      bereich: [{ text: 'Der Wert ist nur ein Faktor unter mehreren; das persönliche Risiko ergibt sich erst aus allen zusammen.' }],
      hoch: [
        { label: U.de, text: 'Häufig die Lebensweise – viele gesättigte Fette und Transfette, wenig Bewegung, starkes Übergewicht (aber auch schlanke Menschen können hohe Werte haben). Außerdem erbliche Anlage (familiäre Hypercholesterinämie), Schilddrüsenunterfunktion, Diabetes, Nieren- oder Lebererkrankungen, bestimmte Medikamente, anabole Steroide, bei Frauen die Zeit nach den Wechseljahren.' },
        { label: A.de, text: 'Meist keine. Bei sehr hohen, erblich bedingten Werten sind gelbliche Ablagerungen an Sehnen oder Augenlidern möglich.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Ablagerungen in den Gefäßen (Arteriosklerose) und damit ein höheres Risiko für Herzinfarkt, Schlaganfall und Durchblutungsstörungen der Beine.' },
        { text: 'Mit Ärztin oder Arzt das persönliche Gesamtrisiko einschätzen lassen. Für die Messung muss man nicht unbedingt nüchtern sein. Nahrungsergänzungsmittel schützen nicht vor den Folgen hoher Werte, manche können sogar schaden.' },
      ],
    },
    en: {
      hinweis: 'There is no fixed value above which the risk suddenly rises: the higher the LDL, the higher the risk. Which value is favourable depends on your personal cardiovascular risk, e.g. blood pressure, diabetes, smoking, age and family history.',
      niedrig: [
        { label: U.en, text: 'Inherited disposition, cholesterol-lowering medicines, an overactive thyroid, malnutrition. Sometimes other illnesses are behind it, such as liver disease, anaemia, chronic infections, impaired nutrient absorption in the gut, or cancer.' },
        { label: A.en, text: 'Usually none.' },
        { label: F.en, text: 'A low value rarely causes problems.' },
        { text: 'An unexpectedly very low value without cholesterol-lowering medicines should be checked by a doctor.' },
      ],
      bereich: [{ text: 'The value is only one factor among several; your personal risk results from all of them together.' }],
      hoch: [
        { label: U.en, text: 'Often lifestyle – a lot of saturated and trans fats, little exercise, severe obesity (but slim people can have high values too). Also inherited disposition (familial hypercholesterolaemia), an underactive thyroid, diabetes, kidney or liver disease, certain medicines, anabolic steroids, and in women the time after menopause.' },
        { label: A.en, text: 'Usually none. With very high inherited levels, yellowish deposits on tendons or eyelids are possible.' },
        { label: 'Possible long-term consequences', text: 'Deposits in the blood vessels (atherosclerosis) and thus a higher risk of heart attack, stroke and poor circulation in the legs.' },
        { text: 'Have your overall personal risk assessed by a doctor. You do not necessarily have to be fasting for the test. Dietary supplements do not protect against the consequences of high levels; some can even do harm.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: LDL-Cholesterin', url: 'https://www.gesundheitsinformation.de/ldl-cholesterin.html' },
      { label: 'gesund.bund.de: Hypercholesterinämie', url: 'https://gesund.bund.de/hypercholesterinaemie' },
      { label: 'gesundheitsinformation.de: Erhöhte Cholesterinwerte', url: 'https://www.gesundheitsinformation.de/erhoehte-cholesterinwerte.html' },
      { label: 'MSD Manual: Hypolipidämie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-des-cholesterinstoffwechsels/hypolipid%C3%A4mie' },
      { label: 'MSD Manual: Dyslipidämie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-des-cholesterinstoffwechsels/dyslipid%C3%A4mie' },
      { label: 'MedlinePlus: LDL', url: 'https://medlineplus.gov/ldlthebadcholesterol.html' },
    ],
  },

  'TSH': {
    de: {
      hinweis: 'TSH kommt aus der Hirnanhangdrüse und regt die Schilddrüse an. Es verhält sich meist umgekehrt zu den Schilddrüsenhormonen; ein auffälliger Wert wird deshalb mit fT3 und fT4 eingeordnet. Der Wert schwankt im Tagesverlauf; bei Älteren gelten etwas höhere Werte oft noch als unauffällig. Auch dauerhaft eingenommene Medikamente können die Werte verändern – vor dem Bluttest der Praxis sagen, was man einnimmt.',
      niedrig: [
        { label: U.de, text: 'Meist eine Schilddrüsenüberfunktion, am häufigsten durch Morbus Basedow. Außerdem Knoten, eine Schilddrüsenentzündung, zu viel eingenommenes Schilddrüsenhormon, bestimmte Medikamente und viel Jod (etwa durch Kontrastmittel) bei vorhandenen Knoten. Selten liegt es an der Hirnanhangdrüse.' },
        { label: 'Typische Anzeichen einer Überfunktion', text: 'Herzrasen, Nervosität, Schwitzen, Gewichtsverlust trotz Appetit, Zittern, Schlafstörungen. Bei Älteren oft weniger typisch.' },
        { label: F.de, text: 'Eine unbehandelte Überfunktion kann Vorhofflimmern und langfristig Knochenschwund begünstigen.' },
        { text: 'Ärztlich abklären; bei starkem Herzrasen oder Brustschmerz sofort.' },
      ],
      bereich: [{ text: 'Die Schilddrüse wird in der Regel ausreichend gesteuert.' }],
      hoch: [
        { label: U.de, text: 'Meist eine Unterfunktion, hierzulande am häufigsten durch Hashimoto. Außerdem ausgeprägter Jodmangel, bestimmte Medikamente und eine nicht passende Dosis von Schilddrüsenhormonen. Vorübergehend kann der Wert auch nach starker Anstrengung oder bei starkem Übergewicht erhöht sein; leicht erhöhte Werte bilden sich recht oft von selbst zurück.' },
        { label: 'Typische Anzeichen einer Unterfunktion', text: 'Müdigkeit, Frieren, Gewichtszunahme, Verstopfung, trockene Haut, gedrückte Stimmung.' },
        { label: F.de, text: 'Höhere Cholesterinwerte und eingeschränkte Fruchtbarkeit. Unbehandelt erhöht eine Unterfunktion in der Schwangerschaft Risiken für Mutter und Kind.' },
        { text: 'Ärztlich abklären, besonders bei Beschwerden, Schwangerschaft, Kinderwunsch oder wenn man Schilddrüsenmedikamente nimmt.' },
      ],
    },
    en: {
      hinweis: 'TSH comes from the pituitary gland and stimulates the thyroid. It usually moves opposite to the thyroid hormones, so an abnormal value is assessed together with fT3 and fT4. The level varies over the day; in older people slightly higher values are often still considered normal. Medicines taken long-term can also change the values – tell your practice what you take before the blood test.',
      niedrig: [
        { label: U.en, text: 'Usually an overactive thyroid, most often due to Graves’ disease. Also nodules, thyroiditis, too much thyroid hormone taken, certain medicines, and a lot of iodine (e.g. from contrast agents) when nodules are present. Rarely the pituitary gland is the cause.' },
        { label: 'Typical signs of an overactive thyroid', text: 'Racing heart, nervousness, sweating, weight loss despite appetite, tremor, sleep problems. Often less typical in older people.' },
        { label: F.en, text: 'An untreated overactive thyroid can promote atrial fibrillation and, in the long term, bone loss.' },
        { text: 'Have it checked by a doctor; immediately with a strongly racing heart or chest pain.' },
      ],
      bereich: [{ text: 'The thyroid is usually being regulated adequately.' }],
      hoch: [
        { label: U.en, text: 'Usually an underactive thyroid, in Germany most often due to Hashimoto’s. Also marked iodine deficiency, certain medicines and an unsuitable dose of thyroid hormones. The value can also be temporarily raised after strenuous exertion or with severe obesity; slightly raised values quite often return to normal on their own.' },
        { label: 'Typical signs of an underactive thyroid', text: 'Tiredness, feeling cold, weight gain, constipation, dry skin, low mood.' },
        { label: F.en, text: 'Higher cholesterol and reduced fertility. Untreated, an underactive thyroid in pregnancy increases risks for mother and child.' },
        { text: 'Have it checked by a doctor, especially with symptoms, pregnancy, when trying for a child, or when taking thyroid medicine.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: TSH', url: 'https://www.gesundheitsinformation.de/thyreoidea-stimulierendes-hormon-tsh.html' },
      { label: 'gesund.bund.de: Schilddrüsenüberfunktion', url: 'https://gesund.bund.de/schilddruesenueberfunktion' },
      { label: 'gesund.bund.de: Schilddrüsenunterfunktion', url: 'https://gesund.bund.de/schilddruesenunterfunktion' },
      { label: 'gesundheitsinformation.de: Schilddrüsenuntersuchungen verstehen', url: 'https://www.gesundheitsinformation.de/schilddruesenuntersuchungen-verstehen_39488.html' },
      { label: 'gesundheitsinformation.de: Schilddrüsenunterfunktion', url: 'https://www.gesundheitsinformation.de/schilddruesenunterfunktion-hypothyreose.html' },
      { label: 'MSD Manual: Hyperthyreose', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/schilddr%C3%BCsenerkrankungen/hyperthyreose' },
      { label: 'NHS: Underactive thyroid', url: 'https://www.nhs.uk/conditions/underactive-thyroid-hypothyroidism/' },
    ],
  },

  'Ferritin': {
    de: {
      hinweis: 'Ferritin zeigt die Eisenspeicher. Bei Entzündungen, Infekten oder Leberschäden kann es ansteigen und einen Mangel verdecken.',
      niedrig: [
        { label: U.de, text: 'Am häufigsten Blutverlust, etwa durch starke Regelblutung oder Blutungen im Magen-Darm-Trakt. Außerdem erhöhter Bedarf (Schwangerschaft, intensiver Ausdauersport), wenig Eisen in der Nahrung und eine gestörte Aufnahme (z. B. Zöliakie oder manche Medikamente).' },
        { label: A.de, text: 'Müdigkeit, Schwäche, Blässe, unruhige Beine, Haarausfall, löffelförmige Nägel.' },
        { label: 'Mögliche Folge', text: 'Blutarmut.' },
        { text: 'Die Ursache vor einer Eiseneinnahme ärztlich klären – besonders bei Männern und Frauen ohne Regelblutung, weil ein Mangel dann auf eine Blutung im Darm hinweisen kann.' },
      ],
      bereich: [{ text: 'Die Eisenspeicher sind wahrscheinlich ausreichend. Bei einer Entzündung ist der Wert allerdings nur eingeschränkt aussagekräftig.' }],
      hoch: [
        { label: U.de, text: 'Entzündungen und Infekte, Lebererkrankungen, starkes Übergewicht, langjähriger hoher Alkoholkonsum, Autoimmunerkrankungen, zu viel Eisen im Körper, etwa durch zu viel eingenommenes Eisen, häufige Bluttransfusionen oder erblich durch Hämochromatose.' },
        { label: A.de, text: 'Lange oft keine. Bei Eisenüberladung sind Müdigkeit und Gelenkschmerzen möglich.' },
        { label: 'Mögliche Folgen einer echten Überladung', text: 'Schäden an Leber, Gelenken, Bauchspeicheldrüse und Herz.' },
        { text: 'Ärztlich abklären, besonders bei deutlich erhöhten Werten oder wenn Hämochromatose in der Familie vorkommt.' },
      ],
    },
    en: {
      hinweis: 'Ferritin shows the iron stores. With inflammation, infections or liver damage it can rise and mask a deficiency.',
      niedrig: [
        { label: U.en, text: 'Most often blood loss, e.g. from heavy periods or bleeding in the gastrointestinal tract. Also increased need (pregnancy, intensive endurance sport), little iron in the diet, and impaired absorption (e.g. coeliac disease or some medicines).' },
        { label: A.en, text: 'Tiredness, weakness, paleness, restless legs, hair loss, spoon-shaped nails.' },
        { label: 'Possible consequence', text: 'Anaemia.' },
        { text: 'Have the cause clarified by a doctor before taking iron – especially in men and in women without periods, because a deficiency can then point to bleeding in the gut.' },
      ],
      bereich: [{ text: 'The iron stores are probably sufficient. With inflammation, however, the value is of limited significance.' }],
      hoch: [
        { label: U.en, text: 'Inflammation and infections, liver disease, severe obesity, long-term heavy drinking, autoimmune diseases, too much iron in the body, e.g. from taking too much iron, frequent blood transfusions, or inherited haemochromatosis.' },
        { label: A.en, text: 'Often none for a long time. With iron overload, tiredness and joint pain are possible.' },
        { label: 'Possible consequences of true overload', text: 'Damage to the liver, joints, pancreas and heart.' },
        { text: 'Have it checked by a doctor, especially with clearly raised values or if haemochromatosis runs in the family.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Ferritin', url: 'https://www.gesundheitsinformation.de/ferritin.html' },
      { label: 'gesundheitsinformation.de: Eisenmangel', url: 'https://www.gesundheitsinformation.de/eisenmangel-und-eisenmangel-anaemie.html' },
      { label: 'gesund.bund.de: Blutarmut', url: 'https://gesund.bund.de/blutarmut-anaemie' },
      { label: 'MSD Manual: Eisenmangel', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/mineralstoffe/eisenmangel' },
      { label: 'MedlinePlus: Ferritin Blood Test', url: 'https://medlineplus.gov/lab-tests/ferritin-blood-test/' },
      { label: 'NHS: Haemochromatosis', url: 'https://www.nhs.uk/conditions/haemochromatosis/' },
    ],
  },

  'Vitamin D': {
    de: {
      hinweis: 'Gemessen wird 25-OH-Vitamin D, die Speicherform. Der Wert schwankt im Jahresverlauf und liegt im Winter meist niedriger.',
      niedrig: [
        { label: U.de, text: 'Wenig Sonnenlicht auf der Haut (viel drinnen, Haut bedeckt, Sonnencreme; im Winter bildet die Haut kaum Vitamin D). Dunklere Haut und höheres Alter, weil die Haut dann weniger bildet. Gestörte Aufnahme im Darm, bestimmte Nieren- oder Lebererkrankungen, manche Medikamente.' },
        { label: A.de, text: 'Oft keine. Bei deutlichem Mangel Knochen- und Muskelschmerzen, Muskelschwäche. Ein niedriger Blutwert allein ist noch kein Mangel – dazu gehören auch Beschwerden.' },
        { label: F.de, text: 'Weiche, brüchige Knochen; bei Kindern Rachitis; bei Älteren Knochenbrüche, auch schon bei leichten Stürzen.' },
        { text: 'Ärztlich abklären bei Knochen- oder Muskelbeschwerden oder einem bekannten Risiko.' },
      ],
      bereich: [{ text: 'Ausreichend versorgt. Im Winter liegt der Wert meist niedriger als im Sommer.' }],
      hoch: [
        { label: U.de, text: 'Fast immer zu viel eingenommenes Vitamin D über längere Zeit. Durch Sonne allein entsteht kein zu hoher Wert.' },
        { label: 'Typische Anzeichen (durch zu viel Kalzium im Blut)', text: 'Appetitlosigkeit, Übelkeit, Erbrechen, Verstopfung, Durst, häufiges Wasserlassen, Schwäche; in schweren Fällen Verwirrtheit.' },
        { label: F.de, text: 'Nierensteine und Nierenschäden, bei sehr hohem Kalzium Herzrhythmusstörungen. Auch die Knochen können geschwächt werden.' },
        { text: 'Zeitnah ärztlich abklären, meist zusammen mit dem Kalziumwert.' },
      ],
    },
    en: {
      hinweis: '25-OH vitamin D, the storage form, is measured. The level varies over the year and is usually lower in winter.',
      niedrig: [
        { label: U.en, text: 'Little sunlight on the skin (a lot of time indoors, covered skin, sunscreen; in winter the skin makes hardly any vitamin D). Darker skin and older age, because the skin then makes less. Impaired absorption in the gut, certain kidney or liver diseases, some medicines.' },
        { label: A.en, text: 'Often none. With a marked deficiency, bone and muscle pain and muscle weakness. A low blood value alone is not yet a deficiency – symptoms are part of it too.' },
        { label: F.en, text: 'Soft, brittle bones; rickets in children; fractures in older people, even from minor falls.' },
        { text: 'Have it checked by a doctor with bone or muscle complaints or a known risk.' },
      ],
      bereich: [{ text: 'Adequately supplied. The level is usually lower in winter than in summer.' }],
      hoch: [
        { label: U.en, text: 'Almost always too much vitamin D taken over a longer period. Sun alone does not cause a level that is too high.' },
        { label: 'Typical signs (from too much calcium in the blood)', text: 'Loss of appetite, nausea, vomiting, constipation, thirst, frequent urination, weakness; confusion in severe cases.' },
        { label: F.en, text: 'Kidney stones and kidney damage; with very high calcium, heart rhythm disorders. The bones can also be weakened.' },
        { text: 'Have it checked by a doctor promptly, usually together with the calcium level.' },
      ],
    },
    quellen: [
      { label: 'gesund.bund.de: Vitamin-D-Mangel', url: 'https://gesund.bund.de/vitamin-d-mangel' },
      { label: 'gesundheitsinformation.de: Vitamin-D-Bedarf', url: 'https://www.gesundheitsinformation.de/wie-hoch-ist-der-vitamin-d-bedarf-und-wie-laesst-er-sich-decken.html' },
      { label: 'MSD Manual: Vitamin-D-Mangel', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/vitamine/vitamin-d-mangel' },
      { label: 'MSD Manual: Vitamin-D-Überschuss', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/vitamine/vitamin-d-%C3%BCberschuss' },
      { label: 'MSD Manual: Hyperkalzämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hyperkalz%C3%A4mie-hoher-kalziumspiegel-im-blut' },
      { label: 'MedlinePlus: Vitamin D Test', url: 'https://medlineplus.gov/lab-tests/vitamin-d-test/' },
    ],
  },

  'GPT (ALT)': {
    de: {
      hinweis: 'GPT ist ein Enzym vor allem der Leberzellen. Es steigt im Blut, wenn Leberzellen geschädigt werden, und wird zusammen mit anderen Leberwerten beurteilt.',
      niedrig: [{ text: 'Selten und meist ohne Bedeutung. Bei Unsicherheit ärztlich einordnen lassen.' }],
      bereich: [{ text: 'Aus diesem Wert ergibt sich kein Hinweis auf eine Schädigung von Leberzellen.' }],
      hoch: [
        { label: U.de, text: 'Fettleber, Alkohol, starkes Übergewicht, Virushepatitis, Gallensteine bzw. entzündete Gallenwege, bestimmte Medikamente (auch Anabolika und pflanzliche Mittel) und Nahrungsergänzungsmittel. Intensive körperliche Belastung kann den Wert beeinflussen.' },
        { label: A.de, text: 'Oft keine. Bei stärkerer Leberbelastung möglich: Müdigkeit, Übelkeit, Bauchschmerzen, Gelbfärbung von Haut oder Augen, dunkler Urin, heller Stuhl.' },
        { label: 'Einordnung', text: 'Ein hoher Wert kann auf eine Leberentzündung oder eine andere Lebererkrankung hinweisen. Er bedeutet aber nicht immer eine behandlungsbedürftige Erkrankung. Sehr hohe Werte sprechen eher für eine akute Leberentzündung, bei chronischen Erkrankungen ist der Wert oft nur mäßig erhöht – ein sicheres Maß für die Schwere ist die Höhe nicht.' },
        { text: 'Einen erhöhten Wert ärztlich einordnen lassen; bei Gelbfärbung von Haut oder Augen zeitnah.' },
      ],
    },
    en: {
      hinweis: 'ALT is an enzyme found mainly in liver cells. It rises in the blood when liver cells are damaged and is assessed together with other liver values.',
      niedrig: [{ text: 'Rare and usually without significance. If unsure, have it assessed by a doctor.' }],
      bereich: [{ text: 'This value gives no indication of damage to liver cells.' }],
      hoch: [
        { label: U.en, text: 'Fatty liver, alcohol, severe obesity, viral hepatitis, gallstones or inflamed bile ducts, certain medicines (including anabolic steroids and herbal remedies) and dietary supplements. Intense physical exertion can affect the value.' },
        { label: A.en, text: 'Often none. With greater strain on the liver: tiredness, nausea, abdominal pain, yellowing of the skin or eyes, dark urine, pale stools.' },
        { label: 'Context', text: 'A high value can point to liver inflammation or another liver disease. But it does not always mean a disease that needs treatment. Very high values suggest acute liver inflammation; in chronic diseases the value is often only moderately raised – the level is not a reliable measure of severity.' },
        { text: 'Have a raised value assessed by a doctor; promptly if the skin or eyes turn yellow.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: ALAT (GPT)', url: 'https://www.gesundheitsinformation.de/alanin-aminotransferase-alat.html' },
      { label: 'gesund.bund.de: Nicht-alkoholische Fettleber', url: 'https://gesund.bund.de/nicht-alkoholische-fettleber' },
      { label: 'MSD Manual: Leberwerte im Blut', url: 'https://www.msdmanuals.com/de/heim/leber-und-gallenst%C3%B6rungen/diagnoseverfahren-bei-leber-gallenblasen-und-gallenerkrankungen/tests-zu-leberwerten-im-blut' },
      { label: 'MedlinePlus: ALT Blood Test', url: 'https://medlineplus.gov/lab-tests/alt-blood-test/' },
    ],
  },
}

/** Alle Marker mit Einordnung: die ersten acht hier, die uebrigen je Kategorie in ./guidance. */
const ALLE: Record<string, MarkerGuidance> = Object.assign({}, GUIDANCE, ...GUIDANCE_PAKETE)

/** Einordnung fuer einen Katalogmarker in der Anzeigesprache; null, wenn es (noch) keine gibt. */
export function markerGuidance(name: string, sprache: string): { text: GuidanceText; quellen: MarkerGuidance['quellen'] } | null {
  const g = ALLE[name]
  if (!g) return null
  return { text: istDeutsch(sprache) ? g.de : g.en, quellen: g.quellen }
}

/** Fuer Tests: alle Marker mit Einordnung. */
export const GUIDANCE_MARKERS = Object.keys(ALLE)
