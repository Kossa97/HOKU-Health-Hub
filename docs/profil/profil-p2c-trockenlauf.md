# Trockenlauf `supabase-profil-p2c-web.sql`

Stand 04.11.2026 (dritte Fassung: dazu „Profil melden ohne Konto“, Abschnitt 7 der Migration, Proben
M1–M11; zweite Fassung nach den Entscheidungen des Nutzers vom 04.11.: Fortschritt im Web nur
als Stufe, Blut/Einnahmen in den Einträgen nur bei Freigabe, Mitgliedschaft und „trackt N Werte“ ohne
Feld-Gate, Mitgliedschaft nur als Dauer). Postgres 16.15 im Container (`/var/tmp/p2c-web`, als `postgres`),
nach dem Code-Review zweimal je ein frischer Cluster (`voll.sh data7`, `voll.sh data8`), beide Ausgaben
gleich. Nicht gegen Produktion gelaufen. Produktivlauf nur nach ausdrücklichem Ja, Reihenfolge 2a → 2b → 2c.

## Aufbau

1. Basis nachgebaut: Rollen `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`
   (über `request.jwt.claim.sub`), `storage.buckets/objects`, `profiles` wie vor P1, `user_blocks`,
   `reviews`, `stack_items`, `training_routines`, `content_reports` wie in Produktion (Spalten, Prüfungen,
   RLS, Policy „Admins lesen Meldungen“, Index `content_reports_einmal_je_melder`, Tabellenrechte für
   `anon`/`authenticated` wie bei Supabase), `is_admin`, `melde_grenze_pruefen`, `moderation_queue` und
   `resolve_content_report` aus `supabase-store-compliance-2.sql`, die neun Eintragstabellen von
   `profile_entry_count` mit ihren Indizes, der echte Textfilter `oeffentlicher_text_fehler`
   (aus `supabase-store-compliance-2.sql`) mit Wortliste. Standardrechte wie Supabase
   (neue Funktionen in `public` bekommen `execute` für `anon`/`authenticated`).
2. `supabase-profil-p1-datenbasis.sql`, dann der heutige Produktionsstand (nach P1): neun Profile, teils
   `is_public`, Bilder ohne Status, Einträge in allen Tabellen, `health_daily`; drei Meldungen aus der App
   (eine offene zu Maras Erfahrung, eine abgelehnte zu Dan, eine erledigte zu Hanna, deren Melder sein
   Konto gelöscht hat, also `reporter_id` null).
3. `supabase-profil-p2a-sichtbarkeit.sql`, `supabase-profil-p2b-fortschritt.sql`, danach die Einstellungen,
   wie Nutzer sie nach dem App-Update setzen (Bild-Check freigegeben, Sichtbarkeit, Schnappschüsse vom Gerät).
   Die Ausgaben von `profile_view` (54 Stück: angemeldet fremd, Eigentümer in allen Sichten, anon)
   wurden vor 2c festgehalten.
4. `supabase-profil-p2c-web.sql` zweimal, je mit Zählung; Proben; ein dritter Lauf nach den Proben.

| Profil | Lage | erwartet als `anon` |
|---|---|---|
| mara | Web-Link an, alle 32 Felder „Alle“, Bio besteht, Bild + Titelbild geprüft, voller Schnappschuss (total 28.35, alle fünf Bereiche, `counts`), heikle und Grenzfall-Abzeichen, Einträge in allen Tabellen, Konto 03.04. | Web-Felder, `progress {tier: 20}`, Karte 7 Monate / 9 Werte / 25 Einträge |
| otto | alles „Alle“, Web-Link aus | `null` |
| ben | alles „Alle“, Web-Link an, privat | `null` |
| hanna | Web-Link an, von der Moderation ausgeblendet | `null` |
| niemand | unbekannt | `null` |
| frieda | alles „Freunde“, Web-Link an, `counts` 4/3/2 | `fields` leer; Karte nur Dauer + 9 Werte |
| dan | Alt-Profil `is_public` (2a schaltet Bio + Web-Link an); Bio fällt nach erweiterter Wortliste durch | keine Bio |
| gustav | Fortschritt nur aus Blut/Einnahmen (total 40), nur heikle Abzeichen, `counts` Blut 12 / Einnahmen 1 / Körper 5 | kein `progress`; Karte Dauer + 5 Werte |
| ida | Fortschritt negativ, `progress.counts` kaputt (Text, Bruch, negativ), keine Einträge, Konto 20.10. 23:30 UTC | kein `progress`; Karte nur 15 Tage |

## Zählungen (nur Zahlen)

