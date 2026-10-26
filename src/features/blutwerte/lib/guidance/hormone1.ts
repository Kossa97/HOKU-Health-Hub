import type { MarkerGuidance } from '../markerGuidance'

/** Hormone (Testosteron-Achse, Prolaktin): Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_HORMONE1: Record<string, MarkerGuidance> = {
  'Freies Testosteron': {
    de: {
      hinweis: 'Wird wie das Gesamttestosteron früh morgens bestimmt, weil der Spiegel im Laufe des Tages sinkt. Die genaue direkte Messung ist aufwendig; oft wird der Wert aus Gesamttestosteron, SHBG und Albumin berechnet. Einfache Schnelltests liefern häufig ungenaue Werte, besonders bei Typ-2-Diabetes, starkem Übergewicht oder Schilddrüsenunterfunktion.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Der Wert sinkt mit dem Alter. Außerdem chronische Erkrankungen (z. B. von Leber oder Niere), übermäßiger Alkoholkonsum, starkes Übergewicht, bestimmte Medikamente, Erkrankungen der Hoden oder der Hirnanhangdrüse, ein hoher SHBG-Wert. Zugeführtes Testosteron oder Anabolika drosseln die körpereigene Bildung; nach dem Ende der Zufuhr kann sie eine Zeit lang niedrig bleiben. Jede akute schwere Erkrankung kann den Wert vorübergehend senken.' },
        { label: 'Typische Anzeichen', text: 'Weniger Lust auf Sex, Erektionsprobleme, gedrückte Stimmung, Schlafprobleme, weniger Muskelmasse, vergrößertes Brustgewebe. Bei Frauen kann die Regelblutung ausbleiben.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Geringere Knochendichte, mehr Bauchumfang, Blutarmut.' },
        { text: 'Bei Beschwerden ärztlich abklären.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Beschwerden können trotzdem andere Ursachen haben.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Vor allem die Zufuhr von Testosteron oder Anabolika; selten ein Tumor im Hoden oder eine Erkrankung der Nebennieren. Bei Frauen u. a. das PCO-Syndrom. Ein niedriger SHBG-Wert lässt mehr Testosteron frei.' },
        { label: 'Typische Anzeichen', text: 'Akne, Haarausfall, Reizbarkeit, Wassereinlagerungen; bei Frauen vermehrte Gesichts- und Körperbehaarung, tiefere Stimme und unregelmäßige Regelblutungen.' },
        { label: 'Mögliche Folgen, vor allem bei Zufuhr', text: 'Mehr rote Blutkörperchen (höherer Hämatokrit), Blutgerinnsel, steigender Blutdruck, ungünstige Blutfette, kleinere Hoden und verminderte Fruchtbarkeit, Wachstum der Brustdrüse.' },
        { text: 'Ärztlich abklären, besonders bei Zufuhr, bei Kinderwunsch oder bei Frauen mit neuen Zeichen von Vermännlichung.' },
      ],
    },
    en: {
      hinweis: 'Like total testosterone, it is measured early in the morning, because the level falls over the day. Accurate direct measurement is laborious; the value is often calculated from total testosterone, SHBG and albumin. Simple rapid tests often give inaccurate values, especially with type 2 diabetes, severe obesity or an underactive thyroid.',
      niedrig: [
        { label: 'Possible causes', text: 'The level falls with age. Also chronic illnesses (e.g. of the liver or kidneys), excessive alcohol, severe obesity, certain medicines, diseases of the testicles or the pituitary gland, a high SHBG level. Supplied testosterone or anabolic steroids suppress the body’s own production; after supply ends, it can stay low for a while. Any acute serious illness can lower the level temporarily.' },
        { label: 'Typical signs', text: 'Less interest in sex, erection problems, low mood, sleep problems, less muscle mass, enlarged breast tissue. In women, periods can stop.' },
        { label: 'Possible long-term consequences', text: 'Lower bone density, larger waist, anaemia.' },
        { text: 'Have it checked by a doctor if you have symptoms.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. Symptoms can still have other causes.' }],
      hoch: [
        { label: 'Possible causes', text: 'Mainly supplied testosterone or anabolic steroids; rarely a testicular tumour or a disease of the adrenal glands. In women, among others, polycystic ovary syndrome (PCOS). A low SHBG level leaves more testosterone free.' },
        { label: 'Typical signs', text: 'Acne, hair loss, irritability, fluid retention; in women increased facial and body hair, a deeper voice and irregular periods.' },
        { label: 'Possible consequences, especially when supplied', text: 'More red blood cells (higher haematocrit), blood clots, rising blood pressure, unfavourable blood lipids, smaller testicles and reduced fertility, breast growth.' },
        { text: 'Have it checked by a doctor, especially when supplying testosterone, when trying for a child, or in women with new signs of masculinisation.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Testosteron', url: 'https://www.gesundheitsinformation.de/testosteron.html' },
      { label: 'MSD Manual: Männlicher Hypogonadismus', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/m%C3%A4nnliche-geschlechtsorgane-endokrinologie-and-verwandte-erkrankungen/m%C3%A4nnlicher-hypogonadismus' },
      { label: 'MSD Manual: Anabol-androgene Steroide', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/m%C3%A4nnliche-geschlechtsorgane-endokrinologie-and-verwandte-erkrankungen/anabol-androgene-steroide' },
      { label: 'MedlinePlus: Testosterone Levels Test', url: 'https://medlineplus.gov/lab-tests/testosterone-levels-test/' },
      { label: 'MedlinePlus: SHBG Blood Test', url: 'https://medlineplus.gov/lab-tests/shbg-blood-test/' },
    ],
  },

  'SHBG': {
    de: {
      hinweis: 'SHBG wird vor allem in der Leber gebildet und meist zusammen mit dem Gesamttestosteron bestimmt, um das freie Testosteron abzuschätzen. Eine besondere Vorbereitung ist nicht nötig. Hormonhaltige Mittel wie die Pille, Östrogene oder Anabolika verändern den Wert – der Praxis sagen, was man einnimmt.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Schilddrüsenunterfunktion, Typ-2-Diabetes oder Insulinresistenz, starkes Übergewicht, Steroide oder Anabolika, Cushing-Syndrom; bei Frauen das PCO-Syndrom.' },
        { label: 'Typische Anzeichen', text: 'Der Wert selbst macht keine Beschwerden. Weil mehr Testosteron frei ist, können bei Frauen vermehrte Gesichts- und Körperbehaarung, Akne und unregelmäßige Regelblutungen auftreten.' },
        { text: 'Zusammen mit dem Testosteron ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im üblichen Bereich. Allein sagt er wenig aus; er wird zusammen mit dem Testosteron beurteilt.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Lebererkrankungen, Schilddrüsenüberfunktion, bestimmte Essstörungen, östrogenhaltige Medikamente wie die Pille oder Hormone in den Wechseljahren; bei Männern eine verminderte Bildung von Geschlechtshormonen.' },
        { label: 'Typische Anzeichen', text: 'Der Wert selbst macht keine Beschwerden. Weil weniger Testosteron frei ist, sind bei Männern weniger Lust auf Sex, Erektionsprobleme, Müdigkeit, weniger Muskelmasse und Fruchtbarkeitsprobleme möglich – auch wenn das Gesamttestosteron normal ist.' },
        { text: 'Zusammen mit dem Testosteron ärztlich einordnen lassen, besonders bei Beschwerden.' },
      ],
    },
    en: {
      hinweis: 'SHBG is made mainly in the liver and is usually measured together with total testosterone to estimate free testosterone. No special preparation is needed. Hormone-containing products such as the pill, oestrogens or anabolic steroids change the value – tell your practice what you take.',
      niedrig: [
        { label: 'Possible causes', text: 'An underactive thyroid, type 2 diabetes or insulin resistance, severe obesity, steroids or anabolic steroids, Cushing’s syndrome; in women polycystic ovary syndrome (PCOS).' },
        { label: 'Typical signs', text: 'The value itself causes no symptoms. Because more testosterone is free, women may have increased facial and body hair, acne and irregular periods.' },
        { text: 'Have it assessed by a doctor together with testosterone.' },
      ],
      bereich: [{ text: 'The value is in the usual range. On its own it says little; it is assessed together with testosterone.' }],
      hoch: [
        { label: 'Possible causes', text: 'Liver disease, an overactive thyroid, certain eating disorders, oestrogen-containing medicines such as the pill or menopausal hormone therapy; in men reduced production of sex hormones.' },
        { label: 'Typical signs', text: 'The value itself causes no symptoms. Because less testosterone is free, men may have less interest in sex, erection problems, tiredness, less muscle mass and fertility problems – even if total testosterone is normal.' },
        { text: 'Have it assessed by a doctor together with testosterone, especially if you have symptoms.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Männlicher Hypogonadismus', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/m%C3%A4nnliche-geschlechtsorgane-endokrinologie-and-verwandte-erkrankungen/m%C3%A4nnlicher-hypogonadismus' },
      { label: 'MedlinePlus: SHBG Blood Test', url: 'https://medlineplus.gov/lab-tests/shbg-blood-test/' },
      { label: 'MedlinePlus: Testosterone Levels Test', url: 'https://medlineplus.gov/lab-tests/testosterone-levels-test/' },
    ],
  },

  'LH': {
    de: {
      hinweis: 'Bei Frauen schwankt LH mit dem Zyklus und steigt kurz vor dem Eisprung stark an; die Blutabnahme kann daher an einem bestimmten Zyklustag nötig sein. Nach den Wechseljahren ist der Wert normalerweise hoch. Bei Männern ändert er sich normalerweise wenig. Beurteilt wird LH zusammen mit FSH und Testosteron bzw. Östrogen.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Zugeführtes Testosteron oder Anabolika senken LH. Außerdem Störungen der Hirnanhangdrüse oder des Hypothalamus (z. B. Tumoren, Verletzungen, Entzündungen, Bestrahlung), ein hoher Prolaktinspiegel, starkes Übergewicht, Eisenüberladung, bestimmte Medikamente (z. B. Opioide). Jede akute schwere Erkrankung kann den Wert vorübergehend senken. Bei Frauen auch extremes Training, Stress, Mangelernährung oder starkes Untergewicht.' },
        { label: 'Typische Anzeichen', text: 'Bei Männern weniger Lust auf Sex, Erektionsprobleme, kleinere Hoden, weniger Spermien. Bei Frauen bleibt die Regelblutung aus, die Scheide wird trocken.' },
        { label: 'Mögliche Folgen', text: 'Unfruchtbarkeit. Nach dem Ende einer Zufuhr von Anabolika kann es Monate bis Jahre dauern, bis sich die Spermienbildung erholt.' },
        { text: 'Ärztlich abklären, besonders bei Beschwerden, Kinderwunsch oder ausbleibender Regelblutung.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein sagt er wenig aus; er wird zusammen mit FSH und den Geschlechtshormonen beurteilt.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Häufig arbeiten Hoden oder Eierstöcke zu wenig, und die Hirnanhangdrüse bildet mehr LH, um sie anzuregen. Bei Männern z. B. Verletzung der Hoden, Mumps, nicht normal entwickelte Hoden, Klinefelter-Syndrom, ein Keimzelltumor im Hoden. Bei Frauen die Wechseljahre (ab etwa 45 normal), vorzeitig nachlassende Eierstöcke, das PCO-Syndrom, Erkrankungen von Schilddrüse oder Nebennieren. Bei beiden Geschlechtern Chemo- oder Strahlentherapie und Autoimmunerkrankungen.' },
        { label: 'Typische Anzeichen', text: 'Hängen von der Ursache ab. Bei Männern z. B. weniger Lust auf Sex, weniger Muskelmasse und Körperbehaarung, unerfüllter Kinderwunsch. Bei Frauen unregelmäßige oder ausbleibende Regelblutungen, unerfüllter Kinderwunsch.' },
        { text: 'Ärztlich abklären, besonders bei Beschwerden oder Kinderwunsch und bei Frauen unter 45.' },
      ],
    },
    en: {
      hinweis: 'In women, LH varies with the cycle and rises sharply just before ovulation, so blood may need to be taken on a specific day of the cycle. After menopause the level is normally high. In men it normally changes little. LH is assessed together with FSH and testosterone or oestrogen.',
      niedrig: [
        { label: 'Possible causes', text: 'Supplied testosterone or anabolic steroids lower LH. Also disorders of the pituitary gland or hypothalamus (e.g. tumours, injuries, inflammation, radiation), a high prolactin level, severe obesity, iron overload, certain medicines (e.g. opioids). Any acute serious illness can lower the level temporarily. In women also extreme exercise, stress, malnutrition or being very underweight.' },
        { label: 'Typical signs', text: 'In men less interest in sex, erection problems, smaller testicles, fewer sperm. In women periods stop and the vagina becomes dry.' },
        { label: 'Possible consequences', text: 'Infertility. After supply of anabolic steroids ends, it can take months to years for sperm production to recover.' },
        { text: 'Have it checked by a doctor, especially with symptoms, when trying for a child, or if periods have stopped.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it says little; it is assessed together with FSH and the sex hormones.' }],
      hoch: [
        { label: 'Possible causes', text: 'Often the testicles or ovaries are underperforming, and the pituitary gland makes more LH to stimulate them. In men e.g. injury to the testicles, mumps, testicles that did not develop normally, Klinefelter syndrome, a germ cell tumour of the testicle. In women menopause (normal from about 45), ovaries that stop working early, polycystic ovary syndrome (PCOS), diseases of the thyroid or adrenal glands. In both sexes chemotherapy or radiotherapy and autoimmune diseases.' },
        { label: 'Typical signs', text: 'Depend on the cause. In men e.g. less interest in sex, less muscle mass and body hair, difficulty conceiving. In women irregular or absent periods, difficulty conceiving.' },
        { text: 'Have it checked by a doctor, especially with symptoms or when trying for a child, and in women under 45.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Hirnanhangdrüse', url: 'https://www.gesundheitsinformation.de/wie-funktioniert-die-hirnanhangdruese-hypophyse.html' },
      { label: 'MSD Manual: Hypopituitarismus', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-hirnanhangdr%C3%BCse-hypophyse/hypopituitarismus' },
      { label: 'MSD Manual: Männlicher Hypogonadismus', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/m%C3%A4nnliche-geschlechtsorgane-endokrinologie-and-verwandte-erkrankungen/m%C3%A4nnlicher-hypogonadismus' },
      { label: 'MSD Manual: Anabol-androgene Steroide', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/m%C3%A4nnliche-geschlechtsorgane-endokrinologie-and-verwandte-erkrankungen/anabol-androgene-steroide' },
      { label: 'MSD Manual: Probleme mit den Spermien', url: 'https://www.msdmanuals.com/de/heim/gesundheitsprobleme-von-frauen/unfruchtbarkeit-und-habitueller-abort/probleme-mit-den-spermien' },
      { label: 'MedlinePlus: Luteinizing Hormone (LH) Levels Test', url: 'https://medlineplus.gov/lab-tests/luteinizing-hormone-lh-levels-test/' },
    ],
  },

  'FSH': {
    de: {
      hinweis: 'Bei Frauen schwankt FSH mit dem Zyklus; die Blutabnahme kann daher an einem bestimmten Zyklustag nötig sein. In den Wechseljahren steigt FSH, weil weniger Östrogen gebildet wird. Beurteilt wird FSH zusammen mit LH und Testosteron bzw. Östrogen.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Zugeführtes Testosteron oder Anabolika senken FSH. Außerdem Störungen der Hirnanhangdrüse oder des Hypothalamus (z. B. Tumoren, Verletzungen, Entzündungen, Bestrahlung). Jede akute schwere Erkrankung kann den Wert vorübergehend senken. Bei Frauen auch rascher Gewichtsverlust, starkes Untergewicht oder extremes Training.' },
        { label: 'Typische Anzeichen', text: 'Bei Männern weniger Spermien, kleinere Hoden. Bei Frauen bleibt die Regelblutung aus.' },
        { label: 'Mögliche Folgen', text: 'Unfruchtbarkeit. Nach dem Ende einer Zufuhr von Anabolika kann es Monate bis Jahre dauern, bis sich die Spermienbildung erholt.' },
        { text: 'Ärztlich abklären, besonders bei Kinderwunsch oder ausbleibender Regelblutung.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein sagt er wenig aus; er wird zusammen mit LH und den Geschlechtshormonen beurteilt.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Häufig arbeiten Hoden oder Eierstöcke zu wenig, und die Hirnanhangdrüse bildet mehr FSH, um sie anzuregen. Bei Männern ist FSH oft erhöht, wenn die Spermienbildung gestört ist, auch bei normalem Testosteron – z. B. nach Verletzung der Hoden, Mumps, beim Klinefelter-Syndrom oder bei einem Keimzelltumor im Hoden. Bei Frauen die Wechseljahre (ab etwa 45 normal), vorzeitig nachlassende Eierstöcke, das PCO-Syndrom, ein Tumor am Eierstock, Erkrankungen von Schilddrüse oder Nebennieren. Bei beiden Geschlechtern Chemo- oder Strahlentherapie und Autoimmunerkrankungen.' },
        { label: 'Typische Anzeichen', text: 'Hängen von der Ursache ab. Bei Männern z. B. unerfüllter Kinderwunsch, weniger Lust auf Sex, weniger Muskelmasse und Körperbehaarung. Bei Frauen unregelmäßige oder ausbleibende Regelblutungen, Hitzewallungen, unerfüllter Kinderwunsch.' },
        { text: 'Ärztlich abklären, besonders bei Kinderwunsch und bei Frauen unter 45.' },
      ],
    },
    en: {
      hinweis: 'In women, FSH varies with the cycle, so blood may need to be taken on a specific day of the cycle. During menopause FSH rises because less oestrogen is made. FSH is assessed together with LH and testosterone or oestrogen.',
      niedrig: [
        { label: 'Possible causes', text: 'Supplied testosterone or anabolic steroids lower FSH. Also disorders of the pituitary gland or hypothalamus (e.g. tumours, injuries, inflammation, radiation). Any acute serious illness can lower the level temporarily. In women also rapid weight loss, being very underweight or extreme exercise.' },
        { label: 'Typical signs', text: 'In men fewer sperm, smaller testicles. In women periods stop.' },
        { label: 'Possible consequences', text: 'Infertility. After supply of anabolic steroids ends, it can take months to years for sperm production to recover.' },
        { text: 'Have it checked by a doctor, especially when trying for a child or if periods have stopped.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it says little; it is assessed together with LH and the sex hormones.' }],
      hoch: [
        { label: 'Possible causes', text: 'Often the testicles or ovaries are underperforming, and the pituitary gland makes more FSH to stimulate them. In men FSH is often raised when sperm production is impaired, even with normal testosterone – e.g. after injury to the testicles, mumps, in Klinefelter syndrome or with a germ cell tumour of the testicle. In women menopause (normal from about 45), ovaries that stop working early, polycystic ovary syndrome (PCOS), an ovarian tumour, diseases of the thyroid or adrenal glands. In both sexes chemotherapy or radiotherapy and autoimmune diseases.' },
        { label: 'Typical signs', text: 'Depend on the cause. In men e.g. difficulty conceiving, less interest in sex, less muscle mass and body hair. In women irregular or absent periods, hot flushes, difficulty conceiving.' },
        { text: 'Have it checked by a doctor, especially when trying for a child, and in women under 45.' },
      ],
    },
    quellen: [
      { label: 'gesund.bund.de: Wechseljahre', url: 'https://gesund.bund.de/wechseljahre' },
      { label: 'MSD Manual: Probleme mit den Spermien', url: 'https://www.msdmanuals.com/de/heim/gesundheitsprobleme-von-frauen/unfruchtbarkeit-und-habitueller-abort/probleme-mit-den-spermien' },
      { label: 'MSD Manual: Hypopituitarismus', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-hirnanhangdr%C3%BCse-hypophyse/hypopituitarismus' },
      { label: 'MSD Manual: Männlicher Hypogonadismus', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/m%C3%A4nnliche-geschlechtsorgane-endokrinologie-and-verwandte-erkrankungen/m%C3%A4nnlicher-hypogonadismus' },
      { label: 'MSD Manual: Anabol-androgene Steroide', url: 'https://www.msdmanuals.com/de/profi/endokrine-und-metabolische-krankheiten/m%C3%A4nnliche-geschlechtsorgane-endokrinologie-and-verwandte-erkrankungen/anabol-androgene-steroide' },
      { label: 'MedlinePlus: Follicle-Stimulating Hormone (FSH) Levels Test', url: 'https://medlineplus.gov/lab-tests/follicle-stimulating-hormone-fsh-levels-test/' },
    ],
  },

  'Prolaktin': {
    de: {
      hinweis: 'In Schwangerschaft und Stillzeit ist Prolaktin natürlicherweise hoch. Der Wert schwankt über den Tag; Blut wird meist 3 bis 4 Stunden nach dem Aufwachen abgenommen. Stress, körperliche Belastung, Sex, eiweißreiche Kost und bestimmte Medikamente können ihn erhöhen – der Praxis sagen, was man einnimmt.',
      niedrig: [
        { text: 'Selten. Kann auf eine Störung der Hirnanhangdrüse hinweisen. Bei Männern hat ein niedriger Wert keine bekannte Bedeutung; bei Frauen kann nach einer Geburt zu wenig Muttermilch gebildet werden.' },
        { text: 'Bei Unsicherheit oder anderen auffälligen Hormonwerten ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im üblichen Bereich.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Am häufigsten ein Prolaktinom, ein gutartiger Tumor der Hirnanhangdrüse. Außerdem andere Tumoren in diesem Bereich, bestimmte Medikamente (z. B. manche Psychopharmaka, Blutdruckmittel, Opioide, die Pille), Schilddrüsenunterfunktion, Nieren- oder Lebererkrankungen, Verletzungen am Brustkorb, bei Frauen das PCO-Syndrom.' },
        { label: 'Typische Anzeichen', text: 'Bei Männern weniger Lust auf Sex, Erektionsprobleme, niedriges Testosteron, vergrößerte Brust, weniger Bart- und Körperbehaarung. Bei Frauen unregelmäßige oder ausbleibende Regelblutungen, trockene Scheide. Bei beiden Geschlechtern Milchfluss aus der Brust ohne Schwangerschaft oder Stillzeit.' },
        { label: 'Mögliche Folgen', text: 'Unfruchtbarkeit. Durch weniger Testosteron bzw. Östrogen ein höheres Risiko für Knochenschwund (Osteoporose). Ein großes Prolaktinom kann auf Nerven drücken und Kopfschmerzen oder Ausfälle im Gesichtsfeld verursachen.' },
        { text: 'Ärztlich abklären, besonders bei Kopfschmerzen oder Sehstörungen; ein leicht erhöhter Wert wird manchmal erst erneut gemessen.' },
      ],
    },
    en: {
      hinweis: 'During pregnancy and breastfeeding, prolactin is naturally high. The level varies over the day; blood is usually taken 3 to 4 hours after waking up. Stress, physical exertion, sex, a high-protein diet and certain medicines can raise it – tell your practice what you take.',
      niedrig: [
        { text: 'Rare. Can point to a disorder of the pituitary gland. In men a low value has no known significance; in women too little breast milk may be produced after giving birth.' },
        { text: 'If unsure, or with other abnormal hormone values, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'The value is in the usual range.' }],
      hoch: [
        { label: 'Possible causes', text: 'Most often a prolactinoma, a benign tumour of the pituitary gland. Also other tumours in this area, certain medicines (e.g. some psychiatric medicines, blood pressure medicines, opioids, the pill), an underactive thyroid, kidney or liver disease, chest injuries, and in women polycystic ovary syndrome (PCOS).' },
        { label: 'Typical signs', text: 'In men less interest in sex, erection problems, low testosterone, enlarged breasts, less facial and body hair. In women irregular or absent periods, vaginal dryness. In both sexes milk from the breast without pregnancy or breastfeeding.' },
        { label: 'Possible consequences', text: 'Infertility. Through less testosterone or oestrogen, a higher risk of bone loss (osteoporosis). A large prolactinoma can press on nerves and cause headaches or gaps in the field of vision.' },
        { text: 'Have it checked by a doctor, especially with headaches or vision problems; a slightly raised value is sometimes measured again first.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Hirnanhangdrüse', url: 'https://www.gesundheitsinformation.de/wie-funktioniert-die-hirnanhangdruese-hypophyse.html' },
      { label: 'MSD Manual: Prolaktinom', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-hirnanhangdr%C3%BCse-hypophyse/prolaktinom' },
      { label: 'MSD Manual: Hypopituitarismus', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-hirnanhangdr%C3%BCse-hypophyse/hypopituitarismus' },
      { label: 'MSD Manual: Probleme mit den Spermien', url: 'https://www.msdmanuals.com/de/heim/gesundheitsprobleme-von-frauen/unfruchtbarkeit-und-habitueller-abort/probleme-mit-den-spermien' },
      { label: 'MedlinePlus: Prolactin Levels Test', url: 'https://medlineplus.gov/lab-tests/prolactin-levels/' },
    ],
  },
}
