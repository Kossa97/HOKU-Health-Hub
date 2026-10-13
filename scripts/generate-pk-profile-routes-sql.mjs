/**
 * Erzeugt `supabase-pk-profile-routes.sql` aus `scripts/pk-profile-routes.mjs`.
 *
 *   npm run pk:routes-sql
 *
 * Zwei Schritte in einer Datei:
 *   1. Die Spalte `pk_profiles.routes` anlegen, mit Pruefung auf die
 *      bekannten Routen. Nur hinzufuegend.
 *   2. Die Routen je Profil setzen — ueber den Namen, und nur dort, wo sie
 *      sich unterscheiden.
 *
 * Zweimal ausgefuehrt aendert der zweite Lauf nichts.
 */
import { writeFileSync } from 'node:fs'
import { PK_ROUTEN, ROUTEN } from './pk-profile-routes.mjs'

const ZIEL = 'supabase-pk-profile-routes.sql'

const quote = text => `'${String(text).replace(/'/g, "''")}'`
const textArray = werte => werte.length === 0 ? `'{}'::text[]` : `array[${werte.map(quote).join(', ')}]::text[]`

for (const [name, routen] of Object.entries(PK_ROUTEN)) {
  for (const route of routen) {
    if (!ROUTEN.includes(route)) throw new Error(`${name}: unbekannte Route „${route}"`)
  }
}

const eintraege = Object.entries(PK_ROUTEN)
const zeilen = eintraege.map(([name, routen]) => `    (${quote(name)}, ${textArray(routen)})`).join(',\n')

const sql = `-- GENERIERT von scripts/generate-pk-profile-routes-sql.mjs.
-- Nicht von Hand aendern — die Quelle ist scripts/pk-profile-routes.mjs.
-- Neu erzeugen mit: npm run pk:routes-sql
--
-- Fuer welche Route die Zahlen eines PK-Profils gelten. Passt die Route im
-- Einnahmeplan, verknuepft die App das Profil ohne Rueckfrage; eine leere
-- Liste heisst unklar, dann bestaetigt der Nutzer selbst.
-- ${eintraege.length} Profile. Nur hinzufuegend; ein zweiter Lauf aendert nichts.

begin;

alter table public.pk_profiles
  add column if not exists routes text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pk_profiles_routes_known' and conrelid = 'public.pk_profiles'::regclass
  ) then
    alter table public.pk_profiles
      add constraint pk_profiles_routes_known
      check (routes <@ ${textArray(ROUTEN)});
  end if;
end $$;

comment on column public.pk_profiles.routes is
  'Routen, fuer die die Zahlen gelten (Woerter aus src/lib/intakeMethods.ts). Leer = unklar, der Nutzer bestaetigt selbst.';

create temporary table pk_routen_quelle (name text primary key, routes text[] not null) on commit drop;
insert into pk_routen_quelle (name, routes) values
${zeilen};

-- Ein Name, den es in der Datenbank nicht gibt, bliebe sonst still ohne Route.
do $$
declare
  fehlend text;
begin
  select string_agg(quelle.name, ', ') into fehlend
  from pk_routen_quelle quelle
  where not exists (select 1 from public.pk_profiles profil where profil.name = quelle.name);
  if fehlend is not null then
    raise exception 'PK-Profile ohne Treffer: %', fehlend;
  end if;
end $$;

update public.pk_profiles profil
set routes = quelle.routes, updated_at = now()
from pk_routen_quelle quelle
where profil.name = quelle.name
  and profil.routes is distinct from quelle.routes;

commit;
`

writeFileSync(ZIEL, sql)
console.log(`${ZIEL}: Routen fuer ${eintraege.length} PK-Profile`)