| | vor 2c | Lauf 1 | Lauf 2 | Lauf 3 (nach Proben) |
|---|---|---|---|---|
| Profile | 9 | 9 | 9 | 9 |
| Schnappschüsse | 8 | 8 | 8 | 8 |
| Sichtbarkeit gesetzt | 8 | 8 | 8 | 8 |
| Web-Link an | 7 | 7 | 7 | 7 |
| Spalten `web_badges`, `web_indexable` | 0 | 2 | 2 | 2 |
| Prüfung `profiles_web_badges_check` | – | 1 | 1 | 1 |
| Funktionen (11 Namen) | – | 11 | 11 | 11 |
| Policy „Visible profile media select“ | – | 1 | 1 | 1 |
| `web_badges <> '{}'` | – | 0 | 0 | 1 (Probe W11) |
| `web_indexable` | – | 0 | 0 | 1 (Probe W11) |
| ungültige `web_badges` | – | 0 | 0 | 0 |
| heikel / Grenzfall / Web-Felder | – | 10 / 8 / 8 | 10 / 8 / 8 | 10 / 8 / 8 |
| `anon` darf `profile_entry_count` | – | nein | nein | nein |
| Meldungen gesamt / offen / ohne Melder | 3 / 1 / 1 | 3 / 1 / 1 | 3 / 1 / 1 | 15 / 13 / 11 (Proben M) |
| Spalten `source`, `reporter_contact` | 0 | 2 | 2 | 2 |
| Index `content_reports_web_zeit` | 0 | 1 | 1 | 1 |
| `report_public_profile_web` da / `anon` darf | nein / nein | ja / ja | ja / ja | ja / ja |
| `anon` darf `moderation_queue` | nein | nein | nein | nein |
| Policies auf `content_reports` | 1 | 1 | 1 | 1 |
| Meldungen `web` / `app` / mit E-Mail | – | 0 / 3 / 0 | 0 / 3 / 0 | 11 / 4 / 3 |

„–“ = vor 2c nicht gezählt. Lauf 2 meldet nur „column … already exists, skipping“ (vier Spalten) und
„relation content_reports_web_zeit already exists, skipping“. Lauf 3 lässt die Abweichungen aus W11 und die
Meldungen aus M1–M8 und M11 stehen (M4b, M5, M8e und M9 laufen in einer Transaktion mit `rollback`). In den Proben W genau
7 erwartete Fehler (W9 einmal, W12 sechsmal), Ausgabe gleich wie in der zweiten Fassung; in M genau 4
erwartete Fehler (M6 dreimal, M7 einmal). Bestehende Meldungen: `source = 'app'`, `reporter_contact` null.

## Ergebnisse der Proben

- **W1** aus / privat / unbekannt / ausgeblendet (auch `OTTO`, ` niemand `) → `null`, alle gleich.
- **W2/W3** mara als `anon`: oben nur `username, display_name, own, blocked, private, avatar, fields,
  card, web_indexable`; `fields` nur `cover, country, goals, bio, streak, progress, badges, reviews`;
  `progress` nur `{tier: 20}` (kein `total`, keine `areas`, kein `since`); `reviews` nur `{count: 12}`;
  `card.member_since` nur `{unit, n}`; Abzeichen ohne heikle und Grenzfälle; im ganzen Text kein
  `total`/`areas`/`since`, kein Bereichsname, kein Datum, nichts zu Blut, Einnahmen, Markern, Substanzen,
  Routine, e1RM, avgRating, Berichte-Inhalt, Geschlecht, Sichtbarkeit, Freunde. Gleiches für dan, frieda,
  gustav, ida.
- **W4** Bio: mara da, dan weg (Textfilter), frieda weg (Freunde).
- **W5** frieda (alles „Freunde“): `fields: {}`, `card` = 6 Monate + 9 Werte, keine Einträge.
- **W6** gustav: kein `progress` (Schutzregel), keine `badges`, keine Einträge; `card` = 5 Monate + 5 Werte
  (nur Körper gezählt, Blut 12 und Einnahmen 1 nicht).
- **W7** ida: kein `progress` (negativ), `card` nur 15 Tage; kaputte `counts` → keine Zahl.
- **W8** mara `card`: 25 Einträge (markers und adherence auf „Alle“; ohne `health_daily`, unbestätigte
  Einnahmen, 0-ml-Tag), 9 Werte, 7 Monate.
- **W8b** dieselbe Mara: markers + adherence auf „Freunde“ → 17 (ohne 5 Blutwerte, 3 Einnahmen); nur markers
  „Alle“ → 22; nur adherence „Alle“ → 20.
- **W8c** progress auf „Freunde“: kein `progress`, keine Einträge; Dauer und 9 Werte bleiben (Rückfallkarte).
- **W9** `profile_entry_count` als `anon`: permission denied.
- **W10** Bilder als `anon`: mara Profil- und Titelbild, frieda nur Profilbild (Titelbild auf „Freunde“), otto
  nichts (Web-Link aus); `anon` sieht 3 Objekte.
- **W11** Mara setzt `{"first_bloodwork": true, "workouts_10": false}` und `web_indexable`: Web zeigt
  `first_bloodwork`, verbirgt `workouts_10`, `web_indexable: true`. Cleo ändert Maras Zeile nicht (RLS).
- **W12** fremde ID, `"true"`, `1`, Array, JSON-`null` → `profiles_web_badges_check`; SQL-`null` → not-null.
- **W13** `anon` liest `profiles` nicht direkt (0 Zeilen).
- **W14** Stufen owner / friends / all (36 Ausgaben) gleich wie nach 2b; beim Eigentümer kommen nur
  `web_badges` und `web_indexable` dazu.
