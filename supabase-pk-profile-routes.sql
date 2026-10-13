-- GENERIERT von scripts/generate-pk-profile-routes-sql.mjs.
-- Nicht von Hand aendern — die Quelle ist scripts/pk-profile-routes.mjs.
-- Neu erzeugen mit: npm run pk:routes-sql
--
-- Fuer welche Route die Zahlen eines PK-Profils gelten. Passt die Route im
-- Einnahmeplan, verknuepft die App das Profil ohne Rueckfrage; eine leere
-- Liste heisst unklar, dann bestaetigt der Nutzer selbst.
-- 93 Profile. Nur hinzufuegend; ein zweiter Lauf aendert nichts.

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
      check (routes <@ array['Subkutan', 'Intramuskulär', 'Nasal', 'Oral', 'Transdermal', 'Intravenös', 'Andere']::text[]);
  end if;
end $$;

comment on column public.pk_profiles.routes is
  'Routen, fuer die die Zahlen gelten (Woerter aus src/lib/intakeMethods.ts). Leer = unklar, der Nutzer bestaetigt selbst.';

create temporary table pk_routen_quelle (name text primary key, routes text[] not null) on commit drop;
insert into pk_routen_quelle (name, routes) values
    ('Semaglutide', array['Subkutan']::text[]),
    ('Tirzepatide', array['Subkutan']::text[]),
    ('Liraglutide', array['Subkutan']::text[]),
    ('Exenatide', array['Subkutan']::text[]),
    ('Retatrutide', array['Subkutan']::text[]),
    ('Cagrilintide', array['Subkutan']::text[]),
    ('Survodutide', array['Subkutan']::text[]),
    ('Mazdutide', array['Subkutan']::text[]),
    ('Orforglipron', array['Oral']::text[]),
    ('GHK-Cu', array['Subkutan']::text[]),
    ('KPV', array['Subkutan']::text[]),
    ('Ipamorelin', array['Subkutan']::text[]),
    ('GHRP-2', array['Subkutan']::text[]),
    ('GHRP-6', array['Subkutan']::text[]),
    ('Tesamorelin', array['Subkutan']::text[]),
    ('MOTS-c', array['Subkutan']::text[]),
    ('AOD-9604', array['Subkutan']::text[]),
    ('Epithalon', array['Subkutan']::text[]),
    ('SS-31', array['Subkutan']::text[]),
    ('Humanin', array['Subkutan']::text[]),
    ('PT-141', array['Subkutan']::text[]),
    ('BPC-157', array['Subkutan']::text[]),
    ('TB-500', array['Subkutan']::text[]),
    ('CJC-1295 DAC', array['Subkutan']::text[]),
    ('CJC-1295 no DAC', array['Subkutan']::text[]),
    ('Hexarelin', array['Subkutan']::text[]),
    ('Sermorelin', array['Subkutan']::text[]),
    ('HGH Fragment 176-191', array['Subkutan']::text[]),
    ('Thymosin Alpha-1', array['Subkutan']::text[]),
    ('DSIP', array['Subkutan']::text[]),
    ('Kisspeptin-10', array['Subkutan']::text[]),
    ('Melanotan II', array['Subkutan']::text[]),
    ('Semax', array['Nasal', 'Subkutan']::text[]),
    ('Selank', array['Nasal', 'Subkutan']::text[]),
    ('NA-Semax Amidate', array['Nasal']::text[]),
    ('Dihexa', '{}'::text[]),
    ('Cerebrolysin', '{}'::text[]),
    ('MK-677', array['Oral']::text[]),
    ('Testosterone Enanthate', array['Intramuskulär', 'Subkutan']::text[]),
    ('Testosterone Cypionate', array['Intramuskulär', 'Subkutan']::text[]),
    ('Testosterone Propionate', array['Intramuskulär', 'Subkutan']::text[]),
    ('HCG', array['Subkutan', 'Intramuskulär']::text[]),
    ('IGF-1 LR3', array['Subkutan']::text[]),
    ('HGH', array['Subkutan']::text[]),
    ('DHEA', array['Oral']::text[]),
    ('Pregnenolon', array['Oral']::text[]),
    ('Östradiol', array['Oral']::text[]),
    ('Progesteron', array['Oral']::text[]),
    ('Ibuprofen', array['Oral']::text[]),
    ('Paracetamol', array['Oral']::text[]),
    ('Acetylsalicylsäure', array['Oral']::text[]),
    ('Prednisolon', array['Oral']::text[]),
    ('Pantoprazol', array['Oral']::text[]),
    ('Omeprazol', array['Oral']::text[]),
    ('Atorvastatin', array['Oral']::text[]),
    ('Rosuvastatin', array['Oral']::text[]),
    ('Simvastatin', array['Oral']::text[]),
    ('Ramipril', array['Oral']::text[]),
    ('Bisoprolol', array['Oral']::text[]),
    ('Metoprolol', array['Oral']::text[]),
    ('Amlodipin', array['Oral']::text[]),
    ('Candesartan', array['Oral']::text[]),
    ('Sertralin', array['Oral']::text[]),
    ('Escitalopram', array['Oral']::text[]),
    ('Venlafaxin', array['Oral']::text[]),
    ('Bupropion', array['Oral']::text[]),
    ('Methylphenidat', array['Oral']::text[]),
    ('Lisdexamfetamin', array['Oral']::text[]),
    ('Modafinil', array['Oral']::text[]),
    ('Finasterid', array['Oral']::text[]),
    ('Dutasterid', array['Oral']::text[]),
    ('Anastrozol', array['Oral']::text[]),
    ('Tamoxifen', array['Oral']::text[]),
    ('Enclomifen', array['Oral']::text[]),
    ('Levothyroxin', array['Oral']::text[]),
    ('Liothyronin', array['Oral']::text[]),
    ('Tadalafil', array['Oral']::text[]),
    ('Sildenafil', array['Oral']::text[]),
    ('Metformin', array['Oral']::text[]),
    ('Dapagliflozin', array['Oral']::text[]),
    ('Empagliflozin', array['Oral']::text[]),
    ('Allopurinol', array['Oral']::text[]),
    ('Cetirizin', array['Oral']::text[]),
    ('Loratadin', array['Oral']::text[]),
    ('Amoxicillin', array['Oral']::text[]),
    ('Naltrexon', array['Oral']::text[]),
    ('Rapamycin', array['Oral']::text[]),
    ('Koffein', array['Oral']::text[]),
    ('Melatonin', array['Oral']::text[]),
    ('5-HTP', array['Oral']::text[]),
    ('L-Theanin', array['Oral']::text[]),
    ('NAC', array['Oral']::text[]),
    ('Coenzym Q10', array['Oral']::text[]);

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
