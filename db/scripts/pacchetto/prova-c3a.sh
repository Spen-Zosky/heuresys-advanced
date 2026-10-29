#!/usr/bin/env bash
# db/scripts/pacchetto/prova-c3a.sh — consolidamento C3a: la catena delle migrazioni resta verde dopo un ricevimento (R-50, R-51).
#
# Uso:  bash db/scripts/pacchetto/prova-c3a.sh <env_del_cluster_usa_e_getta> <database_sorgente> <etichetta> <N> <pacchetto.json> <cartella_uscita> [radice_catena]
#
# <env_del_cluster_usa_e_getta>  il .env di un cluster di prova (sulla VM: ~/pg-prova-advanced/prova.env, porta 5436). Mai la produzione:
#                                lo script rifiuta la porta 5432.
# <database_sorgente>            un database di quel cluster gia' migrato (il ripristino del dump notturno); non si tocca, se ne fa una copia.
# <etichetta> <N>                la copia si chiama heuresys_c3a_<etichetta>_prova<N>; deve non esistere, e NON viene cancellata.
# [radice_catena]                la radice del repository la cui catena si applica (default: quella di questo script). Per la prova rossa
#                                si passa un checkout di main prima dell'emendamento; per la verde, il ramo emendato.
#
# Che cosa fa, sulla sola copia:
#   0. la catena sulla copia appena fatta: deve essere verde (altrimenti la prova non dice niente);
#   A. carica il pacchetto (accogli-pacchetto.mjs carica): nasce una variante, e il trigger le da' la versione 1 PUBLISHED;
#      la versione 2 ricevuta si pubblica con la chiave BLUEPRINT_CONTENT, come fa attiva-modello.mts;
#      poi la catena di nuovo — prima dell'emendamento si fermano la 000301 (processi), la 000320 (chiavi) e la 000400 (versioni);
#   B. pubblica una versione 2 sulla variante della banca (cio' che C3 fara' ricevendo una versione nuova di un prototipo gia' noto);
#      poi la catena di nuovo — prima dell'emendamento la 000398 si ferma («la banca ha 2 versioni»);
#   C. la catena una terza volta, e il conteggio delle righe delle tabelle sys_blueprint_* non cambia (idempotenza).
# Ogni passo scrive il proprio log nella cartella di uscita; l'esito e' una riga per passo, OK o ROSSO, e un riassunto.
set -uo pipefail
ENV_SRC="${1:?env del cluster usa-e-getta}"; SRC="${2:?database sorgente}"; ET="${3:?etichetta}"; N="${4:?N}"
PKG="${5:?pacchetto .json}"; OUT="${6:?cartella di uscita}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RADICE="${7:-$(cd "$AQUI/../../.." && pwd)}"
COPIA="heuresys_c3a_${ET}_prova${N}"
mkdir -p "$OUT"
set -a; . "$ENV_SRC"; set +a
[ "${POSTGRES_PORT:-}" != 5432 ] || { echo "rifiuto: la 5432 e' la produzione" >&2; exit 2; }
export PGHOST="$POSTGRES_HOST" PGPORT="$POSTGRES_PORT" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD"
P=(psql -X -At -v ON_ERROR_STOP=1)
[ "$("${P[@]}" -d postgres -c "select count(*) from pg_database where datname='$COPIA'")" = 0 ] \
  || { echo "la copia $COPIA c'e' gia': scegli un altro N (niente si cancella)" >&2; exit 2; }
createdb -T "$SRC" "$COPIA" || exit 2
# createdb -T non copia i permessi del database: senza questa riga la 000340 si ferma gia' al passo 0 (i ruoli che devono restare
# dentro hanno perso CONNECT sulla copia). Si concede a chi la 000340 nomina, se esiste sul cluster.
for r in gov_worker codex_auditor; do
  [ "$("${P[@]}" -d postgres -c "select count(*) from pg_roles where rolname='$r'")" = 1 ] && "${P[@]}" -d postgres -c "GRANT CONNECT ON DATABASE \"$COPIA\" TO $r" >/dev/null
