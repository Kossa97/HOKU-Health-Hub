#!/usr/bin/env bash
# Stop-Hook: erinnert an "graphify update .", wenn Code unter src/ oder scripts/
# juenger ist als graphify-out/manifest.json.
#
# - Blockt hoechstens einmal pro Runde: Ist stop_hook_active gesetzt (Claude hat
#   auf den ersten Block schon geantwortet), wird nicht erneut geblockt. Vorher
#   lief das in eine Schleife, wenn graphify update nicht durchlaufen konnte.
# - In Cloud-Sitzungen (CLAUDE_CODE_REMOTE=true) nur ein Hinweis statt Block:
#   dort fehlen lokale Dateien, graphify update lehnt ab; nachgezogen wird lokal.
input=$(cat)
command -v graphify >/dev/null 2>&1 || exit 0
[ -f graphify-out/graph.json ] && [ -f graphify-out/manifest.json ] || exit 0
neuer=$(find src scripts -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \) -newer graphify-out/manifest.json -print -quit 2>/dev/null)
[ -n "$neuer" ] || exit 0

if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  echo '{"systemMessage": "Hinweis: Der Wissensgraph ist aelter als der geaenderte Code. In der Cloud-Sitzung nicht nachziehbar, bitte lokal graphify update . laufen lassen und graphify-out committen."}'
  exit 0
fi

echo '{"decision": "block", "reason": "Der Wissensgraph ist aelter als der geaenderte Code. Jetzt graphify update . laufen lassen und graphify-out in einem eigenen Commit nachziehen. Schlaegt der Lauf fehl: dem Nutzer sagen, statt es zu umgehen."}'
