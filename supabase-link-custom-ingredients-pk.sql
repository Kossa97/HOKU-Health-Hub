-- Freitext-Zutaten mit dem Katalog verknuepfen, wenn ihr Name eindeutig zu
-- einem Katalogeintrag MIT PK-Profil passt.
--
-- Warum: Wer eine Substanz als freien Text angelegt hat („Semaglutide“), bekam
-- keine Blutspiegelkurve, obwohl der Katalog sie samt Profil kennt — die
-- Kurve haengt an `catalog_substance_id`, nicht am Namen.
--
-- Regel:
--   - nur Zutaten ohne Katalogverknuepfung (`catalog_substance_id is null`)
--   - der Name passt (ohne Gross/Klein, ohne Rand-Leerzeichen) zum Namen oder
--     einem Alias GENAU EINES aktiven Katalogeintrags mit PK-Profil;
--     mehrdeutige Namen bleiben unberuehrt
--   - `custom_name` bleibt stehen: der Eintrag heisst weiter so, wie der
--     Nutzer ihn genannt hat. Rueckgaengig: catalog_substance_id wieder auf null.
--
-- Stand 2026-10-13: trifft 3 Zutaten. Nur aendernd, nichts wird geloescht.
-- Ein zweiter Lauf aendert nichts.

begin;

with treffer as (
  select ing.id as zutat_id, min(c.id::text)::uuid as katalog_id, count(*) as anzahl
  from public.stack_item_ingredients ing
  join public.substance_catalog c
    on c.active
   and c.pk_profile_id is not null
   and (
     lower(btrim(c.canonical_name)) = lower(btrim(ing.custom_name))
     or lower(btrim(ing.custom_name)) in (select lower(btrim(alias)) from unnest(c.aliases) alias)
   )
  where ing.catalog_substance_id is null
    and nullif(btrim(ing.custom_name), '') is not null
  group by ing.id
)
update public.stack_item_ingredients ing
set catalog_substance_id = treffer.katalog_id
from treffer
where ing.id = treffer.zutat_id
  and treffer.anzahl = 1
  and ing.catalog_substance_id is null;

commit;
