#!/usr/bin/env bash
# Lance les migrations + tests pgTAP sur un Postgres 16 local jetable.
# Usage : bash supabase/tests/local/run.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
trap '"$PGBIN/pg_ctl" -D "$WORK/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

if [ "$(id -u)" = "0" ]; then RUNAS="runuser -u postgres --"; chown postgres "$WORK"; else RUNAS=""; fi
$RUNAS "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/tests/local/supabase_stubs.sql" >/dev/null
for f in "$ROOT"/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done

if [ "${TEST_RESET:-0}" = "1" ]; then
  echo "→ test du script de remise à zéro puis réinstallation"
  "${PSQL[@]}" -f "$ROOT/reset.sql" >/dev/null
  for f in "$ROOT"/migrations/*.sql; do "${PSQL[@]}" -f "$f" >/dev/null; done
fi

FAIL=0
for t in "$ROOT"/tests/database/*.test.sql; do
  echo "→ test $(basename "$t")"
  OUT="$("${PSQL[@]}" -t -A -f "$t" 2>&1)" || FAIL=1
  echo "$OUT" | grep -E "ERROR|psql:" || true
  echo "$OUT" | grep -E "^(not ok|# )" || true
  if echo "$OUT" | grep -qE "^not ok|Looks like you (failed|planned)|ERROR"; then FAIL=1; fi
  echo "$OUT" | grep -cE "^ok" | sed 's/^/   tests réussis : /'
done
[ "$FAIL" = "0" ] && echo "✅ Tous les tests SQL passent" || { echo "❌ Des tests SQL échouent"; exit 1; }
