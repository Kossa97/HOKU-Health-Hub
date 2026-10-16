-- Stand 16.10.2026: Herkunft der Pins geklaert. 224 der 232 Pins sind
-- Beispieldaten des Testkontos test1@trackyourdose.test (Seed-Skript); ihre
-- Positionen sind mit supabase-injection-testaccount-sites.sql an die
-- richtige Stelle gesetzt -- fuer sie aendert diese Datei nichts mehr. Sie
-- korrigiert nur noch die Namen der echten, per Long-Press gesetzten Pins
-- (mit uv). Reihenfolge: ERST testaccount-sites, DANN diese Datei.
--
-- Injektionstracker: Regionen gespeicherter Pins neu berechnen.
--
-- Die Regionserkennung (src/lib/injectionGeometry.ts, inferBodyRegion) lag
-- fuer das Modell `placeholder-v1` rund 0.3-0.4 Einheiten zu tief: ein Pin
-- oben am Oberschenkel hiess „Bauch“, der Unterbauch „Brust“, das Gesaess
-- lag in der Kniekehle. Die Position (position/normal) war immer richtig --
-- nur der Name daneben nicht. Die Rotationswarnung rechnet mit Positionen
-- und war nicht betroffen.
--
-- Diese Datei rechnet body_region, body_side und site aus position/normal
-- mit den neuen Regeln neu (BODY_LANDMARKS in injectionGeometry.ts -- hier
-- dieselben Zahlen, ein Test prueft das). Nur Zeilen mit model_version
-- 'placeholder-v1' und Position; alte Eintraege ohne Position bleiben.
--
-- Vorher werden die bisherigen Werte in
-- `injection_logs_region_backup_v2` gesichert (nur id und die drei Spalten,
-- RLS an, keine Policy: fuer Nutzer unsichtbar). Zurueck geht es mit:
--
--   update public.injection_logs l
--   set body_region = b.body_region, body_side = b.body_side, site = b.site
--   from public.injection_logs_region_backup_v2 b where b.id = l.id;
--
-- Zweimal laufen ist erlaubt: die Sicherung behaelt die ersten Werte
-- (on conflict do nothing), das Update aendert beim zweiten Mal nichts.
--
-- Reihenfolge: ERST die App mit den neuen Regeln ausliefern, DANN diese
-- Datei. Geraete mit einer zwischengespeicherten alten App koennen noch
-- eine Weile alte Namen schreiben -- ein spaeterer zweiter Lauf zieht sie
-- nach (erfasst neue Zeilen auch in der Sicherung).

create table if not exists public.injection_logs_region_backup_v2 (
  id uuid primary key references public.injection_logs (id) on delete cascade,
  body_region text,
  body_side text,
  site text not null,
  backed_up_at timestamptz not null default now()
);
alter table public.injection_logs_region_backup_v2 enable row level security;
revoke all on public.injection_logs_region_backup_v2 from anon, authenticated;

insert into public.injection_logs_region_backup_v2 (id, body_region, body_side, site)
select id, body_region, body_side, site
from public.injection_logs
where model_version = 'placeholder-v1'
  and jsonb_typeof(position->'x') = 'number' and jsonb_typeof(position->'y') = 'number'
on conflict (id) do nothing;

-- Dieselben Regeln wie regionFromPoint/sideFromX in injectionGeometry.ts.
create or replace function pg_temp.injection_region_v2(p jsonb, n jsonb)
returns text language sql immutable as $$
  select case
    when y > 1.32 and ax < 0.15 then 'outside_typical'
    when y > 0.94 then case when ax > 0.31 then 'deltoid' when back then 'torso' else 'chest' end
    when ax > 0.38 then case when y > 0.62 then 'upper_arm' when y > 0.36 then 'forearm' else 'outside_typical' end
    when y > 0.86 then case when back then 'torso' else 'chest' end
    when y > 0.56 then case when back then 'torso' else 'abdomen' end
    when y > 0.2 then case
      when back then 'glute'
      when ax < 0.12 and y < 0.32 then 'outside_typical'
      else 'abdomen' end
    when back and y > 0.05 then 'glute'
    when y > -0.47 then 'thigh'
    when y > -1.12 then 'lower_leg'
    else 'outside_typical'
  end
  from (select
    (p->>'y')::float8 as y,
    abs((p->>'x')::float8) as ax,
    coalesce(case when jsonb_typeof(n->'z') = 'number' then (n->>'z')::float8 end, 0) < -0.35 as back) v
$$;

create or replace function pg_temp.injection_side_v2(p jsonb)
returns text language sql immutable as $$
  select case
    when (p->>'x')::float8 > 0.06 then 'right'
    when (p->>'x')::float8 < -0.06 then 'left'
    else 'center'
  end
$$;

update public.injection_logs l
set body_region = r.region,
    body_side = r.side,
    site = r.region || '_' || r.side
from (
  select id,
    pg_temp.injection_region_v2(position, normal) as region,
    pg_temp.injection_side_v2(position) as side
  from public.injection_logs
  where model_version = 'placeholder-v1'
    and jsonb_typeof(position->'x') = 'number' and jsonb_typeof(position->'y') = 'number'
) r
where l.id = r.id
  and (l.body_region, l.body_side, l.site) is distinct from (r.region, r.side, r.region || '_' || r.side);
