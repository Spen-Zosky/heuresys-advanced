/**
 * db/scripts/pacchetto/attiva-modello.mts — la giunzione, dal pacchetto caricato al modello attivato (W0-A1).
 *
 * Prende la versione di variante che `accogli-pacchetto.mjs carica` ha scritto e la porta fin dove il
 * codice di advanced la sa portare, su una COPIA usa-e-getta:
 *   1. legge cosa dichiara la versione (stato, chiave di costruzione): con il pacchetto 0.2 il datastore
 *      non porta ancora la variante pubblicata (M4 dell'analisi del 2026-10-04, decisione #264: la produce il
 *      datastore), quindi su una versione DRAFT il passo 2 e' un gesto esplicito dell'operatore
 *      (`--pubblica-sulla-copia`), non una derivazione di advanced;
 *   2. (opzionale) marca la versione PUBLISHED con chiave BLUEPRINT_CONTENT;
 *   3. produce il piano di costruzione (`BlueprintBuildSource.plan()`): e' il rifiuto o l'accettazione del modello;
 *   4. (opzionale, `--costruisci`) costruisce il modello in un tenant nuovo della copia, in una transazione.
 * Scrive il risultato in JSON. Guardia: il database deve finire con _prova<N>.
 *
 * Uso: PGHOST=… PGPORT=… PGUSER=… PGPASSWORD=… tsx db/scripts/pacchetto/attiva-modello.mts <database> <versioneId> <uscita.json>
 *        [--pubblica-sulla-copia] [--costruisci <codice-tenant>]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { BLUEPRINT_CONTENT_KEY, BlueprintBuildSource } from "../../../apps/api/src/modules/tenant-materialization/blueprint-build-source.js";
import { materialize } from "../../../apps/api/src/modules/tenant-materialization/repository.js";

const pg = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/api/package.json"))("pg");
const [DB, VERSIONE, OUT, ...opz] = process.argv.slice(2);
if (!DB || !VERSIONE || !OUT) throw new Error("uso: <database> <versioneId> <uscita.json> [--pubblica-sulla-copia] [--costruisci <codice-tenant>]");
if (!/_prova\d*$/.test(DB)) throw new Error(`rifiuto: ${DB} non e' una copia di prova`);
const pubblica = opz.includes("--pubblica-sulla-copia");
const iCostruisci = opz.indexOf("--costruisci");
const codiceTenant = iCostruisci >= 0 ? opz[iCostruisci + 1] : undefined;
if (iCostruisci >= 0 && !codiceTenant) throw new Error("--costruisci vuole il codice del tenant nuovo");

const pool = new pg.Pool({
  host: process.env["PGHOST"] ?? "localhost",
  port: Number(process.env["PGPORT"] ?? 5432),
  user: process.env["PGUSER"] ?? "postgres",
  database: DB,
  application_name: "attiva_modello",
});
const esito: Record<string, unknown> = { database: DB, versione: VERSIONE, avviato: new Date().toISOString() };

try {
  const v = await pool.query<{ stato: string; chiave: string | null; famiglia: string; variante: string }>(
    `SELECT vv.blueprint_variant_version_status AS stato, vv.blueprint_variant_version_build_source_key AS chiave,
            f.blueprint_family_code AS famiglia, v.blueprint_variant_code AS variante
       FROM sys.sys_blueprint_variant_versions vv
       JOIN sys.sys_blueprint_variants v ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
       JOIN sys.sys_blueprint_families f ON f.blueprint_family_id = v.blueprint_variant_family_id
      WHERE vv.blueprint_variant_version_id = $1`,
    [VERSIONE],
  );
  if (!v.rows[0]) throw new Error("versione non trovata");
  esito["prima"] = v.rows[0];

  if (pubblica) {
    await pool.query(
      `UPDATE sys.sys_blueprint_variant_versions
          SET blueprint_variant_version_status = 'PUBLISHED', blueprint_variant_version_published_at = now(),
              blueprint_variant_version_build_source_key = $2
        WHERE blueprint_variant_version_id = $1`,
      [VERSIONE, BLUEPRINT_CONTENT_KEY],
    );
    esito["pubblicata_sulla_copia"] = true;
  }

  try {
    const piano = await new BlueprintBuildSource(pool as never, VERSIONE).plan();
    esito["piano"] = {
      accettato: true,
      etichetta: piano.label,
      unita: piano.orgUnits.length,
      posizioni: piano.positions.length,
      competenze: piano.skills.length,
      indicatori: piano.kpis.length,
      pesoEconomicoZero: piano.positions.filter((p) => p.economicWeight === 0).length,
    };

    if (codiceTenant) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const t = await client.query<{ tenant_id: string }>(
          `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_industry_code, tenant_status)
           VALUES ($1, $2, 'FIN_BANKING', 'ACTIVE') RETURNING tenant_id`,
          [codiceTenant, `Prova giunzione ${codiceTenant}`],
        );
        const tenantId = t.rows[0]!.tenant_id;
        const costruito = await materialize(client, tenantId, piano, "apply");
        const { records, ...conteggi } = costruito;
        esito["costruzione"] = { tenantId, ...conteggi, righeRegistrate: records.length };
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }
  } catch (e) {
    esito["piano"] = { accettato: false, codice: (e as { code?: string }).code ?? null, motivo: (e as Error).message };
  }
  esito["esito"] = "ok";
} catch (e) {
  esito["esito"] = "errore";
  esito["errore"] = (e as Error).message;
} finally {
  await pool.end();
}
esito["finito"] = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(esito, null, 1));
console.log(JSON.stringify(esito, null, 1));
process.exitCode = esito["esito"] === "ok" ? 0 : 1;
