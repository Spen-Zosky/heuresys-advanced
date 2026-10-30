#!/usr/bin/env bash
# db/scripts/pacchetto/prova-c3.sh — consolidamento C3: il ricevimento di una consegna del datastore, su copie usa-e-getta.
#
# Uso:  bash db/scripts/pacchetto/prova-c3.sh <env_del_cluster_usa_e_getta> <database_sorgente> <etichetta> <N> <cartella_uscita>
#
# Come prova-c3a.sh: il cluster e' quello di prova (rifiuta la 5432), il sorgente non si tocca, le copie si chiamano
# heuresys_c3_<etichetta>_prova<N>, heuresys_c3_<etichetta>_carica_prova<N> e heuresys_c3_<etichetta>_guardia<N>, devono non esistere e NON vengono cancellate.
# Il pacchetto e' quello di prova della consegna (contratto/consegna/pacchetto_di_prova_v03.json); i manifesti li scrive lo script.
#
# Che cosa prova, sulla sola copia:
#   0. la catena (con la 000460) sulla copia appena fatta;
#   1. prima consegna (versione 1): CARICATO, una riga nel registro, nessuna definizione di indicatore senza tenant;
#   2. la rilettura del pacchetto ricevuto ha esattamente le differenze del caricamento di sempre (`carica`, su una terza copia):
#      il ricevimento non toglie fedelta'. Le differenze del pacchetto di prova, che e' rado, sono R-59;
#   3. la stessa consegna di nuovo: GIA_PRESENTE, zero righe nuove nel modello, una riga in piu' nel registro;
#   4. manifesto alterato (impronta cambiata): rifiutato senza scrivere niente, registro compreso;
#   5. versione 2 dello stesso prototipo: CARICATO come versione successiva della stessa variante (dal 2026-10-30, C4 e R-58;
#      prima era RIFIUTATO perche' i processi erano unici per variante);
#   6. la versione 1 con un contenuto diverso: RIFIUTATO, scrive solo la riga del registro;
#   7. guardia: su un database che non e' una copia di prova, senza --produzione rifiuta prima di collegarsi; con --produzione carica;
#   8. la catena una seconda volta sulla copia: verde, e le righe del modello non cambiano.
set -uo pipefail
ENV_SRC="${1:?env del cluster usa-e-getta}"; SRC="${2:?database sorgente}"; ET="${3:?etichetta}"; N="${4:?N}"; OUT="${5:?cartella di uscita}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RADICE="$(cd "$AQUI/../../.." && pwd)"
COPIA="heuresys_c3_${ET}_prova${N}"; GUARDIA="heuresys_c3_${ET}_guardia${N}"; CARICA="heuresys_c3_${ET}_carica_prova${N}"
mkdir -p "$OUT"
set -a; . "$ENV_SRC"; set +a
[ "${POSTGRES_PORT:-}" != 5432 ] || { echo "rifiuto: la 5432 e' la produzione" >&2; exit 2; }
export PGHOST="$POSTGRES_HOST" PGPORT="$POSTGRES_PORT" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD"
P=(psql -X -At -v ON_ERROR_STOP=1)
for d in "$COPIA" "$GUARDIA" "$CARICA"; do
  [ "$("${P[@]}" -d postgres -c "select count(*) from pg_database where datname='$d'")" = 0 ] \
    || { echo "la copia $d c'e' gia': scegli un altro N (niente si cancella)" >&2; exit 2; }
done
[ -d "$HOME/.nvm/versions/node" ] && export PATH="$(ls -d "$HOME"/.nvm/versions/node/v22*/bin | tail -1):$PATH"
nuova_copia() { # $1 nome, $2 modello: createdb -T non copia i permessi, e la 000340 pretende il CONNECT di chi nomina
  createdb -T "$2" "$1" || exit 2
  for r in gov_worker codex_auditor; do
    [ "$("${P[@]}" -d postgres -c "select count(*) from pg_roles where rolname='$r'")" = 1 ] && "${P[@]}" -d postgres -c "GRANT CONNECT ON DATABASE \"$1\" TO $r" >/dev/null
  done
}
nuova_copia "$COPIA" "$SRC"
ENVT="$OUT/copia.env"; grep -v '^POSTGRES_DB=' "$ENV_SRC" > "$ENVT"; echo "POSTGRES_DB=$COPIA" >> "$ENVT"; chmod 600 "$ENVT"
echo "[prova-c3] copia $COPIA da $SRC, ramo $(git -C "$RADICE" rev-parse --short HEAD 2>/dev/null || echo '?'), esiti in $OUT"

ok=0; ko=0
esito() { if [ "$2" = "$3" ]; then echo "  OK    $1"; ok=$((ok+1)); else echo "  ROSSO $1: atteso [$3] letto [$2]"; ko=$((ko+1)); fi; }
catena() { bash "$RADICE/db/scripts/migrate.sh" "$ENVT" > "$OUT/$1.out" 2>&1; local rc=$?
  [ $rc = 0 ] || grep -m1 -E 'ERROR|EXCEPTION' "$OUT/$1.out" | sed 's/^/        /'; return $rc; }
