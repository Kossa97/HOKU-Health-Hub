import type { GuidanceItem, MarkerGuidance } from '../markerGuidance'

/*
 * Differentialblutbild: Prozentwert und absoluter Wert einer Zellart teilen sich
 * die Abschnitte niedrig/bereich/hoch; nur der Hinweis unterscheidet sich.
 */

type Abschnitte = { niedrig: GuidanceItem[]; bereich: GuidanceItem[]; hoch: GuidanceItem[] }

const U = { de: 'Mögliche Ursachen', en: 'Possible causes' }
const A = { de: 'Typische Anzeichen', en: 'Typical signs' }
const F = { de: 'Mögliche Folgen', en: 'Possible consequences' }
const E = { de: 'Einordnung', en: 'Context' }

const PROZENT = {
  de: 'Der Prozentwert hängt auch von den anderen weißen Blutkörperchen ab: Steigt eine Zellart stark an, sinkt der Anteil der übrigen. Aussagekräftiger ist meist der absolute Wert.',
  en: 'The percentage also depends on the other white blood cells: if one cell type rises sharply, the share of the others falls. The absolute value is usually more meaningful.',
}
const ABSOLUT = {
  de: 'Der absolute Wert gibt die tatsächliche Zahl der Zellen an und ist meist aussagekräftiger als der Prozentwert, der auch vom Anteil der anderen weißen Blutkörperchen abhängt.',
  en: 'The absolute value gives the actual number of cells and is usually more meaningful than the percentage, which also depends on the share of the other white blood cells.',
}

const BEREICH = {
  de: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein sagt er wenig aus; er wird zusammen mit den übrigen Blutwerten beurteilt.' }],
  en: [{ text: 'The value is within the lab’s reference range. On its own it says little; it is assessed together with the other blood values.' }],
}

const NEUTRO: { de: Abschnitte; en: Abschnitte } = {
  de: {
    niedrig: [
      { label: U.de, text: 'Oft ein starker Verbrauch bei einer bakteriellen Infektion. Seltener Störungen der Blutbildung im Knochenmark, Autoimmunerkrankungen, ein vermehrter Abbau in einer vergrößerten Milz oder Krebs. Außerdem Virusinfektionen wie Grippe, Vitamin-B12- oder Folsäuremangel und Nebenwirkungen bestimmter Medikamente (z. B. Mittel gegen eine Schilddrüsenüberfunktion, Chemotherapie). Bei manchen Menschen, etwa afrikanischer oder nahöstlicher Herkunft, liegt der Wert von Natur aus niedriger, ohne dass Infektionen häufiger sind.' },
      { label: A.de, text: 'Oft keine eigenen Beschwerden. Ein Mangel fällt meist erst durch Infektionen auf: Fieber, schmerzhafte Geschwüre im Mund oder am After, häufige oder ungewöhnliche Infekte.' },
      { label: F.de, text: 'Ein leicht verminderter Wert macht oft keine Beschwerden. Je niedriger der Wert, desto anfälliger ist man für Infektionen; bei sehr niedrigen Werten können sie schwer verlaufen, bis hin zur Blutvergiftung (Sepsis).' },
      { text: 'Ärztlich abklären lassen. Bei Fieber und bekannt niedrigem Wert sofort ärztliche Hilfe holen.' },
    ],
    bereich: BEREICH.de,
    hoch: [
      { label: U.de, text: 'Meist eine Infektion, vor allem durch Bakterien – das ist eine normale Abwehrreaktion. Außerdem Verletzungen, Verbrennungen, akuter Stress, entzündliche Erkrankungen wie rheumatoide Arthritis, Rauchen und bestimmte Medikamente wie Kortison (Kortikosteroide). Seltener eine Bluterkrankung wie Leukämie.' },
      { label: A.de, text: 'Durch den Wert selbst oft keine. Beschwerden kommen meist von der Ursache, z. B. Fieber und Schüttelfrost bei einer Infektion.' },
      { label: E.de, text: 'Eine erhöhte Zahl reifer Neutrophiler ist in der Regel selbst kein Problem; wichtig ist die Ursache.' },
      { text: 'Ärztlich einordnen lassen, besonders bei Fieber oder anderen Beschwerden oder wenn der Wert ohne erkennbaren Grund erhöht ist.' },
    ],
  },
  en: {
    niedrig: [
      { label: U.en, text: 'Often heavy use during a bacterial infection. Less often disorders of blood formation in the bone marrow, autoimmune diseases, increased breakdown in an enlarged spleen, or cancer. Also viral infections such as flu, vitamin B12 or folate deficiency, and side effects of certain medicines (e.g. drugs for an overactive thyroid, chemotherapy). In some people, for example of African or Middle Eastern descent, the level is naturally lower without infections being more frequent.' },
      { label: A.en, text: 'Often no symptoms of its own. A deficiency usually only shows through infections: fever, painful sores in the mouth or around the anus, frequent or unusual infections.' },
      { label: F.en, text: 'A slightly reduced value often causes no symptoms. The lower the value, the more prone you are to infections; with very low values they can become severe, up to blood poisoning (sepsis).' },
      { text: 'Have it checked by a doctor. With fever and a known low value, get medical help immediately.' },
    ],
    bereich: BEREICH.en,
    hoch: [
      { label: U.en, text: 'Usually an infection, mainly bacterial – this is a normal defence reaction. Also injuries, burns, acute stress, inflammatory diseases such as rheumatoid arthritis, smoking and certain medicines such as cortisone (corticosteroids). Less often a blood disease such as leukaemia.' },
      { label: A.en, text: 'Often none from the value itself. Symptoms usually come from the cause, e.g. fever and chills with an infection.' },
      { label: E.en, text: 'A raised number of mature neutrophils is usually not a problem in itself; what matters is the cause.' },
      { text: 'Have it assessed by a doctor, especially with fever or other symptoms, or if the value is raised for no apparent reason.' },
    ],
  },
}
const NEUTRO_HINWEIS = {
  de: 'Die Zahl der Neutrophilen schwankt stärker als die anderer Blutzellen, etwa mit körperlicher Aktivität, Angst, Infekten oder Medikamenten.',
  en: 'The neutrophil count varies more than that of other blood cells, e.g. with physical activity, anxiety, infections or medicines.',
}

