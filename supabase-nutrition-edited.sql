-- Ernährung: hat der Nutzer die Werte eines Lebensmittels aus Open Food Facts oder dem BLS
-- korrigiert? Vorher galt jedes gespeicherte Lebensmittel als „Meins“ — auch eins, das nur
-- als Favorit gemerkt war. Jetzt zeigt die Herkunft: „Open Food Facts“, „… · von dir
-- korrigiert“ oder „Meins“ (selbst angelegt). Alte Korrekturen sind nicht erkennbar und
-- zeigen wieder ihre Herkunft. Idempotent; ändert keine bestehenden Werte.

alter table public.food_items add column if not exists edited boolean not null default false;
