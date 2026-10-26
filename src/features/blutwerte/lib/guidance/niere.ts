import type { MarkerGuidance } from '../markerGuidance'

const U = { de: 'Mögliche Ursachen', en: 'Possible causes' }
const A = { de: 'Typische Anzeichen', en: 'Typical signs' }

/** Niere: Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_NIERE: Record<string, MarkerGuidance> = {
  'Kreatinin': {
    de: {
      hinweis: 'Der übliche Bereich hängt von Geschlecht und Alter ab. Fleisch kann den Wert vorübergehend erhöhen; manchmal soll man vor der Blutabnahme kein Fleisch essen – das sagt die Praxis. Eingenommene Medikamente und Nahrungsergänzungsmittel, auch Kreatin, der Praxis vorher nennen.',
      niedrig: [
        { label: U.de, text: 'Wenig Muskelmasse, etwa bei starkem Untergewicht, Mangelernährung, langer Bettlägerigkeit, Muskelabbau im Alter oder Muskelerkrankungen. In der Schwangerschaft ist der Wert natürlicherweise niedriger. Seltener eine schwere Lebererkrankung.' },
        { label: 'Einordnung', text: 'Ein niedriger Wert ist nicht häufig und hat meist wenig Bedeutung.' },
        { text: 'Die Ursache ärztlich klären lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Eine beginnende Nierenschwäche schließt das nicht aus, weil Kreatinin erst deutlich steigt, wenn die Nieren schon etwa die Hälfte ihrer Leistung verloren haben.' }],
      hoch: [
        { label: 'Mögliche Ursachen ohne Nierenproblem', text: 'Viel Muskelmasse (z. B. bei Kraftsportlern), Kreatin-Präparate, eine sehr fleischreiche Ernährung, intensives Training, Muskelverletzungen und Flüssigkeitsmangel.' },
        { label: 'Mögliche Ursachen an den Nieren', text: 'Häufig eine chronische Nierenschwäche, oft als Folge von Diabetes oder Bluthochdruck. Außerdem Entzündungen der Niere, ein gestörter Harnabfluss (z. B. durch Nierensteine), eine Herzschwäche, schwere Infektionen (Sepsis), Reaktionen auf Kontrastmittel und bestimmte Medikamente, etwa Schmerzmittel bei langer Einnahme oder manche Blutdruckmittel.' },
        { label: A.de, text: 'Eine Nierenschwäche macht lange oft keine Beschwerden. Später möglich: Wassereinlagerungen an Beinen oder im Gesicht, Müdigkeit, Übelkeit, Appetitlosigkeit, Juckreiz, Atemnot, mehr oder weniger Urin als sonst.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Bei einer dauerhaft eingeschränkten Nierenfunktion steigt das Risiko für Herzinfarkt und Schlaganfall; auch Blutarmut und Knochenschäden sind möglich.' },
        { text: 'Ärztlich abklären lassen; meist wird der Wert wiederholt und mit eGFR und Urintest eingeordnet. Bei viel Muskelmasse kann zusätzlich Cystatin C bestimmt werden. Zeitnah, wenn plötzlich viel weniger Urin kommt oder Schwellungen, Atemnot oder Verwirrtheit auftreten.' },
      ],
    },
    en: {
      hinweis: 'The usual range depends on sex and age. Meat can raise the value temporarily; sometimes you are asked not to eat meat before the blood test – your practice will tell you. Tell your practice beforehand about any medicines and dietary supplements you take, including creatine.',
      niedrig: [
        { label: U.en, text: 'Little muscle mass, e.g. with severe underweight, malnutrition, long periods confined to bed, muscle loss in old age, or muscle diseases. In pregnancy the value is naturally lower. Less often a serious liver disease.' },
        { label: 'Context', text: 'A low value is uncommon and usually of little significance.' },
        { text: 'Have the cause clarified by a doctor.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. This does not rule out early kidney weakness, because creatinine only rises clearly once the kidneys have already lost about half of their function.' }],
      hoch: [
        { label: 'Possible causes without a kidney problem', text: 'A lot of muscle mass (e.g. in strength athletes), creatine supplements, a diet very high in meat, intense exercise, muscle injuries and a lack of fluid.' },
        { label: 'Possible causes in the kidneys', text: 'Often chronic kidney disease, frequently as a result of diabetes or high blood pressure. Also inflammation of the kidney, blocked urine flow (e.g. from kidney stones), heart failure, severe infections (sepsis), reactions to contrast agents and certain medicines, such as painkillers taken over a long time or some blood pressure medicines.' },
        { label: A.en, text: 'Kidney weakness often causes no symptoms for a long time. Later possible: fluid retention in the legs or face, tiredness, nausea, loss of appetite, itching, shortness of breath, passing more or less urine than usual.' },
        { label: 'Possible long-term consequences', text: 'With persistently reduced kidney function, the risk of heart attack and stroke rises; anaemia and bone damage are also possible.' },
        { text: 'Have it checked by a doctor; usually the value is repeated and assessed together with eGFR and a urine test. With a lot of muscle mass, cystatin C can also be measured. Promptly if you suddenly pass much less urine or develop swelling, shortness of breath or confusion.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Kreatinin', url: 'https://www.gesundheitsinformation.de/kreatinin.html' },
      { label: 'gesundheitsinformation.de: Chronische Nierenkrankheit', url: 'https://www.gesundheitsinformation.de/chronische-nierenkrankheit-niereninsuffizienz.html' },
      { label: 'MSD Manual: Beurteilung des Patienten mit Nierenproblemen', url: 'https://www.msdmanuals.com/de/profi/nephrologie/vorgehen-beim-patienten-mit-nierenerkrankungen/beurteilung-des-patienten-mit-nierenproblemen' },
      { label: 'MSD Manual: Kreatin', url: 'https://www.msdmanuals.com/de/profi/spezielle-fachgebiete/nahrungserg%C3%A4nzungsmittel/kreatin' },
      { label: 'MedlinePlus: Creatinine Test', url: 'https://medlineplus.gov/lab-tests/creatinine-test/' },
      { label: 'NHS: Acute kidney injury', url: 'https://www.nhs.uk/conditions/acute-kidney-injury/' },
    ],
  },

  'eGFR': {
    de: {
      hinweis: 'Die eGFR wird aus dem Kreatinin sowie Alter und Geschlecht berechnet. Was das Kreatinin erhöht – viel Muskelmasse, Kreatin-Präparate, Fleisch vor der Blutabnahme –, lässt die eGFR niedriger erscheinen. Die Filterleistung nimmt mit dem Alter natürlicherweise ab: bei jungen Erwachsenen etwa 120 bis 130, mit 70 Jahren etwa 75.',
      niedrig: [
        { label: U.de, text: 'Eine eingeschränkte Nierenfunktion, am häufigsten durch Diabetes oder Bluthochdruck; außerdem Entzündungen der Niere, ein gestörter Harnabfluss, angeborene Nierenerkrankungen oder bestimmte Medikamente bei langer Einnahme, vor allem Schmerzmittel. Auch der natürliche Rückgang im Alter. Der Wert kann aber auch ohne Nierenschaden niedrig ausfallen, etwa bei viel Muskelmasse.' },
        { label: 'Einordnung', text: 'Werte zwischen 60 und 90 können auf eine frühe Nierenerkrankung hinweisen, Werte unter 60 auf eine Nierenerkrankung. Von einer chronischen Nierenkrankheit spricht man erst, wenn die Einschränkung länger als drei Monate besteht.' },
        { label: A.de, text: 'In frühen Stadien meist keine. Später möglich: Wassereinlagerungen, Müdigkeit, Übelkeit, Appetitlosigkeit, Juckreiz, Atemnot, häufiges Wasserlassen in der Nacht.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Ein höheres Risiko für Herzinfarkt und Schlaganfall, Blutarmut und Knochenschäden. Ein vollständiges Nierenversagen ist selten.' },
        { text: 'Ärztlich einordnen lassen; meist wird der Wert wiederholt und mit einem Urintest auf Eiweiß ergänzt. Bei viel Muskelmasse kann eine Schätzung über Cystatin C genauer sein. Zeitnah, wenn plötzlich viel weniger Urin kommt oder Schwellungen oder Atemnot auftreten.' },
      ],
      bereich: [{ text: 'Nach dieser Schätzung filtern die Nieren ausreichend. Eine Nierenschädigung, die sich nur im Urin zeigt, schließt das nicht aus.' }],
      hoch: [
        { text: 'Ein hoher Wert ist in der Regel nicht auffällig: Bei jungen, gesunden Erwachsenen liegt die Filterleistung oft bei etwa 120 bis 130. Bei sehr wenig Muskelmasse, z. B. durch Mangelernährung oder Muskelschwund, ist die Schätzung allerdings unzuverlässig.' },
        { text: 'Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
    },
    en: {
      hinweis: 'The eGFR is calculated from creatinine together with age and sex. Anything that raises creatinine – a lot of muscle mass, creatine supplements, meat before the blood test – makes the eGFR look lower. Filtering capacity naturally declines with age: about 120 to 130 in young adults, about 75 at age 70.',
      niedrig: [
        { label: U.en, text: 'Reduced kidney function, most often due to diabetes or high blood pressure; also inflammation of the kidney, blocked urine flow, inherited kidney diseases, or certain medicines taken over a long time, especially painkillers. Also the natural decline with age. The value can, however, be low without kidney damage, for example with a lot of muscle mass.' },
        { label: 'Context', text: 'Values between 60 and 90 can point to early kidney disease, values below 60 to kidney disease. Chronic kidney disease is only diagnosed when the reduction lasts longer than three months.' },
        { label: A.en, text: 'Usually none in early stages. Later possible: fluid retention, tiredness, nausea, loss of appetite, itching, shortness of breath, needing to pee often at night.' },
        { label: 'Possible long-term consequences', text: 'A higher risk of heart attack and stroke, anaemia and bone damage. Complete kidney failure is rare.' },
        { text: 'Have it assessed by a doctor; usually the value is repeated and supplemented with a urine test for protein. With a lot of muscle mass, an estimate based on cystatin C can be more accurate. Promptly if you suddenly pass much less urine or develop swelling or shortness of breath.' },
      ],
      bereich: [{ text: 'According to this estimate, the kidneys are filtering adequately. This does not rule out kidney damage that shows only in the urine.' }],
      hoch: [
        { text: 'A high value is generally not a concern: in young, healthy adults the filtering capacity is often around 120 to 130. With very little muscle mass, e.g. from malnutrition or muscle wasting, the estimate is unreliable, however.' },
        { text: 'If unsure, have it assessed by a doctor.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Verlauf der chronischen Nierenkrankheit', url: 'https://www.gesundheitsinformation.de/wie-verlaeuft-eine-chronische-nierenkrankheit-niereninsuffizienz.html' },
      { label: 'gesundheitsinformation.de: Chronische Nierenkrankheit', url: 'https://www.gesundheitsinformation.de/chronische-nierenkrankheit-niereninsuffizienz.html' },
      { label: 'MSD Manual: Beurteilung des Patienten mit Nierenproblemen', url: 'https://www.msdmanuals.com/de/profi/nephrologie/vorgehen-beim-patienten-mit-nierenerkrankungen/beurteilung-des-patienten-mit-nierenproblemen' },
      { label: 'MedlinePlus: eGFR and GFR Tests', url: 'https://medlineplus.gov/lab-tests/estimated-glomerular-filtration-rate-egfr-and-gfr-tests/' },
      { label: 'NHS: Chronic kidney disease – Diagnosis', url: 'https://www.nhs.uk/conditions/kidney-disease/diagnosis/' },
      { label: 'NHS: Acute kidney injury', url: 'https://www.nhs.uk/conditions/acute-kidney-injury/' },
    ],
  },

  'Harnstoff': {
    de: {
      hinweis: 'Der Wert hängt stark davon ab, wie viel Eiweiß man isst, und ist für die Nierenfunktion recht ungenau; er wird deshalb mit dem Kreatinin beurteilt. Er ist bei Männern etwas höher und steigt mit dem Alter. Manche Labore geben stattdessen Harnstoff-Stickstoff (BUN) an – der ist nur etwa halb so hoch und nicht direkt vergleichbar.',
      niedrig: [
        { label: U.de, text: 'Meist eine eiweißarme Ernährung, z. B. bei manchen Menschen, die sich vegan ernähren. Außerdem Mangelernährung, schwere Lebererkrankungen und langjähriger hoher Alkoholkonsum. In der Schwangerschaft ist der Wert normalerweise niedriger.' },
        { label: 'Einordnung', text: 'Ein niedriger Wert ist meistens harmlos.' },
        { text: 'Trotzdem ärztlich abklären lassen, weil auch eine ernstere Erkrankung dahinterstecken kann.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein sagt er wenig über die Nieren aus.' }],
      hoch: [
        { label: U.de, text: 'Häufig viel Eiweiß in der Nahrung, z. B. bei Kraftsportlern mit eiweißreicher Ernährung, oder Flüssigkeitsmangel. Außerdem vermehrter Eiweißabbau in belastenden Situationen (z. B. nach Operationen, Verbrennungen), Blutungen im Magen-Darm-Trakt, ein kürzlicher Herzinfarkt, bestimmte Medikamente (z. B. Kortison), ein gestörter Harnabfluss (z. B. durch Harnsteine) und Nierenerkrankungen – durch die Nieren steigt der Wert aber erst merklich, wenn sie schon über drei Viertel ihrer Funktion verloren haben.' },
        { label: 'Typische Anzeichen einer fortgeschrittenen Nierenschwäche', text: 'Mehr oder weniger Urin als sonst, Juckreiz, Müdigkeit, Schwellungen an Armen oder Beinen, Muskelkrämpfe, Schlafprobleme.' },
        { text: 'Die Ursache ärztlich abklären lassen, zusammen mit dem Kreatinin. Zeitnah, wenn plötzlich viel weniger Urin kommt oder Schwellungen oder Atemnot auftreten.' },
      ],
    },
    en: {
      hinweis: 'The value depends heavily on how much protein you eat and is fairly imprecise for kidney function; it is therefore assessed together with creatinine. It is somewhat higher in men and rises with age. Some labs report blood urea nitrogen (BUN) instead – it is only about half as high and not directly comparable.',
      niedrig: [
        { label: U.en, text: 'Usually a low-protein diet, e.g. in some people who eat vegan. Also malnutrition, serious liver disease and long-term heavy drinking. In pregnancy the value is normally lower.' },
        { label: 'Context', text: 'A low value is usually harmless.' },
        { text: 'Still have it checked by a doctor, because a more serious illness can also be behind it.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it says little about the kidneys.' }],
      hoch: [
        { label: U.en, text: 'Often a lot of protein in the diet, e.g. in strength athletes on a high-protein diet, or a lack of fluid. Also increased protein breakdown in stressful situations (e.g. after surgery, burns), bleeding in the gastrointestinal tract, a recent heart attack, certain medicines (e.g. cortisone), blocked urine flow (e.g. from urinary stones) and kidney disease – but the kidneys only raise the value noticeably once they have lost more than three quarters of their function.' },
        { label: 'Typical signs of advanced kidney weakness', text: 'Passing more or less urine than usual, itching, tiredness, swelling in the arms or legs, muscle cramps, sleep problems.' },
        { text: 'Have the cause checked by a doctor, together with creatinine. Promptly if you suddenly pass much less urine or develop swelling or shortness of breath.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Harnstoff', url: 'https://www.gesundheitsinformation.de/harnstoff.html' },
      { label: 'MSD Manual: Beurteilung des Patienten mit Nierenproblemen', url: 'https://www.msdmanuals.com/de/profi/nephrologie/vorgehen-beim-patienten-mit-nierenerkrankungen/beurteilung-des-patienten-mit-nierenproblemen' },
      { label: 'MedlinePlus: BUN Test', url: 'https://medlineplus.gov/lab-tests/bun-blood-urea-nitrogen/' },
      { label: 'NHS: Acute kidney injury', url: 'https://www.nhs.uk/conditions/acute-kidney-injury/' },
    ],
  },

  'Harnsäure': {
    de: {
      hinweis: 'Purinreiche Lebensmittel (Fleisch, Innereien, Fisch, Meeresfrüchte) und Alkohol erhöhen den Wert. Bei Männern liegt er höher als bei Frauen. Auch manche Medikamente, z. B. ASS, und Niacin (Vitamin B3) verändern ihn – vor dem Test der Praxis sagen, was man einnimmt.',
      niedrig: [
        { label: 'Einordnung', text: 'Ein niedriger Wert ist selten, macht keine Beschwerden und hat in der Regel keinen Krankheitswert.' },
        { label: U.de, text: 'Meist harnsäuresenkende Medikamente; nur selten seltene Stoffwechselerkrankungen.' },
        { text: 'Bei Unsicherheit die Ursache ärztlich klären lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im üblichen Bereich. Während eines Gichtanfalls kann er allerdings vorübergehend normal sein – eine Gicht schließt das nicht aus.' }],
      hoch: [
        { label: U.de, text: 'Meist scheiden die Nieren zu wenig Harnsäure aus, z. B. bei einer Nierenschwäche. Außerdem viel Fleisch, Innereien, Fisch und Meeresfrüchte, Alkohol (vor allem Bier und Hochprozentiges), stark zuckerhaltige Getränke und bestimmte Medikamente (z. B. Entwässerungsmittel, niedrig dosiertes ASS). Seltener Krebserkrankungen wie Leukämie, Blutbildungsstörungen, eine Krebsbehandlung, Erkrankungen in der Schwangerschaft oder Erbkrankheiten.' },
        { label: 'Typische Anzeichen eines Gichtanfalls', text: 'Oft keine Beschwerden – viele Menschen haben erhöhte Werte ohne Gicht. Bei einem Anfall schwillt ein Gelenk, meist das Grundgelenk des großen Zehs, oft nachts oder früh morgens plötzlich an und wird sehr schmerzhaft, gerötet und warm.' },
        { label: 'Mögliche Folgen', text: 'Nur etwa ein Drittel der Menschen mit erhöhtem Wert bekommt Gicht. Auf Dauer möglich: wiederkehrende Anfälle, Gichtknoten, Gelenkschäden sowie Nieren- und Harnsteine.' },
        { text: 'Ärztlich abklären lassen; ohne Beschwerden muss ein erhöhter Wert nicht unbedingt behandelt werden. Zeitnah bei einem plötzlich schmerzhaft geschwollenen Gelenk, besonders mit Fieber oder Schüttelfrost – dahinter kann auch eine Gelenkinfektion stecken.' },
      ],
    },
    en: {
      hinweis: 'Purine-rich foods (meat, offal, fish, seafood) and alcohol raise the value. It is higher in men than in women. Some medicines, e.g. aspirin, and niacin (vitamin B3) also change it – tell your practice what you take before the test.',
      niedrig: [
        { label: 'Context', text: 'A low value is rare, causes no symptoms and is generally not a sign of disease.' },
        { label: U.en, text: 'Usually medicines that lower uric acid; only rarely rare metabolic disorders.' },
        { text: 'If unsure, have the cause clarified by a doctor.' },
      ],
      bereich: [{ text: 'The value is in the usual range. During a gout attack, however, it can be temporarily normal – so this does not rule out gout.' }],
      hoch: [
        { label: U.en, text: 'Usually the kidneys excrete too little uric acid, e.g. with kidney weakness. Also a lot of meat, offal, fish and seafood, alcohol (especially beer and spirits), very sugary drinks and certain medicines (e.g. diuretics, low-dose aspirin). Less often cancers such as leukaemia, blood-forming disorders, cancer treatment, conditions in pregnancy or inherited diseases.' },
        { label: 'Typical signs of a gout attack', text: 'Often no symptoms – many people have raised levels without gout. In an attack, a joint – usually the base of the big toe – suddenly swells, often at night or early in the morning, and becomes very painful, red and warm.' },
        { label: 'Possible consequences', text: 'Only about one in three people with a raised level develops gout. Possible over time: recurring attacks, gout nodules (tophi), joint damage, and kidney and urinary stones.' },
        { text: 'Have it checked by a doctor; without symptoms a raised level does not necessarily need treatment. Promptly if a joint suddenly becomes painful and swollen, especially with fever or chills – this can also be a joint infection.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Harnsäure', url: 'https://www.gesundheitsinformation.de/harnsaeure.html' },
      { label: 'gesundheitsinformation.de: Gicht', url: 'https://www.gesundheitsinformation.de/gicht.html' },
      { label: 'gesund.bund.de: Gicht', url: 'https://gesund.bund.de/gicht' },
      { label: 'MedlinePlus: Uric Acid Test', url: 'https://medlineplus.gov/lab-tests/uric-acid-test/' },
      { label: 'NHS: Gout', url: 'https://www.nhs.uk/conditions/gout/' },
    ],
  },

  'Cystatin C': {
    de: {
      hinweis: 'Cystatin C ist ein Eiweiß, das alle Körperzellen bilden und die Nieren ausfiltern. Die Messverfahren sind zwischen Laboren nicht einheitlich; Werte deshalb nur mit dem Bereich desselben Labors vergleichen. Zusammen mit Kreatinin ergibt es eine genauere Schätzung der Filterleistung (eGFR) als jeder Wert allein.',
      niedrig: [
        { text: 'Ein niedriger Wert gilt in der Regel nicht als Krankheitszeichen.' },
        { text: 'Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Aus diesem Wert ergibt sich kein Hinweis auf eine eingeschränkte Filterleistung der Nieren. Eine Nierenschädigung, die sich nur im Urin zeigt, schließt das nicht aus.' }],
      hoch: [
        { label: 'Einordnung', text: 'Ein erhöhter Wert kann darauf hinweisen, dass die Nieren weniger filtern. Er wird z. B. genutzt, um eine chronische Nierenerkrankung zu bestätigen, wenn die Schätzung über Kreatinin unsicher ist – etwa bei viel oder wenig Muskelmasse.' },
        { label: U.de, text: 'Eine eingeschränkte Nierenfunktion, am häufigsten durch Diabetes oder Bluthochdruck; außerdem Entzündungen der Niere, ein gestörter Harnabfluss, angeborene Nierenerkrankungen oder bestimmte Medikamente bei langer Einnahme, vor allem Schmerzmittel.' },
        { label: A.de, text: 'In frühen Stadien meist keine. Später möglich: Wassereinlagerungen, Müdigkeit, Übelkeit, Appetitlosigkeit, Juckreiz, Atemnot.' },
        { text: 'Ärztlich einordnen lassen, zusammen mit Kreatinin, eGFR und einem Urintest.' },
      ],
    },
    en: {
      hinweis: 'Cystatin C is a protein made by all body cells and filtered out by the kidneys. Measurement methods are not standardised between labs, so only compare values with the same lab’s range. Together with creatinine it gives a more accurate estimate of filtering capacity (eGFR) than either value alone.',
      niedrig: [
        { text: 'A low value is generally not considered a sign of disease.' },
        { text: 'If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'This value gives no indication of reduced kidney filtering. This does not rule out kidney damage that shows only in the urine.' }],
      hoch: [
        { label: 'Context', text: 'A raised value can point to the kidneys filtering less. It is used, for example, to confirm chronic kidney disease when the creatinine-based estimate is uncertain – such as with a lot of or very little muscle mass.' },
        { label: U.en, text: 'Reduced kidney function, most often due to diabetes or high blood pressure; also inflammation of the kidney, blocked urine flow, inherited kidney diseases, or certain medicines taken over a long time, especially painkillers.' },
        { label: A.en, text: 'Usually none in early stages. Later possible: fluid retention, tiredness, nausea, loss of appetite, itching, shortness of breath.' },
        { text: 'Have it assessed by a doctor, together with creatinine, eGFR and a urine test.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Chronische Nierenkrankheit', url: 'https://www.gesundheitsinformation.de/chronische-nierenkrankheit-niereninsuffizienz.html' },
      { label: 'gesundheitsinformation.de: Verlauf der chronischen Nierenkrankheit', url: 'https://www.gesundheitsinformation.de/wie-verlaeuft-eine-chronische-nierenkrankheit-niereninsuffizienz.html' },
      { label: 'MSD Manual: Nierenfunktionstests', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/diagnose-von-nierenerkrankungen/nierenfunktionstests' },
      { label: 'MSD Manual: Beurteilung des Patienten mit Nierenproblemen', url: 'https://www.msdmanuals.com/de/profi/nephrologie/vorgehen-beim-patienten-mit-nierenerkrankungen/beurteilung-des-patienten-mit-nierenproblemen' },
      { label: 'MedlinePlus: eGFR and GFR Tests', url: 'https://medlineplus.gov/lab-tests/estimated-glomerular-filtration-rate-egfr-and-gfr-tests/' },
    ],
  },
}
