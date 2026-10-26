import type { MarkerGuidance } from '../markerGuidance'

const U = { de: 'Mögliche Ursachen', en: 'Possible causes' }
const A = { de: 'Typische Anzeichen', en: 'Typical signs' }

/** Leber: Einordnung, abgeglichen am 09.10.2026 mit den genannten Quellen. */
export const GUIDANCE_LEBER: Record<string, MarkerGuidance> = {
  'GOT (AST)': {
    de: {
      hinweis: 'GOT wird zusammen mit anderen Leberwerten beurteilt, vor allem mit GPT; das Verhältnis der beiden kann Hinweise auf die Ursache geben. Auch eine Spritze in einen Muskel kann den Wert vorübergehend erhöhen. Frauen haben einen etwas niedrigeren Normalbereich als Männer.',
      niedrig: [{ text: 'Niedrige Werte gelten in der Regel als normal und haben keine besondere Bedeutung. Bei Unsicherheit ärztlich einordnen lassen.' }],
      bereich: [{ text: 'Aus diesem Wert ergibt sich kein Hinweis auf eine Schädigung von Leber- oder Muskelzellen.' }],
      hoch: [
        { label: U.de, text: 'Häufig eine Fettleber, oft durch Alkohol oder starkes Übergewicht. Außerdem Virushepatitis, ein Blutstau in der Leber, entzündete Gallengänge (z. B. durch Gallensteine), Hämochromatose (zu viel Eisen im Körper), Pfeiffersches Drüsenfieber, eine Entzündung der Bauchspeicheldrüse und bestimmte Medikamente, auch pflanzliche. Sehr hohe Werte kommen bei einer akuten Leberentzündung oder einer Vergiftung vor, etwa durch Giftpilze oder eine Überdosis bestimmter Schmerzmittel. Außerhalb der Leber: anstrengender Sport (vorübergehend und unproblematisch), Schäden an Herz- oder Skelettmuskel, schwere Verbrennungen, Krampfanfälle, Operationen.' },
        { label: A.de, text: 'Oft keine – eine Fettleber etwa bleibt meist unbemerkt. Bei einer stärkeren Lebererkrankung möglich: Übelkeit, Bauchschmerzen oder Schwellung im Bauch, Gelbfärbung von Haut oder Augen, dunkler Urin, heller Stuhl.' },
        { label: 'Einordnung', text: 'Bei den meisten Lebererkrankungen ist GOT niedriger als GPT. Ist GOT deutlich höher als GPT, kann das auf Alkohol als Ursache hinweisen. Ein einzelner Wert erlaubt meist keine Diagnose.' },
        { text: 'Einen erhöhten Wert ärztlich einordnen lassen und dabei sagen, welche Medikamente man nimmt; bei Gelbfärbung von Haut oder Augen zeitnah.' },
      ],
    },
    en: {
      hinweis: 'AST is assessed together with other liver values, especially ALT; the ratio between the two can give clues to the cause. An injection into a muscle can also raise the value temporarily. Women have a slightly lower normal range than men.',
      niedrig: [{ text: 'Low values are generally considered normal and have no particular significance. If unsure, have it assessed by a doctor.' }],
      bereich: [{ text: 'This value gives no indication of damage to liver or muscle cells.' }],
      hoch: [
        { label: U.en, text: 'Often a fatty liver, frequently due to alcohol or severe obesity. Also viral hepatitis, blood congestion in the liver, inflamed bile ducts (e.g. from gallstones), haemochromatosis (too much iron in the body), glandular fever, inflammation of the pancreas, and certain medicines, including herbal ones. Very high values occur with acute liver inflammation or poisoning, for example from poisonous mushrooms or an overdose of certain painkillers. Outside the liver: strenuous exercise (temporary and harmless), damage to the heart or skeletal muscle, severe burns, seizures, surgery.' },
        { label: A.en, text: 'Often none – a fatty liver, for example, usually goes unnoticed. With more serious liver disease: nausea, abdominal pain or swelling, yellowing of the skin or eyes, dark urine, pale stools.' },
        { label: 'Context', text: 'In most liver diseases AST is lower than ALT. If AST is clearly higher than ALT, this can point to alcohol as the cause. A single value usually does not allow a diagnosis.' },
        { text: 'Have a raised value assessed by a doctor and say which medicines you take; promptly if the skin or eyes turn yellow.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: AST (GOT)', url: 'https://www.gesundheitsinformation.de/aspartat-aminotransferase-ast.html' },
      { label: 'MSD Manual: Laboruntersuchungen der Leber und der Gallenblase', url: 'https://www.msdmanuals.com/de/profi/erkrankungen-der-leber-der-gallenblase-und-der-gallenwege/tests-bei-leber-und-gallenerkrankungen/laboruntersuchungen-der-leber-und-der-gallenblase' },
      { label: 'MSD Manual: Gelbsucht bei Erwachsenen', url: 'https://www.msdmanuals.com/de/heim/leber-und-gallenst%C3%B6rungen/krankheitsbilder-bei-lebererkrankungen/gelbsucht-bei-erwachsenen' },
      { label: 'MedlinePlus: AST Test', url: 'https://medlineplus.gov/lab-tests/ast-test/' },
      { label: 'NHS: Jaundice', url: 'https://www.nhs.uk/conditions/jaundice/' },
    ],
  },

  'Gamma-GT': {
    de: {
      hinweis: 'Gamma-GT im Blut stammt hauptsächlich aus der Leber. Sie steigt schon nach Alkohol; vor der Blutabnahme wird deshalb empfohlen, mindestens 12 Stunden keinen Alkohol zu trinken. Frauen haben einen niedrigeren Normalbereich als Männer.',
      niedrig: [{ text: 'In der Regel unbedenklich und kein Grund zur Sorge. Bei Unsicherheit ärztlich einordnen lassen.' }],
      bereich: [{ text: 'Eine Leber- oder Gallenwegserkrankung ist damit unwahrscheinlicher, aber nicht sicher ausgeschlossen.' }],
      hoch: [
        { label: U.de, text: 'Übermäßiger Alkoholkonsum, Fettleber, Leberentzündung (Hepatitis), Leberzirrhose, ein Stau der Gallenflüssigkeit. Außerdem eine Entzündung der Bauchspeicheldrüse, Diabetes und Herzschwäche. Viele Medikamente können den Wert erhöhen, z. B. bestimmte Schmerzmittel, Cholesterinsenker, Antibiotika, Magensäurehemmer, Mittel gegen Pilze, gegen Krampfanfälle oder gegen Depressionen; auch pflanzliche Mittel.' },
        { label: A.de, text: 'Oft keine. Bei einer Leber- oder Gallenwegserkrankung möglich: Übelkeit oder Erbrechen, Schwellung oder Schmerzen im Bauch, Juckreiz, Gelbfärbung von Haut oder Augen, dunkler Urin, heller Stuhl.' },
        { label: 'Einordnung', text: 'Der Wert zeigt nicht, welche Ursache dahintersteckt – das können harmlose Gründe, aber auch behandlungsbedürftige Erkrankungen sein. Ist zusätzlich die Alkalische Phosphatase erhöht, spricht das eher für Leber oder Gallenwege.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen und dabei sagen, welche Medikamente man nimmt; bei Gelbfärbung von Haut oder Augen zeitnah.' },
      ],
    },
    en: {
      hinweis: 'Gamma-GT in the blood comes mainly from the liver. It rises even after drinking alcohol, so it is recommended not to drink alcohol for at least 12 hours before the blood test. Women have a lower normal range than men.',
      niedrig: [{ text: 'Usually harmless and no cause for concern. If unsure, have it assessed by a doctor.' }],
      bereich: [{ text: 'This makes a liver or bile duct disease less likely, but does not rule it out with certainty.' }],
      hoch: [
        { label: U.en, text: 'Excessive alcohol consumption, fatty liver, liver inflammation (hepatitis), cirrhosis of the liver, a build-up of bile. Also inflammation of the pancreas, diabetes and heart failure. Many medicines can raise the value, e.g. certain painkillers, cholesterol-lowering medicines, antibiotics, stomach acid blockers, medicines against fungal infections, seizures or depression; herbal remedies too.' },
        { label: A.en, text: 'Often none. With a liver or bile duct disease: nausea or vomiting, abdominal swelling or pain, itching, yellowing of the skin or eyes, dark urine, pale stools.' },
        { label: 'Context', text: 'The value does not show what the cause is – this can be harmless, but can also be a disease that needs treatment. If alkaline phosphatase is raised as well, this points more towards the liver or bile ducts.' },
        { text: 'Have a raised value checked by a doctor and say which medicines you take; promptly if the skin or eyes turn yellow.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Gamma-GT', url: 'https://www.gesundheitsinformation.de/gamma-gt-ggt.html' },
      { label: 'MSD Manual: Laboruntersuchungen der Leber und der Gallenblase', url: 'https://www.msdmanuals.com/de/profi/erkrankungen-der-leber-der-gallenblase-und-der-gallenwege/tests-bei-leber-und-gallenerkrankungen/laboruntersuchungen-der-leber-und-der-gallenblase' },
      { label: 'MedlinePlus: GGT Test', url: 'https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/' },
      { label: 'MedlinePlus: Alkaline Phosphatase', url: 'https://medlineplus.gov/lab-tests/alkaline-phosphatase/' },
      { label: 'NHS: Jaundice', url: 'https://www.nhs.uk/conditions/jaundice/' },
    ],
  },

  'Alkalische Phosphatase': {
    de: {
      hinweis: 'AP kommt außerdem im Dünndarm und in der Schwangerschaft im Mutterkuchen vor. Nach dem Essen, besonders nach einer fettreichen Mahlzeit, kann der Wert steigen; gemessen wird deshalb möglichst 12 Stunden nach der letzten Mahlzeit. Bei Kindern und Jugendlichen im Wachstum, im letzten Drittel der Schwangerschaft und bei Frauen am Ende der Wechseljahre kann der Wert natürlicherweise erhöht sein.',
      niedrig: [
        { label: U.de, text: 'Zum Beispiel eine Schilddrüsenunterfunktion, Blutarmut, die Antibabypille, Mangelernährung, Eiweiß- oder Zinkmangel, Morbus Wilson. Sehr niedrige Werte können auf die seltene erbliche Erkrankung Hypophosphatasie hinweisen, die Knochen und Zähne betrifft.' },
        { label: 'Einordnung', text: 'Niedrige Werte sind eher selten und meist ohne Bedeutung. Gegebenenfalls wird nach einigen Monaten erneut gemessen.' },
        { text: 'Sehr niedrige Werte ärztlich abklären lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Er wird zusammen mit den anderen Leberwerten beurteilt.' }],
      hoch: [
        { label: U.de, text: 'Häufig ein Stau der Gallenflüssigkeit, z. B. durch Gallensteine – dann sind meist auch Bilirubin oder Gamma-GT erhöht. Außerdem Lebererkrankungen wie Leberentzündung (Hepatitis) oder Leberzirrhose. Aus den Knochen: ein heilender Knochenbruch, eine Schilddrüsenüberfunktion oder seltene Knochenerkrankungen wie Knochenerweichung (Osteomalazie) oder Morbus Paget. Außerdem chronische Nierenerkrankungen, Herzschwäche, Pfeiffersches Drüsenfieber und bestimmte Medikamente. Bei Krebserkrankungen können Absiedlungen (Metastasen) in Knochen oder Leber dahinterstecken.' },
        { label: A.de, text: 'Je nach Ursache. Bei Leber- oder Gallenproblemen z. B. großflächiger Juckreiz, Gelbfärbung von Haut oder Augen, dunkler Urin, heller Stuhl; bei Knochenerkrankungen z. B. Knochenschmerzen oder Knochenbrüche.' },
        { label: 'Einordnung', text: 'Ist auch Gamma-GT erhöht, stammt die AP eher aus Leber oder Gallenwegen. Ist nur die AP erhöht und Gamma-GT unauffällig, spricht das eher für die Knochen. Allein aus dem AP-Wert lässt sich keine Diagnose stellen.' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen; bei Gelbfärbung von Haut oder Augen zeitnah.' },
      ],
    },
    en: {
      hinweis: 'ALP is also found in the small intestine and, in pregnancy, in the placenta. The value can rise after eating, especially after a fatty meal, so it is ideally measured 12 hours after the last meal. In growing children and teenagers, in the last third of pregnancy and in women at the end of menopause the value can naturally be raised.',
      niedrig: [
        { label: U.en, text: 'For example an underactive thyroid, anaemia, the contraceptive pill, malnutrition, protein or zinc deficiency, Wilson’s disease. Very low values can point to the rare inherited disease hypophosphatasia, which affects bones and teeth.' },
        { label: 'Context', text: 'Low values are rather rare and usually without significance. If needed, the value is measured again after a few months.' },
        { text: 'Have very low values checked by a doctor.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. It is assessed together with the other liver values.' }],
      hoch: [
        { label: U.en, text: 'Often a build-up of bile, e.g. from gallstones – then bilirubin or gamma-GT are usually raised as well. Also liver diseases such as liver inflammation (hepatitis) or cirrhosis of the liver. From the bones: a healing fracture, an overactive thyroid, or rare bone diseases such as softening of the bones (osteomalacia) or Paget’s disease. Also chronic kidney disease, heart failure, glandular fever and certain medicines. In people with cancer, spread (metastases) to the bones or liver can be behind it.' },
        { label: A.en, text: 'Depends on the cause. With liver or bile problems e.g. widespread itching, yellowing of the skin or eyes, dark urine, pale stools; with bone diseases e.g. bone pain or fractures.' },
        { label: 'Context', text: 'If gamma-GT is raised as well, the ALP more likely comes from the liver or bile ducts. If only ALP is raised and gamma-GT is normal, this points more towards the bones. ALP alone does not allow a diagnosis.' },
        { text: 'Have a raised value checked by a doctor; promptly if the skin or eyes turn yellow.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Alkalische Phosphatase', url: 'https://www.gesundheitsinformation.de/alkalische-phosphatase-ap.html' },
      { label: 'gesundheitsinformation.de: Gamma-GT', url: 'https://www.gesundheitsinformation.de/gamma-gt-ggt.html' },
      { label: 'MSD Manual: Laboruntersuchungen der Leber und der Gallenblase', url: 'https://www.msdmanuals.com/de/profi/erkrankungen-der-leber-der-gallenblase-und-der-gallenwege/tests-bei-leber-und-gallenerkrankungen/laboruntersuchungen-der-leber-und-der-gallenblase' },
      { label: 'MedlinePlus: Alkaline Phosphatase', url: 'https://medlineplus.gov/lab-tests/alkaline-phosphatase/' },
      { label: 'MedlinePlus: GGT Test', url: 'https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/' },
      { label: 'NHS: Jaundice', url: 'https://www.nhs.uk/conditions/jaundice/' },
    ],
  },

  'Bilirubin gesamt': {
    de: {
      hinweis: 'Viele Medikamente, auch pflanzliche, können den Wert beeinflussen; anstrengender Sport kann ihn erhöhen. Ist das Gesamt-Bilirubin erhöht, wird oft zusätzlich das direkte Bilirubin bestimmt – welcher Anteil erhöht ist, gibt Hinweise auf die Ursache.',
      niedrig: [
        { label: U.de, text: 'Zum Beispiel bestimmte Medikamente wie manche Antibiotika, die Antibabypille, Schlafmittel oder Mittel gegen Krampfanfälle.' },
        { text: 'Niedrige Werte haben in der Regel keine Bedeutung. Bei Unsicherheit ärztlich einordnen lassen.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Er wird zusammen mit den anderen Leberwerten beurteilt.' }],
      hoch: [
        { label: U.de, text: 'Eine häufige, harmlose Ursache ist das erbliche Gilbert-Syndrom (Morbus Meulengracht): Der Wert ist nur leicht erhöht, die Leber wird nicht geschädigt, eine Behandlung ist nicht nötig. Fasten, Infekte, Schlafmangel, sehr viel Sport, Alkohol oder zu wenig Trinken können ihn dann vorübergehend steigen lassen. Außerdem ein verstärkter Abbau roter Blutkörperchen, ein Stau der Gallenflüssigkeit (z. B. durch Gallensteine), Lebererkrankungen wie Leberentzündung (Hepatitis) oder Fettleber, etwa durch viel Alkohol, ausgedehnte Blutergüsse, Verbrennungen und bestimmte Medikamente oder Heilkräuter.' },
        { label: A.de, text: 'Ein leicht erhöhter Wert fällt oft nicht auf. Eine Gelbfärbung von Haut und Augenweiß ist meist erst ab etwa 2 bis 3 mg/dl zu sehen; bei dunklerer Haut am ehesten am Augenweiß. Je nach Ursache außerdem Juckreiz, dunkler Urin und heller Stuhl.' },
        { label: 'Einordnung', text: 'Beim Gilbert-Syndrom kommt höchstens eine leichte Gelbfärbung vor, die wieder verschwindet. Juckreiz, dunkler Urin oder heller Stuhl sprechen eher für eine andere Ursache.' },
        { text: 'Erhöhte Werte ärztlich abklären lassen. Zeitnah bei einer neuen Gelbfärbung von Haut oder Augen – oder wenn sie bei bekanntem Gilbert-Syndrom stärker ist als sonst oder nicht nach einigen Tagen verschwindet. So schnell wie möglich bei Gelbfärbung zusammen mit starken Bauchschmerzen, Fieber, Verwirrtheit oder Benommenheit, Erbrechen von Blut oder schwarzem bzw. blutigem Stuhl.' },
      ],
    },
    en: {
      hinweis: 'Many medicines, including herbal ones, can affect the value; strenuous exercise can raise it. If total bilirubin is raised, direct bilirubin is often measured as well – which part is raised gives clues to the cause.',
      niedrig: [
        { label: U.en, text: 'For example certain medicines such as some antibiotics, the contraceptive pill, sleeping pills or medicines against seizures.' },
        { text: 'Low values usually have no significance. If unsure, have it assessed by a doctor.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. It is assessed together with the other liver values.' }],
      hoch: [
        { label: U.en, text: 'A common, harmless cause is the inherited Gilbert’s syndrome: the value is only slightly raised, the liver is not damaged and no treatment is needed. Fasting, infections, lack of sleep, a lot of exercise, alcohol or drinking too little can then raise it temporarily. Also increased breakdown of red blood cells, a build-up of bile (e.g. from gallstones), liver diseases such as liver inflammation (hepatitis) or fatty liver, for example from heavy drinking, extensive bruising, burns, and certain medicines or herbal remedies.' },
        { label: A.en, text: 'A slightly raised value often goes unnoticed. Yellowing of the skin and the whites of the eyes is usually only visible from about 2 to 3 mg/dl; with darker skin it shows most clearly in the whites of the eyes. Depending on the cause, also itching, dark urine and pale stools.' },
        { label: 'Context', text: 'With Gilbert’s syndrome there is at most mild yellowing that comes and goes. Itching, dark urine or pale stools point more towards another cause.' },
        { text: 'Have raised values checked by a doctor. Promptly with new yellowing of the skin or eyes – or, with known Gilbert’s syndrome, if it is worse than usual or does not go away within a few days. As soon as possible with yellowing together with severe abdominal pain, fever, confusion or drowsiness, vomiting blood, or black or bloody stools.' },
      ],
    },
    quellen: [
      { label: 'gesundheitsinformation.de: Bilirubin gesamt', url: 'https://www.gesundheitsinformation.de/bilirubin-gesamt.html' },
      { label: 'MSD Manual: Gelbsucht bei Erwachsenen', url: 'https://www.msdmanuals.com/de/heim/leber-und-gallenst%C3%B6rungen/krankheitsbilder-bei-lebererkrankungen/gelbsucht-bei-erwachsenen' },
      { label: 'MSD Manual: Laboruntersuchungen der Leber und der Gallenblase', url: 'https://www.msdmanuals.com/de/profi/erkrankungen-der-leber-der-gallenblase-und-der-gallenwege/tests-bei-leber-und-gallenerkrankungen/laboruntersuchungen-der-leber-und-der-gallenblase' },
      { label: 'MedlinePlus: Bilirubin Blood Test', url: 'https://medlineplus.gov/lab-tests/bilirubin-blood-test/' },
      { label: 'NHS: Gilbert’s syndrome', url: 'https://www.nhs.uk/conditions/gilberts-syndrome/' },
      { label: 'NHS: Jaundice', url: 'https://www.nhs.uk/conditions/jaundice/' },
    ],
  },

  'Albumin': {
    de: {
      hinweis: 'In der Schwangerschaft ist der Wert niedriger, ebenso nach 24 bis 48 Stunden ohne Essen. Eine lange gestaute Vene bei der Blutabnahme oder große Infusionsmengen können das Ergebnis verfälschen. Albumin ändert sich meist langsam, über Wochen.',
      niedrig: [
        { label: U.de, text: 'Lebererkrankungen wie Leberzirrhose, Leberentzündung (Hepatitis) oder Fettleber, auch durch Alkohol. Nierenerkrankungen, bei denen Eiweiß mit dem Urin verloren geht. Zu wenig Eiweiß in der Nahrung oder Mangelernährung, eine gestörte Aufnahme im Darm (z. B. Zöliakie, Morbus Crohn, nach einer Operation zur Gewichtsabnahme). Außerdem chronische Entzündungen, Infektionen, großflächige Verbrennungen und Schilddrüsenerkrankungen.' },
        { label: A.de, text: 'Bei deutlich niedrigem Wert kann Flüssigkeit aus den Blutgefäßen austreten und sich im Körper sammeln, z. B. als Schwellung an Knöcheln und Beinen, im Bauch (Bauchwassersucht) oder in der Lunge.' },
        { text: 'Ärztlich abklären lassen, damit die Ursache gefunden wird.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein sagt er wenig aus; er wird zusammen mit anderen Werten beurteilt.' }],
      hoch: [
        { label: U.de, text: 'Vor allem Flüssigkeitsmangel, z. B. nach starkem Durchfall. Außerdem eine sehr eiweißreiche Ernährung, bestimmte Mittel wie Anabolika, männliche Hormone, Wachstumshormon oder Insulin sowie eine lange gestaute Vene bei der Blutabnahme.' },
        { text: 'Ein erhöhter Wert bedeutet nicht immer eine behandlungsbedürftige Erkrankung. Bei unklarer Ursache ärztlich einordnen lassen.' },
      ],
    },
    en: {
      hinweis: 'The value is lower in pregnancy, and also after 24 to 48 hours without food. A tourniquet left on for a long time during the blood draw or large amounts of infusions can distort the result. Albumin usually changes slowly, over weeks.',
      niedrig: [
        { label: U.en, text: 'Liver diseases such as cirrhosis, liver inflammation (hepatitis) or fatty liver, including from alcohol. Kidney diseases in which protein is lost in the urine. Too little protein in the diet or malnutrition, impaired absorption in the gut (e.g. coeliac disease, Crohn’s disease, after weight-loss surgery). Also chronic inflammation, infections, extensive burns and thyroid disease.' },
        { label: A.en, text: 'With a clearly low value, fluid can leak out of the blood vessels and collect in the body, e.g. as swelling of the ankles and legs, in the abdomen (ascites) or in the lungs.' },
        { text: 'Have it checked by a doctor so the cause can be found.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it says little; it is assessed together with other values.' }],
      hoch: [
        { label: U.en, text: 'Mainly a lack of fluid, e.g. after severe diarrhoea. Also a very high-protein diet, certain substances such as anabolic steroids, male hormones, growth hormone or insulin, and a tourniquet left on for a long time during the blood draw.' },
        { text: 'A raised value does not always mean a disease that needs treatment. If the cause is unclear, have it assessed by a doctor.' },
      ],
    },
    quellen: [
      { label: 'MSD Manual: Laboruntersuchungen der Leber und der Gallenblase', url: 'https://www.msdmanuals.com/de/profi/erkrankungen-der-leber-der-gallenblase-und-der-gallenwege/tests-bei-leber-und-gallenerkrankungen/laboruntersuchungen-der-leber-und-der-gallenblase' },
      { label: 'MSD Manual: Aszites', url: 'https://www.msdmanuals.com/de/heim/leber-und-gallenst%C3%B6rungen/krankheitsbilder-bei-lebererkrankungen/aszites' },
      { label: 'MSD Manual: Unterernährung', url: 'https://www.msdmanuals.com/de/heim/ern%C3%A4hrungsst%C3%B6rungen/unterern%C3%A4hrung/unterern%C3%A4hrung' },
      { label: 'MedlinePlus: Albumin Blood Test', url: 'https://medlineplus.gov/lab-tests/albumin-blood-test/' },
      { label: 'MedlinePlus: Albumin – blood (serum) test', url: 'https://medlineplus.gov/ency/article/003480.htm' },
    ],
  },

  'Gesamteiweiß': {
    de: {
      hinweis: 'Die Leber bildet die meisten Eiweiße im Blut, die Antikörper stammen dagegen aus Abwehrzellen. Ein auffälliger Wert wird meist zusammen mit Albumin und einer Aufschlüsselung der Eiweiße (Elektrophorese) eingeordnet.',
      niedrig: [
        { label: U.de, text: 'Lebererkrankungen, Nierenerkrankungen, bei denen Eiweiß verloren geht (z. B. nephrotisches Syndrom), Mangelernährung, eine gestörte Aufnahme im Darm (z. B. Zöliakie, Morbus Crohn) oder Eiweißverlust über den Darm. Außerdem starke Blutungen, großflächige Verbrennungen, ein Mangel an Antikörpern (Agammaglobulinämie).' },
        { text: 'Ärztlich abklären lassen, damit die Ursache gefunden wird.' },
      ],
      bereich: [{ text: 'Der Wert liegt im Referenzbereich des Labors. Allein ist er wenig aussagekräftig.' }],
      hoch: [
        { label: U.de, text: 'Chronische Entzündungen oder Infektionen, z. B. Hepatitis B oder C oder HIV, und chronische Lebererkrankungen, bei denen die Antikörper ansteigen. Außerdem bestimmte Blutkrebserkrankungen, bei denen veränderte Zellen große Mengen eines Antikörpers bilden (Multiples Myelom, Morbus Waldenström).' },
        { text: 'Einen erhöhten Wert ärztlich abklären lassen, meist mit weiteren Blut- oder Urinuntersuchungen.' },
      ],
    },
    en: {
      hinweis: 'The liver makes most of the proteins in the blood, whereas antibodies come from immune cells. An abnormal value is usually assessed together with albumin and a breakdown of the proteins (electrophoresis).',
      niedrig: [
        { label: U.en, text: 'Liver diseases, kidney diseases in which protein is lost (e.g. nephrotic syndrome), malnutrition, impaired absorption in the gut (e.g. coeliac disease, Crohn’s disease) or protein loss through the gut. Also heavy bleeding, extensive burns, a lack of antibodies (agammaglobulinaemia).' },
        { text: 'Have it checked by a doctor so the cause can be found.' },
      ],
      bereich: [{ text: 'The value is within the lab’s reference range. On its own it is of limited significance.' }],
      hoch: [
        { label: U.en, text: 'Chronic inflammation or infections, e.g. hepatitis B or C or HIV, and chronic liver diseases in which antibodies rise. Also certain blood cancers in which abnormal cells produce large amounts of one antibody (multiple myeloma, Waldenström’s disease).' },
        { text: 'Have a raised value checked by a doctor, usually with further blood or urine tests.' },
      ],
    },
    quellen: [
      { label: 'gesund.bund.de: Multiples Myelom', url: 'https://gesund.bund.de/multiples-myelom' },
      { label: 'MSD Manual: Laboruntersuchungen der Leber und der Gallenblase', url: 'https://www.msdmanuals.com/de/profi/erkrankungen-der-leber-der-gallenblase-und-der-gallenwege/tests-bei-leber-und-gallenerkrankungen/laboruntersuchungen-der-leber-und-der-gallenblase' },
      { label: 'MedlinePlus: Total Protein and A/G Ratio', url: 'https://medlineplus.gov/lab-tests/total-protein-and-albumin-globulin-a-g-ratio/' },
      { label: 'MedlinePlus: Total protein', url: 'https://medlineplus.gov/ency/article/003483.htm' },
    ],
  },
}
