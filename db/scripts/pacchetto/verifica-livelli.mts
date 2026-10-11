/**
 * db/scripts/pacchetto/verifica-livelli.mts — il principio gerarchia-livelli (#265) su una copia: l'organigramma di un tenant misurato
 * con l'ordine dei livelli del contratto collettivo di un modello caricato. Sola lettura.
 * Uso: PGHOST=… PGUSER=… PGPASSWORD=… tsx db/scripts/pacchetto/verifica-livelli.mts <database> <versioneId> <codiceTenant> <uscita.json>
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import * as repo from "../../../apps/api/src/modules/hierarchy-levels/repository.js";
import { verifica } from "../../../apps/api/src/modules/hierarchy-levels/logic.js";

const pg = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/api/package.json"))("pg");
const [DB, VERSIONE, TENANT, OUT] = process.argv.slice(2);
if (!DB || !VERSIONE || !TENANT || !OUT) throw new Error("uso: <database> <versioneId> <codiceTenant> <uscita.json>");
const pool = new pg.Pool({ host: process.env["PGHOST"] ?? "localhost", port: Number(process.env["PGPORT"] ?? 5432), user: process.env["PGUSER"] ?? "postgres", database: DB, options: "-c default_transaction_read_only=on" });
try {
  const t = await pool.query("SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = $1", [TENANT]);
  if (!t.rows[0]) throw new Error(`tenant ${TENANT} non trovato`);
  const scala = await repo.scalaDaVersioni(pool, [VERSIONE]);
  const unita = await repo.unitaDelTenant(pool, t.rows[0].tenant_id);
  const r = verifica(unita, scala);
  const livelliDichiarati = new Map<string, number>();
  for (const u of unita) for (const p of [...(u.responsabile ? [u.responsabile] : []), ...u.persone]) livelliDichiarati.set(p.livello ?? "(assente)", (livelliDichiarati.get(p.livello ?? "(assente)") ?? 0) + 1);
  const esito = { database: DB, tenant: TENANT, scala: scala.ordine, unitaControllate: unita.length, avvisi: r.avvisi.length, elencoAvvisi: r.avvisi, nonValutabili: r.nonValutabili, livelliNelTenant: Object.fromEntries(livelliDichiarati) };
  fs.writeFileSync(OUT, JSON.stringify(esito, null, 1));
  console.log(JSON.stringify({ ...esito, elencoAvvisi: esito.elencoAvvisi.slice(0, 5), nonValutabili: esito.nonValutabili.length }, null, 1));
} finally {
  await pool.end();
}
