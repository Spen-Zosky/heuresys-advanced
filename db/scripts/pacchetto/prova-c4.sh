#!/usr/bin/env bash
# db/scripts/pacchetto/prova-c4.sh — consolidamento C4: la versione del modello si fissa sull'attivazione, i processi sono unici
# per versione (R-58). Su copie usa-e-getta, come prova-c3.sh.
#
# Uso:  bash db/scripts/pacchetto/prova-c4.sh <env_del_cluster_usa_e_getta> <database_sorgente> <etichetta> <N> <cartella_uscita>
#
# Il cluster e' quello di prova (rifiuta la 5432), il sorgente non si tocca. Le copie si chiamano heuresys_c4_<etichetta>_prova<N> e
# heuresys_c4_<etichetta>_inversa<N>, devono non esistere e NON vengono cancellate.
#
# Che cosa prova, sulla sola copia:
#   0. la catena con la 000463 (e 000008, 000021 emendate): verde; ogni attivazione la cui variante ha una versione pubblicata ne ha
#      una fissata, ed e' la PUBLISHED piu' alta; i processi della banca restano 23;
#   1. prima consegna di un prototipo: CARICATO, versione 2 in DRAFT;
#   2. il numero successivo dello stesso prototipo: CARICATO come versione 3, con gli stessi codici di processo della 2 (R-58);
#   3. il database rifiuta un'attivazione fissata su una bozza;
#   4. due tenant sulla stessa variante, su versioni diverse: con la regola di prima (tutte le PUBLISHED) vedono la somma, ed e' il
#      difetto; con la versione fissata ciascuno vede la propria. Dentro una transazione che si annulla;
#   5. la catena altre due volte: verde, modello, attivazioni e processi della banca invariati;
#   6. l'inversa: rifiuta sulla copia che ha una variante con due versioni; su una copia nuova toglie tutto, e la catena lo rimette.
set -uo pipefail
ENV_SRC="${1:?env del cluster usa-e-getta}"; SRC="${2:?database sorgente}"; ET="${3:?etichetta}"; N="${4:?N}"; OUT="${5:?cartella di uscita}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RADICE="$(cd "$AQUI/../../.." && pwd)"
COPIA="heuresys_c4_${ET}_prova${N}"; INVERSA="heuresys_c4_${ET}_inversa${N}"
mkdir -p "$OUT"
set -a; . "$ENV_SRC"; set +a
[ "${POSTGRES_PORT:-}" != 5432 ] || { echo "rifiuto: la 5432 e' la produzione" >&2; exit 2; }
export PGHOST="$POSTGRES_HOST" PGPORT="$POSTGRES_PORT" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD"
P=(psql -X -At -v ON_ERROR_STOP=1)
for d in "$COPIA" "$INVERSA"; do
  [ "$("${P[@]}" -d postgres -c "select count(*) from pg_database where datname='$d'")" = 0 ] \
    || { echo "la copia $d c'e' gia': scegli un altro N (niente si cancella)" >&2; exit 2; }
done
[ -d "$HOME/.nvm/versions/node" ] && export PATH="$(ls -d "$HOME"/.nvm/versions/node/v22*/bin | tail -1):$PATH"
nuova_copia() { # $1 nome: createdb -T non copia i permessi, e la 000340 pretende il CONNECT di chi nomina
  createdb -T "$SRC" "$1" || exit 2
  for r in gov_worker codex_auditor; do
    [ "$("${P[@]}" -d postgres -c "select count(*) from pg_roles where rolname='$r'")" = 1 ] && "${P[@]}" -d postgres -c "GRANT CONNECT ON DATABASE \"$1\" TO $r" >/dev/null
  done
  local e="$OUT/$1.env"; grep -v '^POSTGRES_DB=' "$ENV_SRC" > "$e"; echo "POSTGRES_DB=$1" >> "$e"; chmod 600 "$e"
}
nuova_copia "$COPIA"
echo "[prova-c4] copia $COPIA da $SRC, ramo $(git -C "$RADICE" rev-parse --short HEAD 2>/dev/null || echo '?'), esiti in $OUT"

ok=0; ko=0
esito() { if [ "$2" = "$3" ]; then echo "  OK    $1"; ok=$((ok+1)); else echo "  ROSSO $1: atteso [$3] letto [$2]"; ko=$((ko+1)); fi; }
catena() { bash "$RADICE/db/scripts/migrate.sh" "$OUT/$2.env" > "$OUT/$1.out" 2>&1; local rc=$?
  [ $rc = 0 ] || grep -m1 -E 'ERROR|EXCEPTION' "$OUT/$1.out" | sed 's/^/        /'; return $rc; }