- **W15** `web_badges` nur in der eigenen Sicht, `card` nur in der Stufe web.
- **W16** „Ansehen als Web-Link“ = Antwort an `anon` (bis auf `own`/`as`).
- **W17** Web-Stufe 2b → 2c: dan verliert die Bio (2b gab sie ungeprüft heraus), mara bekommt die Web-Felder.
- **W18** `profile_web_value_count`: 4+3+2 → 9; ein ungültiger Eintrag (1500, 2.5) → keine Zahl statt Teilsumme;
  nur Blut/Einnahmen, nur Nullen, fehlend, kein Objekt → keine Zahl; nur Körper 4 → 4.
- **W19** Stufen: 9.99 → keine, 10 → 10, 29.9 → 20, 30 → 30, 74.9 → 50, 99 → 75, 250 → 100; 0, −5, null → keine.
- **W20** Dauer: 0 und 30 Tage → Tage; 31 → 1 Monat; 364 und 365 → 11 Monate; 366 und 730 → 1 Jahr;
  1095 → 2 Jahre; Datum in der Zukunft → 0 Tage; ohne Datum → nichts. (365 Tage wären mit 365,25 „0 Jahre“,
  deshalb Jahre erst ab 366 Tagen.)
- **W21** Tageswechsel in UTC: Konto 03.11. 23:30 UTC, heute 04.11. → 1 Tag.

- **M1** `anon` meldet mara (Web-Link an): ok; Zeile mit `source = 'web'`, `reporter_id` null, Details und
  E-Mail getrimmt, Schnappschuss `art = 'profil'` mit Maras Bio (im Web zu sehen).
- **M2** otto (aus), ben (privat), hanna (ausgeblendet), niemand (unbekannt), `OTTO`, ` niemand `, leer, `null` →
  je `P0001 meldung_nicht_moeglich`, genau ein verschiedener Text.
- **M2b** frieda (Web-Link an, alles „Freunde“) ist im Web zu sehen → meldbar, ohne Bio im Schnappschuss;
  `MARA` meldet mara (wie `profile_view`).
- **M3** falscher oder fehlender Grund → `meldung_ungueltig`; E-Mail ohne @, ohne Punkt, mit Leerzeichen, über
  254 Zeichen → `kontakt_ungueltig` — für mara, otto und niemand gleich (geprüft vor der Profilsuche).
- **M3b** Details mit 1500 Zeichen → 1000; E-Mail nur aus Leerzeichen → keine.
- **M4** je Profil (anonym): mara 3., 4., 5. Web-Meldung ok, 6. → `zu_viele_meldungen`; frieda weiter ok; otto
  weiter `meldung_nicht_moeglich` (die Grenze je Profil verrät nichts über Unsichtbare).
- **M4b** nach einer Stunde (Zeitstempel in der Transaktion zurückgesetzt) ist mara wieder meldbar.
- **M5** 200 anonyme Web-Meldungen in der letzten Stunde → `zu_viele_meldungen` für dan, niemand und otto gleich.
- **M6** `anon`: liest 0 Meldungen, `insert` → RLS-Fehler, `update` → 0 Zeilen, `moderation_queue` →
  permission denied, `resolve_content_report` → `nur_admins`.
- **M7** angemeldet ohne Admin (cleo): 0 Meldungen, `moderation_queue` → `nur_admins`.
- **M8** angemeldet über die Web-Funktion: cleo meldet dan → `reporter_id` = cleo, `source = 'web'`; mara meldet
  sich selbst → `meldung_nicht_moeglich`.
- **M8b** App-Weg unverändert: `report_public_profile` (cleo → frieda) → `source = 'app'`, ohne E-Mail.
- **M8c** Die Doppelsperre der App sieht auch die Web-Meldung eines Angemeldeten: cleo meldet dan danach per App →
  kein zweiter offener Eintrag (1).
- **M8d** umgekehrt: cleo meldet dan noch einmal über die Web-Funktion → ok, weiter 1 offener Eintrag.
- **M8e** Angemeldete haben über die Web-Funktion die Grenze der App (20 je Stunde): danach `zu_viele_meldungen`.
- **M9** Admin: `moderation_queue` zeigt alle offenen Meldungen, die alten mit `source: app`, die aus dem Web mit
  `source: web` und `contact` (nur bei M1 gesetzt); „Ausblenden“ einer Web-Meldung blendet mara aus und erledigt
  alle offenen Profilmeldungen zu ihr (0 offen); danach `meldung_nicht_moeglich` und `profile_view` null.
- **M11** Gleiche anonyme Meldung (Profil, Grund, Details getrimmt, E-Mail) zweimal → eine Zeile; mit anderer
  E-Mail → eine neue.
- **M10** `report_public_profile_web`: `anon` und `authenticated` ja, `public` nein; `moderation_queue`: `anon`
  nein.