const LYMPHO: { de: Abschnitte; en: Abschnitte } = {
  de: {
    niedrig: [
      { label: U.de, text: 'Häufig Virusinfektionen wie Grippe oder COVID-19; vorübergehend auch Fasten, starke körperliche Belastung oder Kortison (Kortikosteroide). Länger anhaltend z. B. Unterernährung, eine unbehandelte HIV-Infektion, Autoimmunerkrankungen, Störungen der Blutbildung, Chemo- oder Strahlentherapie, seltener Krebs wie Lymphome oder Leukämie. Auch mit dem Alter kann der Anteil sinken.' },
      { label: A.de, text: 'Bei leicht vermindertem Wert oft keine. Bei stark vermindertem Wert wiederholte Infektionen.' },
      { label: F.de, text: 'Das Immunsystem ist geschwächt; man ist anfälliger für Infektionen.' },
      { text: 'Ärztlich einordnen lassen, besonders bei wiederholten oder ungewöhnlichen Infektionen.' },
    ],
    bereich: BEREICH.de,
    hoch: [
      { label: U.de, text: 'Meist eine Infektion, vor allem durch Viren (z. B. Pfeiffersches Drüsenfieber), aber auch bestimmte bakterielle Infektionen wie Keuchhusten oder Tuberkulose. Außerdem die Basedow-Krankheit oder Morbus Crohn. Seltener eine Form von Blutkrebs wie ein Lymphom oder eine Leukämie.' },
      { label: A.de, text: 'Durch den Wert selbst meist keine; Beschwerden kommen eher von der Infektion. Bei Lymphomen und manchen Leukämien sind Fieber, Nachtschweiß und Gewichtsverlust möglich.' },
      { label: E.de, text: 'Bei Zeichen einer Entzündung steckt häufig ein Virusinfekt dahinter, den der Körper meist selbst überwindet.' },
      { text: 'Ärztlich einordnen lassen, besonders wenn der Wert ohne Infekt erhöht bleibt oder Fieber, Nachtschweiß oder Gewichtsverlust hinzukommen.' },
    ],
  },
  en: {
    niedrig: [
      { label: U.en, text: 'Often viral infections such as flu or COVID-19; temporarily also fasting, heavy physical strain or cortisone (corticosteroids). Longer-lasting e.g. malnutrition, untreated HIV infection, autoimmune diseases, disorders of blood formation, chemotherapy or radiotherapy, less often cancer such as lymphoma or leukaemia. The share can also fall with age.' },
      { label: A.en, text: 'Often none with a slightly reduced value. With a markedly reduced value, repeated infections.' },
      { label: F.en, text: 'The immune system is weakened; you are more prone to infections.' },
      { text: 'Have it assessed by a doctor, especially with repeated or unusual infections.' },
    ],
    bereich: BEREICH.en,
    hoch: [
      { label: U.en, text: 'Usually an infection, mainly viral (e.g. glandular fever), but also certain bacterial infections such as whooping cough or tuberculosis. Also Graves’ disease or Crohn’s disease. Less often a form of blood cancer such as lymphoma or leukaemia.' },
      { label: A.en, text: 'Usually none from the value itself; symptoms tend to come from the infection. With lymphomas and some leukaemias, fever, night sweats and weight loss are possible.' },
      { label: E.en, text: 'With signs of inflammation, a viral infection is often behind it, which the body usually overcomes on its own.' },
      { text: 'Have it assessed by a doctor, especially if the value stays raised without an infection or if fever, night sweats or weight loss occur.' },
    ],
  },
}
const LYMPHO_HINWEIS = {
  de: 'Bei Kindern ist ein deutlich höherer Anteil normal.',
  en: 'In children, a considerably higher share is normal.',
}

