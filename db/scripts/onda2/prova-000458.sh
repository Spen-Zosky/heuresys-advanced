#!/usr/bin/env bash
# Prova della 000458 (contenuto v0.3 del modello) su una COPIA usa-e-getta. Gira sul gemello.
#   bash db/scripts/onda2/prova-000458.sh <database_sorgente_PRIMA_della_000458> <copia_prova_nuova>
# La sorgente deve essere uno schema prima della 000458 (di norma heuresys_ci). La copia deve finire in _prova<N>, non esistere, e NON viene
# cancellata (la elenca chi la lancia). Esiti provati:
#   andata, idempotenza (due applicazioni), \d delle tabelle nuove, ritorno esatto (pg_dump --schema-only filtrato su sys_blueprint_content_*),
#   seconda applicazione dopo l'inversa, mutazioni (un valore fuori vocabolario viene rifiutato), inversa che si rifiuta con una riga dentro.
set -euo pipefail
SRC="${1:?database sorgente}"; DB="${2:?copia di prova}"
[[ "$DB" =~ _prova[0-9]*$ ]] || { echo "rifiuto: $DB non finisce in _prova<N>"; exit 2; }
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGS="$AQUI/../../migrations"
M62="$MIGS/000062_register_embedding_tables_reconciliation.sql"
M429="$MIGS/000429_x1_classificazione_direzione_dato.sql"
M458="$MIGS/000458_pacchetto_v03_contenuto_modello_trova_casa.sql"
INV="$AQUI/000458-inversa.sql"
P="psql -h localhost -U heuresys -w -v ON_ERROR_STOP=1 -X -q"
NUOVE="strategies strategy_items capabilities capability_links job_role_links decisions decision_rights legal_entities agents agent_links design_principles perimeters process_steps position_responsibilities"
ok=0; ko=0
verifica() { if [ -z "$2" ] || [ -z "$3" ]; then echo "  ROSSO $1: misura vuota (una prova che non misura non e' verde)"; ko=$((ko+1)); elif [ "$2" = "$3" ]; then echo "  OK   $1"; ok=$((ok+1)); else echo "  ROSSO $1: atteso [$3] letto [$2]"; ko=$((ko+1)); fi; }
# esito: il comando DEVE fallire (rifiutato) oppure DEVE riuscire
rifiutato() { if "${@:2}" >/dev/null 2>&1; then verifica "$1" "accettato" "rifiutato"; else verifica "$1" "rifiutato" "rifiutato"; fi; }
accettato() { if "${@:2}" >/dev/null 2>&1; then verifica "$1" "accettato" "accettato"; else verifica "$1" "rifiutato" "accettato"; fi; }
uguali() { if [ ! -s "$2" ] || [ ! -s "$3" ]; then verifica "$1" "" "x"; elif cmp -s "$2" "$3"; then verifica "$1 ($(wc -l < "$2") righe confrontate)" "u" "u"; else verifica "$1" "diverso" "uguale"; diff "$2" "$3" | head -20 | sed 's/^/      /' || true; fi; }
schema() { pg_dump -s -h localhost -U heuresys -w -t 'sys.sys_blueprint_content_*' "$DB" | grep -v -e '^--' -e '^$' -e '^.restrict ' -e '^.unrestrict '; }
sql() { $P -d "$DB" -Atc "$1"; }
tutto() { for f in "$M62" "$M429" "$M458"; do $P -d "$DB" -f "$f" >/dev/null 2>&1 || { echo "    fallita: $f"; return 1; }; done; }

for i in $(seq 1 30); do sudo -n -u postgres createdb -O heuresys -T "$SRC" "$DB" 2>/dev/null && break; sleep 8; done
echo "[prova-000458] copia $DB da $SRC"
VER="$(sql "select blueprint_variant_version_id from sys.sys_blueprint_variant_versions limit 1")"
verifica "esiste almeno una versione di variante su cui provare" "$([ -n "$VER" ] && echo si)" "si"