done
ENVT="$OUT/copia.env"; grep -v '^POSTGRES_DB=' "$ENV_SRC" > "$ENVT"; echo "POSTGRES_DB=$COPIA" >> "$ENVT"; chmod 600 "$ENVT"
[ -d "$HOME/.nvm/versions/node" ] && export PATH="$(ls -d "$HOME"/.nvm/versions/node/v22*/bin | tail -1):$PATH"
echo "[prova-c3a] copia $COPIA da $SRC, catena di $RADICE ($(git -C "$RADICE" rev-parse --short HEAD 2>/dev/null || echo '?')), esiti in $OUT"

ok=0; ko=0
esito() { if [ "$2" = "$3" ]; then echo "  OK    $1"; ok=$((ok+1)); else echo "  ROSSO $1: atteso [$3] letto [$2]"; ko=$((ko+1)); fi; }
catena() { bash "$RADICE/db/scripts/migrate.sh" "$ENVT" > "$OUT/$1.out" 2>&1; local rc=$?
  [ $rc = 0 ] || grep -m1 -E 'ERROR|EXCEPTION' "$OUT/$1.out" | sed 's/^/        /'; return $rc; }
conta() { "${P[@]}" -d "$COPIA" -c "select string_agg(format('%s=%s', relname, n), ' ' order by relname) from (
  select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from sys.%I', c.relname), false, true, '')))[1]::text as n
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'sys' and c.relkind = 'r' and c.relname like 'sys_blueprint%') x"; }
pubblicate() { "${P[@]}" -d "$COPIA" -c "select count(*) from sys.sys_blueprint_variant_versions where blueprint_variant_version_status = 'PUBLISHED'"; }

catena 0_catena; esito "0. catena sulla copia appena fatta" "$?" 0

node "$AQUI/accogli-pacchetto.mjs" carica "$COPIA" "$PKG" "$OUT/A_carica.json" > "$OUT/A_carica.out" 2>&1
esito "A. il pacchetto si carica" "$?" 0
# la versione ricevuta si pubblica come la pubblica attiva-modello.mts: PUBLISHED e chiave BLUEPRINT_CONTENT (e' cio' che la rende costruibile)
VER="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).versione ?? "")' "$OUT/A_carica.json" 2>/dev/null)"
"${P[@]}" -d "$COPIA" -c "UPDATE sys.sys_blueprint_variant_versions SET blueprint_variant_version_status = 'PUBLISHED',
  blueprint_variant_version_published_at = now(), blueprint_variant_version_build_source_key = 'BLUEPRINT_CONTENT'
  WHERE blueprint_variant_version_id = '$VER'" > "$OUT/A_pubblica.out" 2>&1
esito "A. la versione ricevuta si pubblica" "$(cat "$OUT/A_pubblica.out")" "UPDATE 1"
echo "        versioni pubblicate nel database: $(pubblicate)"
catena A_catena; esito "A. catena dopo il caricamento" "$?" 0

"${P[@]}" -d "$COPIA" > "$OUT/B_versione2.out" 2>&1 <<'SQL'
INSERT INTO sys.sys_blueprint_variant_versions
  (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status,
   blueprint_variant_version_published_at, blueprint_variant_version_notes)
SELECT v.blueprint_variant_id, 2, 'PUBLISHED', now(), 'prova C3a: versione ricevuta su una variante esistente'
  FROM sys.sys_blueprint_variants v
 WHERE v.blueprint_variant_code = 'REGIONAL_RETAIL_BANK_MEDIUM'
ON CONFLICT (blueprint_variant_version_variant_id, blueprint_variant_version_number) DO NOTHING;
SQL
esito "B. versione 2 pubblicata sulla variante della banca" "$?" 0
echo "        versioni pubblicate nel database: $(pubblicate)"
catena B_catena; esito "B. catena dopo la versione 2 della banca" "$?" 0

PRIMA="$(conta)"
catena C_catena; esito "C. catena una terza volta" "$?" 0
DOPO="$(conta)"
esito "C. righe delle tabelle sys_blueprint_* invariate" "$([ "$PRIMA" = "$DOPO" ] && echo uguali || echo diverse)" uguali
[ "$PRIMA" = "$DOPO" ] || diff <(tr ' ' '\n' <<<"$PRIMA") <(tr ' ' '\n' <<<"$DOPO") | sed 's/^/        /'

echo "[prova-c3a] $ok OK, $ko ROSSI — copia $COPIA lasciata sul cluster (si toglie a mano, quando non serve piu')"
[ "$ko" = 0 ]