Grenzen der Meldefunktion, offen benannt: Eine IP-Adresse gibt es in SQL nicht; die Grenzen zählen deshalb nur
anonyme Web-Meldungen je Profil (5) und insgesamt (200) je Stunde; Angemeldete haben die Grenze der App (20 je
Stunde, eine offene Profilmeldung je Melder und Profil). Wer die Gesamtgrenze ausschöpft, sperrt eine Stunde
lang alle Web-Meldungen — dann bleibt der Weg über das Impressum, den die Seite in diesem Fall nennt. Die
Vercel-Firewall-Regel „Profil-Links bremsen“ deckt nur `/u/` und `/api/og`; für diese Funktion lässt sich dort
keine Regel anlegen, weil der Browser direkt mit Supabase spricht (`/rest/v1/rpc/…`), nicht über Vercel.

Nebenbefund zu 2a (nicht in dieser Datei): Der Bestands-`update` in 2a Abschnitt 4 schaltet bei
`is_public`-Profilen die Bio auf „Alle“; der Trigger `check_public_profile_text` prüft sie dabei und bricht
die ganze 2a-Migration ab, wenn eine Alt-Bio den heutigen Filter nicht besteht (im Container nachgestellt:
`ERROR: oeffentliches_profil_link`). Vor dem Produktivlauf von 2a zählen:
`select count(*) from public.profiles where is_public and field_visibility = '{}'::jsonb and public.oeffentlicher_text_fehler(public_bio) is not null;` — erwartet 0.

## Proben-SQL (als `postgres` gestartet, wechselt selbst die Rolle)