const MONO: { de: Abschnitte; en: Abschnitte } = {
  de: {
    niedrig: [
      { label: E.de, text: 'Meist ohne Bedeutung, weil Monozyten nur einen kleinen Teil der weißen Blutkörperchen ausmachen.' },
      { label: U.de, text: 'Deutlich vermindert sind sie meist zusammen mit anderen weißen Blutkörperchen, etwa bei einer Blutvergiftung (Sepsis), schweren Infektionen, Chemotherapie, Knochenmarkerkrankungen oder als Nebenwirkung von Medikamenten.' },
      { label: F.de, text: 'Fehlen auch andere weiße Blutkörperchen, ist man anfälliger für Infektionen.' },
      { text: 'Ist sonst alles unauffällig, muss in der Regel nichts unternommen werden. Bei Unsicherheit oder wenn auch andere Blutwerte vermindert sind, ärztlich einordnen lassen.' },
    ],
    bereich: BEREICH.de,
    hoch: [
      { label: U.de, text: 'Häufig Infektionen, z. B. durch Viren wie bei Pfeifferschem Drüsenfieber, Masern, Mumps oder Windpocken, durch Bakterien wie bei Tuberkulose oder Syphilis oder durch Parasiten wie bei Malaria. Außerdem chronische Entzündungen und Autoimmunerkrankungen; seltener Bluterkrankungen wie bestimmte Leukämien.' },
      { label: A.de, text: 'Durch den Wert selbst meist keine; Beschwerden kommen eher von der Ursache.' },
      { text: 'Ärztlich einordnen lassen, zusammen mit Beschwerden und den übrigen Blutwerten.' },
    ],
  },
  en: {
    niedrig: [
      { label: E.en, text: 'Usually without significance, because monocytes make up only a small part of the white blood cells.' },
      { label: U.en, text: 'When markedly reduced, they are usually low together with other white blood cells, e.g. with blood poisoning (sepsis), severe infections, chemotherapy, bone marrow diseases or as a side effect of medicines.' },
      { label: F.en, text: 'If other white blood cells are also lacking, you are more prone to infections.' },
      { text: 'If everything else is normal, usually nothing needs to be done. If unsure, or if other blood values are also reduced, have it assessed by a doctor.' },
    ],
    bereich: BEREICH.en,
    hoch: [
      { label: U.en, text: 'Often infections, e.g. viral as with glandular fever, measles, mumps or chickenpox, bacterial as with tuberculosis or syphilis, or parasitic as with malaria. Also chronic inflammation and autoimmune diseases; less often blood diseases such as certain leukaemias.' },
      { label: A.en, text: 'Usually none from the value itself; symptoms tend to come from the cause.' },
      { text: 'Have it assessed by a doctor, together with any symptoms and the other blood values.' },
    ],
  },
}
const MONO_HINWEIS = {
  de: 'Bei Kindern gilt ein höherer Anteil noch als normal.',
  en: 'In children, a higher share is still considered normal.',
}