modello() { "${P[@]}" -d "${1:-$COPIA}" -c "select string_agg(format('%s=%s', relname, n), ' ' order by relname) from (
  select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from sys.%I', c.relname), false, true, '')))[1]::text as n
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'sys' and c.relkind = 'r' and c.relname like 'sys_blueprint%' and c.relname <> 'sys_blueprint_content_receipts') x"; }
registro() { "${P[@]}" -d "${1:-$COPIA}" -c "select count(*) from sys.sys_blueprint_content_receipts"; }
senza_tenant() { "${P[@]}" -d "${1:-$COPIA}" -c "select count(*) from sys.sys_kpi_definitions where kpi_definition_tenant_id is null"; }
campo() { node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const v=process.argv[2].split(".").reduce((a,k)=>a?.[k],j); console.log(v ?? "")' "$1" "$2"; }
ACC=(node "$AQUI/accogli-pacchetto.mjs")

# le consegne: A (versione 1), B (versione 2, contenuto cambiato), C (versione 1 con il contenuto di B), X (A con l'impronta alterata)
node --input-type=module - "$AQUI" "$OUT" <<'JS' || { echo "consegne non scritte" >&2; exit 2; }
import fs from "node:fs"; import path from "node:path";
const [AQUI, OUT] = process.argv.slice(2);
const { improntaJson, ALGORITMO } = await import(path.join(AQUI, "manifesto-consegna.mjs"));
const P = JSON.parse(fs.readFileSync(path.join(AQUI, "contratto", "consegna", "pacchetto_di_prova_v03.json"), "utf8"));
const P2 = structuredClone(P); P2.contesto.descrizione.it += " (seconda consegna)";
const man = (p, versione) => ({ schema: "heuresys.fascicolo.consegna/1", prototipo: p.meta.prototipoId, versione, contratto: p.meta.schema,
  impronta: { algoritmo: ALGORITMO, valore: improntaJson(p) }, fascicoloVersione: p.perimetro?.fascicoloVersione ?? null,
  edizioni: [{ schema: "ESCO_OCC", edizione: "1.2.1" }], correlazione: "0b5a3c1e-7d2f-4a8b-9c3d-2e1f0a9b8c7d",
  consegnatoIl: "2026-10-29T20:00:00.000Z", consegnatoDa: "Amministratore di Sistema", file: "pacchetto.json" });
const scrivi = (nome, m, p) => { const d = path.join(OUT, nome); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "manifesto.json"), JSON.stringify(m)); fs.writeFileSync(path.join(d, "pacchetto.json"), JSON.stringify(p)); };
scrivi("consegna_A", man(P, 1), P);
scrivi("consegna_B", man(P2, 2), P2);
scrivi("consegna_C", man(P2, 1), P2);
const x = man(P, 1); x.impronta.valore = x.impronta.valore.slice(0, -1) + (x.impronta.valore.endsWith("0") ? "1" : "0");
scrivi("consegna_X", x, P);
JS

catena 0_catena; esito "0. catena sulla copia appena fatta (con la 000460)" "$?" 0
KPI0="$(senza_tenant)"

"${ACC[@]}" ricevi "$COPIA" "$OUT/consegna_A" "$OUT/1_ricevi.json" > "$OUT/1_ricevi.out" 2>&1
esito "1. prima consegna: esce 0" "$?" 0
esito "1. prima consegna: CARICATO" "$(campo "$OUT/1_ricevi.json" ricevimento)" CARICATO
esito "1. una riga nel registro" "$(registro)" 1
esito "1. nessuna definizione di indicatore senza tenant in piu'" "$(senza_tenant)" "$KPI0"

