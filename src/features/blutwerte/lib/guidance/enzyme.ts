import type { MarkerGuidance } from '../markerGuidance'

const U = { de: 'Mögliche Ursachen', en: 'Possible causes' }
const F = { de: 'Mögliche Folgen', en: 'Possible consequences' }

/** Enzyme: Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_ENZYME: Record<string, MarkerGuidance> = {
  'LDH': {
    de: {
      hinweis: 'Eine besondere Vorbereitung ist nicht nötig. Platzen bei der Blutabnahme oder im Labor viele rote Blutkörperchen, kann der Wert fälschlich hoch ausfallen. Auch intensiver Sport kann ihn erhöhen.',
      niedrig: [
        { text: 'Selten und meist ohne Bedeutung. Sehr große Mengen Vitamin C oder E können den Wert senken; sehr selten steckt ein angeborener Enzymmangel dahinter.' },
        { text: 'Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein ist er wenig aussagekräftig.' }],
      hoch: [
        { label: U.de, text: 'Verletzungen oder Erkrankungen, die Gewebe schädigen, z. B. von Muskeln und Knochen, Blut (etwa eine Blutarmut), Leber, Lunge, Nieren, Herz (auch ein Herzinfarkt) oder Bauchspeicheldrüse. Außerdem schwere Infektionen und manche Krebserkrankungen. Auch intensiver Sport und bestimmte Medikamente können den Wert erhöhen.' },
        { label: 'Einordnung', text: 'Der Wert allein zeigt nicht, welches Gewebe betroffen ist oder warum. Er wird deshalb zusammen mit anderen Werten und Beschwerden beurteilt; manchmal folgt eine genauere Untersuchung der LDH-Unterformen. Ein erhöhter Wert bedeutet nicht immer eine behandlungsbedürftige Erkrankung.' },
        { text: 'Einen erhöhten Wert ärztlich einordnen lassen, zusammen mit Beschwerden und anderen Befunden.' },
      ],
    },
    en: {
      hinweis: 'No special preparation is needed. If many red blood cells burst during the blood draw or in the lab, the value can be falsely high. Intense exercise can also raise it.',
      niedrig: [
        { text: 'Rare and usually without significance. Very large amounts of vitamin C or E can lower the value; very rarely an inherited enzyme deficiency is behind it.' },
        { text: 'If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it says little.' }],
      hoch: [
        { label: U.en, text: 'Injuries or diseases that damage tissue, e.g. of the muscles and bones, blood (such as anaemia), liver, lungs, kidneys, heart (including a heart attack) or pancreas. Also severe infections and some cancers. Intense exercise and certain medicines can also raise the value.' },
        { label: 'Context', text: 'The value alone does not show which tissue is affected or why. It is therefore assessed together with other values and symptoms; sometimes a more detailed test of the LDH subtypes follows. A raised value does not always mean a disease that needs treatment.' },
        { text: 'Have a raised value assessed by a doctor, together with symptoms and other findings.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Laborwerte richtig verstehen', url: 'https://www.gesundheitsinformation.de/laborwerte-richtig-verstehen.html' },
      { label: 'MedlinePlus: Lactate Dehydrogenase (LDH) Test', url: 'https://medlineplus.gov/lab-tests/lactate-dehydrogenase-ldh-test/' },
      { label: 'MedlinePlus: LDH Isoenzymes Test', url: 'https://medlineplus.gov/lab-tests/lactate-dehydrogenase-ldh-isoenzymes-test/' },
    ],
  },

  'Kreatinkinase': {
    de: {
      hinweis: 'Manchmal wird geraten, einige Tage vor der Blutabnahme auf intensiven Sport und Alkohol zu verzichten. Der übliche Wert hängt von Alter, Geschlecht, Muskelmasse und körperlicher Aktivität ab. Nach einer Verletzung erreicht er seinen Höchststand manchmal erst nach bis zu zwei Tagen.',
      niedrig: [
        { text: 'Ein niedriger Wert hat keine gesundheitliche Bedeutung. Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Aus diesem Wert ergibt sich kein Hinweis auf einen Muskelschaden. Ein einzelner Wert sagt allein aber wenig aus.' }],
      hoch: [
        { label: U.de, text: 'Schon eine starke Belastung der Muskeln kann den Wert erhöhen, etwa intensiver Sport, schweres Heben, Muskelkater oder eine Prellung nach einem Sturz; bei Frauen auch eine Geburt. Außerdem Muskelerkrankungen (z. B. Entzündungen, Muskelschwund), Drogen und Alkohol, bestimmte Medikamente (z. B. Cholesterinsenker), Infektionen und Überhitzung, etwa durch einen Hitzschlag. Ein erhöhter Wert kann auch auf eine Schädigung des Herzmuskels hinweisen, z. B. durch einen Herzinfarkt oder eine Herzmuskelentzündung.' },
        { label: 'Warnzeichen für einen Muskelzerfall (Rhabdomyolyse)', text: 'Muskelschmerzen und Muskelschwäche, vor allem an Schultern, Oberschenkeln und im Kreuz, sowie rötlich-brauner, dunkler Urin. Leichte Formen können unbemerkt bleiben.' },
        { label: F.de, text: 'Ein ausgeprägter Muskelzerfall kann die Nieren schädigen, bis hin zum akuten Nierenversagen, und den Kaliumspiegel erhöhen, was Herzrhythmusstörungen begünstigt. Im Krankenhaus lassen sich diese Folgen meist gut behandeln.' },
        { text: 'Einen erhöhten Wert rasch ärztlich abklären lassen – auch nach hartem Training, denn vor allem ein Herzschaden muss ausgeschlossen werden. Zeitnah bei starken Muskelschmerzen, Muskelschwäche oder dunklem Urin. Bei Schmerzen in der Brust sofort den Notruf 112 wählen.' },
      ],
    },
    en: {
      hinweis: 'You are sometimes advised to avoid intense exercise and alcohol for a few days before the blood test. The usual value depends on age, sex, muscle mass and physical activity. After an injury it sometimes only peaks after up to two days.',
      niedrig: [
        { text: 'A low value has no health significance. If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'This value gives no indication of muscle damage. A single value on its own, however, says little.' }],
      hoch: [
        { label: U.en, text: 'Even heavy strain on the muscles can raise the value, e.g. intense exercise, heavy lifting, muscle soreness or a bruise from a fall; in women also giving birth. Also muscle diseases (e.g. inflammation, muscle wasting), drugs and alcohol, certain medicines (e.g. cholesterol-lowering medicines), infections and overheating, e.g. from heatstroke. A raised value can also point to damage to the heart muscle, e.g. from a heart attack or inflammation of the heart muscle.' },
        { label: 'Warning signs of muscle breakdown (rhabdomyolysis)', text: 'Muscle pain and muscle weakness, especially in the shoulders, thighs and lower back, and reddish-brown, dark urine. Mild forms can go unnoticed.' },
        { label: F.en, text: 'Marked muscle breakdown can damage the kidneys, up to acute kidney failure, and raise the potassium level, which promotes heart rhythm disorders. In hospital these consequences can usually be treated well.' },
        { text: 'Have a raised value checked by a doctor soon – even after hard training, because above all heart damage must be ruled out. Promptly with severe muscle pain, muscle weakness or dark urine. With chest pain, call the emergency number (112 in Europe) immediately.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Kreatinkinase', url: 'https://www.gesundheitsinformation.de/kreatinkinase.html' },
      { label: 'gesund.bund.de: Rhabdomyolyse', url: 'https://gesund.bund.de/rhabdomyolyse' },
      { label: 'gesund.bund.de: Herzinfarkt', url: 'https://gesund.bund.de/herzinfarkt' },
      { label: 'MedlinePlus: Creatine Kinase Test', url: 'https://medlineplus.gov/lab-tests/creatine-kinase/' },
      { label: 'MedlinePlus: Rhabdomyolysis', url: 'https://medlineplus.gov/ency/article/000473.htm' },
    ],
  },

  'Amylase': {
    de: {
      hinweis: 'Vor der Blutabnahme 24 Stunden keinen Alkohol trinken; manchmal soll man kurz vorher auch nüchtern sein – das sagt die Praxis. Auch Medikamente können den Wert beeinflussen. Für die Frage nach einer Entzündung der Bauchspeicheldrüse gilt Lipase als genauer.',
      niedrig: [
        { label: U.de, text: 'Selten. Möglich ist eine dauerhafte Schädigung der Bauchspeicheldrüse, etwa durch eine chronische Entzündung oder Mukoviszidose. Außerdem Lebererkrankungen und in der Schwangerschaft eine Präeklampsie (eine Form von Bluthochdruck).' },
        { text: 'Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Eine Entzündung schließt das nicht sicher aus: Die Werte sinken nach 3 bis 7 Tagen wieder, und nach früheren Entzündungen steigen sie manchmal kaum noch an.' }],
      hoch: [
        { label: U.de, text: 'Vor allem eine akute Entzündung der Bauchspeicheldrüse, am häufigsten durch Gallensteine oder viel Alkohol. Außerdem ein verstopfter Gang der Bauchspeicheldrüse, gutartige oder bösartige Tumoren der Bauchspeicheldrüse und Erkrankungen der Speicheldrüsen.' },
        { label: 'Typische Anzeichen einer akuten Bauchspeicheldrüsenentzündung', text: 'Plötzliche, sehr starke Schmerzen im Oberbauch, die in den Rücken ausstrahlen können, meist mit Übelkeit und Erbrechen; oft auch Fieber und ein aufgeblähter Bauch.' },
        { label: F.de, text: 'Meist ist eine akute Entzündung nach etwa einer Woche überstanden. Ein schwerer Verlauf kann aber lebensbedrohlich sein; wiederholte Entzündungen können in eine dauerhafte (chronische) übergehen.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen. Bei plötzlichen, sehr starken Bauchschmerzen – besonders, wenn sie in den Rücken ausstrahlen oder mit Herzrasen oder Atemnot einhergehen – sofort den Notruf 112 wählen.' },
      ],
    },
    en: {
      hinweis: 'Do not drink alcohol for 24 hours before the blood test; sometimes you also need to fast shortly beforehand – your practice will tell you. Medicines can also affect the value. When checking for inflammation of the pancreas, lipase is considered more accurate.',
      niedrig: [
        { label: U.en, text: 'Rare. Possible is permanent damage to the pancreas, e.g. from chronic inflammation or cystic fibrosis. Also liver disease and, in pregnancy, pre-eclampsia (a form of high blood pressure).' },
        { text: 'If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. This does not reliably rule out inflammation: the values fall again after 3 to 7 days, and after previous episodes they sometimes hardly rise at all.' }],
      hoch: [
        { label: U.en, text: 'Mainly acute inflammation of the pancreas, most often due to gallstones or heavy drinking. Also a blocked duct of the pancreas, benign or malignant tumours of the pancreas, and salivary gland disorders.' },
        { label: 'Typical signs of acute pancreatitis', text: 'Sudden, very severe pain in the upper abdomen that can spread to the back, usually with nausea and vomiting; often also fever and a bloated abdomen.' },
        { label: F.en, text: 'Acute inflammation is usually over after about a week. A severe course can, however, be life-threatening; repeated episodes can turn into a long-term (chronic) inflammation.' },
        { text: 'Have a raised value checked by a doctor. With sudden, very severe abdominal pain – especially if it spreads to the back or comes with a racing heart or difficulty breathing – call the emergency number (112 in Europe) immediately.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Akute Pankreatitis', url: 'https://www.gesundheitsinformation.de/akute-entzuendung-der-bauchspeicheldruese-pankreatitis.html' },
      { label: 'MSD Manual: Akute Pankreatitis', url: 'https://www.msdmanuals.com/de/heim/verdauungsst%C3%B6rungen/pankreatitis/akute-pankreatitis' },
      { label: 'MedlinePlus: Amylase Test', url: 'https://medlineplus.gov/lab-tests/amylase-test/' },
      { label: 'NHS: Acute pancreatitis', url: 'https://www.nhs.uk/conditions/acute-pancreatitis/' },
    ],
  },

  'Lipase': {
    de: {
      hinweis: 'Manchmal soll man vor der Blutabnahme 8 bis 12 Stunden nüchtern sein; das sagt die Praxis. Viele Medikamente können den Wert verändern, z. B. Entwässerungsmittel, bestimmte Cholesterinsenker und die Antibabypille.',
      niedrig: [
        { label: U.de, text: 'Eine dauerhafte Schädigung der Zellen der Bauchspeicheldrüse, die Lipase bilden – etwa bei langwierigen Erkrankungen wie Mukoviszidose oder einer chronischen Entzündung der Bauchspeicheldrüse.' },
        { text: 'Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Eine Entzündung schließt das nicht sicher aus: Die Werte sinken nach 3 bis 7 Tagen wieder, und nach früheren Entzündungen steigen sie manchmal kaum noch an.' }],
      hoch: [
        { label: U.de, text: 'Ein sehr hoher Wert weist meist auf eine akute Entzündung der Bauchspeicheldrüse hin, am häufigsten durch Gallensteine oder viel Alkohol. Erhöhte Werte kommen auch vor bei einem verstopften Gang oder Krebs der Bauchspeicheldrüse, chronischen Nierenerkrankungen, Magengeschwüren, Erkrankungen der Gallenblase, Darmverschluss, Diabetes, Erkrankungen der Speicheldrüsen und Alkoholabhängigkeit.' },
        { label: 'Typische Anzeichen einer akuten Bauchspeicheldrüsenentzündung', text: 'Plötzliche, sehr starke Schmerzen im Oberbauch, die in den Rücken ausstrahlen können, meist mit Übelkeit und Erbrechen; oft auch Fieber und ein aufgeblähter Bauch.' },
        { label: F.de, text: 'Meist ist eine akute Entzündung nach etwa einer Woche überstanden. Ein schwerer Verlauf kann aber lebensbedrohlich sein; wiederholte Entzündungen können in eine dauerhafte (chronische) übergehen.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen. Bei plötzlichen, sehr starken Bauchschmerzen – besonders, wenn sie in den Rücken ausstrahlen oder mit Herzrasen oder Atemnot einhergehen – sofort den Notruf 112 wählen.' },
      ],
    },
    en: {
      hinweis: 'You sometimes need to fast for 8 to 12 hours before the blood test; your practice will tell you. Many medicines can change the value, e.g. water tablets (diuretics), certain cholesterol medicines and the contraceptive pill.',
      niedrig: [
        { label: U.en, text: 'Permanent damage to the cells of the pancreas that make lipase – e.g. in long-term diseases such as cystic fibrosis or chronic inflammation of the pancreas.' },
        { text: 'If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. This does not reliably rule out inflammation: the values fall again after 3 to 7 days, and after previous episodes they sometimes hardly rise at all.' }],
      hoch: [
        { label: U.en, text: 'A very high value usually points to acute inflammation of the pancreas, most often due to gallstones or heavy drinking. Raised values also occur with a blocked duct or cancer of the pancreas, chronic kidney disease, stomach ulcers, gallbladder disease, a blocked bowel, diabetes, salivary gland disorders and alcohol dependence.' },
        { label: 'Typical signs of acute pancreatitis', text: 'Sudden, very severe pain in the upper abdomen that can spread to the back, usually with nausea and vomiting; often also fever and a bloated abdomen.' },
        { label: F.en, text: 'Acute inflammation is usually over after about a week. A severe course can, however, be life-threatening; repeated episodes can turn into a long-term (chronic) inflammation.' },
        { text: 'Have a raised value checked by a doctor. With sudden, very severe abdominal pain – especially if it spreads to the back or comes with a racing heart or difficulty breathing – call the emergency number (112 in Europe) immediately.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Akute Pankreatitis', url: 'https://www.gesundheitsinformation.de/akute-entzuendung-der-bauchspeicheldruese-pankreatitis.html' },
      { label: 'MSD Manual: Akute Pankreatitis', url: 'https://www.msdmanuals.com/de/heim/verdauungsst%C3%B6rungen/pankreatitis/akute-pankreatitis' },
      { label: 'MedlinePlus: Lipase Tests', url: 'https://medlineplus.gov/lab-tests/lipase-tests/' },
      { label: 'NHS: Acute pancreatitis', url: 'https://www.nhs.uk/conditions/acute-pancreatitis/' },
    ],
  },
}