const EOS: { de: Abschnitte; en: Abschnitte } = {
  de: {
    niedrig: [
      { label: E.de, text: 'Meist ohne Bedeutung, weil andere Teile des Immunsystems das ausgleichen.' },
      { label: U.de, text: 'Kortison (Kortikosteroide), das Cushing-Syndrom (eine Hormonerkrankung) oder eine Blutvergiftung (Sepsis). Fehlen Eosinophile ganz, sind oft auch andere weiße Blutkörperchen vermindert.' },
      { text: 'Ist sonst alles unauffällig, muss in der Regel nichts unternommen werden. Bei Unsicherheit ärztlich einordnen lassen.' },
    ],
    bereich: BEREICH.de,
    hoch: [
      { label: U.de, text: 'Vor allem Allergien wie Heuschnupfen, Asthma oder Neurodermitis und Infektionen mit Parasiten. Außerdem Unverträglichkeit von Medikamenten, Hautkrankheiten wie Schuppenflechte, Autoimmunerkrankungen wie rheumatoide Arthritis, in manchen Fällen bestimmte Krebsarten wie das Hodgkin-Lymphom oder eine Leukämie. Ein leichter Anstieg kann auch zeigen, dass eine Infektion abklingt.' },
      { label: A.de, text: 'Bei leicht erhöhtem Wert meist keine.' },
      { label: F.de, text: 'Vor allem bei sehr hohen Werten können sich Gewebe und Organe entzünden, z. B. Herz, Lunge, Haut oder Speiseröhre. Die Anzeichen hängen vom Organ ab, etwa Hautausschlag, pfeifende Atmung, Kurzatmigkeit oder Erschöpfung.' },
      { text: 'Ärztlich einordnen lassen, besonders bei sehr hohen oder anhaltend erhöhten Werten oder bei Beschwerden wie Atemnot oder Ausschlag.' },
    ],
  },
  en: {
    niedrig: [
      { label: E.en, text: 'Usually without significance, because other parts of the immune system compensate.' },
      { label: U.en, text: 'Cortisone (corticosteroids), Cushing’s syndrome (a hormonal disorder) or blood poisoning (sepsis). If eosinophils are missing entirely, other white blood cells are often reduced too.' },
      { text: 'If everything else is normal, usually nothing needs to be done. If unsure, have it assessed by a doctor.' },
    ],
    bereich: BEREICH.en,
    hoch: [
      { label: U.en, text: 'Mainly allergies such as hay fever, asthma or eczema (atopic dermatitis) and infections with parasites. Also intolerance of medicines, skin diseases such as psoriasis, autoimmune diseases such as rheumatoid arthritis, in some cases certain cancers such as Hodgkin lymphoma or leukaemia. A slight rise can also show that an infection is clearing up.' },
      { label: A.en, text: 'Usually none with a slightly raised value.' },
      { label: F.en, text: 'Especially with very high values, tissues and organs can become inflamed, e.g. the heart, lungs, skin or oesophagus. The signs depend on the organ, e.g. skin rash, wheezing, shortness of breath or exhaustion.' },
      { text: 'Have it assessed by a doctor, especially with very high or persistently raised values, or with symptoms such as breathlessness or a rash.' },
    ],
  },
}

