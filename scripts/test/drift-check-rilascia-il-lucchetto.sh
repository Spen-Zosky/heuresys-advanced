#!/usr/bin/env bash
# scripts/test/drift-check-rilascia-il-lucchetto.sh
#
# Prova che l'assert di drift NON blocchi la suite successiva quando scatta.
#
# PERCHE' ESISTE
# --------------
# `drift-check.ts` e `suite-lock.ts` sono due `globalSetup` della stessa suite, e i loro
# teardown girano in sequenza, in ordine inverso all'array: prima `drift-check`, poi
# `suite-lock`. Su Vitest 4.1.10 quella sequenza NON e' protetta per elemento — il primo
# teardown che lancia salta tutti quelli dopo di se'. Finche' `drift-check` chiudeva con
# un `throw`, il rilascio di `.zp/suite.lock` non avveniva **proprio quando il drift
# scattava**, cioe' nell'unico caso per cui quel codice esiste: la corsa successiva
# trovava il lucchetto occupato dal PID di un processo finito.
#
# Il difetto era invisibile alla suite d'integrazione, che non arriva mai al livello dei
# globalSetup. Serve una corsa vera, ed e' questo lo script.
#
# COSA FA, E PERCHE' COSI'
# ------------------------
# Monta una suite minima con i globalSetup REALI e un test che lascia una riga dietro di
# se' esattamente come `inbox-stream.integration.test.ts:113` — un `Client` fuori dal pool,
# che committa e sfugge all'isolamento transazionale di D-52. Poi verifica DUE cose che
# devono valere insieme, e che una sola non basta a dimostrare:
#
#   1. la corsa esce **1** (il rilevatore asserisce davvero: un teardown che lancia viene
#      stampato come «error during close ...» e il processo uscirebbe 0);
#   2. il lucchetto **non c'e' piu'** (la catena dei teardown e' arrivata in fondo).
#
# SCRIVE SUL DATABASE, e lo fa con le quattro cose che il metodo di bonifica impone:
# misura prima, guardia rivalutata al momento dell'esecuzione, post-condizione che
# protegge anche cio' che NON doveva cambiare, e rollback esplicito per soggetto esatto —
# mai un carattere jolly. Il lucchetto di prova vive in una cartella temporanea via
# SUITE_LOCK_FILE: questa prova non tocca `.zp/suite.lock` della macchina.
#
#   bash scripts/test/drift-check-rilascia-il-lucchetto.sh
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$REPO/apps/api"
TMP="$API/.tmp-drift-lock-prova"
SOGGETTO="IT_SSE_PROVA_RILASCIO_LUCCHETTO"
esito=0

psqlq() { psql -h "${PGHOST:-localhost}" -p "${PGPORT:-5433}" -U "${PGUSER:-heuresys}" \
                -d "${PGDATABASE:-heuresys_advanced}" -tA -c "$1"; }

pulisci() { rm -rf "$TMP"; }
trap pulisci EXIT

echo "== guardia: il soggetto di prova non deve gia' esistere =="
gia="$(psqlq "SELECT count(*) FROM sys.sys_inbox_notifications WHERE notification_subject = '$SOGGETTO';")" || {
  echo "FERMO: il database non risponde. La prova non e' eseguibile (non e' un verde)."; exit 2; }
if [ "$gia" != "0" ]; then
  echo "FERMO: esistono gia' $gia righe con soggetto '$SOGGETTO'. Non le tocco."; exit 2
fi

# La riga di prova ha bisogno di una coppia tenant/utente vera: la si prende dal database
# invece di inciderla qui, cosi' la prova non invecchia quando i dati cambiano.
rif="$(psqlq "SELECT notification_tenant_id || '|' || notification_user_id FROM sys.sys_inbox_notifications LIMIT 1;")"
if [ -z "$rif" ]; then echo "FERMO: nessuna notifica da cui derivare tenant/utente."; exit 2; fi
TENANT="${rif%%|*}"; UTENTE="${rif##*|}"

echo "== misura prima =="
notifiche_prima="$(psqlq "SELECT count(*) FROM sys.sys_inbox_notifications;")"
giugno_prima="$(psqlq "SELECT (SELECT count(*) FROM sys.sys_content_documents WHERE document_title LIKE 'ZZZ Link E2E%')
                            + (SELECT count(*) FROM sys.sys_content_versions  WHERE version_title  LIKE 'ZZZ Link E2E%');")"
echo "   notifiche=$notifiche_prima  residui-di-giugno=$giugno_prima"

