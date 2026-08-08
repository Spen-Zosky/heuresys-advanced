/**
 * db/scripts/ricostruisci-fascicolo-rtl.ts
 * #131 Tenant Builder P1, T7 — la prova che conta.
 *
 * RTL Bank e' gia' configurata: ha un'attivazione di modello e sette
 * scostamenti, scritti mesi fa. La domanda a cui questo script risponde non e'
 * «il fascicolo funziona?», e' **«il fascicolo sa descrivere l'azienda che
 * esiste gia'?»**. Se la risposta e' no, non e' sbagliata l'azienda: e'
 * sbagliato il fascicolo, e il progetto si ferma qui.
 *
 * Lo script e' IDEMPOTENTE: rieseguirlo non crea un secondo fascicolo e non
 * duplica una decisione. E confronta: esce con codice diverso da zero se anche
 * una sola motivazione differisce di un carattere.
 *
 *   cd apps/api && pnpm exec tsx ../../db/scripts/ricostruisci-fascicolo-rtl.ts
 *
 * Atteso: `23/23 processi, 7/7 decisioni, 0 differenze`.
 */
import { pool } from "../../apps/api/src/db/client.js";

const CODICE_FASCICOLO = "RTL-BANK-CONFIG";
const TENANT = "RTL_BANK";

interface Scostamento {
  processId: string;
  processCode: string;
  inclusion: string;
  rationale: string;
}

function fatale(messaggio: string): never {
  console.error(`\n  ERRORE: ${messaggio}\n`);
  process.exitCode = 1;
  throw new Error(messaggio);
}