sql() { "${P[@]}" -d "${2:-$COPIA}" -c "$1"; }
modello() { sql "select string_agg(format('%s=%s', relname, n), ' ' order by relname) from (
  select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from sys.%I', c.relname), false, true, '')))[1]::text as n
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'sys' and c.relkind = 'r' and c.relname like 'sys_blueprint%' and c.relname <> 'sys_blueprint_content_receipts') x"; }
attivazioni() { sql "select string_agg(blueprint_activation_id || ':' || coalesce(blueprint_activation_variant_version_id::text, '-'), ' ' order by blueprint_activation_id) from sys.sys_blueprint_activations"; }
processi() { sql "select md5(string_agg(blueprint_process_variant_version_id || ':' || blueprint_process_code, ' ' order by blueprint_process_variant_version_id, blueprint_process_code)) from sys.sys_blueprint_process_registry"; }
banca() { sql "select count(*) from sys.sys_blueprint_process_registry r join sys.sys_blueprint_variants v on v.blueprint_variant_id = r.blueprint_process_variant_id where v.blueprint_variant_code = 'REGIONAL_RETAIL_BANK_MEDIUM'"; }
campo() { node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const v=process.argv[2].split(".").reduce((a,k)=>a?.[k],j); console.log(v ?? "")' "$1" "$2"; }
ACC=(node "$AQUI/accogli-pacchetto.mjs")

# le consegne: A (pacchetto 1) e B (pacchetto 2 dello stesso prototipo, contenuto cambiato)
node --input-type=module - "$AQUI" "$OUT" <<'JS' || { echo "consegne non scritte" >&2; exit 2; }
import fs from "node:fs"; import path from "node:path";
const [AQUI, OUT] = process.argv.slice(2);
const { improntaJson, ALGORITMO } = await import(path.join(AQUI, "manifesto-consegna.mjs"));
const P = JSON.parse(fs.readFileSync(path.join(AQUI, "contratto", "consegna", "pacchetto_di_prova_v03.json"), "utf8"));
const P2 = structuredClone(P); P2.contesto.descrizione.it += " (seconda consegna)";
const man = (p, versione) => ({ schema: "heuresys.fascicolo.consegna/1", prototipo: p.meta.prototipoId, versione, contratto: p.meta.schema,
  impronta: { algoritmo: ALGORITMO, valore: improntaJson(p) }, fascicoloVersione: p.perimetro?.fascicoloVersione ?? null,
  edizioni: [{ schema: "ESCO_OCC", edizione: "1.2.1" }], correlazione: "6c1d8e2a-4b3f-4e7a-9d2c-1a0b9c8d7e6f",
  consegnatoIl: "2026-10-30T12:00:00.000Z", consegnatoDa: "Amministratore di Sistema", file: "pacchetto.json" });
const scrivi = (nome, m, p) => { const d = path.join(OUT, nome); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "manifesto.json"), JSON.stringify(m)); fs.writeFileSync(path.join(d, "pacchetto.json"), JSON.stringify(p)); };
scrivi("consegna_A", man(P, 1), P);
scrivi("consegna_B", man(P2, 2), P2);
JS

echo "        prima della catena: attivazioni $(sql "select count(*) || ' (attive ' || count(*) filter (where blueprint_activation_status = 'ACTIVE') || ')' from sys.sys_blueprint_activations"), processi della banca $(banca)"
catena 0_catena "$COPIA"; esito "0. catena con la 000463 sulla copia appena fatta" "$?" 0
esito "0. nessuna attivazione senza versione dove la variante ne ha una pubblicata" "$(sql "select count(*) from sys.sys_blueprint_activations a where a.blueprint_activation_variant_version_id is null and exists (select 1 from sys.sys_blueprint_variant_versions vv where vv.blueprint_variant_version_variant_id = a.blueprint_activation_variant_id and vv.blueprint_variant_version_status = 'PUBLISHED')")" 0
esito "0. ogni versione fissata e' la PUBLISHED piu' alta della sua variante" "$(sql "select count(*) from sys.sys_blueprint_activations a where a.blueprint_activation_variant_version_id is distinct from (select vv.blueprint_variant_version_id from sys.sys_blueprint_variant_versions vv where vv.blueprint_variant_version_variant_id = a.blueprint_activation_variant_id and vv.blueprint_variant_version_status = 'PUBLISHED' order by vv.blueprint_variant_version_number desc limit 1)")" 0
esito "0. i processi della banca restano 23" "$(banca)" 23
echo "        versioni fissate: $(sql "select string_agg(t.tenant_code || '=' || v.blueprint_variant_code || ' v' || vv.blueprint_variant_version_number || ' ' || a.blueprint_activation_status, ', ' order by t.tenant_code) from sys.sys_blueprint_activations a join sys.sys_tenancies t on t.tenant_id = a.blueprint_activation_tenant_id join sys.sys_blueprint_variants v on v.blueprint_variant_id = a.blueprint_activation_variant_id left join sys.sys_blueprint_variant_versions vv on vv.blueprint_variant_version_id = a.blueprint_activation_variant_version_id")"