```sql
\pset pager off
\set ON_ERROR_STOP 0
\echo '--- W1: anon, Stufe web: aus / privat / unbekannt / ausgeblendet -> null (alle vier gleich)'
set role anon; set request.jwt.claim.sub = '';
select n, public.profile_view(n) is null as ist_null from unnest(array['otto','ben','niemand','hanna','OTTO',' niemand ']) n;
\echo '--- W2: anon, mara (alles auf Alle, total 28.35): volle Antwort, progress nur Stufe 20'
select jsonb_pretty(public.profile_view('mara'));
\echo '--- W3: anon, Schluessel nur aus der erlaubten Menge (erwartet: je leer)'
with v as (select n, public.profile_view(n) j from unnest(array['mara','dan','frieda','gustav','ida','MARA']) n where public.profile_view(n) is not null)
select n,
  (select array_agg(k) from jsonb_object_keys(j) k where k not in ('username','display_name','own','blocked','private','avatar','fields','card','web_indexable')) as fremd_oben,
  (select array_agg(k) from jsonb_object_keys(j -> 'fields') k where k <> all (public.profile_web_fields())) as fremd_felder,
  (select array_agg(k) from jsonb_object_keys(coalesce(j #> '{fields,progress}', '{}')) k where k <> 'tier') as fremd_progress,
  coalesce(j #>> '{fields,progress,tier}', '10') not in ('10','20','30','50','75','100') as stufe_ungueltig,
  (select array_agg(k) from jsonb_object_keys(coalesce(j #> '{fields,reviews}', '{}')) k where k <> 'count') as fremd_reviews,
  (select array_agg(k) from jsonb_object_keys(coalesce(j -> 'card', '{}')) k where k not in ('member_since','entry_count','web_value_count')) as fremd_karte,
  (select array_agg(k) from jsonb_object_keys(coalesce(j #> '{card,member_since}', '{}')) k where k not in ('unit','n')) as fremd_dauer,
  (select array_agg(b) from jsonb_array_elements_text(coalesce(j #> '{fields,badges}', '[]')) b
     where b = any (public.profile_badge_web_sensitive() || public.profile_badge_web_borderline())) as heikle_abzeichen,
  j::text ~* '(blut|einnahmen|markers|in_range|adherence|substan|routine|e1rm|avgRating|Geheim|Kreuzheben|Push Pull|counts|history|werte|gender|female|visibility|web_badges|friends|story|"bio": "Training|"total"|"areas"|"since"|koerper|erholung|"training"|20[0-9][0-9]-[0-9][0-9])' as verbotener_text
from v order by n;
\echo '--- W4: Bio: mara besteht -> da; dan faellt durch (Wortliste erweitert) -> weg; frieda auf Freunde -> weg'
select n, public.profile_view(n) #>> '{fields,bio}' as bio from unnest(array['mara','dan','frieda']) n;
\echo '--- W5: frieda (alles auf Freunde): fields leer; Karte nur Dauer + trackt-Zahl (Entscheidung 04.11.), keine Eintraege'
select public.profile_view('frieda');
\echo '--- W6: gustav (Fortschritt nur aus Blut/Einnahmen, nur heikle Abzeichen): kein progress, keine badges, keine Eintraege; Karte Dauer + 5 Werte (nur koerper gezaehlt)'
select public.profile_view('gustav');
\echo '--- W7: ida (negativ, counts kaputt, Konto 20.10. 23:30 UTC): kein progress, Karte nur Dauer in Tagen'
select public.profile_view('ida');
\echo '--- W8: mara: Eintraege 25 (markers + adherence auf Alle; health_daily, unbestaetigte Einnahmen, 0-ml-Tag nicht), Werte 4+3+2 = 9, Dauer 7 Monate'
select public.profile_view('mara') #> '{card}' as karte;
reset role;
\echo '--- W8b: dieselbe Mara mit markers/adherence auf Freunde: 25 - 5 Blutwerte - 3 Einnahmen = 17; nur markers auf Alle: 22; nur adherence: 20'
begin;
update public.profiles set field_visibility = field_visibility || '{"markers":"friends","adherence":"friends"}' where username = 'mara';
set role anon; set request.jwt.claim.sub = '';
select public.profile_view('mara') #> '{card,entry_count}' as ohne_blut_einnahmen; reset role;
update public.profiles set field_visibility = field_visibility || '{"markers":"all"}' where username = 'mara';
set role anon; set request.jwt.claim.sub = '';
select public.profile_view('mara') #> '{card,entry_count}' as mit_blut; reset role;
update public.profiles set field_visibility = field_visibility || '{"markers":"friends","adherence":"all"}' where username = 'mara';
set role anon; set request.jwt.claim.sub = '';
select public.profile_view('mara') #> '{card,entry_count}' as mit_einnahmen; reset role;
\echo '--- W8c: progress nicht auf Alle -> keine Stufe, keine Eintraege, Dauer + Werte bleiben (Rueckfallkarte)'
update public.profiles set field_visibility = field_visibility || '{"progress":"friends"}' where username = 'mara';
set role anon; set request.jwt.claim.sub = '';
select public.profile_view('mara') #> '{fields,progress}' as progress, public.profile_view('mara') -> 'card' as karte; reset role;
rollback;
set role anon; set request.jwt.claim.sub = '';
\echo '--- W9: Hilfsfunktion fuer fremde IDs gesperrt (erwartet: Fehler permission denied)'
select public.profile_entry_count('00000000-0000-0000-0000-00000000000f', true, true);
\echo '--- W10: Bilder als anon: mara Titelbild + Profilbild ja; frieda Titelbild nein, Profilbild ja; otto (Web aus) beides nein'
select o.name, public.profile_media_visible(o.name, o.id) as sichtbar from storage.objects o order by o.name;
select count(*) as anon_sieht_objekte from storage.objects;
reset role;
\echo '--- W11: Abweichungen: mara gibt first_bloodwork frei, verbirgt workouts_10, schaltet Suchmaschinen an (eigene Zeile, RLS)'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.profiles set web_badges = '{"first_bloodwork": true, "workouts_10": false}', web_indexable = true where id = '00000000-0000-0000-0000-00000000000a';
select public.profile_view('mara') -> 'web_badges' as eigen_web_badges, public.profile_view('mara') -> 'web_indexable' as eigen_indexable;
\echo '--- W11b: Cleo kann Maras web_badges nicht setzen (RLS: 0 Zeilen)'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
update public.profiles set web_badges = '{"body_fat_5": true}' where id = '00000000-0000-0000-0000-00000000000a';
reset role;
set role anon; set request.jwt.claim.sub = '';
select public.profile_view('mara') #> '{fields,badges}' as web_abzeichen, public.profile_view('mara') -> 'web_indexable' as indexable;
reset role;
\echo '--- W12: ungueltige web_badges (erwartet: je Fehler profiles_web_badges_check)'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.profiles set web_badges = '{"hack_badge": true}' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set web_badges = '{"streak_7": "true"}' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set web_badges = '{"streak_7": 1}' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set web_badges = '["streak_7"]' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set web_badges = 'null' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set web_badges = null where id = '00000000-0000-0000-0000-00000000000a';
reset role;
select web_badges from public.profiles where username = 'mara';
\echo '--- W13: anon liest profiles nicht direkt (RLS: 0 Zeilen)'
set role anon; set request.jwt.claim.sub = '';
select count(*) as anon_profilzeilen from public.profiles;
reset role;
\echo '--- W14: angemeldete und Eigentuemer-Sichten unveraendert gegenueber 2b (ausser neue Eigentuemer-Schluessel)'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
create temp table nachher as select 'cleo'::text wer, n name, 'all'::text stufe, public.profile_view(n) j from unnest(array['mara','ben','dan','otto','frieda','gustav','hanna','ida','niemand']) n;
reset role;
do $$ declare r record; s text; begin
  for r in select id, username from public.profiles loop
    perform set_config('request.jwt.claim.sub', r.id::text, false);
    foreach s in array array['owner','friends','all'] loop
      execute 'set role authenticated';
      insert into nachher values ('selbst', r.username, s, public.profile_view(r.username, case when s = 'owner' then null else s end));
      execute 'reset role';
    end loop;
  end loop; end $$;
select count(*) as verglichen,
       count(*) filter (where v.j is not distinct from (case when n.stufe = 'owner' then n.j - 'web_badges' - 'web_indexable' else n.j end)) as gleich
  from nachher n join public.pruef_vorher v using (wer, name, stufe);
select n.wer, n.name, n.stufe from nachher n join public.pruef_vorher v using (wer, name, stufe)
 where v.j is distinct from (case when n.stufe = 'owner' then n.j - 'web_badges' - 'web_indexable' else n.j end);
\echo '--- W15: Eigentuemer sieht web_badges/web_indexable nur in eigener Sicht, nicht in "Ansehen als"'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select s, public.profile_view('mara', s) ? 'web_badges' as hat_web_badges, public.profile_view('mara', s) ? 'card' as hat_karte
  from unnest(array[null,'friends','all','web']) s;
\echo '--- W16: "Ansehen als Web-Link" = anon-Antwort (bis auf own/as)'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select set_config('pruef.als_web', (public.profile_view('mara', 'web') - 'own' - 'as')::text, false) is not null as gemerkt;
reset role;
set role anon; set request.jwt.claim.sub = '';
select current_setting('pruef.als_web')::jsonb = (public.profile_view('mara') - 'own') as gleich_wie_anon;
reset role;
\echo '--- W17: Web-Stufe vorher (2b) und nachher (2c), nur welche Feldschluessel'
set role anon; set request.jwt.claim.sub = '';
select v.name, (select array_agg(k order by k) from jsonb_object_keys(v.j -> 'fields') k) as vorher_2b,
       (select array_agg(k order by k) from jsonb_object_keys(public.profile_view(v.name) -> 'fields') k) as nachher_2c,
       (public.profile_view(v.name) is null) = (v.j is null) as null_gleich
  from public.pruef_vorher v where v.wer = 'anon' order by v.name;
reset role;
\echo '--- W18: web_value_count: gueltig / Teil ungueltig / nur Blut / fehlend / leer'
select public.profile_web_value_count('{"progress":{"counts":{"koerper":4,"training":3,"erholung":2}}}') as neun,
       public.profile_web_value_count('{"progress":{"counts":{"koerper":4,"training":1500,"erholung":2}}}') as teil_ungueltig,
       public.profile_web_value_count('{"progress":{"counts":{"koerper":4,"erholung":2.5}}}') as bruch,
       public.profile_web_value_count('{"progress":{"counts":{"koerper":4}}}') as nur_koerper,
       public.profile_web_value_count('{"progress":{"counts":{"blut":31,"einnahmen":4}}}') as nur_blut,
       public.profile_web_value_count('{"progress":{"counts":{"koerper":0,"training":0}}}') as nullen,
       public.profile_web_value_count('{"progress":{}}') as fehlend,
       public.profile_web_value_count('[1]') as kein_objekt;

\echo '--- W19: Stufen: 9.99 -> keine, 10 -> 10, 29.9 -> 20, 30 -> 30, 74.9 -> 50, 99 -> 75, 250 -> 100, 0 / -5 / null -> keine'
select public.profile_web_progress_tier(9.99) a, public.profile_web_progress_tier(10) b, public.profile_web_progress_tier(29.9) c,
       public.profile_web_progress_tier(30) d, public.profile_web_progress_tier(74.9) e, public.profile_web_progress_tier(99) f,
       public.profile_web_progress_tier(250) g, public.profile_web_progress_tier(0) h, public.profile_web_progress_tier(-5) i,
       public.profile_web_progress_tier(null) j;
\echo '--- W20: Dauer: 0 / 30 Tage -> Tage; 31 / 364 -> Monate (1 / 11); 365 -> 11 Monate; 366 / 730 / 1095 -> Jahre (1 / 1 / 2); Zukunft -> 0 Tage; null -> nichts'
select d, public.profile_web_member_for((date '2026-11-04' - d)::timestamptz, date '2026-11-04') as dauer
  from unnest(array[0, 30, 31, 364, 365, 366, 730, 1095, -3]) d
union all select null, public.profile_web_member_for(null, date '2026-11-04');
\echo '--- W21: Dauer am Tageswechsel UTC: Konto 03.11. 23:30 UTC, heute 04.11. -> 1 Tag'
select public.profile_web_member_for('2026-11-03 23:30+00', date '2026-11-04') as dauer;
```

