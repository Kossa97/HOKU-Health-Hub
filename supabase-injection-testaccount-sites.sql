-- Injektionstracker: Pins des Testkontos test1@trackyourdose.test an die
-- richtige Stelle setzen.
--
-- Die Pins stammen aus supabase-seed-testaccount.sql (Branch
-- claude/testaccount-seed): erfundene Beispieldaten, keine echten Injektionen.
-- Das Seed-Skript hat die Punkte noch mit der alten, zu tiefen
-- Regionserkennung ausgesucht: „Bauch“ lag in Wirklichkeit oben am
-- Oberschenkel, „Oberschenkel“ kurz ueber dem Knie. Der Name ist hier die
-- Absicht, die Position der Fehler -- also wird die Position verschoben,
-- nicht der Name.
--
-- Neue Position = feste Stelle aus src/lib/injectionSitePresets.ts (auf der
-- Haut des Modells, von inferBodyRegion als genau diese Region erkannt) plus
-- ein kleiner, aus der id abgeleiteter Versatz von hoechstens +-2 cm wie im
-- Seed, damit nicht alle Pins aufeinander liegen.
--
-- Betroffen: nur dieses eine Konto, nur model_version 'placeholder-v1', nur
-- Pins ohne uv (die App schreibt immer uv; das Seed-Skript nie), nur
-- Bauch/Oberschenkel links/rechts. Vorher Sicherung der alten Werte in
-- injection_logs_position_backup_testaccount (RLS an, keine Policy).
-- Zurueck geht es mit:
--
--   update public.injection_logs l set position = b.position, normal = b.normal
--   from public.injection_logs_position_backup_testaccount b where b.id = l.id;
--
-- Zweimal laufen ist erlaubt: die Sicherung behaelt die ersten Werte, der
-- Versatz haengt nur an der id, das Update aendert beim zweiten Mal nichts.
--
-- Danach supabase-injection-regions-v2.sql: fuer diese Pins aendert sie dann
-- nichts mehr (Name und Position passen), sie korrigiert nur noch die Namen
-- echter, per Long-Press gesetzter Pins.

create table if not exists public.injection_logs_position_backup_testaccount (
  id uuid primary key references public.injection_logs (id) on delete cascade,
  position jsonb,
  normal jsonb,
  backed_up_at timestamptz not null default now()
);
alter table public.injection_logs_position_backup_testaccount enable row level security;
revoke all on public.injection_logs_position_backup_testaccount from anon, authenticated;

-- Eine Anweisung: Sicherung und Update sehen denselben Stand, die Sicherung
-- also die alten Werte.
with t as (
  select l.id,
    jsonb_build_object(
      'x', round((p.px + (('x' || substr(md5('x' || l.id::text), 1, 7))::bit(28)::int / 268435455.0 - 0.5) * 0.04)::numeric, 4),
      'y', round((p.py + (('x' || substr(md5('y' || l.id::text), 1, 7))::bit(28)::int / 268435455.0 - 0.5) * 0.04)::numeric, 4),
      'z', p.pz) as position,
    jsonb_build_object('x', p.nx, 'y', p.ny, 'z', p.nz) as normal,
    l.position as old_position, l.normal as old_normal
  from public.injection_logs l
  join auth.users a on a.id = l.user_id and a.email = 'test1@trackyourdose.test'
  -- Dieselben Zahlen wie INJECTION_SITE_PRESETS (ein Test prueft das).
  join (values
    ('abdomen', 'left',  -0.12,  0.68, 0.15575, -0.665,   0.11674, 0.73767),
    ('abdomen', 'right',  0.12,  0.68, 0.15565,  0.67697, 0.08745, 0.7308),
    ('thigh',   'left',  -0.2,  -0.1,  0.11854,  0.04394, -0.21788, 0.97498),
    ('thigh',   'right',  0.2,  -0.1,  0.11911, -0.06653, -0.18824, 0.97987)
  ) as p(region, side, px, py, pz, nx, ny, nz) on p.region = l.body_region and p.side = l.body_side
  where l.model_version = 'placeholder-v1'
    and l.uv is null
    and jsonb_typeof(l.position->'y') = 'number'
), backup as (
  insert into public.injection_logs_position_backup_testaccount (id, position, normal)
  select id, old_position, old_normal from t
  on conflict (id) do nothing
)
update public.injection_logs l
set position = t.position, normal = t.normal
from t
where l.id = t.id
  and (l.position, l.normal) is distinct from (t.position, t.normal);
