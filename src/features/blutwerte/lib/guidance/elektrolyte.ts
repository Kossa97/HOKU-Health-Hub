import type { MarkerGuidance } from '../markerGuidance'

/** Elektrolyte: Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_ELEKTROLYTE: Record<string, MarkerGuidance> = {
  'Magnesium': {
    de: {
      hinweis: 'Magnesium wird oft zusammen mit Kalium und Kalzium bestimmt, weil diese Werte häufig gemeinsam verändert sind: Ein niedriger Magnesiumwert geht oft mit niedrigem Kalzium oder Kalium einher. Magnesiumhaltige Präparate, Abführmittel oder Mittel gegen Sodbrennen sollte man der Praxis nennen.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Zu wenig Magnesium über die Nahrung (z. B. einseitige Ernährung, Diäten, Essstörungen), ein höherer Bedarf (etwa durch viel Sport, Schwangerschaft oder Stillen), übermäßiger Alkoholkonsum, länger anhaltender Durchfall oder Erbrechen, Darmerkrankungen mit gestörter Aufnahme, Diabetes und bestimmte Medikamente, z. B. Entwässerungsmittel, manche Antibiotika und Magensäureblocker bei Dauereinnahme.' },
        { label: 'Typische Anzeichen', text: 'Lange oft keine; die Beschwerden sind meist wenig eindeutig. Möglich sind Muskelkrämpfe (z. B. in den Waden), Kribbeln oder Taubheitsgefühl in Armen und Beinen, Müdigkeit, Schwäche, Appetitlosigkeit, Übelkeit und Herzrasen; bei schwerem Mangel Herzrhythmusstörungen und Krampfanfälle.' },
        { text: 'Ein leicht erniedrigter Wert ist meist harmlos. Stark erniedrigte Werte oder anhaltende Beschwerden ärztlich abklären lassen, damit die Ursache gefunden wird.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Beschwerden wie Muskelkrämpfe haben oft auch andere Ursachen.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Selten. Meist arbeiten die Nieren eingeschränkt, etwa bei Nierenschwäche, und es kommt Magnesium von außen hinzu – z. B. durch magnesiumhaltige Abführmittel, Mittel gegen Sodbrennen oder Nahrungsergänzungsmittel. Über die Nahrung allein ist ein zu hoher Wert selten. Außerdem Flüssigkeitsmangel und bestimmte Hormonstörungen (z. B. Schilddrüsenunterfunktion, Addison-Krankheit).' },
        { label: 'Typische Anzeichen', text: 'Muskelschwäche, Übelkeit, Durchfall, Bauchkrämpfe, niedriger Blutdruck; bei starkem Überschuss Atembeschwerden und Herzrhythmusstörungen.' },
        { label: 'Mögliche Folgen', text: 'Ein sehr hoher Wert kann zum Herzstillstand führen.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen, weil er auf eine ernstzunehmende Erkrankung, etwa der Nieren, hinweisen kann.' },
      ],
    },
    en: {
      hinweis: 'Magnesium is often measured together with potassium and calcium, because these values frequently change together: a low magnesium level often goes along with low calcium or potassium. Tell your practice about magnesium-containing products, laxatives or heartburn remedies you take.',
      niedrig: [
        { label: 'Possible causes', text: 'Too little magnesium from food (e.g. a one-sided diet, dieting, eating disorders), increased need (e.g. from a lot of sport, pregnancy or breastfeeding), excessive alcohol, prolonged diarrhoea or vomiting, bowel diseases with impaired absorption, diabetes, and certain medicines, e.g. diuretics (water tablets), some antibiotics and stomach acid blockers taken long-term.' },
        { label: 'Typical signs', text: 'Often none for a long time; symptoms are usually not very specific. Possible are muscle cramps (e.g. in the calves), tingling or numbness in the arms and legs, tiredness, weakness, loss of appetite, nausea and a racing heart; with severe deficiency, heart rhythm disorders and seizures.' },
        { text: 'A slightly low value is usually harmless. Have markedly low values or persistent symptoms checked by a doctor so the cause can be found.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. Symptoms such as muscle cramps often have other causes too.' }],
      hoch: [
        { label: 'Possible causes', text: 'Rare. Usually the kidneys are not working fully, e.g. with kidney failure, and extra magnesium is taken in – e.g. from magnesium-containing laxatives, heartburn remedies or dietary supplements. A level that is too high from food alone is rare. Also a lack of fluid and certain hormone disorders (e.g. an underactive thyroid, Addison’s disease).' },
        { label: 'Typical signs', text: 'Muscle weakness, nausea, diarrhoea, abdominal cramps, low blood pressure; with a marked excess, breathing problems and heart rhythm disorders.' },
        { label: 'Possible consequences', text: 'A very high level can lead to cardiac arrest.' },
        { text: 'Have a raised value checked by a doctor, because it can point to a serious condition, for example of the kidneys.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Magnesium', url: 'https://www.gesundheitsinformation.de/magnesium.html' },
      { label: 'gesund.bund.de: Magnesiummangel', url: 'https://gesund.bund.de/magnesiummangel' },
      { label: 'MSD Manual: Hypomagnesiämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hypomagnesi%C3%A4mie-niedriger-magnesiumspiegel-im-blut' },
      { label: 'MSD Manual: Hypermagnesiämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hypermagnesi%C3%A4mie-hoher-magnesiumspiegel-im-blut' },
      { label: 'MedlinePlus: Magnesium Blood Test', url: 'https://medlineplus.gov/lab-tests/magnesium-blood-test/' },
    ],
  },

  'Kalium': {
    de: {
      hinweis: 'Der Wert kann falsch hoch ausfallen, wenn bei der Blutabnahme rote Blutkörperchen zerplatzen (Hämolyse), der Arm lange gestaut oder die Faust wiederholt geballt wird; eine Hämolyse kann das Labor vermerken. Im Blutplasma liegen die Normalwerte etwas niedriger als im Blutserum.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Meist Verluste über den Darm, etwa durch Erbrechen, Durchfall oder die dauerhafte Einnahme von Abführmitteln. Außerdem Entwässerungsmittel und andere Medikamente wie Kortison, Erkrankungen der Nebennieren oder der Nieren, starkes Schwitzen, ein niedriger Magnesiumwert und große Mengen echter Lakritze. Zu wenig Kalium in der Nahrung ist selten die Ursache.' },
        { label: 'Typische Anzeichen', text: 'Ein leicht niedriger Wert macht meist keine Beschwerden. Stärker ausgeprägt sind Muskelschwäche, Muskelkrämpfe, Zittern, Müdigkeit, Verstopfung und ein beschleunigter oder unregelmäßiger Herzschlag möglich.' },
        { label: 'Mögliche Folgen', text: 'Herzrhythmusstörungen – bei Herzerkrankungen oder bestimmten Herzmedikamenten auch schon bei leichtem Mangel. Hält der Mangel lange an, können Nierenprobleme entstehen.' },
        { text: 'Ärztlich abklären lassen, damit die Ursache gefunden wird; bei Herzstolpern, Herzrasen oder deutlicher Muskelschwäche zeitnah.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Eingeordnet wird er meist zusammen mit den anderen Elektrolyten.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Manchmal ist nur die Blutprobe betroffen (siehe Hinweis); dann wird der Wert wiederholt. Häufig scheidet der Körper zu wenig Kalium aus, etwa bei Nierenerkrankungen, bestimmten Hormonstörungen (z. B. Addison-Krankheit) oder durch bestimmte Medikamente, darunter manche Blutdrucksenker, kaliumsparende Entwässerungsmittel und Schmerzmittel wie NSAR. Außerdem Zellschäden bei schweren Verletzungen, Verbrennungen oder Muskelzerfall, eine Übersäuerung des Blutes (z. B. bei entgleistem Diabetes), sehr starke und lange körperliche Anstrengung und Kaliumpräparate. Viel Kalium über die Nahrung allein führt bei gesunden Nieren oft nicht zu einem zu hohen Wert.' },
        { label: 'Typische Anzeichen', text: 'Ein leicht erhöhter Wert macht selten Beschwerden. Möglich sind Muskelschwäche, Müdigkeit, Übelkeit, Taubheit oder Kribbeln und ein verlangsamter oder unregelmäßiger Herzschlag.' },
        { label: 'Mögliche Folgen', text: 'Stark erhöhte Werte können lebensbedrohliche Herzrhythmusstörungen bis zum Herzstillstand auslösen.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen. Ein stark erhöhter Wert braucht sofort ärztliche Hilfe, besonders zusammen mit Herzstolpern oder Muskelschwäche.' },
      ],
    },
    en: {
      hinweis: 'The value can be falsely high if red blood cells burst during the blood draw (haemolysis), a tourniquet is left on the arm for a long time, or the fist is clenched repeatedly; the lab may note haemolysis. Normal values in blood plasma are slightly lower than in blood serum.',
      niedrig: [
        { label: 'Possible causes', text: 'Usually losses via the gut, e.g. from vomiting, diarrhoea or long-term use of laxatives. Also diuretics (water tablets) and other medicines such as cortisone, diseases of the adrenal glands or kidneys, heavy sweating, a low magnesium level and large amounts of real liquorice. Too little potassium in the diet is rarely the cause.' },
        { label: 'Typical signs', text: 'A slightly low value usually causes no symptoms. When more pronounced, muscle weakness, muscle cramps, trembling, tiredness, constipation and a fast or irregular heartbeat are possible.' },
        { label: 'Possible consequences', text: 'Heart rhythm disorders – with heart disease or certain heart medicines even with a mild deficiency. If the deficiency lasts a long time, kidney problems can develop.' },
        { text: 'Have it checked by a doctor so the cause can be found; promptly with palpitations, a racing heart or marked muscle weakness.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. It is usually assessed together with the other electrolytes.' }],
      hoch: [
        { label: 'Possible causes', text: 'Sometimes only the blood sample is affected (see note); the test is then repeated. Often the body excretes too little potassium, e.g. with kidney disease, certain hormone disorders (e.g. Addison’s disease) or due to certain medicines, including some blood pressure medicines, potassium-sparing diuretics and painkillers such as NSAIDs. Also cell damage from severe injuries, burns or muscle breakdown, acidification of the blood (e.g. with poorly controlled diabetes), very strenuous and prolonged physical exertion, and potassium supplements. A lot of potassium from food alone often does not lead to a high level when the kidneys are healthy.' },
        { label: 'Typical signs', text: 'A slightly raised value rarely causes symptoms. Possible are muscle weakness, tiredness, nausea, numbness or tingling and a slow or irregular heartbeat.' },
        { label: 'Possible consequences', text: 'Markedly raised levels can trigger life-threatening heart rhythm disorders, up to cardiac arrest.' },
        { text: 'Have a raised value checked by a doctor. A markedly raised value needs medical help immediately, especially together with palpitations or muscle weakness.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Kalium', url: 'https://www.gesundheitsinformation.de/kalium.html' },
      { label: 'MSD Manual: Hyperkaliämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hyperkali%C3%A4mie-hoher-kaliumspiegel-im-blut' },
      { label: 'MSD Manual: Hypokaliämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hypokali%C3%A4mie-niedriger-kaliumspiegel-im-blut' },
      { label: 'MSD Manual (Profi): Hyperkaliämie', url: 'https://www.msdmanuals.com/de/profi/nephrologie/elektrolytst%C3%B6rungen/hyperkali%C3%A4mie' },
      { label: 'MedlinePlus: Potassium Blood Test', url: 'https://medlineplus.gov/lab-tests/potassium-blood-test/' },
    ],
  },

  'Natrium': {
    de: {
      hinweis: 'Natrium zeigt vor allem, ob Salz und Wasser im Körper im richtigen Verhältnis stehen: Ein niedriger Wert kommt häufig von zu viel Wasser, ein hoher häufig von zu wenig Wasser. Auch Medikamente, Alter und manche Erkrankungen beeinflussen den Wert.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Häufig ist nicht zu wenig Natrium, sondern zu viel Wasser im Körper – etwa wenn man sehr viel auf einmal trinkt, z. B. wenn Marathonläufer den Schweißverlust nur mit Wasser ersetzen. Außerdem Herz-, Nieren- oder Leberschwäche, Erbrechen und Durchfall, bestimmte Medikamente (vor allem Entwässerungsmittel, aber auch manche Antidepressiva und Schmerzmittel), Hormonstörungen (z. B. Schilddrüsenunterfunktion, Unterfunktion der Nebennieren) und die Droge Ecstasy (MDMA).' },
        { label: 'Typische Anzeichen', text: 'Je nach Ausprägung Kopfschmerzen, Übelkeit, Müdigkeit, Schwäche und Muskelkrämpfe; stärker ausgeprägt Verwirrtheit, Benommenheit, Gleichgewichtsstörungen und Stürze, Muskelzucken und Krampfanfälle. Fällt der Wert schnell ab, sind die Beschwerden oft stärker.' },
        { label: 'Mögliche Folgen', text: 'Ein schwerer Natriummangel kann zur Bewusstlosigkeit (Koma) führen und lebensbedrohlich sein. Ältere Menschen bekommen eher schwere Beschwerden.' },
        { text: 'Ärztlich abklären lassen; ein leicht erniedrigter Wert ist oft kein großes Problem. Bei Verwirrtheit, starker Benommenheit oder Krampfanfällen – auch nach viel Trinken beim Sport – ist es ein Notfall: sofort ärztliche Hilfe holen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein sagt er wenig aus; eingeordnet wird er mit den anderen Elektrolyten.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Meist Flüssigkeitsmangel: zu wenig getrunken – besonders häufig bei älteren oder pflegebedürftigen Menschen und Kindern – oder viel Flüssigkeit verloren, etwa durch starkes Schwitzen, Erbrechen, Durchfall oder Entwässerungsmittel. Außerdem ein sehr hoher Blutzucker bei Diabetes, Nierenstörungen und Hormonstörungen, z. B. der Nebennieren oder solche, bei denen der Körper zu viel Wasser ausscheidet. Seltener sehr viel Salz.' },
        { label: 'Typische Anzeichen', text: 'Vor allem Durst, wenig Urin und Schwindel. Stärker ausgeprägt Verwirrtheit, Muskelzucken und Krampfanfälle.' },
        { label: 'Mögliche Folgen', text: 'Ein starker Überschuss kann zu Kreislaufversagen (Schock) oder Koma führen und lebensbedrohlich sein.' },
        { text: 'Ärztlich abklären lassen; bei leicht erhöhtem Wert ist oft Flüssigkeitsmangel die Ursache. Bei Verwirrtheit, Muskelzucken oder Krampfanfällen sofort ärztliche Hilfe holen.' },
      ],
    },
    en: {
      hinweis: 'Sodium mainly shows whether salt and water in the body are in the right balance: a low value often comes from too much water, a high one often from too little water. Medicines, age and some illnesses also affect the value.',
      niedrig: [
        { label: 'Possible causes', text: 'Often there is not too little sodium but too much water in the body – e.g. when drinking a great deal at once, such as marathon runners replacing sweat losses with water only. Also heart, kidney or liver failure, vomiting and diarrhoea, certain medicines (mainly diuretics, but also some antidepressants and painkillers), hormone disorders (e.g. an underactive thyroid, underactive adrenal glands) and the drug ecstasy (MDMA).' },
        { label: 'Typical signs', text: 'Depending on severity, headache, nausea, tiredness, weakness and muscle cramps; when more pronounced, confusion, drowsiness, balance problems and falls, muscle twitching and seizures. If the level falls quickly, symptoms are often more severe.' },
        { label: 'Possible consequences', text: 'Severe sodium deficiency can lead to unconsciousness (coma) and be life-threatening. Older people are more likely to develop severe symptoms.' },
        { text: 'Have it checked by a doctor; a slightly low value is often not a big problem. Confusion, marked drowsiness or seizures – also after drinking a lot during sport – are an emergency: get medical help immediately.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it says little; it is assessed together with the other electrolytes.' }],
      hoch: [
        { label: 'Possible causes', text: 'Usually a lack of fluid: drinking too little – particularly common in older people, people in need of care, and children – or losing a lot of fluid, e.g. through heavy sweating, vomiting, diarrhoea or diuretics. Also very high blood sugar in diabetes, kidney disorders, and hormone disorders, e.g. of the adrenal glands or ones in which the body excretes too much water. Less often a great deal of salt.' },
        { label: 'Typical signs', text: 'Mainly thirst, passing little urine and dizziness. When more pronounced, confusion, muscle twitching and seizures.' },
        { label: 'Possible consequences', text: 'A marked excess can lead to circulatory failure (shock) or coma and be life-threatening.' },
        { text: 'Have it checked by a doctor; with a slightly raised value, a lack of fluid is often the cause. Get medical help immediately with confusion, muscle twitching or seizures.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Natrium', url: 'https://www.gesundheitsinformation.de/natrium.html' },
      { label: 'MSD Manual: Hyponatriämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hyponatri%C3%A4mie-niedriger-natriumspiegel-im-blut' },
      { label: 'MSD Manual: Hypernatriämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hypernatri%C3%A4mie-hoher-natriumspiegel-im-blut' },
      { label: 'MSD Manual (Profi): Hyponatriämie', url: 'https://www.msdmanuals.com/de/profi/nephrologie/elektrolytst%C3%B6rungen/hyponatri%C3%A4mie' },
      { label: 'MedlinePlus: Sodium Blood Test', url: 'https://medlineplus.gov/lab-tests/sodium-blood-test/' },
      { label: 'MedlinePlus: Low blood sodium', url: 'https://medlineplus.gov/ency/article/000394.htm' },
    ],
  },

  'Kalzium': {
    de: {
      hinweis: 'Meist wird das Gesamtkalzium gemessen; ein großer Teil davon ist an Eiweiß gebunden. Ist wenig Eiweiß (Albumin) im Blut, kann der Gesamtwert niedrig sein, obwohl das freie, wirksame Kalzium ausreicht – dann wird auch Albumin oder das freie (ionisierte) Kalzium bestimmt. Die Einnahme von Vitamin D oder Kalzium sollte man der Praxis nennen.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Wenig Eiweiß im Blut, etwa bei Lebererkrankungen oder Mangelernährung. Außerdem Vitamin-D-Mangel, ein niedriger Magnesiumwert, eine Unterfunktion der Nebenschilddrüsen (z. B. nach einer Operation an der Schilddrüse), Nierenerkrankungen, Magen-Darm-Erkrankungen mit gestörter Aufnahme, eine Entzündung der Bauchspeicheldrüse, wenig Kalzium in der Nahrung und bestimmte Medikamente, z. B. bestimmte Entwässerungsmittel, Kortison und Mittel gegen Epilepsie.' },
        { label: 'Typische Anzeichen', text: 'Ein leicht niedriger Wert macht oft keine Beschwerden. Stärker ausgeprägt: Muskelkrämpfe und steife, schmerzende Muskeln, Kribbeln an Lippen, Zunge, Fingern und Füßen. Bei lange niedrigen Werten trockene Haut, brüchige Nägel und strohiges Haar, auch Verwirrtheit, Vergesslichkeit oder gedrückte Stimmung.' },
        { label: 'Mögliche Folgen', text: 'Ein sehr niedriger Wert kann Muskelkrämpfe (auch der Halsmuskeln mit Atemproblemen), Krampfanfälle und Herzrhythmusstörungen auslösen. Hält ein starker Mangel lange an, können die Knochen geschwächt werden.' },
        { text: 'Ärztlich abklären lassen; ein leicht erniedrigter Wert kann eine harmlose Ursache haben. Bei Kribbeln, Muskelkrämpfen oder Herzstolpern zeitnah.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Über die Knochendichte sagt er nichts aus.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Häufig eine Überfunktion der Nebenschilddrüsen. Außerdem zu viel eingenommenes Vitamin D (oder Vitamin A) über längere Zeit, sehr viel Kalzium etwa durch viel Milch zusammen mit kalziumhaltigen Magenmitteln, Krebserkrankungen (auch mit Befall der Knochen), lange Bettlägerigkeit, eine Schilddrüsenüberfunktion und bestimmte Medikamente, z. B. bestimmte Entwässerungsmittel oder Lithium. Selten eine erbliche Ursache.' },
        { label: 'Typische Anzeichen', text: 'Ein leichter Überschuss macht oft keine Beschwerden. Möglich sind Verstopfung, Übelkeit, Erbrechen, Bauchschmerzen, Appetitlosigkeit, viel Durst und häufiges Wasserlassen, Müdigkeit, Muskelschwäche sowie Knochen- und Gelenkschmerzen; in schweren Fällen Verwirrtheit.' },
        { label: 'Mögliche Folgen', text: 'Nierensteine, seltener Nierenschäden. Ein starker Überschuss kann Herzrhythmusstörungen und Bewusstseinsstörungen bis zum Koma auslösen und lebensbedrohlich sein.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen; ein stark erhöhter Wert gehört immer in ärztliche Betreuung. Bei Verwirrtheit sofort ärztliche Hilfe holen.' },
      ],
    },
    en: {
      hinweis: 'Usually total calcium is measured; a large part of it is bound to protein. If there is little protein (albumin) in the blood, the total value can be low even though the free, active calcium is sufficient – albumin or free (ionised) calcium is then measured too. Tell your practice if you take vitamin D or calcium.',
      niedrig: [
        { label: 'Possible causes', text: 'Little protein in the blood, e.g. with liver disease or malnutrition. Also vitamin D deficiency, a low magnesium level, underactive parathyroid glands (e.g. after thyroid surgery), kidney disease, gastrointestinal diseases with impaired absorption, inflammation of the pancreas, little calcium in the diet, and certain medicines, e.g. certain diuretics, cortisone and epilepsy medicines.' },
        { label: 'Typical signs', text: 'A slightly low value often causes no symptoms. When more pronounced: muscle cramps and stiff, painful muscles, tingling in the lips, tongue, fingers and feet. With long-lasting low levels, dry skin, brittle nails and coarse hair, also confusion, forgetfulness or low mood.' },
        { label: 'Possible consequences', text: 'A very low level can trigger muscle cramps (including of the neck muscles, with breathing problems), seizures and heart rhythm disorders. If a marked deficiency lasts a long time, the bones can be weakened.' },
        { text: 'Have it checked by a doctor; a slightly low value can have a harmless cause. Promptly with tingling, muscle cramps or palpitations.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. It says nothing about bone density.' }],
      hoch: [
        { label: 'Possible causes', text: 'Often overactive parathyroid glands. Also too much vitamin D (or vitamin A) taken over a longer period, a great deal of calcium, e.g. from a lot of milk together with calcium-containing antacids, cancers (including those affecting the bones), being bedridden for a long time, an overactive thyroid, and certain medicines, e.g. certain diuretics or lithium. Rarely an inherited cause.' },
        { label: 'Typical signs', text: 'A mild excess often causes no symptoms. Possible are constipation, nausea, vomiting, abdominal pain, loss of appetite, increased thirst and frequent urination, tiredness, muscle weakness, and bone and joint pain; confusion in severe cases.' },
        { label: 'Possible consequences', text: 'Kidney stones, less often kidney damage. A marked excess can trigger heart rhythm disorders and impaired consciousness up to coma and be life-threatening.' },
        { text: 'Have a raised value checked by a doctor; a markedly raised value always needs medical care. Get medical help immediately with confusion.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Kalzium', url: 'https://www.gesundheitsinformation.de/kalzium.html' },
      { label: 'MSD Manual: Hypokalzämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hypokalz%C3%A4mie-niedrige-kalziumspiegel-im-blut' },
      { label: 'MSD Manual: Hyperkalzämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hyperkalz%C3%A4mie-hoher-kalziumspiegel-im-blut' },
      { label: 'MedlinePlus: Calcium Blood Test', url: 'https://medlineplus.gov/lab-tests/calcium-blood-test/' },
    ],
  },

  'Chlorid': {
    de: {
      hinweis: 'Ein abweichender Wert wird fast immer zusammen mit Natrium und weiteren Blut- und manchmal Urinwerten eingeordnet. Viel Trinken, Flüssigkeitsverlust durch Erbrechen oder Durchfall und manche Medikamente, etwa säurebindende Mittel gegen Sodbrennen, können den Wert verändern.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Meist verliert der Körper mehr Chlorid, als er aufnimmt – etwa durch anhaltendes Erbrechen, sehr starkes Schwitzen oder Entwässerungsmittel. Außerdem bestimmte Hormonstörungen (z. B. Addison-Krankheit), Herz- oder Lungenerkrankungen und ein Basenüberschuss im Blut (Alkalose), z. B. durch basische Mittel wie Natron.' },
        { label: 'Mögliche Anzeichen eines Basenüberschusses', text: 'Reizbarkeit, Muskelzucken, Kribbeln in Fingern und Zehen.' },
        { text: 'Die Ursache ärztlich abklären lassen; stärkere Abweichungen gehören in ärztliche Betreuung.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein sagt er wenig aus.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Flüssigkeitsmangel, anhaltender Durchfall, Nierenerkrankungen, Diabetes, bestimmte Hormonstörungen, Sauerstoffmangel und andere Ursachen einer Übersäuerung des Blutes (Azidose). Außerdem sehr viel Salz in der Ernährung oder bestimmte Medikamente.' },
        { label: 'Mögliche Anzeichen einer Übersäuerung', text: 'Übelkeit, Erbrechen, Müdigkeit.' },
        { text: 'Die Ursache ärztlich abklären lassen; dazu werden meist weitere Blut- und Urinwerte bestimmt.' },
      ],
    },
    en: {
      hinweis: 'An abnormal value is almost always assessed together with sodium and other blood values, sometimes also urine values. Drinking a lot, fluid loss from vomiting or diarrhoea, and some medicines, such as antacids for heartburn, can change the value.',
      niedrig: [
        { label: 'Possible causes', text: 'Usually the body loses more chloride than it takes in – e.g. through persistent vomiting, very heavy sweating or diuretics. Also certain hormone disorders (e.g. Addison’s disease), heart or lung disease, and an excess of base in the blood (alkalosis), e.g. from alkaline remedies such as bicarbonate of soda.' },
        { label: 'Possible signs of excess base', text: 'Irritability, muscle twitching, tingling in the fingers and toes.' },
        { text: 'Have the cause checked by a doctor; larger deviations need medical care.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it says little.' }],
      hoch: [
        { label: 'Possible causes', text: 'A lack of fluid, persistent diarrhoea, kidney disease, diabetes, certain hormone disorders, lack of oxygen and other causes of acidification of the blood (acidosis). Also a great deal of salt in the diet or certain medicines.' },
        { label: 'Possible signs of acidification', text: 'Nausea, vomiting, tiredness.' },
        { text: 'Have the cause checked by a doctor; further blood and urine values are usually measured for this.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Chlorid', url: 'https://www.gesundheitsinformation.de/chlorid.html' },
      { label: 'MedlinePlus: Chloride Blood Test', url: 'https://medlineplus.gov/lab-tests/chloride-blood-test/' },
    ],
  },

  'Phosphat': {
    de: {
      hinweis: 'Kalzium und Phosphat verhalten sich oft gegenläufig; Phosphat wird deshalb meist zusammen mit Kalzium, Vitamin D und Parathormon beurteilt. Bei Kindern liegt der Wert höher, weil die Knochen noch wachsen. Ob man nüchtern kommen soll, sagt die Praxis.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Eine Überfunktion der Nebenschilddrüsen, Vitamin-D-Mangel, chronischer Durchfall, schwere Mangelernährung, übermäßiger Alkoholkonsum, eine gestörte Aufnahme im Darm und die Dauereinnahme bestimmter Medikamente, z. B. bestimmter Mittel gegen Sodbrennen oder Entwässerungsmittel. Plötzlich stark abfallen kann der Wert bei der Erholung nach schwerer Mangelernährung, einer Diabetes-Entgleisung oder schweren Verbrennungen.' },
        { label: 'Typische Anzeichen', text: 'Ein leicht niedriger Wert macht meist keine Beschwerden. Bei sehr niedrigen Werten Muskelschwäche und -schmerzen, Knochenschmerzen, Verwirrtheit oder starke Reizbarkeit, Krampfanfälle.' },
        { label: 'Mögliche Folgen', text: 'Auf Dauer schwächere, weiche Knochen mit Schmerzen und Brüchen, bei Kindern Rachitis. Ein plötzlicher starker Abfall kann Herzrhythmusstörungen auslösen und lebensbedrohlich sein.' },
        { text: 'Ärztlich abklären lassen; ein stark erniedrigter Wert braucht sofort ärztliche Behandlung.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein sagt er wenig aus.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Meist eine eingeschränkte Nierenfunktion, besonders bei fortgeschrittener Nierenerkrankung. Seltener eine Unterfunktion der Nebenschilddrüsen, eine Übersäuerung des Blutes (z. B. bei einer Diabetes-Entgleisung), Muskelzerfall oder schwere Quetschungen, schwere Infektionen (Sepsis) sowie phosphathaltige Abführmittel oder Einläufe.' },
        { label: 'Typische Anzeichen', text: 'Meist keine. Sinkt dadurch das Kalzium, sind Muskelkrämpfe möglich; Ablagerungen in der Haut können stark jucken.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Vor allem bei Nierenerkrankungen geschwächte Knochen und Verkalkungen in den Blutgefäßen mit höherem Risiko für Herzinfarkt und Schlaganfall.' },
        { text: 'Ärztlich abklären lassen, besonders bei einer bekannten Nierenerkrankung.' },
      ],
    },
    en: {
      hinweis: 'Calcium and phosphate often move in opposite directions; phosphate is therefore usually assessed together with calcium, vitamin D and parathyroid hormone. In children the value is higher because their bones are still growing. Your practice will tell you whether to come fasting.',
      niedrig: [
        { label: 'Possible causes', text: 'Overactive parathyroid glands, vitamin D deficiency, chronic diarrhoea, severe malnutrition, excessive alcohol, impaired absorption in the gut, and long-term use of certain medicines, e.g. certain antacids or diuretics. The level can drop sharply and suddenly during recovery from severe malnutrition, a diabetic emergency (ketoacidosis) or severe burns.' },
        { label: 'Typical signs', text: 'A slightly low value usually causes no symptoms. With very low levels, muscle weakness and pain, bone pain, confusion or marked irritability, seizures.' },
        { label: 'Possible consequences', text: 'Over time, weaker, soft bones with pain and fractures; rickets in children. A sudden sharp drop can trigger heart rhythm disorders and be life-threatening.' },
        { text: 'Have it checked by a doctor; a markedly low value needs medical treatment immediately.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it says little.' }],
      hoch: [
        { label: 'Possible causes', text: 'Usually reduced kidney function, especially with advanced kidney disease. Less often underactive parathyroid glands, acidification of the blood (e.g. in a diabetic emergency), muscle breakdown or severe crush injuries, severe infections (sepsis), and phosphate-containing laxatives or enemas.' },
        { label: 'Typical signs', text: 'Usually none. If calcium falls as a result, muscle cramps are possible; deposits in the skin can cause severe itching.' },
        { label: 'Possible long-term consequences', text: 'Mainly with kidney disease, weakened bones and calcification of the blood vessels with a higher risk of heart attack and stroke.' },
        { text: 'Have it checked by a doctor, especially if you have known kidney disease.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Hypophosphatämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hypophosphat%C3%A4mie-niedriger-phosphatspiegel-im-blut' },
      { label: 'MSD Manual: Hyperphosphatämie', url: 'https://www.msdmanuals.com/de/heim/nierenerkrankungen/elektrolythaushalt/hyperphosphat%C3%A4mie-hoher-phosphatspiegel-im-blut' },
      { label: 'MedlinePlus: Phosphate in Blood', url: 'https://medlineplus.gov/lab-tests/phosphate-in-blood/' },
    ],
  },
}
