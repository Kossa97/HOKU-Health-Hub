#!/bin/bash
# Cloud-Sessions: Abhängigkeiten für Tests, Lint und den Wissensgraphen.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# npm install statt ci: nutzt den zwischengespeicherten Container-Stand.
npm install --no-audit --no-fund

# graphify in der Version, mit der graphify-out gebaut wurde — mit SQL-Extra,
# sonst verliert ein Update alle Knoten aus den supabase-*.sql.
if ! pip show graphifyy 2>/dev/null | grep -q '^Version: 0.9.91$' \
  || ! python3 -c 'import tree_sitter_sql' 2>/dev/null; then
  pip install -q 'graphifyy[sql]==0.9.91'
fi