const BASO: { de: Abschnitte; en: Abschnitte } = {
  de: {
    niedrig: [
      { label: E.de, text: 'Meist ohne Bedeutung, weil Basophile nur einen sehr kleinen Teil der weißen Blutkörperchen ausmachen.' },
      { label: U.de, text: 'Eine Schilddrüsenüberfunktion, akute Überempfindlichkeitsreaktionen und Infektionen. Fehlen Basophile ganz, sind oft auch andere weiße Blutkörperchen vermindert.' },
      { text: 'Ist sonst alles unauffällig, muss in der Regel nichts unternommen werden. Bei Unsicherheit ärztlich einordnen lassen.' },
    ],
    bereich: BEREICH.de,
    hoch: [
      { label: U.de, text: 'Allergische Erkrankungen wie Heuschnupfen oder Asthma, chronisch-entzündliche Darmerkrankungen, Infektionen (vor allem mit Parasiten) oder eine Schilddrüsenunterfunktion. Selten Erkrankungen des Knochenmarks, etwa eine Leukämie.' },
      { label: A.de, text: 'Meist hängen sie von der Ursache ab. Ein erhöhter Wert kann Juckreiz und andere allergische Reaktionen begünstigen.' },
      { text: 'Ärztlich einordnen lassen; je nach Ursache können weitere Untersuchungen wie Allergietests folgen.' },
    ],
  },
  en: {
    niedrig: [
      { label: E.en, text: 'Usually without significance, because basophils make up only a very small part of the white blood cells.' },
      { label: U.en, text: 'An overactive thyroid, acute hypersensitivity reactions and infections. If basophils are missing entirely, other white blood cells are often reduced too.' },
      { text: 'If everything else is normal, usually nothing needs to be done. If unsure, have it assessed by a doctor.' },
    ],
    bereich: BEREICH.en,
    hoch: [
      { label: U.en, text: 'Allergic conditions such as hay fever or asthma, chronic inflammatory bowel disease, infections (mainly with parasites) or an underactive thyroid. Rarely diseases of the bone marrow, such as leukaemia.' },
      { label: A.en, text: 'They usually depend on the cause. A raised value can promote itching and other allergic reactions.' },
      { text: 'Have it assessed by a doctor; depending on the cause, further tests such as allergy tests may follow.' },
    ],
  },
}

