import type { MarkerGuidance } from '../markerGuidance'

const U = { de: 'Mögliche Ursachen', en: 'Possible causes' }
const A = { de: 'Typische Anzeichen', en: 'Typical signs' }
const F = { de: 'Mögliche Folgen', en: 'Possible consequences' }
const FD = { de: 'Mögliche Folgen auf Dauer', en: 'Possible long-term consequences' }
const AU = { de: 'Typische Anzeichen einer Unterfunktion', en: 'Typical signs of an underactive thyroid' }
const AH = { de: 'Typische Anzeichen einer Überfunktion', en: 'Typical signs of an overactive thyroid' }
const E = { de: 'Einordnung', en: 'Context' }

/** Stoffwechsel und Schilddrüsenhormone: Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_STOFFWECHSEL: Record<string, MarkerGuidance> = {
  'fT3': {
    de: {
      hinweis: 'fT3 wird meist erst bestimmt, wenn TSH oder fT4 auffällig sind, und immer zusammen mit ihnen eingeordnet. Morgens und abends liegt der Wert höher als tagsüber. Bestimmte Medikamente und Nahrungsergänzungsmittel können ihn verändern – vor dem Bluttest der Praxis sagen, was man einnimmt.',
      niedrig: [
        { label: U.de, text: 'Eine Schilddrüsenunterfunktion, hierzulande am häufigsten durch Hashimoto. Außerdem ausgeprägter Jodmangel, eine Operation oder Radiojodbehandlung der Schilddrüse, manche Medikamente, selten eine Erkrankung der Hirnanhangdrüse. Bei schweren akuten oder chronischen Erkrankungen, beim Fasten oder bei Mangelernährung sinkt fT3 oft, ohne dass die Schilddrüse selbst krank ist.' },
        { label: AU.de, text: 'Müdigkeit, Frieren, Gewichtszunahme, Verstopfung, trockene Haut, gedrückte Stimmung. Viele dieser Beschwerden haben auch andere Ursachen.' },
        { label: F.de, text: 'Eingeschränkte Fruchtbarkeit. Bleibt eine Unterfunktion unbehandelt, sind Kreislaufprobleme möglich.' },
        { text: 'Zusammen mit TSH und fT4 ärztlich abklären; manchmal wird der Wert zunächst nur erneut kontrolliert.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein schließt er eine Schilddrüsenerkrankung nicht aus; aussagekräftig ist er zusammen mit TSH und fT4.' }],
      hoch: [
        { label: U.de, text: 'Meist eine Schilddrüsenüberfunktion, am häufigsten durch Morbus Basedow. Außerdem Knoten, die selbstständig Hormone bilden („heiße Knoten“), eine Schilddrüsenentzündung, zu viel eingenommenes Schilddrüsenhormon, bestimmte Medikamente und viel Jod (etwa durch Kontrastmittel). Selten liegt es an der Hirnanhangdrüse.' },
        { label: AH.de, text: 'Herzrasen, Nervosität, Schwitzen, Gewichtsverlust trotz Appetit, Zittern, Schlafstörungen. Bei Älteren oft weniger typisch.' },
        { label: F.de, text: 'Eine unbehandelte Überfunktion kann Vorhofflimmern und langfristig Knochenschwund begünstigen.' },
        { text: 'Ärztlich abklären; meist wird der Wert noch einmal kontrolliert. Sofort den Notruf 112 wählen bei hohem Fieber, Erbrechen, starker Unruhe, Herzrhythmusstörungen oder Verwirrtheit – das kann eine seltene, lebensbedrohliche Entgleisung sein.' },
      ],
    },
    en: {
      hinweis: 'fT3 is usually only measured when TSH or fT4 is abnormal, and is always assessed together with them. The level is higher in the morning and evening than during the day. Certain medicines and dietary supplements can change it – tell your practice what you take before the blood test.',
      niedrig: [
        { label: U.en, text: 'An underactive thyroid, in Germany most often due to Hashimoto’s. Also marked iodine deficiency, thyroid surgery or radioiodine treatment, some medicines, rarely a disease of the pituitary gland. With severe acute or chronic illness, fasting or malnutrition, fT3 often falls without the thyroid itself being diseased.' },
        { label: AU.en, text: 'Tiredness, feeling cold, weight gain, constipation, dry skin, low mood. Many of these complaints also have other causes.' },
        { label: F.en, text: 'Reduced fertility. If an underactive thyroid is left untreated, circulatory problems are possible.' },
        { text: 'Have it checked by a doctor together with TSH and fT4; sometimes the value is first simply rechecked.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it does not rule out thyroid disease; it is meaningful together with TSH and fT4.' }],
      hoch: [
        { label: U.en, text: 'Usually an overactive thyroid, most often due to Graves’ disease. Also nodules that make hormones on their own (“hot nodules”), thyroiditis, too much thyroid hormone taken, certain medicines and a lot of iodine (e.g. from contrast agents). Rarely the pituitary gland is the cause.' },
        { label: AH.en, text: 'Racing heart, nervousness, sweating, weight loss despite appetite, tremor, sleep problems. Often less typical in older people.' },
        { label: F.en, text: 'An untreated overactive thyroid can promote atrial fibrillation and, in the long term, bone loss.' },
        { text: 'Have it checked by a doctor; the value is usually rechecked. Call the emergency number (112 in Europe) immediately with high fever, vomiting, severe agitation, heart rhythm problems or confusion – this can be a rare, life-threatening crisis.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Freies Trijodthyronin (fT3)', url: 'https://www.gesundheitsinformation.de/freies-trijodthyronin-ft.html' },
      { label: 'gesund.bund.de: Schilddrüsenüberfunktion', url: 'https://gesund.bund.de/schilddruesenueberfunktion' },
      { label: 'gesund.bund.de: Schilddrüsenunterfunktion', url: 'https://gesund.bund.de/schilddruesenunterfunktion' },
      { label: 'MSD Manual: Hyperthyreose', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/schilddr%C3%BCsenerkrankungen/hyperthyreose' },
      { label: 'MSD Manual: Euthyroid-Sick-Syndrom', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/schilddr%C3%BCsenerkrankungen/euthyroid-sick-syndrom' },
      { label: 'MedlinePlus: Triiodothyronine (T3) Tests', url: 'https://medlineplus.gov/lab-tests/triiodothyronine-t3-tests/' },
    ],
  },

  'fT4': {
    de: {
      hinweis: 'fT4 wird meist zusammen mit TSH bestimmt und mit ihm eingeordnet. Schwere Erkrankungen und bestimmte Medikamente, etwa die Antibabypille oder Steroide, können den Wert verändern – vor dem Bluttest der Praxis sagen, was man einnimmt. Bei Neugeborenen und Kindern gelten andere Bereiche.',
      niedrig: [
        { label: U.de, text: 'Eine Schilddrüsenunterfunktion, hierzulande am häufigsten durch Hashimoto. Außerdem ausgeprägter Jodmangel, eine Operation oder Radiojodbehandlung der Schilddrüse, manche Medikamente, bestimmte Phasen einer Schilddrüsenentzündung, selten eine Erkrankung der Hirnanhangdrüse. Auch bei schweren oder lange andauernden Erkrankungen kann fT4 sinken, ohne dass die Schilddrüse selbst krank ist.' },
        { label: AU.de, text: 'Müdigkeit, Frieren, Gewichtszunahme, Verstopfung, trockene Haut, gedrückte Stimmung. Viele dieser Beschwerden haben auch andere Ursachen.' },
        { label: F.de, text: 'Eingeschränkte Fruchtbarkeit. Bleibt eine Unterfunktion unbehandelt, sind Kreislaufprobleme möglich.' },
        { text: 'Zusammen mit TSH ärztlich abklären, besonders bei Beschwerden, Schwangerschaft oder Kinderwunsch; manchmal wird der Wert zunächst nur erneut kontrolliert.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Er wird zusammen mit TSH beurteilt; allein sagt er wenig aus.' }],
      hoch: [
        { label: U.de, text: 'Meist eine Schilddrüsenüberfunktion, am häufigsten durch Morbus Basedow. Außerdem Knoten, die selbstständig Hormone bilden („heiße Knoten“), bestimmte Phasen einer Schilddrüsenentzündung, zu viel eingenommenes Schilddrüsenhormon, bestimmte Medikamente und viel Jod (etwa durch Kontrastmittel oder Algen). Selten liegt es an der Hirnanhangdrüse, z. B. an einem gutartigen Tumor.' },
        { label: AH.de, text: 'Herzrasen, Nervosität, Schwitzen, Gewichtsverlust trotz Appetit, Zittern, Schlafstörungen. Bei Älteren oft weniger typisch.' },
        { label: F.de, text: 'Eine unbehandelte Überfunktion kann Vorhofflimmern und langfristig Knochenschwund begünstigen.' },
        { text: 'Ärztlich abklären; meist wird der Wert noch einmal kontrolliert. Sofort den Notruf 112 wählen bei hohem Fieber, Erbrechen, starker Unruhe, Herzrhythmusstörungen oder Verwirrtheit – das kann eine seltene, lebensbedrohliche Entgleisung sein.' },
      ],
    },
    en: {
      hinweis: 'fT4 is usually measured together with TSH and assessed alongside it. Severe illness and certain medicines, such as the contraceptive pill or steroids, can change the value – tell your practice what you take before the blood test. Different ranges apply to newborns and children.',
      niedrig: [
        { label: U.en, text: 'An underactive thyroid, in Germany most often due to Hashimoto’s. Also marked iodine deficiency, thyroid surgery or radioiodine treatment, some medicines, certain stages of thyroiditis, rarely a disease of the pituitary gland. With severe or prolonged illness, fT4 can also fall without the thyroid itself being diseased.' },
        { label: AU.en, text: 'Tiredness, feeling cold, weight gain, constipation, dry skin, low mood. Many of these complaints also have other causes.' },
        { label: F.en, text: 'Reduced fertility. If an underactive thyroid is left untreated, circulatory problems are possible.' },
        { text: 'Have it checked by a doctor together with TSH, especially with symptoms, pregnancy or when trying for a child; sometimes the value is first simply rechecked.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. It is assessed together with TSH; on its own it says little.' }],
      hoch: [
        { label: U.en, text: 'Usually an overactive thyroid, most often due to Graves’ disease. Also nodules that make hormones on their own (“hot nodules”), certain stages of thyroiditis, too much thyroid hormone taken, certain medicines and a lot of iodine (e.g. from contrast agents or seaweed). Rarely the pituitary gland is the cause, e.g. a benign tumour.' },
        { label: AH.en, text: 'Racing heart, nervousness, sweating, weight loss despite appetite, tremor, sleep problems. Often less typical in older people.' },
        { label: F.en, text: 'An untreated overactive thyroid can promote atrial fibrillation and, in the long term, bone loss.' },
        { text: 'Have it checked by a doctor; the value is usually rechecked. Call the emergency number (112 in Europe) immediately with high fever, vomiting, severe agitation, heart rhythm problems or confusion – this can be a rare, life-threatening crisis.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Freies Thyroxin (fT4)', url: 'https://www.gesundheitsinformation.de/freies-thyroxin-ft.html' },
      { label: 'gesund.bund.de: Schilddrüsenüberfunktion', url: 'https://gesund.bund.de/schilddruesenueberfunktion' },
      { label: 'gesund.bund.de: Schilddrüsenunterfunktion', url: 'https://gesund.bund.de/schilddruesenunterfunktion' },
      { label: 'MSD Manual: Hyperthyreose', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/schilddr%C3%BCsenerkrankungen/hyperthyreose' },
      { label: 'MSD Manual: Euthyroid-Sick-Syndrom', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/schilddr%C3%BCsenerkrankungen/euthyroid-sick-syndrom' },
      { label: 'MedlinePlus: Thyroxine (T4) Test', url: 'https://medlineplus.gov/lab-tests/thyroxine-t4-test/' },
    ],
  },

  'Glukose': {
    de: {
      hinweis: 'Gemessen wird nüchtern: mindestens acht Stunden nichts essen oder trinken außer Wasser, meist morgens vor dem Frühstück. Nach dem Essen steigt der Wert; auch Bewegung, schwere Krankheit, Operationen und bestimmte Medikamente beeinflussen ihn. Bleibt die Blutprobe zu lange liegen, kann der Wert fälschlich niedrig ausfallen.',
      niedrig: [
        { label: U.de, text: 'Meist bei Menschen mit Diabetes, wenn Insulin oder andere blutzuckersenkende Medikamente zu stark wirken, etwa nach einer ausgelassenen Mahlzeit, viel Sport oder Alkohol. Ohne Diabetes selten; dann z. B. Unterernährung, viel Alkohol bei wenig Essen, Leber- oder Nierenerkrankungen, eine Unterfunktion der Nebennieren, bestimmte Medikamente, nach manchen Operationen zur Gewichtsabnahme, selten ein insulinbildender Tumor der Bauchspeicheldrüse. Bei sonst Gesunden führen auch längeres Fasten oder anstrengender Sport kaum zu einer Unterzuckerung.' },
        { label: A.de, text: 'Hunger, Schwitzen, Zittern, Herzklopfen, Nervosität oder Reizbarkeit, Schwindel, Kopfschmerzen, Müdigkeit. Bei starker Unterzuckerung Verwirrtheit, undeutliche Sprache, verschwommenes Sehen, Krampfanfälle bis hin zur Bewusstlosigkeit.' },
        { label: F.de, text: 'Eine schwere, länger dauernde Unterzuckerung kann das Gehirn dauerhaft schädigen.' },
        { text: 'Ärztlich abklären, besonders bei wiederholt niedrigen Werten oder Anzeichen einer Unterzuckerung ohne Diabetes. Sofort den Notruf 112 wählen, wenn jemand bei Verdacht auf Unterzuckerung nicht mehr normal reagiert, krampft oder bewusstlos ist.' },
      ],
      bereich: [{ text: 'Der Nüchternwert liegt im üblichen Bereich. Ein einzelner Wert sagt allein wenig aus; den längerfristigen Verlauf zeigt der HbA1c.' }],
      hoch: [
        { label: U.de, text: 'Am häufigsten ein Prädiabetes (Vorstufe) oder ein Diabetes. Außerdem eine nicht ganz nüchterne Blutabnahme, eine sehr kohlenhydratreiche Ernährung, starke körperliche Belastung durch schwere Krankheit, Operation oder Verletzung, bestimmte Medikamente, eine Schilddrüsenüberfunktion sowie Erkrankungen der Bauchspeicheldrüse oder der Nebennieren.' },
        { label: A.de, text: 'Oft lange keine. Bei dauerhaft hohen Werten möglich: starker Durst, häufiges Wasserlassen, Müdigkeit, verschwommenes Sehen, schlecht heilende Wunden, ungewollter Gewichtsverlust.' },
        { label: FD.de, text: 'Schäden an Blutgefäßen und Nerven, an Augen und Nieren; ein höheres Risiko für Herzinfarkt, Schlaganfall und Durchblutungsstörungen der Beine.' },
        { text: 'Ärztlich abklären; für die Diagnose Diabetes sind mindestens zwei Messungen nötig, weil der Wert schwankt. Sofort ärztliche Hilfe holen bei sehr hohem Zucker mit Erbrechen, Bauchschmerzen, tiefer schneller Atmung, fruchtigem Atemgeruch oder Verwirrtheit; bei Bewusstseinsstörungen den Notruf 112 wählen.' },
      ],
    },
    en: {
      hinweis: 'It is measured fasting: nothing to eat or drink except water for at least eight hours, usually in the morning before breakfast. The value rises after eating; exercise, serious illness, surgery and certain medicines also affect it. If the blood sample is left standing too long, the value can come out falsely low.',
      niedrig: [
        { label: U.en, text: 'Mostly in people with diabetes when insulin or other blood-sugar-lowering medicines act too strongly, e.g. after a skipped meal, a lot of exercise or alcohol. Rare without diabetes; then e.g. malnutrition, a lot of alcohol with little food, liver or kidney disease, underactive adrenal glands, certain medicines, after some weight-loss operations, rarely an insulin-producing tumour of the pancreas. In otherwise healthy people, even longer fasting or strenuous exercise hardly ever causes low blood sugar.' },
        { label: A.en, text: 'Hunger, sweating, shaking, palpitations, nervousness or irritability, dizziness, headache, tiredness. With severe low blood sugar, confusion, slurred speech, blurred vision, seizures and even loss of consciousness.' },
        { label: F.en, text: 'Severe, prolonged low blood sugar can permanently damage the brain.' },
        { text: 'Have it checked by a doctor, especially with repeatedly low values or signs of low blood sugar without diabetes. Call the emergency number (112 in Europe) immediately if someone with suspected low blood sugar is no longer responding normally, has a seizure or is unconscious.' },
      ],
      bereich: [{ text: 'The fasting value is in the usual range. A single value on its own says little; HbA1c shows the longer-term picture.' }],
      hoch: [
        { label: U.en, text: 'Most often prediabetes (an early stage) or diabetes. Also a blood sample that was not fully fasting, a very high-carbohydrate diet, severe physical stress from serious illness, surgery or injury, certain medicines, an overactive thyroid, and diseases of the pancreas or adrenal glands.' },
        { label: A.en, text: 'Often none for a long time. With persistently high values: strong thirst, frequent urination, tiredness, blurred vision, slow-healing wounds, unintended weight loss.' },
        { label: FD.en, text: 'Damage to blood vessels and nerves, to the eyes and kidneys; a higher risk of heart attack, stroke and poor circulation in the legs.' },
        { text: 'Have it checked by a doctor; diagnosing diabetes needs at least two measurements because the value varies. Get medical help immediately with very high blood sugar plus vomiting, abdominal pain, deep rapid breathing, fruity-smelling breath or confusion; with impaired consciousness, call the emergency number (112 in Europe).' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Nüchternblutzucker', url: 'https://www.gesundheitsinformation.de/nuechternblutzucker.html' },
      { label: 'gesund.bund.de: Diabetes Typ 2', url: 'https://gesund.bund.de/diabetes-typ-2' },
      { label: 'MSD Manual: Hypoglykämie (Unterzuckerung)', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/diabetes-mellitus-und-niedriger-blutzucker-hypoglyk%C3%A4mie/hypoglyk%C3%A4mie-unterzuckerung' },
      { label: 'MSD Manual: Akute Komplikationen bei Diabetes mellitus', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/diabetes-mellitus-und-niedriger-blutzucker-hypoglyk%C3%A4mie/akute-komplikationen-bei-diabetes-mellitus' },
      { label: 'MedlinePlus: Blood Glucose Test', url: 'https://medlineplus.gov/lab-tests/blood-glucose-test/' },
      { label: 'NHS: Low blood sugar (hypoglycaemia)', url: 'https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/' },
    ],
  },

  'HbA1c': {
    de: {
      hinweis: 'Der Wert spiegelt die letzten zwei bis drei Monate, weil rote Blutkörperchen etwa so lange leben und der Zucker so lange an ihnen haftet. Nüchtern muss man dafür nicht sein. Blutarmut und andere Erkrankungen der roten Blutkörperchen, Nieren- oder Lebererkrankungen, eine Schwangerschaft und manche Medikamente können den Wert verfälschen.',
      niedrig: [
        { label: U.de, text: 'Meist war der Blutzucker im Durchschnitt einfach niedrig; das hat kaum medizinische Bedeutung. Bei normalem Blutzucker kann dahinterstecken, dass rote Blutkörperchen schneller abgebaut werden. Bei Menschen mit Diabetes auch eine zu starke Blutzuckersenkung.' },
        { text: 'Mit Ärztin oder Arzt besprechen, um die Ursache zu finden – besonders bei einer Diabetes-Behandlung.' },
      ],
      bereich: [{ text: 'Kein Hinweis auf einen dauerhaft erhöhten Blutzucker in den letzten Monaten. Bei Erkrankungen der roten Blutkörperchen ist der Wert nur eingeschränkt aussagekräftig.' }],
      hoch: [
        { label: U.de, text: 'Häufig ein bisher unbehandelter Diabetes oder seine Vorstufe (Prädiabetes, etwa 5,7 bis 6,4 %); bei bekanntem Diabetes eine nicht ausreichende Blutzuckersenkung. Auch eine sehr kohlenhydratreiche Ernährung trägt bei. Bei normalem Blutzucker kann der Wert z. B. nach Entfernung der Milz oder bei Vitamin-B12- oder Folsäuremangel erhöht sein.' },
        { label: A.de, text: 'Oft keine, deshalb bleibt ein erhöhter Wert häufig unbemerkt. Möglich sind starker Durst, häufiges Wasserlassen, Müdigkeit, verschwommenes Sehen, schlecht heilende Wunden, häufigere Infekte.' },
        { label: FD.de, text: 'Schäden an Blutgefäßen und Nerven, an Augen und Nieren; ein höheres Risiko für Herzinfarkt und Schlaganfall.' },
        { text: 'Ärztlich abklären. Für die Diagnose Diabetes sind mindestens zwei Messungen nötig, weil der Wert von Messung zu Messung schwanken kann.' },
      ],
    },
    en: {
      hinweis: 'The value reflects the last two to three months, because red blood cells live about that long and the sugar stays attached to them for that time. You do not need to be fasting. Anaemia and other disorders of the red blood cells, kidney or liver disease, pregnancy and some medicines can distort the value.',
      niedrig: [
        { label: U.en, text: 'Usually the average blood sugar was simply low; this has little medical significance. With normal blood sugar, red blood cells being broken down faster can be behind it. In people with diabetes, also blood sugar being lowered too much.' },
        { text: 'Discuss it with a doctor to find the cause – especially when being treated for diabetes.' },
      ],
      bereich: [{ text: 'No indication of persistently raised blood sugar in recent months. With disorders of the red blood cells, the value is of limited significance.' }],
      hoch: [
        { label: U.en, text: 'Often previously untreated diabetes or its early stage (prediabetes, about 5.7 to 6.4%); with known diabetes, blood sugar not being lowered enough. A very high-carbohydrate diet also contributes. With normal blood sugar, the value can be raised e.g. after removal of the spleen or with vitamin B12 or folate deficiency.' },
        { label: A.en, text: 'Often none, so a raised value frequently goes unnoticed. Possible are strong thirst, frequent urination, tiredness, blurred vision, slow-healing wounds, more frequent infections.' },
        { label: FD.en, text: 'Damage to blood vessels and nerves, to the eyes and kidneys; a higher risk of heart attack and stroke.' },
        { text: 'Have it checked by a doctor. Diagnosing diabetes needs at least two measurements, because the value can vary from one measurement to the next.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: HbA1c', url: 'https://www.gesundheitsinformation.de/hba1c-haemoglobin-a1c-wert.html' },
      { label: 'gesund.bund.de: Diabetes Typ 2', url: 'https://gesund.bund.de/diabetes-typ-2' },
      { label: 'MedlinePlus: Hemoglobin A1C (HbA1c) Test', url: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/' },
      { label: 'MedlinePlus: Blood Glucose Test', url: 'https://medlineplus.gov/lab-tests/blood-glucose-test/' },
    ],
  },

  'Insulin': {
    de: {
      hinweis: 'Gemessen wird meist nüchtern, nach 8 bis 12 Stunden ohne Essen. Insulin steigt und fällt mit dem Blutzucker und wird deshalb zusammen mit ihm beurteilt. Biotin (Vitamin B7) aus Nahrungsergänzungsmitteln und bei Menschen, die Insulin spritzen, Antikörper gegen Insulin können das Ergebnis verfälschen – der Praxis sagen, was man einnimmt.',
      niedrig: [
        { label: E.de, text: 'Insulin sinkt, wenn der Blutzucker sinkt. Ein niedriger Wert allein sagt deshalb wenig aus.' },
        { label: U.de, text: 'Ist zugleich der Blutzucker hoch, kann die Bauchspeicheldrüse zu wenig Insulin bilden, z. B. bei Typ-1-Diabetes oder einer Entzündung der Bauchspeicheldrüse.' },
        { text: 'Zusammen mit dem Blutzucker ärztlich einordnen lassen; zeitnah bei starkem Durst, häufigem Wasserlassen oder ungewolltem Gewichtsverlust.' },
      ],
      bereich: [{ text: 'Der Nüchternwert liegt im üblichen Bereich. Allein ist er wenig aussagekräftig; er wird zusammen mit dem Blutzucker beurteilt.' }],
      hoch: [
        { label: U.de, text: 'Bei normalem oder leicht erhöhtem Blutzucker kann er auf eine Insulinresistenz hinweisen: Die Zellen sprechen schlechter auf Insulin an, und die Bauchspeicheldrüse bildet mehr davon. Begünstigt wird das vor allem durch Übergewicht und wenig Bewegung; gehäuft kommt es bei Prädiabetes, Typ-2-Diabetes und dem PCO-Syndrom vor. Außerdem eine nicht nüchterne Blutabnahme, gespritztes Insulin, selten ein Cushing-Syndrom oder ein insulinbildender Tumor der Bauchspeicheldrüse.' },
        { label: A.de, text: 'Oft keine. Bei Insulinresistenz manchmal dunkle, verdickte, samtige Haut an Nacken oder Achseln. Ist der Blutzucker zugleich niedrig: Schwitzen, Zittern, Herzklopfen, Schwindel, Kopfschmerzen, Hunger, Verwirrtheit.' },
        { label: FD.de, text: 'Mit der Zeit kann die Bauchspeicheldrüse den Mehrbedarf nicht mehr decken; dann steigt der Blutzucker, und es kann ein Prädiabetes und später ein Typ-2-Diabetes entstehen.' },
        { text: 'Zusammen mit dem Blutzucker ärztlich einordnen lassen. Bei Anzeichen einer starken Unterzuckerung – jemand reagiert nicht mehr normal, krampft oder ist bewusstlos – sofort den Notruf 112 wählen.' },
      ],
    },
    en: {
      hinweis: 'It is usually measured fasting, after 8 to 12 hours without food. Insulin rises and falls with blood sugar and is therefore assessed together with it. Biotin (vitamin B7) from dietary supplements and, in people who inject insulin, antibodies against insulin can distort the result – tell your practice what you take.',
      niedrig: [
        { label: E.en, text: 'Insulin falls when blood sugar falls. A low value on its own therefore says little.' },
        { label: U.en, text: 'If blood sugar is high at the same time, the pancreas may be making too little insulin, e.g. in type 1 diabetes or inflammation of the pancreas.' },
        { text: 'Have it assessed by a doctor together with blood sugar; promptly with strong thirst, frequent urination or unintended weight loss.' },
      ],
      bereich: [{ text: 'The fasting value is in the usual range. On its own it is of little significance; it is assessed together with blood sugar.' }],
      hoch: [
        { label: U.en, text: 'With normal or slightly raised blood sugar, it can point to insulin resistance: the cells respond less well to insulin, and the pancreas makes more of it. This is promoted mainly by excess weight and little exercise; it is more common with prediabetes, type 2 diabetes and polycystic ovary syndrome (PCOS). Also a blood sample that was not fasting, injected insulin, rarely Cushing’s syndrome or an insulin-producing tumour of the pancreas.' },
        { label: A.en, text: 'Often none. With insulin resistance, sometimes dark, thickened, velvety skin on the neck or in the armpits. If blood sugar is low at the same time: sweating, shaking, palpitations, dizziness, headache, hunger, confusion.' },
        { label: FD.en, text: 'Over time the pancreas may no longer keep up with the extra demand; blood sugar then rises, and prediabetes and later type 2 diabetes can develop.' },
        { text: 'Have it assessed by a doctor together with blood sugar. With signs of severe low blood sugar – someone is no longer responding normally, has a seizure or is unconscious – call the emergency number (112 in Europe) immediately.' },
      ],
    },
    quellen: [
      { label: 'gesund.bund.de: Diabetes Typ 2', url: 'https://gesund.bund.de/diabetes-typ-2' },
      { label: 'MSD Manual: Diabetes mellitus Typ 2', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/diabetes-mellitus-und-niedriger-blutzucker-hypoglyk%C3%A4mie/diabetes-mellitus-typ-2' },
      { label: 'MedlinePlus: Insulin in Blood Test', url: 'https://medlineplus.gov/lab-tests/insulin-in-blood-test/' },
      { label: 'MedlinePlus: Prediabetes', url: 'https://medlineplus.gov/prediabetes.html' },
      { label: 'NHS: Low blood sugar (hypoglycaemia)', url: 'https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/' },
    ],
  },

  'HOMA-Index': {
    de: {
      hinweis: 'Weil der Wert aus Nüchternzucker und Nüchterninsulin berechnet wird, müssen beide wirklich nüchtern abgenommen sein – nach dem Essen steigen beide. Was einen der beiden Messwerte verfälscht, verfälscht auch den Index.',
      niedrig: [{ text: 'Meist ohne Bedeutung. Ist der Blutzucker zugleich hoch, ärztlich einordnen lassen.' }],
      bereich: [{ text: 'Aus diesem Wert ergibt sich kein Hinweis auf eine verminderte Insulinwirkung. Er ist nur so verlässlich wie die beiden Messwerte, aus denen er berechnet wird.' }],
      hoch: [
        { label: E.de, text: 'Ein hoher Wert entsteht durch ein hohes Nüchterninsulin, einen hohen Nüchternzucker oder beides. Ein hohes Insulin bei normalem oder leicht erhöhtem Zucker kann auf eine Insulinresistenz hinweisen.' },
        { label: U.de, text: 'Begünstigt durch Übergewicht, besonders am Bauch, und wenig Bewegung. Gehäuft bei Prädiabetes, Typ-2-Diabetes, dem PCO-Syndrom und dem metabolischen Syndrom.' },
        { label: A.de, text: 'Meist keine. Manchmal dunkle, verdickte Haut an Nacken oder Achseln.' },
        { label: FD.de, text: 'Es kann sich ein Prädiabetes und später ein Typ-2-Diabetes entwickeln.' },
        { text: 'Zusammen mit Blutzucker, HbA1c und Insulin ärztlich einordnen lassen.' },
      ],
    },
    en: {
      hinweis: 'Because the value is calculated from fasting blood sugar and fasting insulin, both must be taken truly fasting – both rise after eating. Anything that distorts one of the two measurements also distorts the index.',
      niedrig: [{ text: 'Usually without significance. If blood sugar is high at the same time, have it assessed by a doctor.' }],
      bereich: [{ text: 'This value gives no indication of reduced insulin action. It is only as reliable as the two measurements it is calculated from.' }],
      hoch: [
        { label: E.en, text: 'A high value results from high fasting insulin, high fasting blood sugar, or both. High insulin with normal or slightly raised blood sugar can point to insulin resistance.' },
        { label: U.en, text: 'Promoted by excess weight, especially around the belly, and little exercise. More common with prediabetes, type 2 diabetes, polycystic ovary syndrome (PCOS) and metabolic syndrome.' },
        { label: A.en, text: 'Usually none. Sometimes dark, thickened skin on the neck or in the armpits.' },
        { label: FD.en, text: 'Prediabetes and later type 2 diabetes can develop.' },
        { text: 'Have it assessed by a doctor together with blood sugar, HbA1c and insulin.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Nüchternblutzucker', url: 'https://www.gesundheitsinformation.de/nuechternblutzucker.html' },
      { label: 'MSD Manual: Diabetes mellitus Typ 2', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/diabetes-mellitus-und-niedriger-blutzucker-hypoglyk%C3%A4mie/diabetes-mellitus-typ-2' },
      { label: 'MSD Manual: Metabolisches Syndrom', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/adipositas-und-metabolisches-syndrom/metabolisches-syndrom-syndrom-x' },
      { label: 'MedlinePlus: Insulin in Blood Test', url: 'https://medlineplus.gov/lab-tests/insulin-in-blood-test/' },
      { label: 'MedlinePlus: Prediabetes', url: 'https://medlineplus.gov/prediabetes.html' },
    ],
  },
}
