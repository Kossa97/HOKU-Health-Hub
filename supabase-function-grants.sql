-- Ausfuehrungsrechte an SECURITY-DEFINER-Funktionen enger ziehen
--
-- Anlass: Supabases Sicherheitspruefung (Lints 0028/0029) meldet
-- SECURITY-DEFINER-Funktionen, die ohne Anmeldung ueber /rest/v1/rpc
-- aufrufbar sind. Diese Datei nimmt nur Rechte weg, die niemand braucht.
-- Sie aendert keine Funktion, keine Tabelle und keine Zeile.
--
-- 1. Trigger-Funktionen. Sie laufen als Trigger auf ihrer Tabelle; ein
--    Aufruf ueber die API endet ohnehin mit „trigger functions can only be
--    called as triggers". Postgres prueft EXECUTE nur beim Anlegen des
--    Triggers, nicht beim Feuern — der Trigger feuert danach weiter fuer
--    jede Rolle, die in die Tabelle schreibt.
--
-- 2. is_admin(). Alle Policies, die sie benutzen, gelten nur fuer
--    `authenticated` (Stand 2026-10-19: 8 Policies auf content_reports,
--    moderation_terms, peptide_library, pk_profiles). `anon` braucht sie
--    nicht; `authenticated` behaelt sie, sonst scheiterten diese Policies.
--
-- Bewusst NICHT angefasst:
-- - public_profile_reviews(text): die oeffentliche Profilseite ruft sie ohne
--   Anmeldung auf (src/pages/PublicProfile.tsx). Gewollt.
-- - die uebrigen RPCs fuer angemeldete Nutzer (confirm_intake_group,
--   save_stack_item_with_plan, …): die App braucht sie, jede prueft
--   auth.uid() selbst.
--
-- Nur `revoke`, kein `drop`. Wiederholbar: ein zweiter Lauf aendert nichts.

revoke execute on function public.check_effect_references() from public, anon, authenticated;
revoke execute on function public.check_public_profile_text() from public, anon, authenticated;
revoke execute on function public.check_public_review_text() from public, anon, authenticated;
revoke execute on function public.check_public_stack_item_name() from public, anon, authenticated;
revoke execute on function public.keep_reports_on_review_delete() from public, anon, authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
