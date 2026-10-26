import type { MarkerGuidance } from '../markerGuidance'

const U = { de: 'Mögliche Ursachen', en: 'Possible causes' }
const A = { de: 'Typische Anzeichen', en: 'Typical signs' }
const F = { de: 'Mögliche Folgen', en: 'Possible consequences' }

/** Lipide und Entzündung: Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_LIPIDE: Record<string, MarkerGuidance> = {
  'Cholesterin gesamt': {
    de: {
      hinweis: 'Mahlzeiten beeinflussen den Cholesterinwert kaum; nüchtern muss man dafür nicht unbedingt sein. Oft wird es trotzdem empfohlen, weil andere Blutwerte mitgemessen werden. Die Werte können sich je nach Labor unterscheiden.',
      niedrig: [
        { label: U.de, text: 'Erbliche Anlage, Schilddrüsenüberfunktion, Lebererkrankungen, chronische Infektionen, eine gestörte Nährstoffaufnahme im Darm, Tumorerkrankungen, Mangelernährung. Auch eine hohe Dosis cholesterinsenkender Medikamente kann zu sehr niedrigen Werten führen.' },
        { label: F.de, text: 'Ein niedriger Wert ist meist unbedenklich und verursacht selten Probleme.' },
        { text: 'Einen sehr niedrigen Wert ärztlich abklären lassen, weil auch Erkrankungen dahinterstecken können.' },
      ],
      bereich: [{ text: 'Der Wert ist nur ein Faktor unter mehreren; das persönliche Risiko ergibt sich erst aus allen zusammen.' }],
      hoch: [
        { label: U.de, text: 'Häufig die Lebensweise – wenig Bewegung, einseitige Ernährung, Übergewicht (aber auch schlanke Menschen können hohe Werte haben). Außerdem Diabetes, Schilddrüsenunterfunktion, chronische Leber- und Nierenerkrankungen, bestimmte Medikamente (z. B. hormonelle Verhütungsmittel, Betablocker, Kortisonpräparate) und eine erbliche Anlage (familiäre Hypercholesterinämie).' },
        { label: A.de, text: 'Meist keine. Bei besonders hohen Werten sind Fettablagerungen in der Haut und an Sehnen möglich.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Je höher der Wert, desto höher das Risiko für Ablagerungen in den Gefäßen (Arteriosklerose) und damit für Herzinfarkt, Schlaganfall und Durchblutungsstörungen der Beine.' },
        { text: 'Die Ursache und das persönliche Gesamtrisiko ärztlich einschätzen lassen; dazu zählen auch Rauchen, Alter, Geschlecht, Diabetes und Blutdruck. Nahrungsergänzungsmittel schützen nicht vor den Folgen hoher Werte, manche können sogar schaden.' },
      ],
    },
    en: {
      hinweis: 'Meals hardly affect the cholesterol level; you do not necessarily have to be fasting. It is often recommended anyway because other blood values are measured at the same time. Values can differ from lab to lab.',
      niedrig: [
        { label: U.en, text: 'Inherited disposition, an overactive thyroid, liver disease, chronic infections, impaired nutrient absorption in the gut, cancer, malnutrition. A high dose of cholesterol-lowering medicines can also lead to very low values.' },
        { label: F.en, text: 'A low value is usually harmless and rarely causes problems.' },
        { text: 'Have a very low value checked by a doctor, because an illness can be behind it.' },
      ],
      bereich: [{ text: 'The value is only one factor among several; your personal risk results from all of them together.' }],
      hoch: [
        { label: U.en, text: 'Often lifestyle – little exercise, an unbalanced diet, excess weight (but slim people can have high values too). Also diabetes, an underactive thyroid, chronic liver and kidney disease, certain medicines (e.g. hormonal contraceptives, beta blockers, corticosteroids) and an inherited disposition (familial hypercholesterolaemia).' },
        { label: A.en, text: 'Usually none. With particularly high values, fatty deposits in the skin and on tendons are possible.' },
        { label: 'Possible long-term consequences', text: 'The higher the value, the higher the risk of deposits in the blood vessels (atherosclerosis) and thus of heart attack, stroke and poor circulation in the legs.' },
        { text: 'Have the cause and your overall personal risk assessed by a doctor; this also includes smoking, age, sex, diabetes and blood pressure. Dietary supplements do not protect against the consequences of high levels; some can even do harm.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Cholesterin', url: 'https://www.gesundheitsinformation.de/cholesterin.html' },
      { label: 'gesund.bund.de: Hypercholesterinämie', url: 'https://gesund.bund.de/hypercholesterinaemie' },
      { label: 'MSD Manual: Dyslipidämie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-des-cholesterinstoffwechsels/dyslipid%C3%A4mie' },
      { label: 'MSD Manual: Hypolipidämie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-des-cholesterinstoffwechsels/hypolipid%C3%A4mie' },
    ],
  },

  'HDL-Cholesterin': {
    de: {
      hinweis: 'Mahlzeiten beeinflussen den Wert kaum; nüchtern muss man nicht unbedingt sein. Welcher Wert günstig ist, hängt von Alter und Geschlecht ab.',
      niedrig: [
        { label: U.de, text: 'Häufig wenig Bewegung, einseitige Ernährung, starkes Übergewicht oder Rauchen. Außerdem Diabetes, chronische Leber- und Nierenerkrankungen, erhöhte Triglyceride, eine erbliche Neigung und bestimmte Medikamente (z. B. hormonelle Verhütungsmittel, Betablocker, Kortisonpräparate). Auch anabole Steroide, einschließlich Testosteron, können den Wert senken.' },
        { label: F.de, text: 'Ein niedriger Wert kann mit einem höheren Risiko für Durchblutungsstörungen, Herzinfarkt und Schlaganfall verbunden sein. Allein ist er aber wenig aussagekräftig – LDL-Cholesterin und Triglyceride zählen ebenso.' },
        { text: 'Die Ursache und das persönliche Gesamtrisiko ärztlich einschätzen lassen.' },
      ],
      bereich: [{ text: 'Der Wert ist nur ein Faktor unter mehreren; das persönliche Risiko ergibt sich erst aus allen zusammen.' }],
      hoch: [
        { label: U.de, text: 'Eine erbliche Anlage, schwere körperliche Arbeit, Leistungssport, Alkoholkonsum.' },
        { label: 'Einordnung', text: 'Höhere Werte sind meist günstig. Deutlich erhöhte Werte können das Herz-Kreislauf-Risiko aber auch erhöhen, besonders bei weiteren Risikofaktoren.' },
        { text: 'Einen deutlich erhöhten Wert ärztlich einordnen lassen.' },
      ],
    },
    en: {
      hinweis: 'Meals hardly affect the value; you do not necessarily have to be fasting. Which value is favourable depends on age and sex.',
      niedrig: [
        { label: U.en, text: 'Often little exercise, an unbalanced diet, severe obesity or smoking. Also diabetes, chronic liver and kidney disease, raised triglycerides, an inherited tendency and certain medicines (e.g. hormonal contraceptives, beta blockers, corticosteroids). Anabolic steroids, including testosterone, can also lower the value.' },
        { label: F.en, text: 'A low value can be linked to a higher risk of circulatory problems, heart attack and stroke. On its own, however, it says little – LDL cholesterol and triglycerides count just as much.' },
        { text: 'Have the cause and your overall personal risk assessed by a doctor.' },
      ],
      bereich: [{ text: 'The value is only one factor among several; your personal risk results from all of them together.' }],
      hoch: [
        { label: U.en, text: 'An inherited disposition, heavy physical work, competitive sport, drinking alcohol.' },
        { label: 'Context', text: 'Higher values are usually favourable. Clearly raised values can, however, also increase cardiovascular risk, especially with other risk factors.' },
        { text: 'Have a clearly raised value assessed by a doctor.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: HDL-Cholesterin', url: 'https://www.gesundheitsinformation.de/hdl-cholesterin.html' },
      { label: 'MSD Manual: Dyslipidämie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-des-cholesterinstoffwechsels/dyslipid%C3%A4mie' },
      { label: 'MedlinePlus: HDL', url: 'https://medlineplus.gov/hdlthegoodcholesterol.html' },
    ],
  },

  'Triglyceride': {
    de: {
      hinweis: 'In den 8 Stunden vor der Blutabnahme nichts essen und nur Wasser trinken – eine Mahlzeit, besonders mit viel Fett oder Zucker, kann den Wert erhöhen. Gegen Ende einer Schwangerschaft steigt der Wert natürlicherweise an.',
      niedrig: [
        { label: U.de, text: 'Unter- oder Mangelernährung, Schilddrüsenüberfunktion, eine hohe Dosis lipidsenkender Medikamente.' },
        { label: F.de, text: 'Niedrige Werte sind selten und haben kaum medizinische Bedeutung.' },
        { text: 'Bei Unsicherheit die Ursache ärztlich klären lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im üblichen Bereich. Für sich genommen ist er wenig aussagekräftig.' }],
      hoch: [
        { label: U.de, text: 'Häufig wenig Bewegung, Ernährung mit viel Fett, Zucker und Weißmehl, viel Alkohol, Rauchen, starkes Übergewicht. Außerdem schlecht eingestellter Diabetes, Gicht, Schilddrüsenunterfunktion, chronische Leber- und Nierenerkrankungen, bestimmte Medikamente (z. B. hormonelle Verhütungsmittel, Betablocker, Kortisonpräparate, Entwässerungsmittel) und eine erbliche Anlage. Auch eine Messung nach dem Essen ergibt höhere Werte.' },
        { label: A.de, text: 'Meist keine. Bei stark erhöhten Werten sind rötliche oder gelbliche Knötchen in der Haut möglich.' },
        { label: F.de, text: 'Ein erhöhter Wert kann auf ein höheres Risiko für Herzinfarkt, Schlaganfall und Durchblutungsstörungen hinweisen, vor allem zusammen mit niedrigem HDL, Diabetes oder einer Nierenerkrankung. Sehr hohe Werte können eine Entzündung der Bauchspeicheldrüse auslösen, die starke Bauchschmerzen verursacht und gefährlich sein kann.' },
        { text: 'Die Ursache und das persönliche Gesamtrisiko ärztlich einschätzen lassen; sehr hohe Werte zeitnah. Bei plötzlichen starken Bauchschmerzen sofort ärztliche Hilfe holen.' },
      ],
    },
    en: {
      hinweis: 'Do not eat anything in the 8 hours before the blood sample and drink only water – a meal, especially one high in fat or sugar, can raise the value. Towards the end of pregnancy the value naturally rises.',
      niedrig: [
        { label: U.en, text: 'Undernutrition or malnutrition, an overactive thyroid, a high dose of lipid-lowering medicines.' },
        { label: F.en, text: 'Low values are rare and have little medical significance.' },
        { text: 'If unsure, have the cause clarified by a doctor.' },
      ],
      bereich: [{ text: 'The value is in the usual range. On its own it says little.' }],
      hoch: [
        { label: U.en, text: 'Often little exercise, a diet high in fat, sugar and white flour, a lot of alcohol, smoking, severe obesity. Also poorly controlled diabetes, gout, an underactive thyroid, chronic liver and kidney disease, certain medicines (e.g. hormonal contraceptives, beta blockers, corticosteroids, water tablets) and an inherited disposition. A measurement after eating also gives higher values.' },
        { label: A.en, text: 'Usually none. With greatly raised values, reddish or yellowish bumps in the skin are possible.' },
        { label: F.en, text: 'A raised value can point to a higher risk of heart attack, stroke and circulatory problems, especially together with low HDL, diabetes or kidney disease. Very high values can trigger inflammation of the pancreas, which causes severe abdominal pain and can be dangerous.' },
        { text: 'Have the cause and your overall personal risk assessed by a doctor; very high values promptly. With sudden severe abdominal pain, get medical help immediately.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Triglyceride', url: 'https://www.gesundheitsinformation.de/triglyceride.html' },
      { label: 'MSD Manual: Dyslipidämie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-des-cholesterinstoffwechsels/dyslipid%C3%A4mie' },
      { label: 'MedlinePlus: Triglycerides Test', url: 'https://medlineplus.gov/lab-tests/triglycerides-test/' },
    ],
  },

  'Lipoprotein (a)': {
    de: {
      hinweis: 'Ob man nüchtern kommen soll, sagt die Praxis. Alkohol, Niacin-Präparate, Aspirin und Östrogen zum Einnehmen können das Ergebnis beeinflussen – vorher der Praxis sagen, was man einnimmt. Auch manche Erkrankungen können den Wert verändern.',
      niedrig: [
        { text: 'Ein erhöhtes Risiko geht nur von hohen Werten aus. Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Aus diesem Wert ergibt sich kein Hinweis auf ein erhöhtes Risiko. Die übrigen Risikofaktoren zählen trotzdem.' }],
      hoch: [
        { label: U.de, text: 'Fast immer die erbliche Anlage. Ernährung und Bewegung verändern den Wert kaum.' },
        { label: F.de, text: 'Ein höheres Risiko für Ablagerungen in den Gefäßen (Arteriosklerose) und Blutgerinnsel und damit für Herzinfarkt, Schlaganfall und Durchblutungsstörungen – auch dann, wenn die übrigen Cholesterinwerte unauffällig sind.' },
        { text: 'Mit Ärztin oder Arzt das persönliche Gesamtrisiko einschätzen lassen. Weil sich der Wert selbst kaum ändern lässt, kommt es dann besonders auf die übrigen Risikofaktoren an, etwa LDL-Cholesterin, Blutdruck und Rauchen.' },
      ],
    },
    en: {
      hinweis: 'Your practice will tell you whether to come fasting. Alcohol, niacin supplements, aspirin and oral oestrogen can affect the result – tell your practice beforehand what you take. Some illnesses can also change the value.',
      niedrig: [
        { text: 'Increased risk comes only from high values. If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'This value gives no indication of increased risk. The other risk factors still count.' }],
      hoch: [
        { label: U.en, text: 'Almost always inherited disposition. Diet and exercise hardly change the value.' },
        { label: F.en, text: 'A higher risk of deposits in the blood vessels (atherosclerosis) and blood clots, and thus of heart attack, stroke and circulatory problems – even when the other cholesterol values are normal.' },
        { text: 'Have your overall personal risk assessed by a doctor. Because the value itself can hardly be changed, the other risk factors then matter all the more, such as LDL cholesterol, blood pressure and smoking.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Dyslipidämie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-des-cholesterinstoffwechsels/dyslipid%C3%A4mie' },
      { label: 'MedlinePlus: Lipoprotein (a) Blood Test', url: 'https://medlineplus.gov/lab-tests/lipoprotein-a-blood-test/' },
    ],
  },

  'ApoB': {
    de: {
      hinweis: 'Manchmal soll man 4 bis 6 Stunden vorher nichts essen oder trinken; das sagt die Praxis. Wie viel der Wert über die üblichen Cholesterinwerte hinaus bringt, ist nicht abschließend geklärt.',
      niedrig: [
        { label: F.de, text: 'Niedrige Blutfettwerte verursachen selten Probleme, können aber auf eine andere Erkrankung hinweisen.' },
        { text: 'Ein unerwartet sehr niedriger Wert ohne cholesterinsenkende Medikamente gehört ärztlich abgeklärt.' },
      ],
      bereich: [{ text: 'Der Wert ist nur ein Faktor unter mehreren; das persönliche Risiko ergibt sich erst aus allen zusammen.' }],
      hoch: [
        { label: U.de, text: 'Erhöhte Blutfette, z. B. durch eine erbliche Anlage (familiäre Hypercholesterinämie).' },
        { label: A.de, text: 'Meist keine.' },
        { label: F.de, text: 'Ein hoher Wert kann auf ein höheres Risiko für Herzerkrankungen hinweisen, auch wenn die Cholesterinwerte unter Behandlung im Zielbereich liegen. Er hängt mit Gefäßablagerungen (Arteriosklerose), Brustenge und Herzinfarkt zusammen.' },
        { text: 'Mit Ärztin oder Arzt das persönliche Gesamtrisiko einschätzen lassen. Nahrungsergänzungsmittel schützen nicht vor den Folgen hoher Blutfette, manche können sogar schaden.' },
      ],
    },
    en: {
      hinweis: 'Sometimes you should not eat or drink for 4 to 6 hours beforehand; your practice will tell you. How much the value adds to the usual cholesterol values has not been fully settled.',
      niedrig: [
        { label: F.en, text: 'Low blood lipid levels rarely cause problems, but can point to another illness.' },
        { text: 'An unexpectedly very low value without cholesterol-lowering medicines should be checked by a doctor.' },
      ],
      bereich: [{ text: 'The value is only one factor among several; your personal risk results from all of them together.' }],
      hoch: [
        { label: U.en, text: 'Raised blood lipids, e.g. due to an inherited disposition (familial hypercholesterolaemia).' },
        { label: A.en, text: 'Usually none.' },
        { label: F.en, text: 'A high value can point to a higher risk of heart disease, even when cholesterol values are at target with treatment. It is linked to deposits in the blood vessels (atherosclerosis), chest tightness (angina) and heart attack.' },
        { text: 'Have your overall personal risk assessed by a doctor. Dietary supplements do not protect against the consequences of high blood lipids; some can even do harm.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Erhöhte Cholesterinwerte', url: 'https://www.gesundheitsinformation.de/erhoehte-cholesterinwerte.html' },
      { label: 'MSD Manual: Dyslipidämie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-des-cholesterinstoffwechsels/dyslipid%C3%A4mie' },
      { label: 'MSD Manual: Hypolipidämie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-des-cholesterinstoffwechsels/hypolipid%C3%A4mie' },
      { label: 'MedlinePlus: Apolipoprotein B100', url: 'https://medlineplus.gov/ency/article/003502.htm' },
    ],
  },

  'CRP': {
    de: {
      hinweis: 'Der Wert hängt auch von Alter, Körpergewicht und Geschlecht ab (Frauen haben oft etwas höhere Werte) und wird durch Rauchen und Hormonpräparate beeinflusst. Nach großer Anstrengung, etwa einem Marathon, steigt er für einige Tage an. Der hochsensitive Test (hs-CRP) misst schon sehr kleine Erhöhungen und dient zur Abschätzung des Herz-Kreislauf-Risikos.',
      niedrig: [
        { text: 'Ein gutes Zeichen: Eine bedeutsame Entzündung ist unwahrscheinlich. Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Kein Hinweis auf eine stärkere Entzündung. Ein einzelner Wert allein sagt aber wenig aus.' }],
      hoch: [
        { label: U.de, text: 'Infektionen mit Bakterien, Viren oder Pilzen – bei bakteriellen Infekten steigt der Wert meist besonders stark. Außerdem chronisch-entzündliche Erkrankungen (z. B. rheumatoide Arthritis, Morbus Crohn), Verletzungen, Verbrennungen, Operationen, ein Herzinfarkt oder Krebs. Leicht erhöht oft durch Rauchen, starke körperliche Anstrengung, hormonelle Verhütungsmittel, Übergewicht, Schlafstörungen oder Depression.' },
        { label: 'Einordnung', text: 'Je höher der Wert, desto stärker ist meist die Entzündung. Wo sie sitzt und woher sie kommt, zeigt der Wert nicht. Leicht erhöhte Werte sind gewöhnlich harmlos; dauerhaft erhöhte können mit einem höheren Herz-Kreislauf-Risiko einhergehen.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen, bei Fieber zeitnah. Sofort den Notruf 112 wählen bei Fieber mit Schüttelfrost, plötzlicher Verwirrtheit, schneller Atmung, Herzrasen oder starkem Krankheitsgefühl – das können Zeichen einer Blutvergiftung (Sepsis) sein.' },
      ],
    },
    en: {
      hinweis: 'The value also depends on age, body weight and sex (women often have slightly higher values) and is affected by smoking and hormone preparations. After great exertion, such as a marathon, it rises for a few days. The high-sensitivity test (hs-CRP) detects even very small increases and is used to estimate cardiovascular risk.',
      niedrig: [
        { text: 'A good sign: significant inflammation is unlikely. If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'No sign of marked inflammation. A single value on its own, however, says little.' }],
      hoch: [
        { label: U.en, text: 'Infections with bacteria, viruses or fungi – with bacterial infections the value usually rises especially sharply. Also chronic inflammatory diseases (e.g. rheumatoid arthritis, Crohn’s disease), injuries, burns, operations, a heart attack or cancer. Often slightly raised by smoking, strenuous physical exertion, hormonal contraceptives, obesity, sleep problems or depression.' },
        { label: 'Context', text: 'The higher the value, the stronger the inflammation usually is. The value does not show where it is or what causes it. Slightly raised values are usually harmless; persistently raised values can go along with a higher cardiovascular risk.' },
        { text: 'Have a raised value checked by a doctor, promptly if you have a fever. Call the emergency number (112 in Europe) immediately for fever with chills, sudden confusion, rapid breathing, a racing heart or feeling very unwell – these can be signs of blood poisoning (sepsis).' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: C-reaktives Protein (CRP)', url: 'https://www.gesundheitsinformation.de/c-reaktives-protein-crp.html' },
      { label: 'gesundheitsinformation.de: Was ist eine Entzündung?', url: 'https://www.gesundheitsinformation.de/was-ist-eine-entzuendung.html' },
      { label: 'gesund.bund.de: Sepsis', url: 'https://gesund.bund.de/sepsis' },
      { label: 'MedlinePlus: C-Reactive Protein (CRP) Test', url: 'https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/' },
    ],
  },

  'BSG': {
    de: {
      hinweis: 'Der Normalbereich hängt von Alter und Geschlecht ab. Schwangerschaft, Monatszyklus, Übergewicht, regelmäßiger Alkoholkonsum, Training sowie manche Medikamente und Nahrungsergänzungsmittel können den Wert beeinflussen.',
      niedrig: [
        { label: U.de, text: 'Bluterkrankungen wie zu viele rote Blutkörperchen (Polyzythämie), Sichelzellkrankheit oder stark erhöhte weiße Blutkörperchen; außerdem Herzschwäche und bestimmte Nieren- und Lebererkrankungen.' },
        { label: 'Einordnung', text: 'Ein auffälliger Wert bedeutet nicht immer eine behandlungsbedürftige Erkrankung.' },
        { text: 'Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Kein Hinweis auf eine stärkere Entzündung. Eine Entzündung ist trotz unauffälliger BSG aber möglich.' }],
      hoch: [
        { label: U.de, text: 'Entzündungen verschiedenster Art: Infektionen, rheumatoide Arthritis und andere Autoimmunerkrankungen, Entzündungen der Blutgefäße (z. B. Riesenzellarteriitis), Polymyalgia rheumatica, chronisch-entzündliche Darmerkrankungen. Außerdem Nieren- und Herzerkrankungen sowie bestimmte Krebserkrankungen.' },
        { label: 'Mögliche Anzeichen einer zugrunde liegenden Erkrankung', text: 'Kopfschmerzen, unerklärtes Fieber, ungewollter Gewichtsverlust, Gelenksteife, Nacken- oder Schulterschmerzen, Appetitlosigkeit.' },
        { label: 'Einordnung', text: 'Je schneller die Senkung, desto stärker meist die Entzündung. Welche Erkrankung dahintersteckt, zeigt der Wert allein nicht; ein erhöhter Wert bedeutet auch nicht immer eine behandlungsbedürftige Erkrankung.' },
        { text: 'Ärztlich einordnen lassen, meist zusammen mit dem CRP – besonders bei Beschwerden wie unerklärtem Fieber oder Gewichtsverlust.' },
      ],
    },
    en: {
      hinweis: 'The normal range depends on age and sex. Pregnancy, the menstrual cycle, obesity, regular alcohol consumption, exercise and some medicines and dietary supplements can affect the value.',
      niedrig: [
        { label: U.en, text: 'Blood disorders such as too many red blood cells (polycythaemia), sickle cell disease or a very high white blood cell count; also heart failure and certain kidney and liver diseases.' },
        { label: 'Context', text: 'An abnormal value does not always mean a disease that needs treatment.' },
        { text: 'If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'No sign of marked inflammation. Inflammation is still possible despite a normal ESR.' }],
      hoch: [
        { label: U.en, text: 'Inflammation of many kinds: infections, rheumatoid arthritis and other autoimmune diseases, inflammation of the blood vessels (e.g. giant cell arteritis), polymyalgia rheumatica, inflammatory bowel disease. Also kidney and heart disease and certain cancers.' },
        { label: 'Possible signs of an underlying condition', text: 'Headaches, unexplained fever, unintended weight loss, joint stiffness, neck or shoulder pain, loss of appetite.' },
        { label: 'Context', text: 'The faster the settling, the stronger the inflammation usually is. The value alone does not show which disease is behind it; a raised value also does not always mean a disease that needs treatment.' },
        { text: 'Have it assessed by a doctor, usually together with CRP – especially with symptoms such as unexplained fever or weight loss.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Was ist eine Entzündung?', url: 'https://www.gesundheitsinformation.de/was-ist-eine-entzuendung.html' },
      { label: 'MedlinePlus: Erythrocyte Sedimentation Rate (ESR)', url: 'https://medlineplus.gov/lab-tests/erythrocyte-sedimentation-rate-esr/' },
    ],
  },

  'Homocystein': {
    de: {
      hinweis: 'Manchmal soll man 8 bis 12 Stunden vorher nichts essen oder trinken. Der Wert steigt mit dem Alter und ist bei Männern meist höher; bei Frauen steigt er nach den Wechseljahren. Auch Rauchen beeinflusst ihn. Medikamente und Nahrungsergänzungsmittel, vor allem B-Vitamine, können das Ergebnis verändern – vorher der Praxis sagen, was man einnimmt.',
      niedrig: [
        { text: 'Normalerweise ist der Wert niedrig. Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im üblichen Bereich.' }],
      hoch: [
        { label: U.de, text: 'Zu wenig Vitamin B12, B6 oder Folsäure, z. B. bei Mangelernährung, im höheren Alter (B12 wird dann oft schlechter aufgenommen) oder bei Alkohol- oder Drogenabhängigkeit. Außerdem u. a. chronische Nierenerkrankung und Schilddrüsenunterfunktion. Selten die erbliche Stoffwechselstörung Homocystinurie, die meist schon im Kindesalter auffällt.' },
        { label: 'Mögliche Anzeichen eines Vitaminmangels', text: 'Schwindel, Müdigkeit, Schwäche, Kopfschmerzen, Herzklopfen, wunde Stellen an Zunge oder Mund, Kribbeln oder Taubheit in Händen und Füßen.' },
        { label: F.de, text: 'Hohe Werte können mit einem höheren Risiko für Herzinfarkt, Schlaganfall und Gefäßerkrankungen verbunden sein. Wie stark, ist unsicher: Den Wert zu senken, hat das Risiko in Studien meist nicht verringert. Ein Mangel an B-Vitaminen selbst kann zu Blutarmut und Nervenschäden führen.' },
        { text: 'Die Ursache ärztlich abklären lassen, besonders bei Beschwerden wie Kribbeln oder Taubheit.' },
      ],
    },
    en: {
      hinweis: 'Sometimes you should not eat or drink for 8 to 12 hours beforehand. The value rises with age and is usually higher in men; in women it rises after menopause. Smoking affects it too. Medicines and dietary supplements, especially B vitamins, can change the result – tell your practice beforehand what you take.',
      niedrig: [
        { text: 'The value is normally low. If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'The value is in the usual range.' }],
      hoch: [
        { label: U.en, text: 'Too little vitamin B12, B6 or folic acid, e.g. with malnutrition, in older age (B12 is then often absorbed less well) or with alcohol or drug dependence. Also, among others, chronic kidney disease and an underactive thyroid. Rarely the inherited metabolic disorder homocystinuria, which usually shows up in childhood.' },
        { label: 'Possible signs of a vitamin deficiency', text: 'Dizziness, tiredness, weakness, headache, palpitations, sores on the tongue or in the mouth, tingling or numbness in the hands and feet.' },
        { label: F.en, text: 'High values can be linked to a higher risk of heart attack, stroke and blood vessel disease. How strongly is uncertain: in studies, lowering the value mostly did not reduce the risk. A lack of B vitamins itself can lead to anaemia and nerve damage.' },
        { text: 'Have the cause clarified by a doctor, especially with symptoms such as tingling or numbness.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Homocystinurie', url: 'https://www.msdmanuals.com/de/heim/gesundheitsprobleme-von-kindern/erbliche-stoffwechselst%C3%B6rungen/homocystinurie' },
      { label: 'MedlinePlus: Homocysteine Test', url: 'https://medlineplus.gov/lab-tests/homocysteine-test/' },
    ],
  },
}