schema > /tmp/o2-schema0.$$
N0="$(sql "select count(*) from information_schema.tables where table_schema='sys' and table_name like 'sys_blueprint_content_%'")"
verifica "prima: nessuna delle 14 tabelle nuove" "$(sql "select count(*) from information_schema.tables where table_schema='sys' and table_name in ($(for t in $NUOVE; do printf "'sys_blueprint_content_%s'," "$t"; done | sed 's/,$//'))")" "0"

tutto && verifica "andata: 062, 429, 458 si applicano" "ok" "ok" || verifica "andata" "fallita" "ok"
verifica "andata: 14 tabelle nuove" "$(sql "select count(*) from information_schema.tables where table_schema='sys' and table_name in ($(for t in $NUOVE; do printf "'sys_blueprint_content_%s'," "$t"; done | sed 's/,$//'))")" "14"
verifica "andata: 14 classificate importato" "$(sql "select count(*) from sys.sys_classificazione_direzione_dato where stato='importato' and tabella in ($(for t in $NUOVE; do printf "'sys_blueprint_content_%s'," "$t"; done | sed 's/,$//'))")" "14"
verifica "andata: 14 nel registro di riconciliazione" "$(sql "select count(*) from sys.sys_reconciliation_registry where reconciliation_registry_bucket='D' and reconciliation_registry_declared_status='EXCLUDE' and reconciliation_registry_table_name in ($(for t in $NUOVE; do printf "'sys_blueprint_content_%s'," "$t"; done | sed 's/,$//'))")" "14"
verifica "andata: nessuna tabella sys.sys_* non classificata" "$(sql "select count(*) from sys.v_tabelle_non_classificate")" "0"
schema > /tmp/o2-schema1.$$
tutto && verifica "idempotenza: la seconda applicazione e' verde" "ok" "ok" || verifica "idempotenza" "fallita" "ok"
schema > /tmp/o2-schema1b.$$
uguali "idempotenza: lo schema non cambia" /tmp/o2-schema1.$$ /tmp/o2-schema1b.$$
verifica "indici sulle chiavi esterne: ogni tabella nuova ha l'indice sulla versione" "$(sql "select count(*) from pg_indexes where schemaname='sys' and indexname in ($(for t in $NUOVE; do printf "'sys_blueprint_content_%s_versione_idx'," "$t"; done | sed 's/,$//'))")" "14"

echo "  --- \\d delle tabelle nuove ---"
for t in $NUOVE; do $P -d "$DB" -c "\\d sys.sys_blueprint_content_$t" | head -40 | sed 's/^/    /'; done > /tmp/o2-d.$$ 2>&1 || true
verifica "\\d: tutte le 14 tabelle descrivibili" "$(grep -c '^ *Tabella ' /tmp/o2-d.$$)" "14"
cp /tmp/o2-d.$$ "${O2_D_OUT:-/tmp/o2-d-000458.txt}"

