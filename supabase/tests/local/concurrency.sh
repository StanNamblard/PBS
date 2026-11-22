#!/usr/bin/env bash
# Test de charge du matching : N utilisateurs envoient un selfie EN MÊME TEMPS
# (N connexions Postgres parallèles), puis chacun interroge une fois son statut.
# Vérifie : aucun selfie dans deux matchs, aucun auto-match, tout le monde apparié.
# Usage : bash supabase/tests/local/concurrency.sh [N=40]
set -euo pipefail
N="${1:-40}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
WORK="$(mktemp -d)"; PORT=54331
trap '"$PGBIN/pg_ctl" -D "$WORK/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
if [ "$(id -u)" = "0" ]; then RUNAS="runuser -u postgres --"; chown postgres "$WORK"; else RUNAS=""; fi
$RUNAS "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c max_connections=200" -l "$WORK/log" start >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/tests/local/supabase_stubs.sql" >/dev/null
for f in "$ROOT"/migrations/*.sql; do "${PSQL[@]}" -f "$f" >/dev/null; done

# N utilisateurs onboardés (pays variés) + fichiers
"${PSQL[@]}" >/dev/null <<SQL
insert into auth.users (id) select ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, $N) g;
do \$\$ declare g int; c text[] := array['FR','US','BR','JP','IN','NG']; begin
  for g in 1..$N loop
    perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0')))::text, true);
    perform public.verify_age('1990-01-01');
    perform public.complete_onboarding('user' || g, null, null, c[1 + g % 6], 'en', 'UTC', '{en}', 'v1');
    insert into storage.objects (bucket_id, name) values ('selfies', '00000000-0000-0000-0000-' || lpad(g::text, 12, '0') || '/s.jpg');
  end loop; end \$\$;
SQL

submit() {
  local uid; uid="00000000-0000-0000-0000-$(printf '%012d' "$1")"
  "${PSQL[@]}" -c "set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$uid\"}', false); select * from public.submit_selfie('$uid/s.jpg', gen_random_uuid());" >/dev/null
}
for g in $(seq 1 "$N"); do submit "$g" & done
wait

# Chacun interroge une fois (résout les envois arrivés exactement au même instant)
for g in $(seq 1 "$N"); do
  uid="00000000-0000-0000-0000-$(printf '%012d' "$g")"
  "${PSQL[@]}" -c "set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$uid\"}', false); select * from public.get_pending_selfie(); select public.poll_selfie(submission_id) from public.get_pending_selfie();" >/dev/null &
done
wait

"${PSQL[@]}" -t -A <<SQL
select 'envois: ' || count(*) from public.selfie_submissions;
select 'matchs: ' || count(*) from public.matches;
select 'en attente: ' || count(*) from public.selfie_submissions where status = 'pending';
select 'selfies dans 2 matchs (doit être 0): ' || count(*) from (
  select s from (select submission_a s from public.matches union all select submission_b from public.matches) x group by s having count(*) > 1) y;
select 'auto-matchs (doit être 0): ' || count(*) from public.matches where user_a = user_b;
select 'matchs entre personnes de même pays: ' || count(*) from public.matches m
  join public.profiles a on a.id = m.user_a join public.profiles b on b.id = m.user_b where a.country_code = b.country_code;
SQL