"${ACC[@]}" ricevi "$COPIA" "$OUT/consegna_A" "$OUT/1_ricevi.json" > "$OUT/1_ricevi.out" 2>&1
esito "1. prima consegna: CARICATO" "$(campo "$OUT/1_ricevi.json" ricevimento)" CARICATO
esito "1. versione 2 della variante" "$(campo "$OUT/1_ricevi.json" numero_di_versione)" 2
VAR="$(campo "$OUT/1_ricevi.json" variante)"; V2="$(campo "$OUT/1_ricevi.json" versione)"

"${ACC[@]}" ricevi "$COPIA" "$OUT/consegna_B" "$OUT/2_ricevi.json" > "$OUT/2_ricevi.out" 2>&1
esito "2. pacchetto successivo dello stesso prototipo: esce 0" "$?" 0
esito "2. CARICATO (R-58 chiuso)" "$(campo "$OUT/2_ricevi.json" ricevimento)" CARICATO
esito "2. versione 3 della stessa variante" "$(campo "$OUT/2_ricevi.json" numero_di_versione)/$(campo "$OUT/2_ricevi.json" variante)" "3/$VAR"
V3="$(campo "$OUT/2_ricevi.json" versione)"
PROC2="$(sql "select string_agg(blueprint_process_code, ',' order by blueprint_process_code) from sys.sys_blueprint_process_registry where blueprint_process_variant_version_id = '$V2'")"
esito "2. la versione 3 ha gli stessi codici di processo della 2 (e ne ha)" "$(sql "select string_agg(blueprint_process_code, ',' order by blueprint_process_code) from sys.sys_blueprint_process_registry where blueprint_process_variant_version_id = '$V3'")" "$PROC2"
[ -n "$PROC2" ] || { echo "  ROSSO 2. il pacchetto di prova non ha processi: la prova di R-58 non dice niente"; ko=$((ko+1)); }

esito "3. il database rifiuta un'attivazione fissata su una bozza" "$(sql "begin; insert into sys.sys_blueprint_activations (blueprint_activation_tenant_id, blueprint_activation_variant_id, blueprint_activation_variant_version_id, blueprint_activation_status) select tenant_id, '$VAR', '$V3', 'PROPOSED' from sys.sys_tenancies where tenant_code = 'RTL_BANK'; rollback;" > "$OUT/3_bozza.out" 2>&1; echo $?)/$(grep -c 'non è adottabile' "$OUT/3_bozza.out")" "1/1"

# 4: le versioni 2 e 3 si pubblicano (sulla copia), la 3 riceve un ruolo solo suo; poi, in una transazione che si annulla, RTL va
#    sulla 2 e HEURESYS sulla 3 della stessa variante, e si confrontano la regola di prima e la versione fissata.
sql "update sys.sys_blueprint_variant_versions set blueprint_variant_version_status = 'PUBLISHED', blueprint_variant_version_published_at = now() where blueprint_variant_version_id in ('$V2', '$V3');
     insert into sys.sys_blueprint_content_job_roles (blueprint_content_job_role_version_id, blueprint_content_job_role_code, blueprint_content_job_role_name) values ('$V3', 'C4_PROVA_SOLO_V3', 'Ruolo della sola versione 3');" > "$OUT/4_pubblica.out" 2>&1
"${P[@]}" -d "$COPIA" > "$OUT/4_profili.out" 2>&1 <<SQL
BEGIN;
UPDATE sys.sys_blueprint_activations SET blueprint_activation_status = 'SUSPENDED'
 WHERE blueprint_activation_status = 'ACTIVE' AND blueprint_activation_tenant_id IN (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code IN ('RTL_BANK','HEURESYS'));
INSERT INTO sys.sys_blueprint_activations (blueprint_activation_tenant_id, blueprint_activation_variant_id, blueprint_activation_variant_version_id, blueprint_activation_status)
SELECT tenant_id, '$VAR', CASE tenant_code WHEN 'RTL_BANK' THEN '$V2'::uuid ELSE '$V3'::uuid END, 'ACTIVE'
  FROM sys.sys_tenancies WHERE tenant_code IN ('RTL_BANK','HEURESYS');
SELECT 'prima_' || t.tenant_code || '=' || bool_or(ct.blueprint_content_job_role_code = 'C4_PROVA_SOLO_V3')
  FROM sys.sys_tenancies t
  JOIN sys.sys_blueprint_activations a ON a.blueprint_activation_tenant_id = t.tenant_id AND a.blueprint_activation_status = 'ACTIVE'
  JOIN sys.sys_blueprint_variant_versions vv ON vv.blueprint_variant_version_variant_id = a.blueprint_activation_variant_id AND vv.blueprint_variant_version_status = 'PUBLISHED'
  JOIN sys.sys_blueprint_content_job_roles ct ON ct.blueprint_content_job_role_version_id = vv.blueprint_variant_version_id
 WHERE t.tenant_code IN ('RTL_BANK','HEURESYS') GROUP BY t.tenant_code ORDER BY t.tenant_code;
