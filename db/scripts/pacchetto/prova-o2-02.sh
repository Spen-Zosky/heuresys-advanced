#!/usr/bin/env bash
# Prova di chiusura di O2-02: il caricatore porta il pacchetto v0.3 nelle tabelle del modello (migrazione 000458). Gira sul gemello, su COPIE usa-e-getta.
#   bash db/scripts/pacchetto/prova-o2-02.sh <database_sorgente_migrato_alla_000458> <N> <cartella_pacchetti> <cartella_caricatore_vecchio>
# <cartella_pacchetti> contiene banca_v02.json e i pacchetti costruiti da costruisci-pacchetto-prova-v03.mjs (pieno, vuoto, perimetro-senza-voci).
# <cartella_caricatore_vecchio> e' la cartella db/scripts/pacchetto del caricatore PRIMA di O2-02 (da git, un commit prima), dentro una radice che ha anche apps/ e node_modules/.
# Le copie si chiamano heuresys_o2_02_{nuovo,vecchio}_prova<N>, devono non esistere, e NON vengono cancellate: le elenca chi lancia.
# Che cosa prova:
#   1. v0.2: il pacchetto della banca del 10 ottobre (quello della giunzione) si carica e si rilegge uguale col caricatore nuovo, con gli stessi conteggi del vecchio;
#   2. v0.3 pieno / vuoto / perimetro senza voci: carica, rilegge UGUALE (percorso per percorso e per intero), conteggio righe per tabella uguale al JSON
#      (calcolato senza passare dalla definizione), stato del perimetro, regole che marcano riportate senza fermarsi;
#   3. rosso prima: il caricatore vecchio sul pacchetto v0.3 pieno NON rilegge uguale;
#   4. il caricatore rifiuta un pacchetto che non passa lo schema v0.3 o i limiti del database, senza scrivere niente;
#   5. mutazioni: togliere dal caricatore una colonna (work_nature, ...) fa diventare rosso il confronto.
set -uo pipefail
SRC="${1:?database sorgente (migrato alla 000458)}"; N="${2:?numero della prova}"; PK="${3:?cartella dei pacchetti}"; VECCHIO="${4:?cartella del caricatore vecchio}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PGUSER=heuresys PGHOST=localhost
[ -d "$HOME/.nvm/versions/node" ] && export PATH="$(ls -d "$HOME"/.nvm/versions/node/v22*/bin | tail -1):$PATH"
P="psql -h localhost -U heuresys -w -X -At"
NUOVO="heuresys_o2_02_nuovo_prova${N}"; VEC="heuresys_o2_02_vecchio_prova${N}"
U="$(mktemp -d)"; RADICE="$(cd "$AQUI/../../.." && pwd)"
ok=0; ko=0
QUIET=0
verifica() { if [ "$2" = "$3" ]; then [ "$QUIET" = 1 ] || echo "  OK    $1"; ok=$((ok+1)); else [ "$QUIET" = 1 ] || echo "  ROSSO $1: atteso [$3] letto [$2]"; ko=$((ko+1)); fi; }
campo() { node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const v=process.argv[2].split(".").reduce((a,k)=>a?.[k],j); console.log(v===undefined?"":typeof v==="object"?JSON.stringify(v):v)' "$1" "$2"; }
for d in "$NUOVO" "$VEC"; do
  [ "$($P -d postgres -c "select count(*) from pg_database where datname='$d'")" = 0 ] || { echo "la copia $d c'e' gia': scegli un altro N (niente si cancella)"; exit 2; }
done
[ "$($P -d "$SRC" -c "select count(*) from information_schema.tables where table_schema='sys' and table_name in ('sys_blueprint_content_strategies','sys_blueprint_content_strategy_items','sys_blueprint_content_capabilities','sys_blueprint_content_capability_links','sys_blueprint_content_job_role_links','sys_blueprint_content_decisions','sys_blueprint_content_decision_rights','sys_blueprint_content_legal_entities','sys_blueprint_content_agents','sys_blueprint_content_agent_links','sys_blueprint_content_design_principles','sys_blueprint_content_perimeters','sys_blueprint_content_process_steps','sys_blueprint_content_position_responsibilities')")" = 14 ] || { echo "il sorgente $SRC non e' migrato alla 000458"; exit 2; }
sudo -n -u postgres createdb -O heuresys -T "$SRC" "$NUOVO" || exit 2
sudo -n -u postgres createdb -O heuresys -T "$SRC" "$VEC" || exit 2
echo "[prova-o2-02] copie $NUOVO e $VEC da $SRC; esiti in $U"
for d in "$NUOVO" "$VEC"; do node "$AQUI/conta-righe-v03.mjs" "$d" "$PK/banca_v02.json" "snap:$U/snapshot_$d.json" >/dev/null 2>&1 || { echo "snapshot di $d fallito"; exit 2; }; done

# ---- un giro completo (carica, rileggi, conteggi, regole) di un pacchetto con un caricatore su un database. Risultato: numero di rossi in $ROSSI_GIRO
# $1 etichetta  $2 cartella del caricatore  $3 database  $4 pacchetto  $5 regole attese ("p,i,controllate/senza/piu,ore,marcate" oppure "-")
giro() {
  local et="$1" dir="$2" db="$3" pkg="$4" regole="$5" r0=$ko
  node "$dir/accogli-pacchetto.mjs" carica "$db" "$pkg" "$U/$et.carica.json" >"$U/$et.carica.out" 2>&1; local rc=$?
  verifica "$et: carica esce 0" "$rc" "0"
  local ver; ver="$(campo "$U/$et.carica.json" versione)"
  node "$dir/accogli-pacchetto.mjs" rileggi "$db" "$pkg" "$U/$et.rileggi.json" >"$U/$et.rileggi.out" 2>&1; rc=$?
  verifica "$et: rileggi esce 0" "$rc" "0"
  verifica "$et: pacchetto ricostruito uguale al file" "$(campo "$U/$et.rileggi.json" pacchetto_ricostruito_uguale)" "true"
  verifica "$et: percorsi con differenze" "$(campo "$U/$et.rileggi.json" percorsi_con_differenze)" "0"
  if [ -n "$ver" ]; then
    node "$AQUI/conta-righe-v03.mjs" "$db" "$pkg" "$ver" >"$U/$et.conta.out" 2>&1; rc=$?
    verifica "$et: conteggio righe per tabella uguale al JSON" "$rc" "0"
    [ "$rc" != 0 ] && [ "$QUIET" != 1 ] && grep ROSSO "$U/$et.conta.out" | sed 's/^/        /'
  else verifica "$et: versione caricata" "nessuna" "una"; fi
  if [ "$regole" != "-" ]; then
    local r; r="$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).regole_che_marcano; console.log(r?[r.priorita.oltre_il_massimo,r.obiettivi_d_impresa.oltre_il_massimo,r.decisioni.controllate+"/"+r.decisioni.senza_decide+"/"+r.decisioni.con_piu_di_un_decide,r.ore_per_posizione.oltre_il_contratto,r.marcate].join(","):"assenti")' "$U/$et.rileggi.json")"
    verifica "$et: regole che marcano riportate (priorita oltre,impresa oltre,decisioni c/s/p,ore oltre,marcate)" "$r" "$regole"
  fi
  ROSSI_GIRO=$((ko-r0))
}
scarica() { # $1 etichetta $2 cartella $3 database $4 pacchetto
  node "$2/accogli-pacchetto.mjs" scarica "$3" "$4" "$U/$1.scarica.json" >"$U/$1.scarica.out" 2>&1; local rc=$?
  verifica "$1: scarica esce 0" "$rc" "0"
  node "$AQUI/conta-righe-v03.mjs" "$3" "$4" "cmp:$U/snapshot_$3.json" >"$U/$1.vuote.out" 2>&1
  verifica "$1: dopo lo scarico ogni tabella torna al conteggio di prima" "$?" "0"
}

echo "== 1. v0.2 (banca del 10 ottobre): come prima"
node "$VECCHIO/accogli-pacchetto.mjs" carica "$VEC" "$PK/banca_v02.json" "$U/v02vecchio.carica.json" >/dev/null 2>&1
giro v02nuovo "$AQUI" "$NUOVO" "$PK/banca_v02.json" "-"
verifica "v02: stessi conteggi per tabella del caricatore vecchio" "$(campo "$U/v02nuovo.carica.json" righe_per_tabella | node -e 'const n=JSON.parse(require("fs").readFileSync(0,"utf8")); const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).righe_per_tabella; console.log(Object.keys(v).every((k)=>n[k]===v[k])?"uguali":"diversi")' "$U/v02vecchio.carica.json")" "uguali"
verifica "v02: nessuna riga nelle tabelle nuove" "$(campo "$U/v02nuovo.carica.json" righe_per_tabella | node -e 'const n=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(["strategies","strategy_items","capabilities","capability_links","job_roles","job_role_links","decisions","decision_rights","legal_entities","agents","agent_links","design_principles","perimeters","process_steps","position_responsibilities"].map((k)=>n["sys_blueprint_content_"+k]??0).reduce((a,b)=>a+b,0))')" "0"
scarica v02nuovo "$AQUI" "$NUOVO" "$PK/banca_v02.json"
scarica v02vecchio "$VECCHIO" "$VEC" "$PK/banca_v02.json"

echo "== 2. v0.3: pieno, vuoto, perimetro senza voci"
giro pieno "$AQUI" "$NUOVO" "$PK/prova_v03_pieno.json" "0,0,3/1/1,1,3"
scarica pieno "$AQUI" "$NUOVO" "$PK/prova_v03_pieno.json"
giro vuoto "$AQUI" "$NUOVO" "$PK/prova_v03_vuoto.json" "0,0,0/0/0,0,0"
verifica "vuoto: nessuna riga in nessuna tabella nuova" "$(grep -c 'letto     0' "$U/vuoto.conta.out")" "$(grep -c 'atteso     0' "$U/vuoto.conta.out")"
scarica vuoto "$AQUI" "$NUOVO" "$PK/prova_v03_vuoto.json"
giro senzavoci "$AQUI" "$NUOVO" "$PK/prova_v03_perimetro-senza-voci.json" "0,0,3/1/1,1,3"
verifica "senzavoci: il fascicolo c'e' (dossier_version) ma lo stato resta NON_RILASCIATO" "$($P -d "$NUOVO" -c "select blueprint_content_package_dossier_version||'/'||blueprint_content_package_perimeter_status from sys.sys_blueprint_content_packages")" "2/NON_RILASCIATO"
scarica senzavoci "$AQUI" "$NUOVO" "$PK/prova_v03_perimetro-senza-voci.json"

echo "== 3. rosso prima: il caricatore vecchio sui pacchetti v0.3"
# pieno: i campi nuovi non hanno casa nel vecchio caricatore e il database li rifiuta (CHECK degli obiettivi d'impresa); vuoto: il vecchio carica ma perde le sezioni dichiarate
node "$VECCHIO/accogli-pacchetto.mjs" carica "$VEC" "$PK/prova_v03_pieno.json" "$U/vecchio_pieno.carica.json" >/dev/null 2>&1; rc=$?
verifica "vecchio + v0.3 pieno: carica NON riesce (nessuna casa per i campi nuovi)" "$([ $rc = 0 ] && echo riuscito || echo fallito)" "fallito"
node "$VECCHIO/accogli-pacchetto.mjs" carica "$VEC" "$PK/prova_v03_vuoto.json" "$U/vecchio_vuoto.carica.json" >/dev/null 2>&1
node "$VECCHIO/accogli-pacchetto.mjs" rileggi "$VEC" "$PK/prova_v03_vuoto.json" "$U/vecchio_vuoto.rileggi.json" >/dev/null 2>&1; rc=$?
verifica "vecchio + v0.3 vuoto: rileggi NON esce 0" "$([ $rc = 0 ] && echo uguale || echo diverso)" "diverso"
verifica "vecchio + v0.3 vuoto: ricostruito diverso dal file (le sezioni nuove si perdono)" "$(campo "$U/vecchio_vuoto.rileggi.json" pacchetto_ricostruito_uguale)" "false"
node "$VECCHIO/accogli-pacchetto.mjs" scarica "$VEC" "$PK/prova_v03_vuoto.json" "$U/vecchio_vuoto.scarica.json" >/dev/null 2>&1

echo "== 4. rifiuti: il pacchetto che non passa lo schema o i limiti non scrive niente"
for g in leva-fuori-vocabolario sezione-mancante ore-oltre-168 impronta-non-esadecimale schema-sconosciuto due-sedi-due-entita valore-fuori-vocabolario-fase; do
  node "$AQUI/guasta-pacchetto.mjs" "$PK/prova_v03_pieno.json" "$U/guasto_$g.json" "$g" >/dev/null
  node "$AQUI/accogli-pacchetto.mjs" carica "$NUOVO" "$U/guasto_$g.json" "$U/guasto_$g.out.json" >/dev/null 2>&1; rc=$?
  verifica "rifiuto $g: carica esce con errore" "$([ $rc != 0 ] && echo rifiutato || echo accettato)" "rifiutato"
  verifica "rifiuto $g: il messaggio dice che e' rifiutato" "$(campo "$U/guasto_$g.out.json" errore | grep -c -E 'rifiutato|schema sconosciuto')" "1"
  verifica "rifiuto $g: nessuna famiglia scritta" "$($P -d "$NUOVO" -c "select count(*) from sys.sys_blueprint_families where blueprint_family_code='PACCHETTO_DATASTORE'")" "0"
done

echo "== 5. mutazioni del caricatore: ogni colonna tolta deve far diventare rosso il giro"
mutante() { # $1 nome  $2 file da mutare  $3 testo vecchio  $4 testo nuovo  $5 regole attese del giro
  # i moduli cercano apps/api e node_modules risalendo tre cartelle: il mutante ha la sua radice con db/scripts/pacchetto e i due collegamenti
  mkdir -p "$U/mut_$1/db/scripts/pacchetto" && cp -r "$AQUI"/*.mjs "$AQUI/contratto" "$U/mut_$1/db/scripts/pacchetto/" && ln -s "$RADICE/apps" "$U/mut_$1/apps" && ln -s "$RADICE/node_modules" "$U/mut_$1/node_modules"
  local M="$U/mut_$1/db/scripts/pacchetto"
  python3 - "$M/$2" "$3" "$4" <<'PY'
import sys
p, a, b = sys.argv[1:4]
s = open(p, encoding="utf8").read()
if s.count(a) != 1:
    print("MUTAZIONE-NON-APPLICATA", s.count(a)); sys.exit(3)
open(p, "w", encoding="utf8").write(s.replace(a, b))
PY
  verifica "mutante $1: la mutazione e' stata applicata" "$?" "0"
  QUIET=1; giro "mut_$1" "$M" "$NUOVO" "$PK/prova_v03_pieno.json" "$5"; QUIET=0
  verifica "mutante $1: il giro diventa rosso" "$([ $ROSSI_GIRO -gt 0 ] && echo rosso || echo verde)" "rosso"
  node "$AQUI/accogli-pacchetto.mjs" scarica "$NUOVO" "$PK/prova_v03_pieno.json" "$U/mut_$1.scarica.json" >/dev/null 2>&1
  ko=$((ko-ROSSI_GIRO)); ok=$((ok+ROSSI_GIRO)) # i rossi del mutante sono l'esito atteso: non contano come rossi della prova
}
mutante work_nature definizione-pacchetto.mjs 'work_nature: f.naturaLavoro, ' '' "-"
mutante capacity_share definizione-pacchetto.mjs '{ capacity_share: a.quotaCapacita }' '{}' "-"
mutante nature_commessa definizione-pacchetto.mjs 'description: it(x.descrizione), nature: x.natura }' 'description: it(x.descrizione) }' "-"
mutante null_esplicito definizione-pacchetto.mjs 'md: md(nul(o, ["padre", "capabilityCodice"]))' 'md: undefined' "-"
mutante used_by_model definizione-pacchetto.mjs 'used_by_model: x.usataDalModello' 'used_by_model: undefined' "-"
mutante stato_perimetro definizione-pacchetto.mjs 'perimeter_status: voci > 0 ? "DICHIARATO" : "NON_RILASCIATO"' 'perimeter_status: "NON_RILASCIATO"' "-"
mutante conta_decide regole-di-ritorno.mjs "FILTER (WHERE r.blueprint_content_decision_right_right = 'DECIDE')" "FILTER (WHERE false)" "0,0,3/1/1,1,3"

echo "[prova-o2-02] ok=$ok rossi=$ko copie=$NUOVO,$VEC esiti in $U"
[ "$ko" -eq 0 ]