const Q = {
  giNeutro: { label: 'gesundheitsinformation.de: Neutrophile Granulozyten', url: 'https://www.gesundheitsinformation.de/neutrophile-granulozyten.html' },
  giLympho: { label: 'gesundheitsinformation.de: Lymphozyten', url: 'https://www.gesundheitsinformation.de/lymphozyten.html' },
  giMono: { label: 'gesundheitsinformation.de: Monozyten', url: 'https://www.gesundheitsinformation.de/monozyten.html' },
  giEos: { label: 'gesundheitsinformation.de: Eosinophile Granulozyten', url: 'https://www.gesundheitsinformation.de/eosinophile-granulozyten.html' },
  giBaso: { label: 'gesundheitsinformation.de: Basophile Granulozyten', url: 'https://www.gesundheitsinformation.de/basophile-granulozyten.html' },
  msdNeutropenie: { label: 'MSD Manual: Neutropenie', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/neutropenie' },
  msdNeutrophilie: { label: 'MSD Manual: Neutrophile Leukozytose', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/neutrophile-leukozytose' },
  msdNeutropenieProfi: { label: 'MSD Manual (Fachkreise): Neutropenie', url: 'https://www.msdmanuals.com/de/profi/h%C3%A4matologie/leukopenien/neutropenie' },
  msdLymphopenie: { label: 'MSD Manual: Lymphozytopenie', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/lymphozytopenie' },
  msdLymphozytose: { label: 'MSD Manual: Lymphozytische Leukozytose', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/lymphozytische-leukozytose' },
  msdLeukopenieProfi: { label: 'MSD Manual (Fachkreise): Leukopenien', url: 'https://www.msdmanuals.com/de/profi/h%C3%A4matologie/leukopenien/%C3%BCbesicht-%C3%BCber-leukopenien' },
  msdMono: { label: 'MSD Manual: Störungen der Monozyten', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/st%C3%B6rungen-der-monozyten' },
  msdEos: { label: 'MSD Manual: Störungen der eosinophilen Granulozyten', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/st%C3%B6rungen-der-eosinophilen-granulozyten' },
  msdBaso: { label: 'MSD Manual: Störungen der basophilen Granulozyten', url: 'https://www.msdmanuals.com/de/heim/bluterkrankungen/st%C3%B6rungen-der-wei%C3%9Fen-blutk%C3%B6rperchen/st%C3%B6rungen-der-basophilen-granulozyten' },
  mpDiff: { label: 'MedlinePlus: Blood differential test', url: 'https://medlineplus.gov/ency/article/003657.htm' },
}

const QUELLEN = {
  neutro: [Q.giNeutro, Q.msdNeutropenie, Q.msdNeutrophilie, Q.msdNeutropenieProfi, Q.mpDiff],
  lympho: [Q.giLympho, Q.msdLymphopenie, Q.msdLymphozytose, Q.msdLeukopenieProfi, Q.mpDiff],
  mono: [Q.giMono, Q.msdMono, Q.mpDiff],
  eos: [Q.giEos, Q.msdEos, Q.mpDiff],
  baso: [Q.giBaso, Q.msdBaso, Q.mpDiff],
}

/** Differentialblutbild: Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_BLUTBILD2: Record<string, MarkerGuidance> = {
  'Neutrophile %': {
    de: { hinweis: `${NEUTRO_HINWEIS.de} ${PROZENT.de}`, ...NEUTRO.de },
    en: { hinweis: `${NEUTRO_HINWEIS.en} ${PROZENT.en}`, ...NEUTRO.en },
    quellen: QUELLEN.neutro,
  },
  'Neutrophile absolut': {
    de: { hinweis: `${NEUTRO_HINWEIS.de} ${ABSOLUT.de}`, ...NEUTRO.de },
    en: { hinweis: `${NEUTRO_HINWEIS.en} ${ABSOLUT.en}`, ...NEUTRO.en },
    quellen: QUELLEN.neutro,
  },
  'Lymphozyten %': {
    de: { hinweis: `${LYMPHO_HINWEIS.de} ${PROZENT.de}`, ...LYMPHO.de },
    en: { hinweis: `${LYMPHO_HINWEIS.en} ${PROZENT.en}`, ...LYMPHO.en },
    quellen: QUELLEN.lympho,
  },
  'Lymphozyten absolut': {
    de: { hinweis: `${LYMPHO_HINWEIS.de} ${ABSOLUT.de}`, ...LYMPHO.de },
    en: { hinweis: `${LYMPHO_HINWEIS.en} ${ABSOLUT.en}`, ...LYMPHO.en },
    quellen: QUELLEN.lympho,
  },
  'Monozyten %': {
    de: { hinweis: `${MONO_HINWEIS.de} ${PROZENT.de}`, ...MONO.de },
    en: { hinweis: `${MONO_HINWEIS.en} ${PROZENT.en}`, ...MONO.en },
    quellen: QUELLEN.mono,
  },
  'Monozyten absolut': {
    de: { hinweis: `${MONO_HINWEIS.de} ${ABSOLUT.de}`, ...MONO.de },
    en: { hinweis: `${MONO_HINWEIS.en} ${ABSOLUT.en}`, ...MONO.en },
    quellen: QUELLEN.mono,
  },
  'Eosinophile %': {
    de: { hinweis: PROZENT.de, ...EOS.de },
    en: { hinweis: PROZENT.en, ...EOS.en },
    quellen: QUELLEN.eos,
  },
  'Eosinophile absolut': {
    de: { hinweis: ABSOLUT.de, ...EOS.de },
    en: { hinweis: ABSOLUT.en, ...EOS.en },
    quellen: QUELLEN.eos,
  },
  'Basophile %': {
    de: { hinweis: PROZENT.de, ...BASO.de },
    en: { hinweis: PROZENT.en, ...BASO.en },
    quellen: QUELLEN.baso,
  },
  'Basophile absolut': {
    de: { hinweis: ABSOLUT.de, ...BASO.de },
    en: { hinweis: ABSOLUT.en, ...BASO.en },
    quellen: QUELLEN.baso,
  },
}