SELECT 'dopo_' || t.tenant_code || '=' || bool_or(ct.blueprint_content_job_role_code = 'C4_PROVA_SOLO_V3')
  FROM sys.sys_tenancies t
  JOIN sys.sys_blueprint_activations a ON a.blueprint_activation_tenant_id = t.tenant_id AND a.blueprint_activation_status = 'ACTIVE'
  JOIN sys.sys_blueprint_variant_versions vv ON vv.blueprint_variant_version_variant_id = a.blueprint_activation_variant_id
   AND (vv.blueprint_variant_version_id = a.blueprint_activation_variant_version_id
        OR (a.blueprint_activation_variant_version_id IS NULL AND vv.blueprint_variant_version_status = 'PUBLISHED'))
  JOIN sys.sys_blueprint_content_job_roles ct ON ct.blueprint_content_job_role_version_id = vv.blueprint_variant_version_id
 WHERE t.tenant_code IN ('RTL_BANK','HEURESYS') GROUP BY t.tenant_code ORDER BY t.tenant_code;
ROLLBACK;
SQL
esito "4. regola di prima: anche il tenant sulla versione 2 vede il ruolo della 3 (il difetto)" "$(grep '^prima_' "$OUT/4_profili.out" | tr '\n' ' ')" "prima_HEURESYS=true prima_RTL_BANK=true "
esito "4. versione fissata: solo il tenant sulla versione 3 lo vede" "$(grep '^dopo_' "$OUT/4_profili.out" | tr '\n' ' ')" "dopo_HEURESYS=true dopo_RTL_BANK=false "
esito "4. la transazione si e' annullata: attivazioni come prima" "$(sql "select count(*) from sys.sys_blueprint_activations where blueprint_activation_variant_id = '$VAR'")" 0

M5="$(modello)"; A5="$(attivazioni)"; P5="$(processi)"
catena 5_catena "$COPIA"; esito "5. catena una seconda volta" "$?" 0
catena 5_catena_bis "$COPIA"; esito "5. catena una terza volta" "$?" 0
esito "5. righe del modello invariate" "$([ "$(modello)" = "$M5" ] && echo uguali || echo diverse)" uguali
esito "5. attivazioni e versioni fissate invariate" "$([ "$(attivazioni)" = "$A5" ] && echo uguali || echo diverse)" uguali
esito "5. i processi della banca restano 23" "$(banca)" 23
esito "5. ogni processo resta sulla sua versione (la 000298 non li riporta sulla 1)" "$([ "$(processi)" = "$P5" ] && echo uguali || echo diverse)" uguali

"${P[@]}" -d "$COPIA" -f "$AQUI/inversa-000463.sql" > "$OUT/6_inversa_rifiuta.out" 2>&1
esito "6. l'inversa rifiuta dove una variante ha due versioni con gli stessi processi" "$([ $? != 0 ] && echo rifiuta || echo procede)/$(grep -c 'non si torna indietro' "$OUT/6_inversa_rifiuta.out")" "rifiuta/1"
nuova_copia "$INVERSA"
catena 6_catena "$INVERSA"; esito "6. catena sulla copia dell'inversa" "$?" 0
"${P[@]}" -d "$INVERSA" -f "$AQUI/inversa-000463.sql" > "$OUT/6_inversa.out" 2>&1; esito "6. l'inversa su una copia senza versioni doppie" "$?" 0
esito "6. ... toglie la colonna e rimette l'indice per variante" "$(sql "select (select count(*) from information_schema.columns where table_schema='sys' and table_name='sys_blueprint_activations' and column_name='blueprint_activation_variant_version_id') || '/' || (select count(*) from pg_indexes where schemaname='sys' and indexname='sys_blueprint_process_registry_variant_code_uq')" "$INVERSA")" "0/1"
catena 6_catena_dopo "$INVERSA"; esito "6. la catena dopo l'inversa rimette la 000463" "$?" 0
esito "6. ... con la versione fissata" "$(sql "select count(*) from sys.sys_blueprint_activations where blueprint_activation_variant_version_id is not null" "$INVERSA")" "$(sql "select count(*) from sys.sys_blueprint_activations where blueprint_activation_variant_version_id is not null" "$COPIA")"

echo "[prova-c4] $ok OK, $ko ROSSI — copie $COPIA e $INVERSA lasciate sul cluster (si tolgono a mano, quando non servono piu')"
[ "$ko" = 0 ]