"${ACC[@]}" rileggi "$COPIA" "$OUT/consegna_A/pacchetto.json" "$OUT/2_rileggi.json" > "$OUT/2_rileggi.out" 2>&1
nuova_copia "$CARICA" "$SRC"
ENVC="$OUT/carica.env"; grep -v '^POSTGRES_DB=' "$ENV_SRC" > "$ENVC"; echo "POSTGRES_DB=$CARICA" >> "$ENVC"; chmod 600 "$ENVC"
bash "$RADICE/db/scripts/migrate.sh" "$ENVC" > "$OUT/2_catena_carica.out" 2>&1; esito "2. catena sulla copia del caricamento di sempre" "$?" 0
"${ACC[@]}" carica "$CARICA" "$OUT/consegna_A/pacchetto.json" "$OUT/2_carica.json" > "$OUT/2_carica.out" 2>&1; esito "2. il caricamento di sempre carica" "$?" 0
"${ACC[@]}" rileggi "$CARICA" "$OUT/consegna_A/pacchetto.json" "$OUT/2_rileggi_carica.json" > "$OUT/2_rileggi_carica.out" 2>&1
percorsi() { node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log((j.differenze??[]).map((d)=>`${d.percorso}:${d.persi}:${d.in_piu}`).sort().join(" ")+" uguale="+j.pacchetto_ricostruito_uguale)' "$1"; }
esito "2. la rilettura dopo il ricevimento ha le stesse differenze del caricamento di sempre" "$(percorsi "$OUT/2_rileggi.json")" "$(percorsi "$OUT/2_rileggi_carica.json")"
echo "        differenze della rilettura (R-59 se non vuote): $(percorsi "$OUT/2_rileggi.json")"

M1="$(modello)"
"${ACC[@]}" ricevi "$COPIA" "$OUT/consegna_A" "$OUT/3_ricevi.json" > "$OUT/3_ricevi.out" 2>&1
esito "3. stessa consegna: esce 0" "$?" 0
esito "3. stessa consegna: GIA_PRESENTE" "$(campo "$OUT/3_ricevi.json" ricevimento)" GIA_PRESENTE
esito "3. zero righe nuove nel modello" "$([ "$(modello)" = "$M1" ] && echo uguali || echo diverse)" uguali
esito "3. una riga in piu' nel registro" "$(registro)" 2

"${ACC[@]}" ricevi "$COPIA" "$OUT/consegna_X" "$OUT/4_ricevi.json" > "$OUT/4_ricevi.out" 2>&1
esito "4. manifesto alterato: esce 1" "$?" 1
esito "4. manifesto alterato: NON_VERIFICATO" "$(campo "$OUT/4_ricevi.json" ricevimento)" NON_VERIFICATO
esito "4. niente scritto nel modello" "$([ "$(modello)" = "$M1" ] && echo uguali || echo diverse)" uguali
esito "4. niente scritto nel registro" "$(registro)" 2

"${ACC[@]}" ricevi "$COPIA" "$OUT/consegna_B" "$OUT/5_ricevi.json" > "$OUT/5_ricevi.out" 2>&1
esito "5. versione 2 del pacchetto: esce 0" "$?" 0
esito "5. versione 2: CARICATO (C4, R-58)" "$(campo "$OUT/5_ricevi.json" ricevimento)" CARICATO
esito "5. versione 2: e' la versione 3 della stessa variante" "$(campo "$OUT/5_ricevi.json" numero_di_versione)" 3
esito "5. una riga in piu' nel registro" "$(registro)" 3

M5="$(modello)"
"${ACC[@]}" ricevi "$COPIA" "$OUT/consegna_C" "$OUT/6_ricevi.json" > "$OUT/6_ricevi.out" 2>&1
esito "6. versione 1 con un altro contenuto: esce 1" "$?" 1
esito "6. RIFIUTATO" "$(campo "$OUT/6_ricevi.json" ricevimento)" RIFIUTATO
esito "6. niente scritto nel modello" "$([ "$(modello)" = "$M5" ] && echo uguali || echo diverse)" uguali
esito "6. solo la riga del registro" "$(registro)" 4
esito "6. gli esiti del registro, in ordine" "$("${P[@]}" -d "$COPIA" -c "select string_agg(blueprint_content_receipt_outcome, ',' order by blueprint_content_receipt_received_at, blueprint_content_receipt_id) from sys.sys_blueprint_content_receipts")" "CARICATO,GIA_PRESENTE,CARICATO,RIFIUTATO"

# la guardia: una copia del database PRIMA dei caricamenti, con un nome che non e' di prova
nuova_copia "$GUARDIA" "$SRC"
ENVG="$OUT/guardia.env"; grep -v '^POSTGRES_DB=' "$ENV_SRC" > "$ENVG"; echo "POSTGRES_DB=$GUARDIA" >> "$ENVG"; chmod 600 "$ENVG"
bash "$RADICE/db/scripts/migrate.sh" "$ENVG" > "$OUT/7_catena.out" 2>&1; esito "7. catena sulla copia della guardia" "$?" 0
"${ACC[@]}" ricevi "$GUARDIA" "$OUT/consegna_A" "$OUT/7_senza.json" > "$OUT/7_senza.out" 2>&1
esito "7. fuori dalle copie di prova, senza --produzione: rifiuta" "$([ $? != 0 ] && echo rifiuta || echo carica)" rifiuta
esito "7. ... e non scrive niente" "$(registro "$GUARDIA")" 0
"${ACC[@]}" ricevi "$GUARDIA" "$OUT/consegna_A" "$OUT/7_con.json" --produzione > "$OUT/7_con.out" 2>&1
esito "7. con --produzione e il manifesto verificato: carica" "$(campo "$OUT/7_con.json" ricevimento)" CARICATO

M8="$(modello)"
catena 8_catena; esito "8. catena una seconda volta, dopo i ricevimenti" "$?" 0
esito "8. righe del modello invariate" "$([ "$(modello)" = "$M8" ] && echo uguali || echo diverse)" uguali

echo "[prova-c3] $ok OK, $ko ROSSI — copie $COPIA, $CARICA e $GUARDIA lasciate sul cluster (si tolgono a mano, quando non servono piu')"
[ "$ko" = 0 ]