echo "  --- mutazioni: un valore fuori vocabolario viene rifiutato (e lo stesso inserimento col valore buono passa) ---"
ins() { $P -d "$DB" -c "$1"; }
V="'$VER'"
accettato "strategia con leva buona" ins "insert into sys.sys_blueprint_content_strategies(blueprint_content_strategy_version_id, blueprint_content_strategy_competitive_lever, blueprint_content_strategy_growth_ambition) values ($V,'QUALITA','FORTE')"
$P -d "$DB" -c "delete from sys.sys_blueprint_content_strategies" >/dev/null
rifiutato "strategia con leva fuori vocabolario" ins "insert into sys.sys_blueprint_content_strategies(blueprint_content_strategy_version_id, blueprint_content_strategy_competitive_lever) values ($V,'PREZZO')"
rifiutato "strategia con ambizione fuori vocabolario" ins "insert into sys.sys_blueprint_content_strategies(blueprint_content_strategy_version_id, blueprint_content_strategy_competitive_lever, blueprint_content_strategy_growth_ambition) values ($V,'COSTO','ALTISSIMA')"
rifiutato "leva secondaria uguale alla prevalente" ins "insert into sys.sys_blueprint_content_strategies(blueprint_content_strategy_version_id, blueprint_content_strategy_competitive_lever, blueprint_content_strategy_secondary_lever) values ($V,'COSTO','COSTO')"
rifiutato "perimetro con schema fuori vocabolario" ins "insert into sys.sys_blueprint_content_perimeters(blueprint_content_perimeter_version_id, blueprint_content_perimeter_scheme, blueprint_content_perimeter_code) values ($V,'ISTAT_X','1')"
rifiutato "diritto decisionale fuori vocabolario" ins "insert into sys.sys_blueprint_content_decision_rights(blueprint_content_decision_right_version_id, blueprint_content_decision_right_decision_code, blueprint_content_decision_right_right, blueprint_content_decision_right_actor_kind, blueprint_content_decision_right_actor_code) values ($V,'D1','FIRMA','POSIZIONE','P1')"
rifiutato "attore di tipo persona" ins "insert into sys.sys_blueprint_content_decision_rights(blueprint_content_decision_right_version_id, blueprint_content_decision_right_decision_code, blueprint_content_decision_right_right, blueprint_content_decision_right_actor_kind, blueprint_content_decision_right_actor_code) values ($V,'D1','DECIDE','PERSONA','P1')"
rifiutato "legame competenza senza livello" ins "insert into sys.sys_blueprint_content_job_role_links(blueprint_content_job_role_link_version_id, blueprint_content_job_role_link_job_role_code, blueprint_content_job_role_link_link_kind, blueprint_content_job_role_link_skill_code) values ($V,'R1','COMPETENZA','S1')"
accettato "legame attivita' senza fase (faseCodice facoltativa)" ins "insert into sys.sys_blueprint_content_job_role_links(blueprint_content_job_role_link_version_id, blueprint_content_job_role_link_job_role_code, blueprint_content_job_role_link_link_kind, blueprint_content_job_role_link_process_code) values ($V,'R1','ATTIVITA','PR1')"
rifiutato "stesso legame attivita' senza fase due volte" ins "insert into sys.sys_blueprint_content_job_role_links(blueprint_content_job_role_link_version_id, blueprint_content_job_role_link_job_role_code, blueprint_content_job_role_link_link_kind, blueprint_content_job_role_link_process_code) values ($V,'R1','ATTIVITA','PR1')"
rifiutato "capability: strumento senza testo" ins "insert into sys.sys_blueprint_content_capability_links(blueprint_content_capability_link_version_id, blueprint_content_capability_link_capability_code, blueprint_content_capability_link_link_kind) values ($V,'C1','STRUMENTO_DATO')"
rifiutato "entita' giuridica con paese minuscolo" ins "insert into sys.sys_blueprint_content_legal_entities(blueprint_content_legal_entity_version_id, blueprint_content_legal_entity_code, blueprint_content_legal_entity_name, blueprint_content_legal_entity_country) values ($V,'E1','X','it')"
rifiutato "agente che risponde a un agente" ins "insert into sys.sys_blueprint_content_agents(blueprint_content_agent_version_id, blueprint_content_agent_code, blueprint_content_agent_name, blueprint_content_agent_accountable_kind, blueprint_content_agent_accountable_code) values ($V,'A1','X','AGENTE','A2')"
rifiutato "fase con esecutore senza codice" ins "insert into sys.sys_blueprint_content_process_steps(blueprint_content_process_step_version_id, blueprint_content_process_step_process_code, blueprint_content_process_step_code, blueprint_content_process_step_name, blueprint_content_process_step_ordinal, blueprint_content_process_step_executor_kind) values ($V,'PR1','F1','x',1,'POSIZIONE')"
PKG="insert into sys.sys_blueprint_content_packages(blueprint_content_package_version_id, blueprint_content_package_schema_version, blueprint_content_package_prototype_ref, blueprint_content_package_languages, blueprint_content_package_base_language, blueprint_content_package_source_hash) values ($V,'0.3','P','[\"it\"]','it',repeat('%s',64))"
accettato "pacchetto con impronta esadecimale" ins "$(printf "$PKG" a)"
rifiutato "pacchetto con passi accettati oltre il totale" ins "update sys.sys_blueprint_content_packages set blueprint_content_package_steps_accepted=5, blueprint_content_package_steps_total=3"
$P -d "$DB" -c "delete from sys.sys_blueprint_content_packages" >/dev/null
rifiutato "pacchetto con impronta non esadecimale" ins "$(printf "$PKG" Z)"
rifiutato "obiettivo di livello UNITA senza unita'" ins "insert into sys.sys_blueprint_content_goals(blueprint_content_goal_version_id, blueprint_content_goal_code, blueprint_content_goal_title, blueprint_content_goal_horizon, blueprint_content_goal_duration_days, blueprint_content_goal_dimension, blueprint_content_goal_level) values ($V,'G1','x','ANNUALE',365,'CRESCITA','UNITA')"
accettato "obiettivo d'impresa senza terna" ins "insert into sys.sys_blueprint_content_goals(blueprint_content_goal_version_id, blueprint_content_goal_code, blueprint_content_goal_title, blueprint_content_goal_horizon, blueprint_content_goal_duration_days, blueprint_content_goal_dimension, blueprint_content_goal_level) values ($V,'G-IMPRESA','x','ANNUALE',365,'CRESCITA','IMPRESA')"
rifiutato "obiettivo v0.2 (livello assente) senza terna" ins "insert into sys.sys_blueprint_content_goals(blueprint_content_goal_version_id, blueprint_content_goal_code, blueprint_content_goal_title, blueprint_content_goal_horizon, blueprint_content_goal_duration_days, blueprint_content_goal_dimension) values ($V,'G-V02','x','ANNUALE',365,'CRESCITA')"
rifiutato "legame di commessa con tipo fuori elenco" ins "insert into sys.sys_blueprint_content_engagement_links(blueprint_content_engagement_link_version_id, blueprint_content_engagement_link_engagement_code, blueprint_content_engagement_link_link_kind, blueprint_content_engagement_link_link_code) values ($V,'C1','PERSONA','X')"
accettato "legame di commessa col tipo nuovo ROLE" ins "insert into sys.sys_blueprint_content_engagement_links(blueprint_content_engagement_link_version_id, blueprint_content_engagement_link_engagement_code, blueprint_content_engagement_link_link_kind, blueprint_content_engagement_link_link_code, blueprint_content_engagement_link_capacity_share) values ($V,'C1','ROLE','X',0.5)"
rifiutato "quota di capacita' maggiore di 1" ins "update sys.sys_blueprint_content_engagement_links set blueprint_content_engagement_link_capacity_share=1.5 where blueprint_content_engagement_link_link_kind='ROLE'"
rifiutato "ore settimanali oltre 168" ins "insert into sys.sys_blueprint_content_position_processes(blueprint_content_position_process_version_id, blueprint_content_position_process_position_code, blueprint_content_position_process_process_code, blueprint_content_position_process_weekly_hours) values ($V,'P1','PR1',200)"
rifiutato "impatto AI fuori vocabolario" ins "insert into sys.sys_blueprint_content_job_roles(blueprint_content_job_role_version_id, blueprint_content_job_role_code, blueprint_content_job_role_name, blueprint_content_job_role_ai_impact) values ($V,'R-AI','x','ENORME')"
rifiutato "famiglia dell'indicatore fuori vocabolario" ins "insert into sys.sys_blueprint_content_kpis(blueprint_content_kpi_version_id, blueprint_content_kpi_code, blueprint_content_kpi_name, blueprint_content_kpi_family) values ($V,'K1','x','ALTRO')"