mkdir -p "$TMP"
cat > "$TMP/scrive.test.ts" <<EOF
import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { expect, it } from "vitest";

it("lascia una riga dietro di se', come un cleanup saltato", async () => {
  dotenvConfig({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
  const c = new pg.Client({
    host: process.env["POSTGRES_HOST"], port: Number(process.env["POSTGRES_PORT"] ?? 5432),
    database: process.env["POSTGRES_DB"], user: process.env["POSTGRES_USER"],
    password: process.env["POSTGRES_PASSWORD"],
  });
  await c.connect();
  await c.query(
    \`INSERT INTO sys.sys_inbox_notifications
       (notification_tenant_id, notification_user_id, notification_type,
        notification_subject, notification_body, notification_priority, notification_status)
     VALUES (\$1, \$2, 'GAP_CLOSURE_DUE', '$SOGGETTO', 'prova del rilascio del lucchetto', 'MEDIUM', 'UNREAD')\`,
    ["$TENANT", "$UTENTE"],
  );
  await c.end();
  expect(true).toBe(true);
});
EOF

cat > "$TMP/probe.config.ts" <<'EOF'
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  test: {
    include: [".tmp-drift-lock-prova/scrive.test.ts"],
    environment: "node",
    fileParallelism: false,
    // I globalSetup REALI, nell'ordine reale di vitest.config.ts.
    globalSetup: ["./test/helpers/suite-lock.ts", "./test/helpers/drift-check.ts"],
  },
});
EOF

export SUITE_LOCK_FILE="$TMP/prova.lock"
rm -f "$SUITE_LOCK_FILE"

echo "== la corsa (il drift scatta per costruzione) =="
( cd "$API" && pnpm exec vitest run --config .tmp-drift-lock-prova/probe.config.ts ) > "$TMP/corsa.log" 2>&1
uscita=$?
grep -E "^\[drift\]|occorrenze in" "$TMP/corsa.log" | sed 's/^/   /'

echo "== rollback: soggetto esatto, nessun jolly =="
psqlq "DELETE FROM sys.sys_inbox_notifications WHERE notification_subject = '$SOGGETTO';" >/dev/null

# --- le asserzioni, tutte, senza fermarsi alla prima rossa ---------------------
if [ "$uscita" -eq 1 ]; then
  echo "OK   la corsa esce 1: il rilevatore asserisce"
else
  echo "ROSSO la corsa esce $uscita invece di 1: il drift non ha fatto fallire niente"; esito=1
fi

if [ -f "$SUITE_LOCK_FILE" ]; then
  echo "ROSSO il lucchetto NON e' stato rilasciato: $(cat "$SUITE_LOCK_FILE" 2>/dev/null | tr '\n' ' ')"; esito=1
else
  echo "OK   il lucchetto e' stato rilasciato: la catena dei teardown e' arrivata in fondo"
fi

if grep -q "sys_inbox_notifications.notification_subject" "$TMP/corsa.log"; then
  echo "OK   il rilevatore ha VISTO la riga (il prefisso IT\\_SSE\\_% la copre)"
else
  echo "ROSSO il rilevatore non ha visto la riga: il prefisso non la copre"; esito=1
fi

notifiche_dopo="$(psqlq "SELECT count(*) FROM sys.sys_inbox_notifications;")"
giugno_dopo="$(psqlq "SELECT (SELECT count(*) FROM sys.sys_content_documents WHERE document_title LIKE 'ZZZ Link E2E%')
                           + (SELECT count(*) FROM sys.sys_content_versions  WHERE version_title  LIKE 'ZZZ Link E2E%');")"
if [ "$notifiche_dopo" = "$notifiche_prima" ]; then
  echo "OK   post-condizione: notifiche tornate a $notifiche_prima"
else
  echo "ROSSO post-condizione: notifiche $notifiche_prima -> $notifiche_dopo, la riga di prova e' rimasta"; esito=1
fi
# Protegge cio' che NON doveva cambiare: i 4 residui di giugno non sono roba di questa prova.
if [ "$giugno_dopo" = "$giugno_prima" ]; then
  echo "OK   post-condizione: i residui di giugno intatti ($giugno_prima)"
else
  echo "ROSSO post-condizione: residui di giugno $giugno_prima -> $giugno_dopo: la prova ha toccato altro"; esito=1
fi

[ "$esito" -eq 0 ] && echo "== VERDE ==" || echo "== ROSSO =="
exit "$esito"
