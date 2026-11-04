// anon-Antworten von `profile_view` wie im Trockenlauf `docs/profil/profil-p2c-trockenlauf.md`
// (Proben W2/W5/W6/W7): nur die Schlüssel, die die Web-Stufe dort liefert.
// Für die Tests von `profileViewWeb.js`, `api/u.js` und `api/og.js`.

export const MARA_AVATAR = '00000000-0000-0000-0000-00000000000a/avatar-1762000000000.jpg'

/** W2/W8: alles auf „Alle“, Stufe 20, Karte 7 Monate / 9 Werte / 25 Einträge. */
export const MARA = {
  username: 'mara',
  display_name: 'Mara K.',
  own: false,
  blocked: false,
  private: false,
  avatar: MARA_AVATAR,
  fields: {
    cover: '00000000-0000-0000-0000-00000000000a/cover-1762000000001.jpg',
    country: 'DE',
    goals: ['muskelaufbau', 'ausdauer'],
    bio: 'Laufe gern früh.',
    streak: { current: 12, best: 30 },
    progress: { tier: 20 },
    badges: ['streak_7', 'workouts_10'],
    reviews: { count: 12 },
  },
  card: { member_since: { unit: 'months', n: 7 }, web_value_count: 9, entry_count: 25 },
  web_indexable: false,
}

/** W5: alles auf „Freunde“: `fields` leer, Karte nur Dauer + 9 Werte. */
export const FRIEDA = {
  username: 'frieda',
  display_name: 'Frieda',
  own: false,
  blocked: false,
  private: false,
  avatar: '00000000-0000-0000-0000-00000000000f/avatar-1762000000002.jpg',
  fields: {},
  card: { member_since: { unit: 'months', n: 6 }, web_value_count: 9 },
  web_indexable: false,
}

/** W6: Fortschritt nur aus Blut/Einnahmen → kein `progress`; Karte 5 Monate + 5 Werte. */
export const GUSTAV = {
  username: 'gustav',
  display_name: 'Gustav',
  own: false,
  blocked: false,
  private: false,
  fields: { country: 'AT' },
  card: { member_since: { unit: 'months', n: 5 }, web_value_count: 5 },
  web_indexable: false,
}

/** W7: negativ, `counts` kaputt → nur Dauer in Tagen, kein Bild. */
export const IDA = {
  username: 'ida',
  own: false,
  blocked: false,
  private: false,
  fields: {},
  card: { member_since: { unit: 'days', n: 15 } },
  web_indexable: false,
}
