import type { MarkerGuidance } from '../markerGuidance'

/** Hormone (Wachstum, Nebenniere, Progesteron): Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_HORMONE2: Record<string, MarkerGuidance> = {
  'IGF-1': {
    de: {
      hinweis: 'IGF-1 hängt stark vom Alter ab: In der Kindheit ist der Wert niedrig, in der Pubertät am höchsten, danach sinkt er. Eine besondere Vorbereitung ist meist nicht nötig.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Häufig der normale Rückgang mit dem Alter. Seltener ein Mangel an Wachstumshormon, weil die Hirnanhangdrüse zu wenig bildet, z. B. durch einen Tumor, eine Verletzung, eine Operation, eine Bestrahlung oder eine Entzündung. Sehr selten ist der Körper von Geburt an unempfindlich für Wachstumshormon.' },
        { label: 'Typische Anzeichen', text: 'Bei Erwachsenen eher unspezifisch: Abgeschlagenheit, mehr Körperfett und weniger Muskeln. Solche Beschwerden haben aber meist andere Ursachen. Bei Kindern langsames Wachstum und geringere Körpergröße als Gleichaltrige.' },
        { label: 'Mögliche Folgen', text: 'Bei Erwachsenen geringere Knochendichte, weniger Muskelmasse und veränderte Cholesterinwerte.' },
        { text: 'Ärztlich einordnen lassen, besonders bei Kindern, die auffällig langsam wachsen, oder bei bekannten Erkrankungen der Hirnanhangdrüse.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Ein Wachstumshormonmangel bei Erwachsenen ist damit allein nicht sicher ausgeschlossen.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Zugeführtes Wachstumshormon (Somatropin) erhöht IGF-1, ebenso Substanzen, die die körpereigene Ausschüttung anregen (z. B. manche Peptide). Ohne Zufuhr meist ein gutartiger Tumor der Hirnanhangdrüse, der zu viel Wachstumshormon bildet. Bei Erwachsenen heißt das Akromegalie, bei Kindern Riesenwuchs. Selten regen Tumoren in Bauchspeicheldrüse oder Lunge die Hirnanhangdrüse dazu an.' },
        { label: 'Typische Anzeichen', text: 'Gröbere Gesichtszüge, größere Hände und Füße (Ring- oder Schuhgröße ändert sich), tiefe, raue Stimme, starkes Schwitzen, dicke, ölige Haut, Gelenkschmerzen, Kopfschmerzen, Sehstörungen; bei Frauen unregelmäßige Regelblutungen, bei Männern Erektionsprobleme. Die Veränderungen kommen langsam und bleiben oft jahrelang unbemerkt.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Diabetes, Bluthochdruck, ein vergrößertes und geschwächtes Herz, nächtliche Atemaussetzer (Schlafapnoe) und Polypen im Dickdarm. Unbehandelt ist die Lebenserwartung verkürzt.' },
        { label: 'Bei Zufuhr', text: 'Zu viel zugeführtes Wachstumshormon kann ähnliche Veränderungen auslösen wie eine Akromegalie: Schwellungen an Händen, Füßen und Beinen, größere Hände, Füße, Lippen, Nase und Zunge, starkes Schwitzen, Gelenk- oder Muskelschwäche.' },
        { text: 'Ärztlich abklären, besonders bei Zufuhr solcher Substanzen; zeitnah bei Sehstörungen oder anhaltend starken Kopfschmerzen.' },
      ],
    },
    en: {
      hinweis: 'IGF-1 depends strongly on age: the level is low in childhood, highest during puberty, and falls afterwards. Usually no special preparation is needed.',
      niedrig: [
        { label: 'Possible causes', text: 'Often the normal decline with age. Less often a lack of growth hormone because the pituitary gland makes too little, e.g. due to a tumour, an injury, surgery, radiotherapy or inflammation. Very rarely the body is insensitive to growth hormone from birth.' },
        { label: 'Typical signs', text: 'In adults rather non-specific: tiredness, more body fat and less muscle. Such complaints, however, usually have other causes. In children, slow growth and shorter height than others of the same age.' },
        { label: 'Possible consequences', text: 'In adults, lower bone density, less muscle mass and changed cholesterol levels.' },
        { text: 'Have it assessed by a doctor, especially in children who grow noticeably slowly or with known pituitary disease.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own, this does not reliably rule out growth hormone deficiency in adults.' }],
      hoch: [
        { label: 'Possible causes', text: 'Supplied growth hormone (somatropin) raises IGF-1, as do substances that stimulate the body’s own release (e.g. some peptides). Without supply, usually a benign tumour of the pituitary gland that makes too much growth hormone. In adults this is called acromegaly, in children gigantism. Rarely, tumours in the pancreas or lungs stimulate the pituitary gland to do so.' },
        { label: 'Typical signs', text: 'Coarser facial features, larger hands and feet (ring or shoe size changes), deep, husky voice, heavy sweating, thick, oily skin, joint pain, headaches, vision problems; irregular periods in women, erection problems in men. The changes come slowly and often go unnoticed for years.' },
        { label: 'Possible long-term consequences', text: 'Diabetes, high blood pressure, an enlarged and weakened heart, pauses in breathing at night (sleep apnoea) and polyps in the large bowel. Untreated, life expectancy is reduced.' },
        { label: 'When supplied', text: 'Too much supplied growth hormone can cause changes similar to acromegaly: swelling of the hands, feet and legs, enlarged hands, feet, lips, nose and tongue, heavy sweating, joint or muscle weakness.' },
        { text: 'Have it checked by a doctor, especially when supplying such substances; promptly with vision problems or persistent severe headaches.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Gigantismus und Akromegalie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-hirnanhangdr%C3%BCse-hypophyse/gigantismus-und-akromegalie' },
      { label: 'MSD Manual: Hypopituitarismus', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-hirnanhangdr%C3%BCse-hypophyse/hypopituitarismus' },
      { label: 'gesund.bund.de: Akromegalie (ICD E22.0)', url: 'https://gesund.bund.de/icd-code-suche/e22-0' },
      { label: 'MedlinePlus: IGF-1 Test', url: 'https://medlineplus.gov/lab-tests/igf-1-insulin-like-growth-factor-1-test/' },
      { label: 'MedlinePlus: Acromegaly', url: 'https://medlineplus.gov/ency/article/000321.htm' },
      { label: 'NHS: Acromegaly', url: 'https://www.nhs.uk/conditions/acromegaly/' },
      { label: 'MedlinePlus: Somatropin Injection', url: 'https://medlineplus.gov/druginfo/meds/a622022.html' },
      { label: 'MSD Manual: Growth Hormone Deficiency in Children', url: 'https://www.msdmanuals.com/professional/pediatrics/endocrine-disorders-in-children/growth-hormone-deficiency-in-children' },
    ],
  },

  'GH': {
    de: {
      hinweis: 'Wachstumshormon wird in kurzen Schüben ausgeschüttet, vor allem nachts. Ein Wert kann normal hoch sein, wenn gerade ein Schub war, und normal niedrig, wenn keiner war. Bei Frauen liegt der übliche Bereich höher als bei Männern. Verlässlich beurteilt wird es meist in besonderen Tests über mehrere Stunden; davor muss man manchmal nüchtern sein.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Häufig ohne Bedeutung, weil zum Zeitpunkt der Blutentnahme gerade kein Schub war. Seltener bildet die Hirnanhangdrüse zu wenig Wachstumshormon, oft zusammen mit anderen Hormonen.' },
        { label: 'Typische Anzeichen eines Mangels', text: 'Bei Erwachsenen eher unspezifisch: Abgeschlagenheit, mehr Körperfett und weniger Muskeln. Bei Kindern langsames Wachstum und geringere Körpergröße.' },
        { text: 'Ein Mangel lässt sich mit einem Einzelwert nicht feststellen. Bei Verdacht ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Als Einzelmessung ist er allein wenig aussagekräftig.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Oft ein Schub zum Zeitpunkt der Blutentnahme. Dauerhaft zu viel Wachstumshormon kommt meist von einem gutartigen Tumor der Hirnanhangdrüse (bei Erwachsenen Akromegalie, bei Kindern Riesenwuchs). Selten ist der Körper unempfindlich für Wachstumshormon. Außerdem zugeführtes Wachstumshormon (Somatropin) oder Substanzen, die die körpereigene Ausschüttung anregen (z. B. manche Peptide).' },
        { label: 'Typische Anzeichen bei dauerhaftem Überschuss', text: 'Gröbere Gesichtszüge, größere Hände und Füße, tiefe Stimme, starkes Schwitzen, Gelenkschmerzen, Kopfschmerzen.' },
        { label: 'Bei Zufuhr', text: 'Zu viel zugeführtes Wachstumshormon kann ähnliche Veränderungen auslösen wie eine Akromegalie: Schwellungen an Händen, Füßen und Beinen, größere Hände, Füße, Lippen, Nase und Zunge, starkes Schwitzen, Gelenk- oder Muskelschwäche.' },
        { text: 'Ein einzelner hoher Wert reicht für eine Diagnose nicht. Zusammen mit IGF-1 ärztlich einordnen lassen, besonders bei solchen Anzeichen oder bei Zufuhr.' },
      ],
    },
    en: {
      hinweis: 'Growth hormone is released in short bursts, mainly at night. A value can be normally high if a burst has just occurred, and normally low if none has. In women the usual range is higher than in men. It is usually assessed reliably with special tests over several hours; for some you need to be fasting.',
      niedrig: [
        { label: 'Possible causes', text: 'Often without significance, because no burst was occurring when the blood was taken. Less often the pituitary gland makes too little growth hormone, often together with other hormones.' },
        { label: 'Typical signs of a deficiency', text: 'In adults rather non-specific: tiredness, more body fat and less muscle. In children, slow growth and shorter height.' },
        { text: 'A deficiency cannot be established from a single value. If suspected, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. As a single measurement, it says little on its own.' }],
      hoch: [
        { label: 'Possible causes', text: 'Often a burst at the time the blood was taken. Persistent excess growth hormone usually comes from a benign tumour of the pituitary gland (acromegaly in adults, gigantism in children). Rarely the body is insensitive to growth hormone. Also supplied growth hormone (somatropin) or substances that stimulate the body’s own release (e.g. some peptides).' },
        { label: 'Typical signs of persistent excess', text: 'Coarser facial features, larger hands and feet, deep voice, heavy sweating, joint pain, headaches.' },
        { label: 'When supplied', text: 'Too much supplied growth hormone can cause changes similar to acromegaly: swelling of the hands, feet and legs, enlarged hands, feet, lips, nose and tongue, heavy sweating, joint or muscle weakness.' },
        { text: 'A single high value is not enough for a diagnosis. Have it assessed by a doctor together with IGF-1, especially with such signs or when supplying it.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Gigantismus und Akromegalie', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-hirnanhangdr%C3%BCse-hypophyse/gigantismus-und-akromegalie' },
      { label: 'MSD Manual: Hypopituitarismus', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-hirnanhangdr%C3%BCse-hypophyse/hypopituitarismus' },
      { label: 'MedlinePlus: Growth Hormone Tests', url: 'https://medlineplus.gov/lab-tests/growth-hormone-tests/' },
      { label: 'MedlinePlus: Growth hormone test', url: 'https://medlineplus.gov/ency/article/003706.htm' },
      { label: 'MedlinePlus: Somatropin Injection', url: 'https://medlineplus.gov/druginfo/meds/a622022.html' },
      { label: 'MSD Manual: Growth Hormone Deficiency in Children', url: 'https://www.msdmanuals.com/professional/pediatrics/endocrine-disorders-in-children/growth-hormone-deficiency-in-children' },
    ],
  },

  'Kortisol': {
    de: {
      hinweis: 'Kortisol folgt einem Tagesrhythmus: morgens ist es am höchsten, gegen 16 Uhr deutlich niedriger. Stress und körperliche Anstrengung erhöhen den Wert; auch Schwangerschaft, Hitze oder Kälte und bestimmte Medikamente wie die Pille verändern ihn. Der Praxis alle Medikamente nennen, auch Cremes.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Am Nachmittag oder Abend gemessen ist ein niedrigerer Wert normal. Sonst eine Unterfunktion der Nebennieren, am häufigsten weil das Abwehrsystem sie angreift (Addison-Krankheit), seltener durch Infektionen wie Tuberkulose oder Krebs. Oder die Hirnanhangdrüse gibt zu wenig Steuerhormon (ACTH) ab, etwa durch einen Tumor, eine Verletzung oder eine Operation. Häufig steckt eine längere Einnahme kortisonhaltiger Medikamente dahinter, vor allem wenn sie plötzlich beendet wird.' },
        { label: 'Typische Anzeichen', text: 'Anhaltende Müdigkeit, Schwäche, Schwindel beim Aufstehen, Appetitlosigkeit, Gewichtsverlust, Übelkeit, Bauchschmerzen, Lust auf Salziges; bei der Addison-Krankheit dunklere Hautstellen.' },
        { label: 'Mögliche Folgen', text: 'Bei Belastung wie Infekten, Unfällen oder Operationen kann eine lebensbedrohliche Nebennierenkrise entstehen.' },
        { text: 'Ärztlich abklären. Sofort den Notruf 112 wählen bei plötzlicher Verschlechterung mit starkem Schwindel, starken Bauchschmerzen, Erbrechen, großer Schläfrigkeit oder Verwirrtheit.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Ein einzelner Wert sagt allein wenig aus.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Am häufigsten eine längere Einnahme kortisonhaltiger Medikamente (auch als Spray oder Creme möglich). Vorübergehend erhöhen Stress und Anstrengung den Wert; erhöht sein kann er auch bei Depression, Angst, Alkoholabhängigkeit, schlecht eingestelltem Diabetes oder starkem Übergewicht. Seltener ein Tumor in der Hirnanhangdrüse, der Nebenniere oder anderswo, z. B. in der Lunge (Cushing-Syndrom).' },
        { label: 'Typische Anzeichen eines dauerhaften Überschusses', text: 'Mehr Fett an Bauch, Nacken und oberem Rücken bei eher dünnen Armen und Beinen, rundes, gerötetes Gesicht, dünne Haut mit leichten Blutergüssen, breite Dehnungsstreifen, Muskelschwäche, Stimmungsschwankungen; bei Frauen unregelmäßige Regelblutungen und vermehrte Behaarung.' },
        { label: 'Mögliche Folgen auf Dauer', text: 'Bluthochdruck, Diabetes, Knochenschwund (Osteoporose), Infektanfälligkeit, Blutgerinnsel und Nierensteine.' },
        { text: 'Ein einzelner Wert ist keine Diagnose. Ärztlich abklären, besonders bei solchen Anzeichen oder wenn man kortisonhaltige Medikamente nimmt.' },
      ],
    },
    en: {
      hinweis: 'Cortisol follows a daily rhythm: it is highest in the morning and much lower around 4 pm. Stress and physical exertion raise the level; pregnancy, heat or cold and certain medicines such as the pill also change it. Tell your practice about all medicines, including creams.',
      niedrig: [
        { label: 'Possible causes', text: 'Measured in the afternoon or evening, a lower value is normal. Otherwise underactive adrenal glands, most often because the immune system attacks them (Addison’s disease), less often due to infections such as tuberculosis, or cancer. Or the pituitary gland releases too little of the control hormone (ACTH), e.g. due to a tumour, an injury or surgery. Often the cause is long-term use of corticosteroid medicines, especially when they are stopped suddenly.' },
        { label: 'Typical signs', text: 'Persistent tiredness, weakness, dizziness on standing up, loss of appetite, weight loss, nausea, abdominal pain, craving for salty food; in Addison’s disease, darker patches of skin.' },
        { label: 'Possible consequences', text: 'Under strain such as infections, accidents or surgery, a life-threatening adrenal crisis can develop.' },
        { text: 'Have it checked by a doctor. Call the emergency number (112 in Europe) immediately if things suddenly get worse with severe dizziness, severe abdominal pain, vomiting, marked drowsiness or confusion.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. A single value says little on its own.' }],
      hoch: [
        { label: 'Possible causes', text: 'Most often long-term use of corticosteroid medicines (also possible as a spray or cream). Stress and exertion raise the level temporarily; it can also be raised with depression, anxiety, alcohol dependence, poorly controlled diabetes or severe obesity. Less often a tumour in the pituitary gland, the adrenal gland or elsewhere, e.g. in the lungs (Cushing’s syndrome).' },
        { label: 'Typical signs of persistent excess', text: 'More fat on the tummy, neck and upper back with rather thin arms and legs, a round, red face, thin skin that bruises easily, wide stretch marks, muscle weakness, mood swings; in women irregular periods and increased hair growth.' },
        { label: 'Possible long-term consequences', text: 'High blood pressure, diabetes, bone loss (osteoporosis), susceptibility to infections, blood clots and kidney stones.' },
        { text: 'A single value is not a diagnosis. Have it checked by a doctor, especially with such signs or if you take corticosteroid medicines.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Cushing-Syndrom', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-nebennieren/cushing-syndrom' },
      { label: 'MSD Manual: Nebenniereninsuffizienz', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-nebennieren/nebenniereninsuffizienz' },
      { label: 'MedlinePlus: Cortisol Test', url: 'https://medlineplus.gov/lab-tests/cortisol-test/' },
      { label: 'NHS: Addison’s disease', url: 'https://www.nhs.uk/conditions/addisons-disease/' },
      { label: 'NHS: Cushing’s syndrome', url: 'https://www.nhs.uk/conditions/cushings-syndrome/' },
    ],
  },

  'DHEA-S': {
    de: {
      hinweis: 'Der Normalbereich hängt stark von Alter und Geschlecht ab; am höchsten ist der Wert um die Pubertät. Eine besondere Vorbereitung ist nicht nötig. Beurteilt wird DHEA-S meist zusammen mit anderen Geschlechtshormonen wie Testosteron oder Östrogen.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Häufig das Alter. Seltener eine Unterfunktion der Nebennieren (z. B. Addison-Krankheit) oder der Hirnanhangdrüse.' },
        { label: 'Typische Anzeichen', text: 'Altersbedingt: weniger Lust auf Sex, bei Männern Erektionsprobleme, bei Frauen eine dünnere Scheidenhaut. Liegt es an den Nebennieren: Gewichtsverlust, Übelkeit, Erbrechen, Schwindel, Flüssigkeitsmangel, Lust auf Salziges.' },
        { text: 'Bei Beschwerden ärztlich abklären; zeitnah bei Zeichen einer Nebennieren-Unterfunktion.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Er wird mit Alter, Geschlecht und anderen Hormonwerten eingeordnet.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'Bei Frauen z. B. das PCO-Syndrom, eine häufige Hormonstörung. Außerdem eine angeborene Störung der Nebennieren (adrenogenitales Syndrom), ein gutartiger oder bösartiger Tumor der Nebenniere, selten ein Tumor des Eierstocks.' },
        { label: 'Typische Anzeichen', text: 'Bei Frauen vermehrte Gesichts- und Körperbehaarung, tiefere Stimme, unregelmäßige Regelblutungen, Akne, Haarausfall am Oberkopf, deutlich mehr Muskeln. Bei Männern oft keine.' },
        { label: 'Mögliche Folgen', text: 'Bei Frauen kann die Regelblutung ausbleiben, bei Männern die Hodenfunktion gedrosselt werden – beides kann die Fruchtbarkeit verringern.' },
        { text: 'Ärztlich abklären, besonders bei Frauen mit neuen Zeichen von Vermännlichung. DHEA-Präparate werden gegen das Altern beworben; ein Nutzen ist nicht verlässlich belegt, ernste Nebenwirkungen sind möglich – ihre Einnahme ärztlich besprechen.' },
      ],
    },
    en: {
      hinweis: 'The normal range depends strongly on age and sex; the level is highest around puberty. No special preparation is needed. DHEA-S is usually assessed together with other sex hormones such as testosterone or oestrogen.',
      niedrig: [
        { label: 'Possible causes', text: 'Often age. Less often underactive adrenal glands (e.g. Addison’s disease) or an underactive pituitary gland.' },
        { label: 'Typical signs', text: 'Age-related: less interest in sex, erection problems in men, thinner vaginal tissue in women. If the adrenal glands are the cause: weight loss, nausea, vomiting, dizziness, dehydration, craving for salty food.' },
        { text: 'Have it checked by a doctor if you have symptoms; promptly with signs of underactive adrenal glands.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. It is assessed together with age, sex and other hormone values.' }],
      hoch: [
        { label: 'Possible causes', text: 'In women, e.g. polycystic ovary syndrome (PCOS), a common hormone disorder. Also an inherited disorder of the adrenal glands (congenital adrenal hyperplasia), a benign or malignant tumour of the adrenal gland, rarely a tumour of the ovary.' },
        { label: 'Typical signs', text: 'In women, increased facial and body hair, deeper voice, irregular periods, acne, hair loss on top of the head, markedly more muscle. In men, often none.' },
        { label: 'Possible consequences', text: 'In women periods can stop, in men testicular function can be suppressed – both can reduce fertility.' },
        { text: 'Have it checked by a doctor, especially in women with new signs of masculinisation. DHEA supplements are promoted against ageing; a benefit is not reliably proven and serious side effects are possible – discuss taking them with a doctor.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Adrenale Virilisierung', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-nebennieren/adrenale-virilisierung' },
      { label: 'MSD Manual: Nebenniereninsuffizienz', url: 'https://www.msdmanuals.com/de/heim/hormon-und-stoffwechselerkrankungen/erkrankungen-der-nebennieren/nebenniereninsuffizienz' },
      { label: 'MedlinePlus: DHEA Sulfate Test', url: 'https://medlineplus.gov/lab-tests/dhea-sulfate-test/' },
    ],
  },

  'Progesteron': {
    de: {
      hinweis: 'Bei Frauen hängt der Wert vom Zyklus ab: Nach dem Eisprung bildet der Gelbkörper mehr Progesteron, in der zweiten Zyklushälfte und in der Schwangerschaft ist ein höherer Wert daher normal. Für die Einordnung zählen der Zyklustag (erster Tag der letzten Regelblutung) und ob eine Schwangerschaft besteht; manchmal sind mehrere Messungen nötig.',
      niedrig: [
        { label: 'Mögliche Ursachen', text: 'Bei Männern und bei Frauen in der ersten Zyklushälfte ist ein niedriger Wert normal. Sonst kann er bei Frauen auf einen ausbleibenden Eisprung hinweisen, z. B. bei fehlender Regelblutung, PCO-Syndrom, viel Stress oder in der Zeit vor den Wechseljahren; auch niedriges Cholesterin kommt infrage. In der Schwangerschaft kann ein niedriger Wert auf eine Fehlgeburt, ein erhöhtes Risiko dafür oder eine Schwangerschaft außerhalb der Gebärmutter hinweisen.' },
        { label: 'Typische Anzeichen', text: 'Unregelmäßige Regelblutungen, Hitzewallungen, Schlafprobleme.' },
        { label: 'Mögliche Folge', text: 'Schwierigkeiten, schwanger zu werden.' },
        { text: 'Bei Kinderwunsch oder Zyklusstörungen ärztlich einordnen lassen. In der Schwangerschaft bei Blutungen oder Unterbauchschmerzen sofort ärztliche Hilfe holen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Bei Frauen ist er nur mit dem Zyklustag aussagekräftig.' }],
      hoch: [
        { label: 'Mögliche Ursachen', text: 'In der zweiten Zyklushälfte und in der Schwangerschaft normal; besonders hohe Werte in der Schwangerschaft können auf Mehrlinge hinweisen. Sonst Zysten am Eierstock, Erkrankungen der Nebennieren (z. B. das angeborene adrenogenitale Syndrom, selten Krebs), selten Eierstockkrebs oder in der Schwangerschaft eine Blasenmole (krankhaftes Gewebe statt eines Embryos). Bei Männern kann ein hoher Wert auf eine Erkrankung der Nebennieren hinweisen.' },
        { label: 'Typische Anzeichen', text: 'Scheidentrockenheit, Blähbauch.' },
        { text: 'Außerhalb der zweiten Zyklushälfte und einer Schwangerschaft sowie bei Männern ärztlich abklären.' },
      ],
    },
    en: {
      hinweis: 'In women the value depends on the cycle: after ovulation the corpus luteum makes more progesterone, so a higher value is normal in the second half of the cycle and in pregnancy. The cycle day (first day of the last period) and whether you are pregnant matter for the assessment; several measurements are sometimes needed.',
      niedrig: [
        { label: 'Possible causes', text: 'In men and in women in the first half of the cycle, a low value is normal. Otherwise, in women it can point to a lack of ovulation, e.g. with absent periods, PCOS, a lot of stress or in the time before menopause; low cholesterol is also possible. In pregnancy, a low value can point to a miscarriage, a higher risk of one, or a pregnancy outside the womb.' },
        { label: 'Typical signs', text: 'Irregular periods, hot flushes, sleep problems.' },
        { label: 'Possible consequence', text: 'Difficulty getting pregnant.' },
        { text: 'Have it assessed by a doctor when trying for a child or with cycle problems. In pregnancy, get medical help immediately with bleeding or lower abdominal pain.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. In women it is only meaningful together with the cycle day.' }],
      hoch: [
        { label: 'Possible causes', text: 'Normal in the second half of the cycle and in pregnancy; particularly high values in pregnancy can point to twins or more. Otherwise ovarian cysts, adrenal gland disorders (e.g. inherited congenital adrenal hyperplasia, rarely cancer), rarely ovarian cancer or, in pregnancy, a molar pregnancy (abnormal tissue instead of an embryo). In men, a high value can point to an adrenal gland disorder.' },
        { label: 'Typical signs', text: 'Vaginal dryness, bloating.' },
        { text: 'Have it checked by a doctor outside the second half of the cycle and pregnancy, and in men.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Menstruationszyklus', url: 'https://www.msdmanuals.com/de/heim/gesundheitsprobleme-von-frauen/das-weibliche-fortpflanzungssystem/menstruationszyklus' },
      { label: 'MSD Manual: Ektope Schwangerschaft', url: 'https://www.msdmanuals.com/de/heim/gesundheitsprobleme-von-frauen/erkrankungen-in-der-fr%C3%BChen-schwangerschaft/ektope-schwangerschaft' },
      { label: 'MedlinePlus: Progesterone Test', url: 'https://medlineplus.gov/lab-tests/progesterone-test/' },
    ],
  },
}