async function main(): Promise<void> {
  console.log(`\n=== Fascicolo di ${TENANT} — ricostruzione e confronto ===\n`);

  /* 1. Il reale: azienda, carta d'identita', attivazione, scostamenti. */

  const { rows: tenantRows } = await pool.query<{ id: string; nome: string }>(
    `SELECT tenant_id AS id, tenant_name AS nome FROM sys.sys_tenancies WHERE tenant_code = $1`,
    [TENANT],
  );
  const tenant = tenantRows[0];
  if (!tenant) fatale(`il tenant ${TENANT} non esiste`);

  const { rows: identitaRows } = await pool.query<{
    industry_class_id: string | null;
    size_band_id: string | null;
    operating_model_id: string | null;
    regulatory: string;
    country: string | null;
    employees: number | null;
    revenue: string | null;
  }>(
    `SELECT enterprise_typing_industry_class_id  AS industry_class_id,
            enterprise_typing_size_band_id       AS size_band_id,
            enterprise_typing_operating_model_id AS operating_model_id,
            enterprise_typing_regulatory_intensity AS regulatory,
            enterprise_typing_country_code       AS country,
            enterprise_typing_employee_count     AS employees,
            enterprise_typing_revenue_eur        AS revenue
       FROM sys.sys_enterprise_typing_profiles
      WHERE enterprise_typing_tenant_id = $1`,
    [tenant.id],
  );
  const identita = identitaRows[0];
  if (!identita) fatale(`${TENANT} non ha una carta d'identita' (enterprise typing profile)`);

  const { rows: attivazioneRows } = await pool.query<{
    activation_id: string;
    variant_id: string;
    variant_code: string;
    variant_version_id: string;
    variant_version_number: number;
  }>(
    `SELECT a.blueprint_activation_id       AS activation_id,
            v.blueprint_variant_id          AS variant_id,
            v.blueprint_variant_code        AS variant_code,
            vv.blueprint_variant_version_id AS variant_version_id,
            vv.blueprint_variant_version_number AS variant_version_number
       FROM sys.sys_blueprint_activations a
       JOIN sys.sys_blueprint_variants v ON v.blueprint_variant_id = a.blueprint_activation_variant_id
       JOIN sys.sys_blueprint_variant_versions vv
         ON vv.blueprint_variant_version_variant_id = v.blueprint_variant_id
        AND vv.blueprint_variant_version_status = 'PUBLISHED'
      WHERE a.blueprint_activation_tenant_id = $1
        AND a.blueprint_activation_status = 'ACTIVE'
      ORDER BY vv.blueprint_variant_version_number
      LIMIT 1`,
    [tenant.id],
  );
  const attivazione = attivazioneRows[0];
  if (!attivazione) fatale(`${TENANT} non ha un'attivazione di modello ACTIVE con versione pubblicata`);

  const { rows: scostamenti } = await pool.query<Scostamento>(
    `SELECT o.blueprint_override_process_id AS "processId",
            p.blueprint_process_code        AS "processCode",
            o.blueprint_override_inclusion  AS inclusion,
            COALESCE(o.blueprint_override_rationale, '') AS rationale
       FROM sys.sys_blueprint_overrides o
       JOIN sys.sys_blueprint_process_registry p
         ON p.blueprint_process_id = o.blueprint_override_process_id
      WHERE o.blueprint_override_activation_id = $1
      ORDER BY p.blueprint_process_ordinal`,
    [attivazione.activation_id],
  );

  const senzaMotivazione = scostamenti.filter((s) => s.rationale.trim().length === 0);
  if (senzaMotivazione.length > 0) {
    fatale(
      `${senzaMotivazione.length} scostamenti non hanno motivazione: il fascicolo la pretende ` +
        `(${senzaMotivazione.map((s) => s.processCode).join(", ")})`,
    );
  }

  console.log(`  azienda ................. ${tenant.nome}`);
  console.log(`  modello attivo .......... ${attivazione.variant_code} v${attivazione.variant_version_number}`);
  console.log(`  scostamenti registrati .. ${scostamenti.length}`);

  /* 2. L'attore: chi puo' comporre un fascicolo. */

  const { rows: attoreRows } = await pool.query<{ id: string; email: string }>(
    `SELECT DISTINCT u.user_id AS id, u.user_email AS email
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur
         ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'tenant_blueprint:write' AND u.user_status = 'ACTIVE'
      ORDER BY u.user_email
      LIMIT 1`,
  );
  const attore = attoreRows[0];
  if (!attore) fatale("nessun utente detiene tenant_blueprint:write");

  /* 3. Il fascicolo, idempotente. */

  const client = await pool.connect();
  let blueprintId: string;
  let versionId: string;
  try {
    await client.query("BEGIN");

    const { rows: esistenti } = await client.query<{ id: string }>(
      `SELECT tenant_blueprint_id AS id FROM sys.sys_tenant_blueprints
        WHERE tenant_blueprint_code = $1`,
      [CODICE_FASCICOLO],
    );

    if (esistenti[0]) {
      blueprintId = esistenti[0].id;
      console.log(`\n  fascicolo ............... gia' presente, riuso (${CODICE_FASCICOLO})`);
    } else {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO sys.sys_tenant_blueprints
           (tenant_blueprint_code, tenant_blueprint_name, tenant_blueprint_tenant_id,
            created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING tenant_blueprint_id AS id`,
        [CODICE_FASCICOLO, `Configurazione di ${tenant.nome}`, tenant.id, attore.id],
      );
      blueprintId = rows[0]!.id;
      console.log(`\n  fascicolo ............... creato (${CODICE_FASCICOLO})`);
    }

    const { rows: versioniEsistenti } = await client.query<{ id: string; stato: string }>(
      `SELECT tenant_blueprint_version_id AS id, tenant_blueprint_version_status AS stato
         FROM sys.sys_tenant_blueprint_versions
        WHERE tenant_blueprint_version_blueprint_id = $1 AND tenant_blueprint_version_number = 1`,
      [blueprintId],
    );

    if (versioniEsistenti[0]) {
      versionId = versioniEsistenti[0].id;
      console.log(`  versione 1 .............. gia' presente (${versioniEsistenti[0].stato})`);
    } else {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO sys.sys_tenant_blueprint_versions
           (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number,
            tenant_blueprint_version_status, tenant_blueprint_version_variant_version_id,
            tenant_blueprint_version_industry_class_id, tenant_blueprint_version_size_band_id,
            tenant_blueprint_version_operating_model_id,
            tenant_blueprint_version_regulatory_intensity, tenant_blueprint_version_country_code,
            tenant_blueprint_version_employee_count, tenant_blueprint_version_revenue_eur,
            created_by, updated_by)
         VALUES ($1, 1, 'DRAFT', $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         RETURNING tenant_blueprint_version_id AS id`,
        [
          blueprintId,
          attivazione.variant_version_id,
          identita.industry_class_id,
          identita.size_band_id,
          identita.operating_model_id,
          identita.regulatory,
          identita.country,
          identita.employees,
          identita.revenue,
          attore.id,
        ],
      );
      versionId = rows[0]!.id;
      console.log(`  versione 1 .............. creata, ancorata a v${attivazione.variant_version_number} del modello`);
    }

    await client.query(
      `UPDATE sys.sys_tenant_blueprints
          SET tenant_blueprint_current_version_id = $2, updated_by = $3
        WHERE tenant_blueprint_id = $1 AND tenant_blueprint_current_version_id IS DISTINCT FROM $2`,
      [blueprintId, versionId, attore.id],
    );

    // Le decisioni: una per scostamento, con la motivazione IDENTICA. L'upsert
    // rende la riesecuzione innocua e allinea una motivazione che fosse
    // cambiata nell'attivazione.
    for (const s of scostamenti) {
      await client.query(
        `INSERT INTO sys.sys_tenant_blueprint_process_decisions
           (tenant_blueprint_process_decision_version_id,
            tenant_blueprint_process_decision_process_id,
            tenant_blueprint_process_decision_inclusion,
            tenant_blueprint_process_decision_rationale,
            created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT (tenant_blueprint_process_decision_version_id,
                      tenant_blueprint_process_decision_process_id)
         DO UPDATE SET tenant_blueprint_process_decision_inclusion = EXCLUDED.tenant_blueprint_process_decision_inclusion,
                       tenant_blueprint_process_decision_rationale = EXCLUDED.tenant_blueprint_process_decision_rationale,
                       updated_by = EXCLUDED.updated_by`,
        [versionId, s.processId, s.inclusion, s.rationale, attore.id],
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  /* 4. Il confronto. Qui lo script deve poter fallire. */

  console.log(`\n--- confronto fra il fascicolo e la configurazione reale ---\n`);

  const { rows: processi } = await pool.query<{
    processCode: string;
    fascicolo_inclusion: string | null;
    fascicolo_rationale: string | null;
    reale_inclusion: string | null;
    reale_rationale: string | null;
  }>(
    `SELECT p.blueprint_process_code                        AS "processCode",
            d.tenant_blueprint_process_decision_inclusion   AS fascicolo_inclusion,
            d.tenant_blueprint_process_decision_rationale   AS fascicolo_rationale,
            o.blueprint_override_inclusion                  AS reale_inclusion,
            o.blueprint_override_rationale                  AS reale_rationale
       FROM sys.sys_blueprint_process_registry p
       LEFT JOIN sys.sys_tenant_blueprint_process_decisions d
              ON d.tenant_blueprint_process_decision_process_id = p.blueprint_process_id
             AND d.tenant_blueprint_process_decision_version_id = $1
       LEFT JOIN sys.sys_blueprint_overrides o
              ON o.blueprint_override_process_id = p.blueprint_process_id
             AND o.blueprint_override_activation_id = $2
      WHERE p.blueprint_process_variant_version_id = $3
      ORDER BY p.blueprint_process_ordinal`,
    [versionId, attivazione.activation_id, attivazione.variant_version_id],
  );

  const differenze: string[] = [];
  for (const r of processi) {
    if (r.fascicolo_inclusion !== r.reale_inclusion) {
      differenze.push(
        `${r.processCode}: il fascicolo dice ${r.fascicolo_inclusion ?? "niente"}, la configurazione dice ${r.reale_inclusion ?? "niente"}`,
      );
      continue;
    }
    if ((r.fascicolo_rationale ?? null) !== (r.reale_rationale ?? null)) {
      differenze.push(
        `${r.processCode}: le motivazioni differiscono\n      fascicolo: ${r.fascicolo_rationale}\n      reale:     ${r.reale_rationale}`,
      );
    }
  }

  const decisioniNelFascicolo = processi.filter((r) => r.fascicolo_inclusion !== null).length;

  for (const r of processi) {
    const stato = r.fascicolo_inclusion ?? "come il modello";
    console.log(`  ${r.processCode.padEnd(4)} ${stato}`);
  }

  console.log(
    `\n  ${processi.length}/${processi.length} processi, ` +
      `${decisioniNelFascicolo}/${scostamenti.length} decisioni, ` +
      `${differenze.length} differenze`,
  );

  // Le condizioni che rendono questa prova capace di fallire. Un universo vuoto
  // darebbe zero differenze e sarebbe una verifica cieca: si pretende che i
  // numeri ci siano PRIMA di dichiarare che tornano.
  if (processi.length === 0) fatale("nessun processo nel modello ancorato: la prova sarebbe cieca");
  if (scostamenti.length === 0) fatale("nessuno scostamento da riprodurre: la prova sarebbe cieca");
  if (decisioniNelFascicolo !== scostamenti.length) {
    fatale(
      `il fascicolo porta ${decisioniNelFascicolo} decisioni ma gli scostamenti reali sono ${scostamenti.length}`,
    );
  }
  if (differenze.length > 0) {
    console.error(`\n  DIFFERENZE:\n${differenze.map((d) => `    - ${d}`).join("\n")}`);
    fatale(
      `il fascicolo NON descrive l'azienda che esiste: ${differenze.length} differenze. ` +
        `Il difetto e' del fascicolo, non di questo script.`,
    );
  }

  console.log(`\n  Il fascicolo descrive RTL Bank esattamente com'e' configurata.\n`);
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    await pool.end();
    process.exit(1);
  });