## Proben-SQL Melden (M1–M11, als `postgres` gestartet, wechselt selbst die Rolle)

Vorher im Aufbau zusätzlich: `content_reports` wie in Produktion (siehe Aufbau 1), drei App-Meldungen (Aufbau 2).
Gezählt mit derselben Abfrage vor 2c, nach jedem Lauf (Tabelle oben).

```sql
\pset pager off
\set ON_ERROR_STOP 0
-- Helfer: ruft die Meldefunktion als aktuelle Rolle auf und gibt 'ok' oder den Fehlertext zurueck.
create schema if not exists pruef;
grant usage on schema pruef to anon, authenticated;
create or replace function pruef.melde(n text, grund text default 'spam', det text default null, kontakt text default null)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  perform public.report_public_profile_web(n, grund, det, kontakt);
  return 'ok';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;
grant execute on function pruef.melde(text, text, text, text) to anon, authenticated;

\echo '--- M1: anon meldet mara (Web-Link an, sichtbar): ok; Zeile source web, reporter null, Kontakt getrimmt, Details getrimmt'
set role anon; set request.jwt.claim.sub = '';
select pruef.melde('mara', 'werbung', '  Verkauft etwas  ', '  melder@example.org ') as mara;
reset role;
select reason, details, source, reporter_id is null as ohne_melder, reporter_contact, status, snapshot ->> 'art' as art,
       snapshot ->> 'username' as username, snapshot ? 'public_bio' and snapshot ->> 'public_bio' is not null as bio_im_schnappschuss
  from public.content_reports where source = 'web' order by created_at;

\echo '--- M2: aus / privat / ausgeblendet / unbekannt / leer / null -> derselbe Fehler (erwartet: 1 verschiedener Text)'
set role anon; set request.jwt.claim.sub = '';
select n, pruef.melde(n) as ergebnis from unnest(array['otto','ben','hanna','niemand','OTTO',' niemand ','', null]) n;
select count(distinct pruef.melde(n)) as verschiedene_fehler from unnest(array['otto','ben','hanna','niemand','', null]) n;
\echo '--- M2b: frieda (Web-Link an, alles Freunde) ist im Web zu sehen -> meldbar; MARA wie in profile_view -> mara'
select pruef.melde('frieda', 'spam') as frieda, pruef.melde('MARA', 'beleidigung') as mara_gross;
reset role;
select snapshot ->> 'username' as gemeldet, reason, snapshot ->> 'public_bio' as bio from public.content_reports where source = 'web' order by created_at;

\echo '--- M3: Eingaben, unabhaengig vom Ziel: falscher Grund -> meldung_ungueltig, kaputte E-Mail -> kontakt_ungueltig (auch fuer otto/niemand)'
set role anon; set request.jwt.claim.sub = '';
select n, pruef.melde(n, 'hack') as grund_falsch, pruef.melde(n, null) as grund_null,
       pruef.melde(n, 'spam', null, 'kein-at') as ohne_at, pruef.melde(n, 'spam', null, 'a@b') as ohne_punkt,
       pruef.melde(n, 'spam', null, 'a b@c.de') as leerzeichen, pruef.melde(n, 'spam', null, repeat('x', 250) || '@b.de') as zu_lang
  from unnest(array['mara','otto','niemand']) n;
\echo '--- M3b: Details ueber 1000 Zeichen -> 1000; nur Leerzeichen -> null; E-Mail leer -> null'
select pruef.melde('frieda', 'sonstiges', repeat('d', 1500), '   ') as lang;
reset role;
select char_length(details) as zeichen, reporter_contact is null as ohne_kontakt from public.content_reports where source = 'web' and reason = 'sonstiges';

\echo '--- M4: Grenze je Profil: mara hat 2 Web-Meldungen; 3 weitere ok, die 6. -> zu_viele_meldungen; frieda weiter ok; otto weiter meldung_nicht_moeglich'
set role anon; set request.jwt.claim.sub = '';
select i, pruef.melde('mara', 'spam', 'M4 ' || i) as ergebnis from generate_series(3, 6) i;
select pruef.melde('frieda', 'spam', 'M4 frieda') as frieda, pruef.melde('otto') as otto;
reset role;
select snapshot ->> 'username' as profil, count(*) as web_meldungen from public.content_reports where source = 'web' group by 1 order by 1;

\echo '--- M4b: eine Stunde spaeter (Zeitstempel zurueckgesetzt, Probe in Transaktion) -> mara wieder meldbar'
begin;
update public.content_reports set created_at = created_at - interval '61 minutes' where source = 'web';
set role anon; set request.jwt.claim.sub = '';
select pruef.melde('mara') as nach_einer_stunde;
reset role;
rollback;

\echo '--- M5: Gesamtgrenze 200 je Stunde (in Transaktion): danach zu_viele_meldungen fuer jedes Ziel, auch fuer unbekannte (kein Hinweis aufs Ziel)'
begin;
insert into public.content_reports (reported_user_id, reason, snapshot, source)
select '00000000-0000-0000-0000-00000000000f', 'spam', '{"art":"profil","username":"frieda"}', 'web'
  from generate_series(1, 200 - (select count(*) from public.content_reports where source = 'web' and reporter_id is null and created_at > now() - interval '1 hour'));
select count(*) as anon_web_letzte_stunde from public.content_reports where source = 'web' and reporter_id is null and created_at > now() - interval '1 hour';
set role anon; set request.jwt.claim.sub = '';
select pruef.melde('dan') as dan, pruef.melde('niemand') as niemand, pruef.melde('otto') as otto;
reset role;
rollback;

\echo '--- M6: anon liest, schreibt, aendert keine Meldungen (RLS) und kommt nicht an die Admin-Liste'
set role anon; set request.jwt.claim.sub = '';
select count(*) as anon_sieht_meldungen from public.content_reports;
insert into public.content_reports (reported_user_id, reason, source) values ('00000000-0000-0000-0000-00000000000a', 'spam', 'web');
update public.content_reports set status = 'erledigt' where status = 'offen';
select public.moderation_queue();
select public.resolve_content_report('00000000-0000-0000-0000-000000000000', 'ablehnen');
reset role;

\echo '--- M7: angemeldet, kein Admin (cleo): sieht keine Meldungen, Admin-Liste nur_admins'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) as cleo_sieht_meldungen from public.content_reports;
select public.moderation_queue();
\echo '--- M8: angemeldet ueber die Web-Funktion: cleo meldet dan -> ok mit reporter_id; mara meldet sich selbst -> meldung_nicht_moeglich'
select pruef.melde('dan', 'spam', 'von cleo') as cleo_meldet_dan;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pruef.melde('mara') as selbst;
reset role;
select reporter_id = '00000000-0000-0000-0000-00000000000c' as reporter_cleo, source from public.content_reports where details = 'von cleo';
\echo '--- M8b: App-Weg unveraendert: cleo meldet frieda per report_public_profile -> source app, ohne Kontakt'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.report_public_profile('frieda', 'werbung', 'app-weg');
reset role;
select source, reporter_contact is null as ohne_kontakt from public.content_reports where details = 'app-weg';
\echo '--- M8c: Doppelsperre der App gilt auch fuer die Web-Meldung eines Angemeldeten: cleo meldet dan danach per App -> kein zweiter Eintrag (1)'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.report_public_profile('dan', 'werbung', 'zweites mal');
reset role;
select count(*) as cleo_offen_zu_dan from public.content_reports
 where reported_user_id = '00000000-0000-0000-0000-00000000000d' and reporter_id = '00000000-0000-0000-0000-00000000000c' and status = 'offen';
\echo '--- M8d: und umgekehrt: cleo meldet dan noch einmal ueber die Web-Funktion -> ok, weiter 1 offener Eintrag'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pruef.melde('dan', 'beleidigung', 'nochmal web') as cleo_nochmal;
reset role;
select count(*) as cleo_offen_zu_dan from public.content_reports
 where reported_user_id = '00000000-0000-0000-0000-00000000000d' and reporter_id = '00000000-0000-0000-0000-00000000000c' and status = 'offen';
\echo '--- M8e: Angemeldete haben die Grenze der App (20 je Stunde, in Transaktion): danach zu_viele_meldungen, auch ueber die Web-Funktion'
begin;
insert into public.content_reports (reported_user_id, reporter_id, reason, snapshot)
select '00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000c', 'spam', '{"art":"erfahrung"}' from generate_series(1, 20);
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pruef.melde('frieda', 'spam', 'ueber der grenze') as cleo_ueber_grenze;
reset role;
rollback;

\echo '--- M9: Admin (Probe in Transaktion): Liste zeigt Web-Meldungen mit source/contact, alte mit source app; Ausblenden erledigt alle offenen Profilmeldungen zu mara'
begin;
update public.profiles set is_admin = true where username = 'cleo';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select e ->> 'username' as profil, e ->> 'art' as art, e ->> 'source' as quelle, e ->> 'contact' as kontakt, e ->> 'details' as details
  from jsonb_array_elements(public.moderation_queue()) e order by e ->> 'created_at';
select public.resolve_content_report((select id from public.content_reports where source = 'web' and snapshot ->> 'username' = 'mara' order by created_at limit 1), 'ausblenden');
reset role;
select (select hidden_by_moderation from public.profiles where username = 'mara') as mara_ausgeblendet,
       (select count(*) from public.content_reports where reported_user_id = '00000000-0000-0000-0000-00000000000a' and review_id is null and status = 'offen') as mara_offen;
set role anon; set request.jwt.claim.sub = '';
select pruef.melde('mara') as nach_ausblenden, public.profile_view('mara') is null as web_null;
reset role;
rollback;

\echo '--- M11: gleiche anonyme Meldung (Profil, Grund, Details, E-Mail) innerhalb einer Stunde nur einmal; andere E-Mail -> neue Zeile'
set role anon; set request.jwt.claim.sub = '';
select pruef.melde('frieda', 'gefaehrlich', 'gleich', 'a@b.de') as erste, pruef.melde('frieda', 'gefaehrlich', ' gleich ', 'a@b.de') as zweite,
       pruef.melde('frieda', 'gefaehrlich', 'gleich', 'c@d.de') as andere_mail;
reset role;
select reporter_contact, count(*) from public.content_reports where details = 'gleich' group by 1 order by 1;

\echo '--- M10: Rechte: anon/authenticated duerfen melden, public nicht; anon nicht moderation_queue'
select r, has_function_privilege(r, 'public.report_public_profile_web(text, text, text, text)', 'execute') as melden,
       has_function_privilege(r, 'public.moderation_queue()', 'execute') as liste
  from unnest(array['anon', 'authenticated']) r;
select exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.report_public_profile_web(text, text, text, text)'::regprocedure and a.grantee = 0) as public_darf;

-- Helfer-Schema pruef bleibt im Wegwerf-Cluster stehen (kein drop).
```