echo "  --- inversa che si rifiuta con dati dentro ---"
# in questo momento ci sono righe nelle tabelle nuove (legami ATTIVITA, ecc.) e colonne valorizzate? Riga certa: una strategia.
ins "insert into sys.sys_blueprint_content_strategies(blueprint_content_strategy_version_id, blueprint_content_strategy_competitive_lever) values ($V,'SERVIZIO')" >/dev/null
rifiutato "inversa con una riga in una tabella nuova" $P -d "$DB" -f "$INV"
verifica "inversa rifiutata: la tabella c'e' ancora" "$(sql "select count(*) from sys.sys_blueprint_content_strategies")" "1"
$P -d "$DB" -c "delete from sys.sys_blueprint_content_strategies" >/dev/null
# svuota le altre righe di prova, poi una colonna valorizzata
for t in $NUOVE; do $P -d "$DB" -c "delete from sys.sys_blueprint_content_$t" >/dev/null; done
$P -d "$DB" -c "delete from sys.sys_blueprint_content_engagement_links where blueprint_content_engagement_link_link_kind in ('ROLE','AGENT','GOAL')" >/dev/null
$P -d "$DB" -c "delete from sys.sys_blueprint_content_goals where blueprint_content_goal_level is not null" >/dev/null
$P -d "$DB" -c "delete from sys.sys_blueprint_content_job_roles where blueprint_content_job_role_code='R-AI'" >/dev/null
# una colonna aggiunta con un valore (le unita' di modello possono mancare nella copia: si usa un obiettivo, che qui si inserisce)
ins "insert into sys.sys_blueprint_content_goals(blueprint_content_goal_version_id, blueprint_content_goal_code, blueprint_content_goal_title, blueprint_content_goal_horizon, blueprint_content_goal_duration_days, blueprint_content_goal_dimension, blueprint_content_goal_level) values ($V,'G-COL','x','ANNUALE',365,'CRESCITA','IMPRESA')" >/dev/null
$P -d "$DB" -f "$INV" >/dev/null 2>/tmp/o2-inv2.$$ && verifica "inversa con un valore in una colonna aggiunta" "accettata" "rifiutata" || { verifica "inversa con un valore in una colonna aggiunta" "rifiutata" "rifiutata"; grep -q "blueprint_content_goal_level" /tmp/o2-inv2.$$ && verifica "inversa rifiutata: nomina la colonna" "si" "si" || verifica "inversa rifiutata: nomina la colonna" "no" "si"; }
verifica "inversa rifiutata: la colonna c'e' ancora" "$(sql "select count(*) from information_schema.columns where table_name='sys_blueprint_content_goals' and column_name='blueprint_content_goal_level'")" "1"
$P -d "$DB" -c "delete from sys.sys_blueprint_content_goals where blueprint_content_goal_code='G-COL'" >/dev/null

echo "  --- ritorno e riandata ---"
$P -d "$DB" -f "$INV" >/dev/null 2>/tmp/o2-inv.$$ && verifica "inversa a vuoto: riesce" "ok" "ok" || { verifica "inversa a vuoto: riesce" "rifiutata" "ok"; sed 's/^/      /' /tmp/o2-inv.$$; }
schema > /tmp/o2-schema2.$$
uguali "ritorno: lo schema sui sys_blueprint_content_* e' identico a prima, riga per riga" /tmp/o2-schema0.$$ /tmp/o2-schema2.$$
accettato "inversa ripetuta: idempotente" $P -d "$DB" -f "$INV"
tutto && verifica "riandata: 062, 429, 458 di nuovo verdi dopo l'inversa" "ok" "ok" || verifica "riandata" "fallita" "ok"
schema > /tmp/o2-schema3.$$
uguali "riandata: stesso schema della prima andata" /tmp/o2-schema1.$$ /tmp/o2-schema3.$$
rm -f /tmp/o2-schema?.$$ /tmp/o2-schema1b.$$ /tmp/o2-d.$$
echo "[prova-000458] ok=$ok rossi=$ko copia=$DB"
[ "$ko" -eq 0 ]
