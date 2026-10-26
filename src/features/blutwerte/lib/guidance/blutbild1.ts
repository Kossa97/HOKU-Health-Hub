import type { MarkerGuidance } from '../markerGuidance'

const U = { de: 'Mögliche Ursachen', en: 'Possible causes' }
const A = { de: 'Typische Anzeichen', en: 'Typical signs' }
const F = { de: 'Mögliche Folgen', en: 'Possible consequences' }

/** Blutbild (rote/weiße Blutkörperchen, Blutplättchen, Erythrozyten-Indizes): Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_BLUTBILD1: Record<string, MarkerGuidance> = {
  'Hämoglobin': {
    de: {
      hinweis: 'Frauen haben niedrigere Normalwerte als Männer. Flüssigkeitsmangel, Rauchen und ein Wohnort in großer Höhe können den Wert erhöhen. In der Schwangerschaft nimmt die Blutmenge stärker zu als die Zahl der roten Blutkörperchen; der Wert kann dadurch vorübergehend sinken.',
      niedrig: [
        { label: U.de, text: 'Am häufigsten Eisenmangel – etwa die Hälfte aller Blutarmuten entsteht so. Außerdem Mangel an Vitamin B12 oder Folsäure, Blutverlust (z. B. starke Regelblutung oder Blutungen im Magen-Darm-Trakt), chronische Erkrankungen etwa der Nieren oder des Darms, bestimmte Infektionen, Erkrankungen des Knochenmarks und angeborene Störungen der Blutbildung wie eine Thalassämie. Im Alter kommt eine Blutarmut häufiger vor.' },
        { label: A.de, text: 'Eine Blutarmut entwickelt sich meist langsam und bleibt oft lange unbemerkt. Möglich sind Blässe, Müdigkeit, Kopfschmerzen, Schwächegefühl, Schwindel, Konzentrationsprobleme und Kurzatmigkeit bei Anstrengung.' },
        { label: F.de, text: 'Bei starker Blutarmut ist die Sauerstoffversorgung des Körpers gefährdet. Bei Menschen ab 65 kann schon eine leichte Blutarmut die Leistungsfähigkeit mindern und das Risiko für Herzschwäche oder Herzinfarkt erhöhen.' },
        { text: 'Auch einen leicht erniedrigten Wert ärztlich abklären lassen, damit die Ursache gefunden wird – besonders bei schwarzem, teerartigem Stuhl oder Blut im Stuhl oder Urin, weil das auf eine Blutung hinweisen kann.' },
      ],
      bereich: [{ text: 'Aus diesem Wert ergibt sich kein Hinweis auf eine Blutarmut. Beschwerden können trotzdem andere Ursachen haben.' }],
      hoch: [
        { label: U.de, text: 'Häufig Flüssigkeitsmangel, etwa durch starkes Schwitzen, Erbrechen, Durchfall oder zu wenig Trinken – dann ist nicht zu viel Hämoglobin, sondern zu wenig Flüssigkeit im Blut. Außerdem anhaltender Sauerstoffmangel, z. B. durch Rauchen, einen längeren Aufenthalt in großer Höhe, Lungen- oder Herzerkrankungen oder nächtliche Atemaussetzer (Schlafapnoe). Auch Nierenerkrankungen, Testosteron oder Anabolika. Selten vermehren sich die Blutzellen im Knochenmark krankhaft (Polycythaemia vera).' },
        { label: A.de, text: 'Oft keine. Möglich sind Schwäche, Müdigkeit, Kopfschmerzen, Benommenheit und Kurzatmigkeit.' },
        { label: F.de, text: 'Sind tatsächlich zu viele rote Blutkörperchen im Blut, kann es leichter zu Blutgerinnseln kommen – mit dem Risiko einer Thrombose, Lungenembolie, eines Herzinfarkts oder Schlaganfalls.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen. Sofort Hilfe holen bei einem schmerzenden, geschwollenen, geröteten Bein, plötzlicher Atemnot oder Brustschmerz; bei Verdacht auf Herzinfarkt oder Schlaganfall den Notruf 112 wählen.' },
      ],
    },
    en: {
      hinweis: 'Women have lower normal values than men. A lack of fluid, smoking and living at high altitude can raise the value. In pregnancy the blood volume increases more than the number of red blood cells, so the value can fall temporarily.',
      niedrig: [
        { label: U.en, text: 'Most often iron deficiency – about half of all anaemias develop this way. Also a lack of vitamin B12 or folate, blood loss (e.g. heavy periods or bleeding in the gastrointestinal tract), chronic illnesses, for example of the kidneys or the gut, certain infections, bone marrow diseases and inherited disorders of blood formation such as thalassaemia. Anaemia is more common in older age.' },
        { label: A.en, text: 'Anaemia usually develops slowly and often goes unnoticed for a long time. Paleness, tiredness, headaches, feeling weak, dizziness, difficulty concentrating and shortness of breath on exertion are possible.' },
        { label: F.en, text: 'With severe anaemia the body’s oxygen supply is at risk. In people aged 65 and over, even mild anaemia can reduce physical fitness and raise the risk of heart failure or heart attack.' },
        { text: 'Have even a slightly low value checked by a doctor so the cause can be found – especially with black, tarry stools or blood in the stools or urine, as this can point to bleeding.' },
      ],
      bereich: [{ text: 'This value gives no indication of anaemia. Symptoms can still have other causes.' }],
      hoch: [
        { label: U.en, text: 'Often a lack of fluid, e.g. from heavy sweating, vomiting, diarrhoea or drinking too little – then there is not too much haemoglobin, but too little fluid in the blood. Also ongoing lack of oxygen, e.g. from smoking, a longer stay at high altitude, lung or heart disease, or pauses in breathing at night (sleep apnoea). Also kidney disease, testosterone or anabolic steroids. Rarely, the blood cells in the bone marrow multiply abnormally (polycythaemia vera).' },
        { label: A.en, text: 'Often none. Weakness, tiredness, headaches, light-headedness and shortness of breath are possible.' },
        { label: F.en, text: 'If there really are too many red blood cells in the blood, blood clots can form more easily – with the risk of thrombosis, pulmonary embolism, heart attack or stroke.' },
        { text: 'Have a raised value checked by a doctor. Get help immediately for a painful, swollen, red leg, sudden shortness of breath or chest pain; if a heart attack or stroke is suspected, call the emergency number (112 in Europe).' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Hämoglobin', url: 'https://www.gesundheitsinformation.de/haemoglobin.html' },
      { label: 'gesund.bund.de: Blutarmut', url: 'https://gesund.bund.de/blutarmut-anaemie' },
      { label: 'MSD Manual: Blutarmut', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/an%C3%A4mie/%C3%BCberblick-%C3%BCber-an%C3%A4mie' },
      { label: 'MSD Manual: Sekundäre Erythrozytose', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/myeloproliferative-erkrankungen/sekund%C3%A4re-erythrozytose' },
      { label: 'MedlinePlus: Hemoglobin Test', url: 'https://medlineplus.gov/lab-tests/hemoglobin-test/' },
      { label: 'NHS: Erythrocytosis', url: 'https://www.nhs.uk/conditions/erythrocytosis/' },
    ],
  },

  'Erythrozyten': {
    de: {
      hinweis: 'Die Zahl der roten Blutkörperchen wird zusammen mit Hämoglobin und Hämatokrit beurteilt. Frauen haben etwas niedrigere Normalwerte als Männer. Flüssigkeitsmangel kann den Wert erhöhen, eine Schwangerschaft ihn senken.',
      niedrig: [
        { label: U.de, text: 'Meist eine Blutarmut, oft durch Eisenmangel, aber auch durch Mangel an Vitamin B12 oder Folsäure. Außerdem Blutverlust, Mangelernährung, chronische Erkrankungen etwa der Nieren oder des Darms, übermäßiger Alkoholkonsum, bestimmte Infektionen, Erkrankungen des Knochenmarks und angeborene Störungen der Blutbildung.' },
        { label: A.de, text: 'Müdigkeit, Schwindel und Leistungsschwäche, weil der Körper weniger gut mit Sauerstoff versorgt wird. Bei stärkerer Blutarmut auch Herzrasen und Kurzatmigkeit bei Anstrengung.' },
        { label: F.de, text: 'Eine starke Blutarmut gefährdet die Sauerstoffversorgung des Körpers.' },
        { text: 'Leicht erniedrigte Werte können eine harmlose Ursache haben. Trotzdem ärztlich abklären lassen, weil auch ernsthafte Erkrankungen dahinterstecken können.' },
      ],
      bereich: [{ text: 'Die Zahl der roten Blutkörperchen liegt im üblichen Bereich. Allein sagt sie wenig aus.' }],
      hoch: [
        { label: U.de, text: 'Flüssigkeitsmangel – dann sind nur scheinbar zu viele Zellen im Blut. Außerdem chronischer Sauerstoffmangel, z. B. durch starkes Rauchen, längeres Leben in großer Höhe, Lungen- oder Herzerkrankungen oder Schlafapnoe. Auch Nierenerkrankungen einschließlich Nierentumoren sowie Anabolika oder Testosteron. Selten eine Erkrankung des Knochenmarks (Polycythaemia vera).' },
        { label: A.de, text: 'Nicht immer. Möglich sind Kopfschmerzen, verschwommenes Sehen, gerötete Haut, Müdigkeit, Schwindel und Juckreiz, vor allem nach dem Baden oder Duschen.' },
        { label: F.de, text: 'Zu viele rote Blutkörperchen können Blutgerinnsel begünstigen und so das Risiko für Thrombose, Lungenembolie, Herzinfarkt und Schlaganfall erhöhen.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen, besonders bei anhaltenden Beschwerden. Sofort Hilfe holen bei einem schmerzenden, geschwollenen Bein, plötzlicher Atemnot oder Brustschmerz; bei Verdacht auf Herzinfarkt oder Schlaganfall den Notruf 112 wählen.' },
      ],
    },
    en: {
      hinweis: 'The red blood cell count is assessed together with haemoglobin and haematocrit. Women have slightly lower normal values than men. A lack of fluid can raise the value, pregnancy can lower it.',
      niedrig: [
        { label: U.en, text: 'Usually anaemia, often due to iron deficiency, but also due to a lack of vitamin B12 or folate. Also blood loss, malnutrition, chronic illnesses, for example of the kidneys or the gut, excessive alcohol use, certain infections, bone marrow diseases and inherited disorders of blood formation.' },
        { label: A.en, text: 'Tiredness, dizziness and reduced performance, because the body is less well supplied with oxygen. With more marked anaemia also a racing heart and shortness of breath on exertion.' },
        { label: F.en, text: 'Severe anaemia puts the body’s oxygen supply at risk.' },
        { text: 'Slightly low values can have a harmless cause. Still have it checked by a doctor, because serious illnesses can also be behind it.' },
      ],
      bereich: [{ text: 'The red blood cell count is in the usual range. On its own it says little.' }],
      hoch: [
        { label: U.en, text: 'A lack of fluid – then there only seem to be too many cells in the blood. Also chronic lack of oxygen, e.g. from heavy smoking, living at high altitude for a long time, lung or heart disease, or sleep apnoea. Also kidney disease including kidney tumours, and anabolic steroids or testosterone. Rarely a bone marrow disease (polycythaemia vera).' },
        { label: A.en, text: 'Not always. Headaches, blurred vision, reddened skin, tiredness, dizziness and itching, especially after a bath or shower, are possible.' },
        { label: F.en, text: 'Too many red blood cells can promote blood clots and so raise the risk of thrombosis, pulmonary embolism, heart attack and stroke.' },
        { text: 'Have a raised value checked by a doctor, especially with persistent symptoms. Get help immediately for a painful, swollen leg, sudden shortness of breath or chest pain; if a heart attack or stroke is suspected, call the emergency number (112 in Europe).' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Erythrozyten', url: 'https://www.gesundheitsinformation.de/erythrozyten.html' },
      { label: 'gesund.bund.de: Blutarmut', url: 'https://gesund.bund.de/blutarmut-anaemie' },
      { label: 'MSD Manual: Sekundäre Erythrozytose', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/myeloproliferative-erkrankungen/sekund%C3%A4re-erythrozytose' },
      { label: 'MedlinePlus: Red Blood Cell (RBC) Count', url: 'https://medlineplus.gov/lab-tests/red-blood-cell-rbc-count/' },
      { label: 'NHS: Erythrocytosis', url: 'https://www.nhs.uk/conditions/erythrocytosis/' },
    ],
  },

  'Leukozyten': {
    de: {
      hinweis: 'Gezählt werden alle weißen Blutkörperchen zusammen. Ist die Zahl auffällig, werden die einzelnen Gruppen meist genauer untersucht (Differentialblutbild). Bei Kindern sind höhere Werte normal; Stress, Rauchen und eine Schwangerschaft können die Zahl erhöhen.',
      niedrig: [
        { label: U.de, text: 'Virusinfekte wie eine Grippe, aber auch schwere Infektionen. Außerdem bestimmte Medikamente (z. B. Krebstherapien oder Mittel gegen eine Schilddrüsenüberfunktion), Strahlentherapie, Autoimmunerkrankungen wie Lupus, HIV, Erkrankungen von Leber oder Milz, Vitamin-B12- oder Folsäuremangel sowie Störungen der Blutbildung im Knochenmark, etwa durch Krebs.' },
        { label: A.de, text: 'Der Wert selbst macht oft keine Beschwerden. Auffallen können häufige oder ungewöhnliche Infekte, Fieber oder schmerzhafte Geschwüre im Mund.' },
        { label: F.de, text: 'Die Abwehr kann geschwächt sein, der Körper ist dann anfälliger für Infektionen – vor allem bei stark erniedrigten Werten. Nach einem Virusinfekt normalisiert sich der Wert oft von selbst wieder.' },
        { text: 'Ärztlich einordnen lassen. Bei bekannt niedrigem Wert und Fieber sofort ärztliche Hilfe holen.' },
      ],
      bereich: [{ text: 'Die Zahl der weißen Blutkörperchen liegt im üblichen Bereich. Über die einzelnen Gruppen sagt der Gesamtwert allein wenig aus.' }],
      hoch: [
        { label: U.de, text: 'Am häufigsten eine Infektion – der Körper bildet dann mehr Abwehrzellen. Außerdem Entzündungen und Autoimmunerkrankungen (z. B. rheumatoide Arthritis), Allergien, Verletzungen, Verbrennungen oder Operationen, Stress, Rauchen, Schwangerschaft und bestimmte Medikamente wie Kortison. Selten Blutkrebs (Leukämie).' },
        { label: A.de, text: 'Hängen von der Ursache ab, bei einer Infektion etwa Fieber, Schüttelfrost und Gliederschmerzen.' },
        { text: 'Ärztlich einordnen lassen. Passt der Wert zu einem bekannten Infekt, ist die Erhöhung meist eine normale Abwehrreaktion. Bleibt sie unklar, folgt in der Regel ein Differentialblutbild.' },
      ],
    },
    en: {
      hinweis: 'All white blood cells are counted together. If the count is abnormal, the individual groups are usually examined more closely (differential blood count). Higher values are normal in children; stress, smoking and pregnancy can raise the count.',
      niedrig: [
        { label: U.en, text: 'Viral infections such as flu, but also severe infections. Also certain medicines (e.g. cancer treatments or medicines for an overactive thyroid), radiotherapy, autoimmune diseases such as lupus, HIV, diseases of the liver or spleen, vitamin B12 or folate deficiency, and disorders of blood formation in the bone marrow, for example due to cancer.' },
        { label: A.en, text: 'The value itself often causes no symptoms. Frequent or unusual infections, fever or painful ulcers in the mouth may be noticed.' },
        { label: F.en, text: 'The immune defence can be weakened, so the body is more prone to infections – especially with very low values. After a viral infection the value often returns to normal on its own.' },
        { text: 'Have it assessed by a doctor. With a known low value and fever, get medical help immediately.' },
      ],
      bereich: [{ text: 'The white blood cell count is in the usual range. On its own, the total says little about the individual groups.' }],
      hoch: [
        { label: U.en, text: 'Most often an infection – the body then makes more immune cells. Also inflammation and autoimmune diseases (e.g. rheumatoid arthritis), allergies, injuries, burns or surgery, stress, smoking, pregnancy and certain medicines such as cortisone. Rarely blood cancer (leukaemia).' },
        { label: A.en, text: 'Depend on the cause; with an infection, for example, fever, chills and aching limbs.' },
        { text: 'Have it assessed by a doctor. If the value fits a known infection, the rise is usually a normal immune response. If it remains unclear, a differential blood count usually follows.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Leukozyten', url: 'https://www.gesundheitsinformation.de/leukozyten-weisse-blutkoerperchen.html' },
      { label: 'MSD Manual: Störungen der weißen Blutkörperchen', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/%C3%BCberblick-%C3%BCber-st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen' },
      { label: 'MSD Manual: Hohe Anzahl weißer Blutkörperchen', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/hohe-anzahl-wei%C3%9Fer-blutk%C3%B6rperchen' },
      { label: 'MSD Manual: Neutropenie', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/neutropenie' },
      { label: 'MedlinePlus: White Blood Count (WBC)', url: 'https://medlineplus.gov/lab-tests/white-blood-count-wbc/' },
    ],
  },

  'Thrombozyten': {
    de: {
      hinweis: 'Frauen haben etwas höhere Normalwerte als Männer, Kinder meist niedrigere. In der Schwangerschaft ist ein leicht niedriger Wert häufig und meist harmlos. Verklumpen die Blutplättchen im Röhrchen, kann der Wert fälschlich niedrig sein; ein Blutausstrich unter dem Mikroskop klärt das.',
      niedrig: [
        { label: U.de, text: 'Virusinfekte (z. B. Pfeiffersches Drüsenfieber, Hepatitis C, HIV), eine Immunthrombozytopenie (der Körper baut die Blutplättchen zu schnell ab), Lebererkrankungen wie eine Zirrhose mit vergrößerter Milz, Vitamin-B12- oder Folsäuremangel, Alkohol, bestimmte Medikamente (z. B. Heparin, manche Antibiotika, Krebsmedikamente), Strahlentherapie sowie Erkrankungen des Knochenmarks einschließlich Leukämie.' },
        { label: A.de, text: 'Bei leicht erniedrigtem Wert oft keine. Bei deutlich niedrigem Wert: schnell blaue Flecken, viele kleine rote Pünktchen auf der Haut (vor allem an den Unterschenkeln), Nasen- oder Zahnfleischbluten, ungewöhnlich starke Regelblutung, Wunden, die schwer aufhören zu bluten.' },
        { label: F.de, text: 'Bei sehr niedrigen Werten sind Blutungen auch ohne Verletzung möglich, z. B. im Darm oder im Gehirn.' },
        { text: 'Einen deutlich erniedrigten Wert ärztlich abklären lassen, besonders bei Blutungszeichen wie vielen roten Pünktchen auf der Haut oder Blut im Stuhl oder Urin.' },
      ],
      bereich: [{ text: 'Die Zahl der Blutplättchen liegt im üblichen Bereich. Ob sie richtig funktionieren, zeigt dieser Wert nicht.' }],
      hoch: [
        { label: U.de, text: 'Meist eine Reaktion des Körpers auf etwas anderes: Infekte und Entzündungen (z. B. chronisch-entzündliche Darmerkrankungen, rheumatoide Arthritis), Blutverlust, Verletzungen oder Operationen, Eisenmangel und die Entfernung der Milz. Auch bestimmte Krebsarten. Seltener eine Erkrankung des Knochenmarks selbst (essenzielle Thrombozythämie).' },
        { label: A.de, text: 'Ist der Wert als Reaktion auf eine andere Erkrankung erhöht, meist keine eigenen. Bei einer Knochenmarkerkrankung möglich: brennende, gerötete Hände und Füße, Kribbeln in Fingern und Füßen, Sehstörungen, leichte Blutungen wie Nasen- oder Zahnfleischbluten.' },
        { label: F.de, text: 'Nach einer akuten Erkrankung normalisiert sich der Wert meist schnell wieder. Bei einer Knochenmarkerkrankung können Blutgerinnsel entstehen – mit dem Risiko für Thrombose, Lungenembolie, Herzinfarkt oder Schlaganfall; sehr hohe Werte können auch Blutungen begünstigen.' },
        { text: 'Leicht erhöhte Werte haben meist eine harmlose Ursache. Trotzdem ärztlich abklären lassen, besonders wenn der Wert ohne erkennbaren Grund erhöht bleibt.' },
      ],
    },
    en: {
      hinweis: 'Women have slightly higher normal values than men, children usually lower ones. In pregnancy a slightly low value is common and usually harmless. If the platelets clump together in the tube, the value can be falsely low; a blood smear under the microscope clarifies this.',
      niedrig: [
        { label: U.en, text: 'Viral infections (e.g. glandular fever, hepatitis C, HIV), immune thrombocytopenia (the body breaks down the platelets too quickly), liver diseases such as cirrhosis with an enlarged spleen, vitamin B12 or folate deficiency, alcohol, certain medicines (e.g. heparin, some antibiotics, cancer medicines), radiotherapy, and bone marrow diseases including leukaemia.' },
        { label: A.en, text: 'Often none with a slightly low value. With a clearly low value: bruising easily, many small red dots on the skin (especially on the lower legs), nose or gum bleeding, unusually heavy periods, wounds that are hard to stop bleeding.' },
        { label: F.en, text: 'With very low values, bleeding is possible even without injury, e.g. in the gut or in the brain.' },
        { text: 'Have a clearly low value checked by a doctor, especially with signs of bleeding such as many red dots on the skin or blood in the stools or urine.' },
      ],
      bereich: [{ text: 'The platelet count is in the usual range. This value does not show whether they work properly.' }],
      hoch: [
        { label: U.en, text: 'Usually the body’s reaction to something else: infections and inflammation (e.g. inflammatory bowel disease, rheumatoid arthritis), blood loss, injuries or surgery, iron deficiency and removal of the spleen. Also certain cancers. Less often a disease of the bone marrow itself (essential thrombocythaemia).' },
        { label: A.en, text: 'If the value is raised in reaction to another illness, usually none of its own. With a bone marrow disease: burning, reddened hands and feet, tingling in the fingers and feet, visual disturbances, mild bleeding such as nose or gum bleeding.' },
        { label: F.en, text: 'After an acute illness the value usually returns to normal quickly. With a bone marrow disease, blood clots can form – with the risk of thrombosis, pulmonary embolism, heart attack or stroke; very high values can also promote bleeding.' },
        { text: 'Slightly raised values usually have a harmless cause. Still have it checked by a doctor, especially if the value stays raised without an obvious reason.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Thrombozyten', url: 'https://www.gesundheitsinformation.de/thrombozyten.html' },
      { label: 'MSD Manual: Thrombozytopenie', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/blutpl%C3%A4ttchenerkrankungen/%C3%BCberblick-%C3%BCber-die-thrombozytopenie' },
      { label: 'MSD Manual: Sekundäre Thrombozythämie', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/myeloproliferative-erkrankungen/sekund%C3%A4re-thrombozyth%C3%A4mie' },
      { label: 'MSD Manual: Essenzielle Thrombozythämie', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/myeloproliferative-erkrankungen/essenzielle-thrombozyth%C3%A4mie' },
      { label: 'MSD Manual (Fachkreise): Diagnose der Anämie', url: 'https://www.msdmanuals.com/de/profi/h%C3%A4matologie/untersuchung-des-an%C3%A4mischen-patienten/diagnose' },
      { label: 'MedlinePlus: Platelet Tests', url: 'https://medlineplus.gov/lab-tests/platelet-tests/' },
    ],
  },

  'MCV': {
    de: {
      hinweis: 'Das MCV wird zusammen mit MCH und MCHC beurteilt; allein ist es nicht aussagekräftig. Sind nach einer Blutung viele junge, größere rote Blutkörperchen im Blut, kann der Wert kurzzeitig steigen.',
      niedrig: [
        { label: U.de, text: 'Meist Eisenmangel – die roten Blutkörperchen sind dann klein und blass, weil ohne Eisen zu wenig Hämoglobin gebildet wird. Seltener angeborene Störungen der Hämoglobinbildung wie eine Thalassämie. Auch chronische Entzündungen, Infektionen oder Erkrankungen der Nieren oder des Knochenmarks können dahinterstecken.' },
        { label: A.de, text: 'Der Wert selbst macht keine Beschwerden. Besteht eine Blutarmut, sind Müdigkeit, Schwäche und Blässe möglich.' },
        { text: 'Zusammen mit den anderen Blutwerten ärztlich abklären lassen. Bei Männern und Frauen ohne Regelblutung kann ein Eisenmangel auf eine Blutung im Verdauungstrakt hinweisen.' },
      ],
      bereich: [{ text: 'Die roten Blutkörperchen sind im Mittel normal groß. Eine Blutarmut schließt das nicht aus.' }],
      hoch: [
        { label: U.de, text: 'Am häufigsten ein Mangel an Vitamin B12 oder Folsäure. Außerdem übermäßiger Alkoholkonsum, Lebererkrankungen, Magenerkrankungen, Erkrankungen der Blutbildung und bestimmte Medikamente, etwa manche Rheuma- und Krebsmittel oder die Antibabypille.' },
        { label: 'Typische Anzeichen bei Vitamin-B12-Mangel', text: 'Müdigkeit, Schwäche und Blässe, dazu Kribbeln oder Taubheitsgefühle, eine wunde, gerötete Zunge, Gedächtnis- oder Konzentrationsprobleme; bei schwerem Mangel Verwirrtheit.' },
        { label: F.de, text: 'Ein länger bestehender Vitamin-B12-Mangel kann die Nerven schädigen; nicht alle Schäden bilden sich zurück.' },
        { text: 'Ärztlich abklären lassen. Ein Vitamin-B12- oder Folsäuremangel sollte möglichst früh erkannt werden.' },
      ],
    },
    en: {
      hinweis: 'MCV is assessed together with MCH and MCHC; on its own it is not meaningful. If there are many young, larger red blood cells in the blood after bleeding, the value can rise briefly.',
      niedrig: [
        { label: U.en, text: 'Usually iron deficiency – the red blood cells are then small and pale, because too little haemoglobin is made without iron. Less often inherited disorders of haemoglobin formation such as thalassaemia. Chronic inflammation, infections or diseases of the kidneys or bone marrow can also be behind it.' },
        { label: A.en, text: 'The value itself causes no symptoms. If anaemia is present, tiredness, weakness and paleness are possible.' },
        { text: 'Have it checked by a doctor together with the other blood values. In men and in women without periods, iron deficiency can point to bleeding in the digestive tract.' },
      ],
      bereich: [{ text: 'The red blood cells are of normal size on average. This does not rule out anaemia.' }],
      hoch: [
        { label: U.en, text: 'Most often a lack of vitamin B12 or folate. Also excessive alcohol use, liver disease, stomach disease, disorders of blood formation and certain medicines, such as some rheumatism and cancer medicines or the contraceptive pill.' },
        { label: 'Typical signs of vitamin B12 deficiency', text: 'Tiredness, weakness and paleness, plus tingling or numbness, a sore, red tongue, memory or concentration problems; confusion with severe deficiency.' },
        { label: F.en, text: 'A longer-standing vitamin B12 deficiency can damage the nerves; not all damage is reversible.' },
        { text: 'Have it checked by a doctor. A lack of vitamin B12 or folate should be detected as early as possible.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: MCV', url: 'https://www.gesundheitsinformation.de/mcv-mittleres-zellvolumen.html' },
      { label: 'MSD Manual: Eisenmangelanämie', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/an%C3%A4mie/eisenmangelan%C3%A4mie' },
      { label: 'MSD Manual: Vitaminmangelanämie', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/an%C3%A4mie/vitaminmangelan%C3%A4mie' },
      { label: 'MSD Manual (Fachkreise): Diagnose der Anämie', url: 'https://www.msdmanuals.com/de/profi/h%C3%A4matologie/untersuchung-des-an%C3%A4mischen-patienten/diagnose' },
      { label: 'MedlinePlus: Red Blood Cell (RBC) Indices', url: 'https://medlineplus.gov/lab-tests/red-blood-cell-rbc-indices/' },
      { label: 'NHS: Vitamin B12 or folate deficiency anaemia', url: 'https://www.nhs.uk/conditions/vitamin-b12-or-folate-deficiency-anaemia/' },
    ],
  },

  'MCH': {
    de: {
      hinweis: 'Das MCH wird aus Hämoglobin und Erythrozytenzahl berechnet und zusammen mit MCV und MCHC beurteilt; allein ist es nicht aussagekräftig. MCH und MCV verändern sich meist in dieselbe Richtung.',
      niedrig: [
        { label: U.de, text: 'Meist Eisenmangel – ohne Eisen kann der Körper nicht genug Hämoglobin bilden. Die roten Blutkörperchen sind dann meist auch kleiner. Seltener eine angeborene Störung wie eine Thalassämie; auch Infektionen oder Erkrankungen der Nieren oder des Knochenmarks können die Blutbildung stören.' },
        { text: 'Zusammen mit den anderen Blutwerten ärztlich abklären lassen, damit die Ursache gefunden wird.' },
      ],
      bereich: [{ text: 'Der Hämoglobingehalt der roten Blutkörperchen liegt im üblichen Bereich. Allein sagt der Wert wenig aus.' }],
      hoch: [
        { label: U.de, text: 'Am häufigsten ein Mangel an Vitamin B12 oder Folsäure; die roten Blutkörperchen sind dann meist auch größer. Außerdem viel Alkohol, chronische Lebererkrankungen, bestimmte Medikamente (z. B. manche Rheumamittel oder hormonelle Verhütungsmittel) und seltener Krebserkrankungen, die die Blutbildung beeinflussen.' },
        { text: 'Zusammen mit den anderen Blutwerten ärztlich abklären lassen, damit die Ursache gefunden wird.' },
      ],
    },
    en: {
      hinweis: 'MCH is calculated from haemoglobin and red blood cell count and assessed together with MCV and MCHC; on its own it is not meaningful. MCH and MCV usually change in the same direction.',
      niedrig: [
        { label: U.en, text: 'Usually iron deficiency – without iron the body cannot make enough haemoglobin. The red blood cells are then usually smaller too. Less often an inherited disorder such as thalassaemia; infections or diseases of the kidneys or bone marrow can also disturb blood formation.' },
        { text: 'Have it checked by a doctor together with the other blood values so the cause can be found.' },
      ],
      bereich: [{ text: 'The haemoglobin content of the red blood cells is in the usual range. On its own the value says little.' }],
      hoch: [
        { label: U.en, text: 'Most often a lack of vitamin B12 or folate; the red blood cells are then usually larger too. Also a lot of alcohol, chronic liver disease, certain medicines (e.g. some rheumatism medicines or hormonal contraceptives) and, less often, cancers that affect blood formation.' },
        { text: 'Have it checked by a doctor together with the other blood values so the cause can be found.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: MCH', url: 'https://www.gesundheitsinformation.de/mch-mittleres-korpuskulaeres-haemoglobin.html' },
      { label: 'MedlinePlus: Red Blood Cell (RBC) Indices', url: 'https://medlineplus.gov/lab-tests/red-blood-cell-rbc-indices/' },
    ],
  },

  'MCHC': {
    de: {
      hinweis: 'Die MCHC wird aus Hämoglobin und Hämatokrit berechnet. Sie bleibt bei vielen Formen der Blutarmut im Normalbereich und ist weniger aussagekräftig als MCV und MCH; Ärztinnen und Ärzte prüfen mit ihr eher, ob die anderen Blutwerte stimmig sind.',
      niedrig: [
        { label: U.de, text: 'Zum Beispiel Eisenmangel oder eine angeborene Störung der Hämoglobinbildung wie eine Thalassämie.' },
        { text: 'Nur zusammen mit MCV, MCH und weiteren Blutwerten aussagekräftig – ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im üblichen Bereich – das ist auch bei vielen Formen der Blutarmut so.' }],
      hoch: [
        { label: U.de, text: 'Selten. Erhöht ist der Wert z. B. bei angeborenen Formen der Blutarmut wie der Kugelzellanämie oder der Sichelzellanämie; die roten Blutkörperchen sind dabei verformt und werden schneller abgebaut.' },
        { text: 'Nur zusammen mit MCV, MCH und weiteren Blutwerten aussagekräftig – ärztlich einordnen lassen.' },
      ],
    },
    en: {
      hinweis: 'MCHC is calculated from haemoglobin and haematocrit. It stays in the normal range in many forms of anaemia and is less meaningful than MCV and MCH; doctors use it more to check whether the other blood values are consistent.',
      niedrig: [
        { label: U.en, text: 'For example iron deficiency or an inherited disorder of haemoglobin formation such as thalassaemia.' },
        { text: 'Only meaningful together with MCV, MCH and other blood values – have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'The value is in the usual range – this is also the case in many forms of anaemia.' }],
      hoch: [
        { label: U.en, text: 'Rare. The value is raised, for example, in inherited forms of anaemia such as hereditary spherocytosis or sickle cell anaemia; the red blood cells are misshapen and are broken down more quickly.' },
        { text: 'Only meaningful together with MCV, MCH and other blood values – have it assessed by a doctor.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: MCHC', url: 'https://www.gesundheitsinformation.de/mchc-mittlere-korpuskulaere-haemoglobin-konzentration.html' },
      { label: 'MedlinePlus: Red Blood Cell (RBC) Indices', url: 'https://medlineplus.gov/lab-tests/red-blood-cell-rbc-indices/' },
    ],
  },

  'RDW': {
    de: {
      hinweis: 'Eine besondere Vorbereitung ist nicht nötig. Die RDW wird zusammen mit dem MCV beurteilt: Liegen kleine und große rote Blutkörperchen gleichzeitig vor, kann das MCV normal sein und nur die RDW auffallen.',
      niedrig: [{ text: 'Die roten Blutkörperchen sind sehr gleichmäßig groß. Das ist kein Zeichen einer Blutarmut und meist ohne Bedeutung. Bei Unsicherheit ärztlich einordnen lassen.' }],
      bereich: [{ text: 'Die roten Blutkörperchen sind ähnlich groß. Eine Blutarmut ist damit nicht ausgeschlossen.' }],
      hoch: [
        { label: U.de, text: 'Unterschiedlich große rote Blutkörperchen kommen z. B. bei Eisenmangel oder Vitamin-B12-Mangel vor, außerdem bei angeborenen Blutkrankheiten wie Thalassämie oder Sichelzellanämie. Ein erhöhter Wert wird auch bei verschiedenen chronischen Erkrankungen beobachtet, etwa von Leber, Herz oder Nieren, bei Diabetes oder bei Krebs.' },
        { text: 'Allein reicht der Wert für eine Aussage nicht. Zusammen mit MCV und den anderen Blutwerten ärztlich einordnen lassen.' },
      ],
    },
    en: {
      hinweis: 'No special preparation is needed. RDW is assessed together with MCV: if small and large red blood cells are present at the same time, MCV can be normal and only RDW stands out.',
      niedrig: [{ text: 'The red blood cells are very uniform in size. This is not a sign of anaemia and is usually without significance. If unsure, have it assessed by a doctor.' }],
      bereich: [{ text: 'The red blood cells are of similar size. This does not rule out anaemia.' }],
      hoch: [
        { label: U.en, text: 'Red blood cells of different sizes occur, for example, with iron deficiency or vitamin B12 deficiency, and also with inherited blood disorders such as thalassaemia or sickle cell anaemia. A raised value is also seen in various chronic diseases, for example of the liver, heart or kidneys, in diabetes or in cancer.' },
        { text: 'The value on its own is not enough to draw conclusions. Have it assessed by a doctor together with MCV and the other blood values.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual (Fachkreise): Diagnose der Anämie', url: 'https://www.msdmanuals.com/de/profi/h%C3%A4matologie/untersuchung-des-an%C3%A4mischen-patienten/diagnose' },
      { label: 'MedlinePlus: RDW', url: 'https://medlineplus.gov/lab-tests/rdw-red-cell-distribution-width/' },
      { label: 'MedlinePlus: Red Blood Cell (RBC) Indices', url: 'https://medlineplus.gov/lab-tests/red-blood-cell-rbc-indices/' },
    ],
  },
}
