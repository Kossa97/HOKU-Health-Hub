import type { MarkerGuidance } from '../markerGuidance'

/** Vitamine & Mineralstoffe: Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_VITAMINE: Record<string, MarkerGuidance> = {
  'Vitamin B12': {
    de: {
      hinweis: 'Vor der Blutabnahme sollte man einige Stunden nichts essen; bestimmte Medikamente können das Ergebnis beeinflussen. Manche Menschen haben Beschwerden trotz unauffälligem Wert, andere einen niedrigen Wert ohne Beschwerden. Bei grenzwertigen Werten können weitere Tests helfen, etwa Holo-Transcobalamin oder Methylmalonsäure.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Am häufigsten nimmt der Körper das Vitamin schlecht auf: etwa wenn das Immunsystem die Magenzellen angreift, die für die Aufnahme nötig sind (perniziöse Anämie), bei wenig Magensäure im Alter, nach Magen- oder Darmoperationen (auch zur Gewichtsabnahme) oder bei Darmerkrankungen wie Morbus Crohn oder Zöliakie. Außerdem rein pflanzliche (vegane) Ernährung ohne Vitamin-B12-Zusatz, bestimmte Medikamente (z. B. Magensäureblocker und das Diabetesmittel Metformin), wiederholter Lachgas-Konsum und Lebererkrankungen. Weil die Speicher in der Leber lange reichen, kann ein Mangel erst Jahre nach einer Ernährungsumstellung entstehen.' },
        { label: 'Typische Anzeichen', text: 'Müdigkeit, Schwäche, Blässe, bei stärkerer Blutarmut Kurzatmigkeit und Herzklopfen; eine wunde, rote Zunge. Über die Nerven: Kribbeln oder Taubheit an Füßen und Händen, Muskelschwäche, Unsicherheit beim Gehen und Gleichgewicht, Gedächtnisprobleme, gedrückte Stimmung oder Verwirrtheit. Nervenbeschwerden können auch ohne Blutarmut auftreten.' },
        { label: 'Mögliche Folgen', text: 'Blutarmut mit zu großen roten Blutkörperchen. Nervenschäden, die bleiben können, wenn der Mangel lange unbehandelt ist; bei fortgeschrittenem Mangel auch Störungen des Denkens bis hin zu Demenz.' },
        { text: 'Ärztlich abklären, damit die Ursache gefunden wird; zeitnah bei Kribbeln, Taubheitsgefühl oder Gangunsicherheit, weil Nervenschäden umso eher bleiben, je länger der Mangel besteht.' },
      ],
      bereich: [{ text: 'Ein Wert im unteren Bereich schließt einen Mangel nicht sicher aus, vor allem bei passenden Beschwerden.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Ein erhöhter Wert ist ungewöhnlich, denn überschüssiges Vitamin B12 wird meist mit dem Urin ausgeschieden. Er kann auf eine Lebererkrankung (z. B. Zirrhose oder Hepatitis) oder selten auf eine Erkrankung des Knochenmarks hinweisen.' },
        { label: 'Einordnung', text: 'Größere Mengen Vitamin B12 gelten nicht als giftig; von einer übermäßigen Einnahme wird trotzdem abgeraten.' },
        { text: 'Einen erhöhten Wert ärztlich einordnen lassen.' },
      ],
    },
    en: {
      hinweis: 'You should not eat for a few hours before the blood test; certain medicines can affect the result. Some people have symptoms despite a normal value, others have a low value without symptoms. With borderline values, further tests can help, such as holotranscobalamin or methylmalonic acid.',
      niedrig: [
        { label: 'Possible causes', text: 'Most often the body absorbs the vitamin poorly: for example when the immune system attacks the stomach cells needed for absorption (pernicious anaemia), with little stomach acid in older age, after stomach or bowel surgery (including for weight loss), or with bowel diseases such as Crohn’s disease or coeliac disease. Also a purely plant-based (vegan) diet without added vitamin B12, certain medicines (e.g. stomach acid blockers and the diabetes medicine metformin), repeated use of nitrous oxide, and liver disease. Because the stores in the liver last a long time, a deficiency can appear only years after a change in diet.' },
        { label: 'Typical signs', text: 'Tiredness, weakness, paleness, with more marked anaemia shortness of breath and palpitations; a sore, red tongue. Via the nerves: tingling or numbness in the feet and hands, muscle weakness, unsteadiness when walking and with balance, memory problems, low mood or confusion. Nerve symptoms can also occur without anaemia.' },
        { label: 'Possible consequences', text: 'Anaemia with red blood cells that are too large. Nerve damage that can remain if the deficiency goes untreated for a long time; with advanced deficiency also problems with thinking, up to dementia.' },
        { text: 'Have it checked by a doctor so the cause can be found; promptly with tingling, numbness or unsteady walking, because the longer the deficiency lasts, the more likely nerve damage is to remain.' },
      ],
      bereich: [{ text: 'A value in the lower part of the range does not reliably rule out a deficiency, especially with matching symptoms.' }],
      hoch: [
        { label: 'Possible causes', text: 'A raised value is uncommon, because excess vitamin B12 is usually passed out in the urine. It can point to liver disease (e.g. cirrhosis or hepatitis) or rarely to a disease of the bone marrow.' },
        { label: 'Context', text: 'Larger amounts of vitamin B12 are not considered toxic; excessive intake is still advised against.' },
        { text: 'Have a raised value assessed by a doctor.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Vitamin-B12-Mangel', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/vitamine/vitamin-b12-mangel' },
      { label: 'MSD Manual: Vitaminmangelanämie', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/an%C3%A4mie/vitaminmangelan%C3%A4mie' },
      { label: 'MSD Manual Professional: Vitamin B12 Deficiency', url: 'https://www.msdmanuals.com/professional/nutritional-disorders/vitamin-deficiency-dependency-and-toxicity/vitamin-b12-deficiency' },
      { label: 'MedlinePlus: Vitamin B12 level', url: 'https://medlineplus.gov/ency/article/003705.htm' },
      { label: 'NHS: Vitamin B12 or folate deficiency anaemia – Causes', url: 'https://www.nhs.uk/conditions/vitamin-b12-or-folate-deficiency-anaemia/causes/' },
      { label: 'NHS: Vitamin B12 or folate deficiency anaemia – Symptoms', url: 'https://www.nhs.uk/conditions/vitamin-b12-or-folate-deficiency-anaemia/symptoms/' },
    ],
  },

  'Holo-Transcobalamin': {
    de: {
      hinweis: 'Holo-Transcobalamin ist Vitamin B12, das an sein Transporteiweiß gebunden ist; in dieser Form gelangt es in die Gewebe. Der Wert wird seltener bestimmt, meist ergänzend, wenn der Vitamin-B12-Wert grenzwertig ist.',
      niedrig: [
        { label: 'Einordnung', text: 'Ein niedriger Wert kann auf einen Vitamin-B12-Mangel hinweisen.' },
        { label: 'Mögliche Ursachen', text: 'Dieselben wie bei einem Vitamin-B12-Mangel: vor allem eine gestörte Aufnahme über Magen oder Darm, außerdem rein pflanzliche Ernährung ohne Vitamin-B12-Zusatz und bestimmte Medikamente.' },
        { label: 'Typische Anzeichen eines Mangels', text: 'Müdigkeit, Schwäche, Blässe; Kribbeln oder Taubheit an Händen und Füßen, Unsicherheit beim Gehen.' },
        { text: 'Zusammen mit dem Vitamin-B12-Wert ärztlich einordnen lassen; zeitnah bei Nervenbeschwerden wie Kribbeln oder Taubheitsgefühl.' },
      ],
      bereich: [{ text: 'Der Wert spricht nicht für einen Vitamin-B12-Mangel. Beschwerden können trotzdem andere Ursachen haben.' }],
      hoch: [{ text: 'Was ein erhöhter Wert bedeutet, ist wenig untersucht. Bei Unsicherheit ärztlich einordnen lassen.' }],
    },
    en: {
      hinweis: 'Holotranscobalamin is vitamin B12 bound to its transport protein; in this form it reaches the tissues. The value is measured less often, usually as an addition when the vitamin B12 level is borderline.',
      niedrig: [
        { label: 'Context', text: 'A low value can point to a vitamin B12 deficiency.' },
        { label: 'Possible causes', text: 'The same as for a vitamin B12 deficiency: above all impaired absorption via the stomach or gut, also a purely plant-based diet without added vitamin B12, and certain medicines.' },
        { label: 'Typical signs of a deficiency', text: 'Tiredness, weakness, paleness; tingling or numbness in the hands and feet, unsteadiness when walking.' },
        { text: 'Have it assessed by a doctor together with the vitamin B12 level; promptly with nerve symptoms such as tingling or numbness.' },
      ],
      bereich: [{ text: 'The value does not suggest a vitamin B12 deficiency. Symptoms can still have other causes.' }],
      hoch: [{ text: 'Little is known about what a raised value means. If unsure, have it assessed by a doctor.' }],
    },
    quellen: [
      { label: 'MSD Manual: Vitamin-B12-Mangel', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/vitamine/vitamin-b12-mangel' },
      { label: 'MSD Manual Professional: Vitamin B12 Deficiency', url: 'https://www.msdmanuals.com/professional/nutritional-disorders/vitamin-deficiency-dependency-and-toxicity/vitamin-b12-deficiency' },
      { label: 'NHS: Vitamin B12 or folate deficiency anaemia', url: 'https://www.nhs.uk/conditions/vitamin-b12-or-folate-deficiency-anaemia/' },
    ],
  },

  'Folsäure': {
    de: {
      hinweis: 'Der Wert schwankt über den Tag; Blut wird deshalb morgens nüchtern abgenommen. Weil ein Vitamin-B12-Mangel dieselben Veränderungen im Blutbild macht, wird B12 meist mitbestimmt.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Sehr einseitige Ernährung, viel Alkohol, erhöhter Bedarf in Schwangerschaft und Stillzeit. Außerdem eine gestörte Aufnahme im Darm (z. B. Zöliakie, Morbus Crohn, Colitis ulcerosa), Leber- und Nierenerkrankungen, Dialyse, Schuppenflechte, Krebs und bestimmte Medikamente (z. B. gegen Epilepsie oder bei Krebs).' },
        { label: 'Typische Anzeichen', text: 'Zuerst oft Müdigkeit; dazu Blässe, Kurzatmigkeit, Schwindel. Bei schwerem Mangel eine rote, wunde Zunge, eingeschränkter Geschmackssinn, Durchfall, Gewichtsverlust und gedrückte Stimmung.' },
        { label: 'Mögliche Folgen', text: 'Hält der Mangel Wochen bis Monate an, kann eine Blutarmut mit vergrößerten roten Blutkörperchen entstehen. In der Schwangerschaft steigt das Risiko für Fehlbildungen von Rückenmark und Gehirn beim Kind (z. B. offener Rücken).' },
        { text: 'Ärztlich abklären, damit die Ursache gefunden wird, besonders in der Schwangerschaft.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Ein einzelner Laborwert allein sagt meist wenig aus.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Über die Ernährung allein ist kein zu hoher Wert möglich, weil der Körper Überschüsse über die Nieren ausscheidet. Häufig steckt eine hoch dosierte Einnahme von Folsäure-Präparaten dahinter oder ein Messfehler, weil vor der Blutabnahme gegessen wurde.' },
        { label: 'Einordnung', text: 'Folsäure gilt im Allgemeinen als nicht giftig.' },
        { text: 'Ärztlich einordnen lassen, vor allem wenn keine Präparate eingenommen wurden – dann kann eine behandlungsbedürftige Erkrankung dahinterstecken.' },
      ],
    },
    en: {
      hinweis: 'The level varies over the day, so blood is taken in the morning while fasting. Because a vitamin B12 deficiency causes the same changes in the blood count, B12 is usually measured as well.',
      niedrig: [
        { label: 'Possible causes', text: 'A very one-sided diet, a lot of alcohol, increased need in pregnancy and while breastfeeding. Also impaired absorption in the gut (e.g. coeliac disease, Crohn’s disease, ulcerative colitis), liver and kidney disease, dialysis, psoriasis, cancer and certain medicines (e.g. for epilepsy or cancer).' },
        { label: 'Typical signs', text: 'Often tiredness first; also paleness, shortness of breath, dizziness. With severe deficiency a red, sore tongue, reduced sense of taste, diarrhoea, weight loss and low mood.' },
        { label: 'Possible consequences', text: 'If the deficiency lasts for weeks to months, anaemia with enlarged red blood cells can develop. In pregnancy the risk of malformations of the baby’s spinal cord and brain rises (e.g. spina bifida).' },
        { text: 'Have it checked by a doctor so the cause can be found, especially in pregnancy.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. A single lab value on its own usually says little.' }],
      hoch: [
        { label: 'Possible causes', text: 'Diet alone cannot cause a level that is too high, because the body excretes excess via the kidneys. Often the cause is high-dose folic acid supplements or a measurement error because food was eaten before the blood test.' },
        { label: 'Context', text: 'Folic acid is generally not considered toxic.' },
        { text: 'Have it assessed by a doctor, especially if no supplements were taken – then a condition that needs treatment may be behind it.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Folsäure', url: 'https://www.gesundheitsinformation.de/folsaeure.html' },
      { label: 'MSD Manual: Folsäuremangel', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/vitamine/fols%C3%A4uremangel' },
      { label: 'MedlinePlus: Folate blood test', url: 'https://medlineplus.gov/ency/article/003686.htm' },
      { label: 'NHS: Vitamin B12 or folate deficiency anaemia – Causes', url: 'https://www.nhs.uk/conditions/vitamin-b12-or-folate-deficiency-anaemia/causes/' },
    ],
  },

  'Eisen': {
    de: {
      hinweis: 'Der Wert steigt nach dem Essen vorübergehend an und sinkt, wenn man länger nichts gegessen hat; er wird daher meist morgens und nüchtern bestimmt. Auch die Regelblutung sowie hormonelle Verhütung oder Östrogene können ihn beeinflussen. Beurteilt wird er zusammen mit Ferritin und Transferrinsättigung.',
      niedrig: [
        { label: 'Einordnung', text: 'Ein niedriger Eisenwert allein bedeutet noch keinen Mangel. Er sinkt auch bei Entzündungen im Körper; dann ist meist zugleich ein Entzündungswert wie das CRP erhöht.' },
        { label: 'Mögliche Ursachen eines Eisenmangels', text: 'Oft Blutverlust, z. B. durch starke Regelblutungen oder unbemerkte Blutungen in Magen oder Darm. Außerdem erhöhter Bedarf (Schwangerschaft, Stillzeit, Wachstum, Leistungssport), wenig Eisen in der Nahrung (z. B. bei einseitiger, vegetarischer oder veganer Ernährung, Essstörungen), eine gestörte Aufnahme bei Zöliakie oder chronisch-entzündlichen Darmerkrankungen und bestimmte Medikamente wie Magensäureblocker.' },
        { label: 'Typische Anzeichen eines Mangels', text: 'Müdigkeit, Schwindel, nachlassende Leistungsfähigkeit.' },
        { label: 'Mögliche Folge', text: 'Blutarmut.' },
        { text: 'Zusammen mit Ferritin und Transferrinsättigung ärztlich einordnen lassen, damit die Ursache gefunden wird.' },
      ],
      bereich: [{ text: 'Allein wenig aussagekräftig; über den Eisenhaushalt geben erst Ferritin und Transferrinsättigung zusammen Auskunft.' }],
      hoch: [
        { label: 'Einordnung', text: 'Kurzzeitig erhöhte Werte kommen auch bei Gesunden vor. Oft weisen sie aber auf zu viel Eisen im Körper hin (Eisenüberladung).' },
        { label: 'Mögliche Ursachen', text: 'Häufige Bluttransfusionen, zu viel eingenommenes Eisen, die erbliche Eisenspeicherkrankheit (Hämochromatose), ein verstärkter Zerfall roter Blutkörperchen (Hämolyse), Lebererkrankungen, Alkoholkrankheit, selten eine Bleivergiftung.' },
        { label: 'Typische Anzeichen', text: 'Lange oft keine. Möglich sind Magen-Darm- und Bauchbeschwerden, Müdigkeit und Schwäche, Gelenkschmerzen (oft an Knien oder Händen), weniger Lust auf Sex oder Erektionsprobleme und eine graue bis bronzefarbene Haut.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Schäden an Organen, besonders der Leber, aber auch an Herz und Bauchspeicheldrüse.' },
        { text: 'Ärztlich abklären, besonders wenn Eltern oder Geschwister eine Hämochromatose haben.' },
      ],
    },
    en: {
      hinweis: 'The level rises temporarily after eating and falls if you have not eaten for a long time; it is therefore usually measured in the morning while fasting. Periods, hormonal contraception or oestrogens can also affect it. It is assessed together with ferritin and transferrin saturation.',
      niedrig: [
        { label: 'Context', text: 'A low iron level alone does not mean a deficiency. It also falls with inflammation in the body; then an inflammation marker such as CRP is usually raised at the same time.' },
        { label: 'Possible causes of iron deficiency', text: 'Often blood loss, e.g. from heavy periods or unnoticed bleeding in the stomach or gut. Also increased need (pregnancy, breastfeeding, growth, competitive sport), little iron in the diet (e.g. with a one-sided, vegetarian or vegan diet, eating disorders), impaired absorption with coeliac disease or inflammatory bowel disease, and certain medicines such as stomach acid blockers.' },
        { label: 'Typical signs of a deficiency', text: 'Tiredness, dizziness, reduced performance.' },
        { label: 'Possible consequence', text: 'Anaemia.' },
        { text: 'Have it assessed by a doctor together with ferritin and transferrin saturation so the cause can be found.' },
      ],
      bereich: [{ text: 'Of limited significance on its own; only ferritin and transferrin saturation together give information about the iron balance.' }],
      hoch: [
        { label: 'Context', text: 'Briefly raised values also occur in healthy people. Often, however, they point to too much iron in the body (iron overload).' },
        { label: 'Possible causes', text: 'Frequent blood transfusions, too much iron taken, the inherited iron storage disease (haemochromatosis), increased breakdown of red blood cells (haemolysis), liver disease, alcohol dependence, rarely lead poisoning.' },
        { label: 'Typical signs', text: 'Often none for a long time. Possible are stomach, bowel and abdominal complaints, tiredness and weakness, joint pain (often in the knees or hands), reduced interest in sex or erection problems, and grey to bronze-coloured skin.' },
        { label: 'Possible long-term consequences', text: 'Damage to organs, especially the liver, but also the heart and pancreas.' },
        { text: 'Have it checked by a doctor, especially if a parent or sibling has haemochromatosis.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Eisen', url: 'https://www.gesundheitsinformation.de/eisen.html' },
      { label: 'gesund.bund.de: Blutarmut', url: 'https://gesund.bund.de/blutarmut-anaemie' },
      { label: 'MSD Manual: Eisenüberschuss', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/mineralstoffe/eisen%C3%BCberschuss' },
      { label: 'MedlinePlus: Iron Tests', url: 'https://medlineplus.gov/lab-tests/iron-tests/' },
      { label: 'NHS: Haemochromatosis', url: 'https://www.nhs.uk/conditions/haemochromatosis/' },
    ],
  },

  'Transferrinsättigung': {
    de: {
      hinweis: 'Der Wert wird aus Eisen- und Transferrinwert berechnet; für die Blutabnahme sollte man nüchtern sein. Bei Kindern und Jugendlichen liegt er meist niedriger.',
      niedrig: [
        { label: 'Einordnung', text: 'Ein niedriger Wert weist meist auf einen Eisenmangel hin. Bei chronischen Entzündungen, Infektionen oder Krebs kann der Körper außerdem vorhandenes Eisen schlechter nutzen.' },
        { label: 'Mögliche Ursachen eines Eisenmangels', text: 'Oft Blutverlust, z. B. durch starke Regelblutungen oder unbemerkte Blutungen im Magen-Darm-Trakt. Außerdem erhöhter Bedarf (Schwangerschaft, Stillzeit, Wachstum, Leistungssport), wenig Eisen in der Nahrung (z. B. bei einseitiger, vegetarischer oder veganer Ernährung), eine gestörte Aufnahme bei Zöliakie, chronisch-entzündlichen Darmerkrankungen oder nach einer Magenoperation und bestimmte Medikamente wie Magensäureblocker.' },
        { label: 'Typische Anzeichen', text: 'Ein vorübergehender Mangel ist meist ungefährlich. Hält er an, sind Müdigkeit, Schwindel und nachlassende Leistungsfähigkeit möglich.' },
        { label: 'Mögliche Folgen', text: 'Blutarmut. Bei einer Blutarmut durch Eisenmangel in der Schwangerschaft steigt das Risiko, z. B. für eine Frühgeburt.' },
        { text: 'Ärztlich abklären, damit die Ursache gefunden wird.' },
      ],
      bereich: [{ text: 'Der Wert liegt im üblichen Bereich. Er wird immer zusammen mit Ferritin und Eisen beurteilt.' }],
      hoch: [
        { label: 'Einordnung', text: 'Ein hoher Wert kann auf zu viel Eisen im Körper hinweisen (Eisenüberladung). Sind Transferrinsättigung und Ferritin beide erhöht, wird oft auf die erbliche Eisenspeicherkrankheit (Hämochromatose) untersucht.' },
        { label: 'Mögliche Ursachen', text: 'Hämochromatose, häufige Bluttransfusionen, zu viel eingenommenes Eisen, ein verstärkter Zerfall roter Blutkörperchen (Hämolyse). Außerdem eine gestörte Blutbildung, etwa bei Vitamin-B12- oder Folsäuremangel, sowie Leber- oder Nierenerkrankungen, bei denen weniger Transferrin im Blut ist.' },
        { label: 'Typische Anzeichen', text: 'Bei Hämochromatose oft lange keine, häufig erst ab dem mittleren Alter, bei Frauen meist nach den Wechseljahren. Dann z. B. Müdigkeit, Schwäche, Gelenkschmerzen besonders an den Händen, Magen-Darm-Beschwerden, bronzefarbene Haut, Erektionsprobleme oder unregelmäßige Regelblutungen.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Schäden an Leber (bis zu Zirrhose und Leberkrebs), Bauchspeicheldrüse (Diabetes), Herz und Gelenken. Früh erkannt und behandelt, verkürzt eine Hämochromatose die Lebenserwartung meist nicht.' },
        { text: 'Ärztlich abklären lassen. Bei bekannter Hämochromatose in der Familie sollten sich auch Eltern, Geschwister und Kinder untersuchen lassen.' },
      ],
    },
    en: {
      hinweis: 'The value is calculated from the iron and transferrin levels; you should be fasting for the blood test. In children and adolescents it is usually lower.',
      niedrig: [
        { label: 'Context', text: 'A low value usually points to iron deficiency. With chronic inflammation, infections or cancer, the body can also use the iron it has less well.' },
        { label: 'Possible causes of iron deficiency', text: 'Often blood loss, e.g. from heavy periods or unnoticed bleeding in the gastrointestinal tract. Also increased need (pregnancy, breastfeeding, growth, competitive sport), little iron in the diet (e.g. with a one-sided, vegetarian or vegan diet), impaired absorption with coeliac disease, inflammatory bowel disease or after stomach surgery, and certain medicines such as stomach acid blockers.' },
        { label: 'Typical signs', text: 'A temporary deficiency is usually harmless. If it persists, tiredness, dizziness and reduced performance are possible.' },
        { label: 'Possible consequences', text: 'Anaemia. With iron-deficiency anaemia in pregnancy, the risk rises, e.g. of premature birth.' },
        { text: 'Have it checked by a doctor so the cause can be found.' },
      ],
      bereich: [{ text: 'The value is in the usual range. It is always assessed together with ferritin and iron.' }],
      hoch: [
        { label: 'Context', text: 'A high value can point to too much iron in the body (iron overload). If both transferrin saturation and ferritin are raised, testing for the inherited iron storage disease (haemochromatosis) often follows.' },
        { label: 'Possible causes', text: 'Haemochromatosis, frequent blood transfusions, too much iron taken, increased breakdown of red blood cells (haemolysis). Also impaired blood formation, e.g. with vitamin B12 or folate deficiency, and liver or kidney disease in which there is less transferrin in the blood.' },
        { label: 'Typical signs', text: 'With haemochromatosis often none for a long time, frequently only from middle age, in women usually after menopause. Then, for example, tiredness, weakness, joint pain especially in the hands, stomach and bowel complaints, bronze-coloured skin, erection problems or irregular periods.' },
        { label: 'Possible long-term consequences', text: 'Damage to the liver (up to cirrhosis and liver cancer), pancreas (diabetes), heart and joints. Detected and treated early, haemochromatosis usually does not shorten life expectancy.' },
        { text: 'Have it checked by a doctor. If haemochromatosis is known in the family, parents, siblings and children should be tested too.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Transferrin-Sättigung', url: 'https://www.gesundheitsinformation.de/transferrin-saettigung.html' },
      { label: 'MSD Manual: Hämochromatose', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/eisen%C3%BCberlastung/h%C3%A4mochromatose' },
      { label: 'NHS: Haemochromatosis', url: 'https://www.nhs.uk/conditions/haemochromatosis/' },
      { label: 'NHS: Haemochromatosis – Diagnosis', url: 'https://www.nhs.uk/conditions/haemochromatosis/diagnosis/' },
    ],
  },

  'Zink': {
    de: {
      hinweis: 'Der Blutwert spiegelt den Zinkgehalt des Körpers nur ungenau wider; ist das Bluteiweiß Albumin niedrig, ist er zusätzlich schwer zu deuten. Ein Mangel wird deshalb auch nach Lebensumständen und Beschwerden beurteilt.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Bei ausgewogener Ernährung selten durch zu wenig Zink in der Nahrung; eher bei wenig Fleisch und Eiweiß und viel Vollkorn, Hülsenfrüchten und Nüssen, deren Inhaltsstoffe die Aufnahme hemmen. Außerdem Alkoholkrankheit, Diabetes, chronische Nieren- und Lebererkrankungen, eine gestörte Aufnahme im Darm (z. B. Zöliakie, Morbus Crohn), Sichelzellanämie, Entwässerungsmittel (Diuretika) und lange künstliche Ernährung über die Vene. Häufiger bei älteren Menschen, die das Haus kaum verlassen oder in Pflegeeinrichtungen leben.' },
        { label: 'Typische Anzeichen', text: 'Appetitlosigkeit, Haarausfall, Antriebslosigkeit und Reizbarkeit, gestörter Geschmacks- und Geruchssinn, Hautausschläge, häufige Infekte, schlecht heilende Wunden; bei Männern eine verringerte Spermienbildung.' },
        { label: 'Mögliche Folgen', text: 'Ein geschwächtes Immunsystem; in der Schwangerschaft ein geringeres Geburtsgewicht oder eine Frühgeburt.' },
        { text: 'Ärztlich abklären, besonders bei passenden Beschwerden.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors; er zeigt den Zinkgehalt des Körpers aber nur ungefähr.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Selten. Zu große Mengen Zink, z. B. aus Präparaten oder aus säurehaltigen Speisen und Getränken, die in verzinkten Behältern aufbewahrt wurden; in bestimmten Industrien das Einatmen von Zinkoxid-Dämpfen.' },
        { label: 'Typische Anzeichen', text: 'Übelkeit, Erbrechen, Durchfall und Bauchkrämpfe, meist wenige Stunden nach der Aufnahme. Nach dem Einatmen von Dämpfen Fieber, Schwitzen, schnelles Atmen, Muskelschmerzen und Metallgeschmack im Mund.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Mangel an Kupfer (auch an Eisen oder Magnesium), Blutarmut, ein geschwächtes Immunsystem, Nervenschäden.' },
        { text: 'Ärztlich abklären.' },
      ],
    },
    en: {
      hinweis: 'The blood level reflects the body’s zinc content only imprecisely; if the blood protein albumin is low, it is also hard to interpret. A deficiency is therefore also assessed by circumstances and symptoms.',
      niedrig: [
        { label: 'Possible causes', text: 'With a balanced diet, rarely due to too little zinc in food; more likely with little meat and protein and a lot of whole grains, pulses and nuts, whose components reduce absorption. Also alcohol dependence, diabetes, chronic kidney and liver disease, impaired absorption in the gut (e.g. coeliac disease, Crohn’s disease), sickle cell disease, water tablets (diuretics), and long-term intravenous feeding. More common in older people who rarely leave the house or live in care homes.' },
        { label: 'Typical signs', text: 'Loss of appetite, hair loss, lack of drive and irritability, disturbed sense of taste and smell, skin rashes, frequent infections, poorly healing wounds; in men reduced sperm production.' },
        { label: 'Possible consequences', text: 'A weakened immune system; in pregnancy a lower birth weight or premature birth.' },
        { text: 'Have it checked by a doctor, especially with matching symptoms.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range; but it reflects the body’s zinc content only approximately.' }],
      hoch: [
        { label: 'Possible causes', text: 'Rare. Too much zinc, e.g. from supplements or from acidic food and drinks stored in galvanised (zinc-coated) containers; in certain industries, breathing in zinc oxide fumes.' },
        { label: 'Typical signs', text: 'Nausea, vomiting, diarrhoea and abdominal cramps, usually a few hours after intake. After breathing in fumes, fever, sweating, rapid breathing, muscle pain and a metallic taste in the mouth.' },
        { label: 'Possible long-term consequences', text: 'Deficiency of copper (also of iron or magnesium), anaemia, a weakened immune system, nerve damage.' },
        { text: 'Have it checked by a doctor.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Zinkmangel', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/mineralstoffe/zinkmangel' },
      { label: 'MSD Manual: Zinküberschuss', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/mineralstoffe/zink%C3%BCberschuss' },
      { label: 'MSD Manual Professional: Zinc Deficiency', url: 'https://www.msdmanuals.com/professional/nutritional-disorders/mineral-deficiency-and-toxicity/zinc-deficiency' },
      { label: 'MSD Manual Professional: Zinc Toxicity', url: 'https://www.msdmanuals.com/professional/nutritional-disorders/mineral-deficiency-and-toxicity/zinc-toxicity' },
      { label: 'MedlinePlus: Zinc in diet', url: 'https://medlineplus.gov/ency/article/002416.htm' },
    ],
  },
}
