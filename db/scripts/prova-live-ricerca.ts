/**
 * db/scripts/prova-live-ricerca.ts — #132 F4h, la dimostrazione LIVE.
 *
 * Fa una corsa VERA su una versione di fascicolo VERA, leggendo pagine web VERE e chiedendo
 * le proposte al gateway sull'abbonamento. Scrive nel database di produzione, ed e' voluto:
 * una corsa di ricerca e' materiale legittimo del fascicolo, e senza scrittura non ci sarebbe
 * niente da mostrare (ADR-0026: un solo ambiente, prod-grade).
 *
 *   RESEARCH_GATEWAY_URL=http://localhost:8790 RESEARCH_GATEWAY_TOKEN=<segreto> \
 *     pnpm --filter @heuresys/api exec tsx ../../db/scripts/prova-live-ricerca.ts [dominio]
 *
 * Non stampa mai il segreto. Stampa cio' che serve a giudicare: le domande poste, gli
 * indirizzi aperti con la loro impronta, le proposte con lo stato e le regole che le hanno
 * giudicate.
 */
import { pool, closePool } from "../../apps/api/src/db/client.js";
import { researchService } from "../../apps/api/src/modules/research/service.js";
import { sorgenteGatewayDaAmbiente } from "../../apps/api/src/modules/research/sorgenti/gateway.js";
import type { ActorContext } from "../../apps/api/src/lib/actor.js";

const DOMINIO = process.argv[2] ?? "research_sources";

async function main(): Promise<void> {
  const sorgente = sorgenteGatewayDaAmbiente();
  if (!sorgente) {
    console.error("RESEARCH_GATEWAY_URL / RESEARCH_GATEWAY_TOKEN non configurati: non c'e' chi propone.");
    process.exitCode = 2;
    return;
  }

  const { rows } = await pool.query<{ v: string; codice: string; n: number }>(
    `SELECT v.tenant_blueprint_version_id AS v, b.tenant_blueprint_code AS codice,
            v.tenant_blueprint_version_number AS n
       FROM sys.sys_tenant_blueprints b
       JOIN sys.sys_tenant_blueprint_versions v ON v.tenant_blueprint_version_blueprint_id = b.tenant_blueprint_id
      WHERE v.tenant_blueprint_version_industry_class_id IS NOT NULL
        AND v.tenant_blueprint_version_operating_model_id IS NOT NULL
        AND v.tenant_blueprint_version_employee_count >= 1
      ORDER BY v.created_at LIMIT 1`,
  );
  const v = rows[0];
  if (!v) throw new Error("nessuna versione di fascicolo coi sei parametri della ricerca");

  const { rows: attori } = await pool.query<{ id: string; email: string }>(
    `SELECT u.user_id AS id, u.user_email AS email
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
      ORDER BY u.created_at LIMIT 1`,
  );
  const a = attori[0];
  if (!a) throw new Error("nessun PLATFORM_ADMIN attivo");

  const attore: ActorContext = { userId: a.id, tenantId: null, roles: ["PLATFORM_ADMIN"] };

  console.log(`fascicolo   ${v.codice} v${v.n}`);
  console.log(`attore      ${a.email}`);
  console.log(`dominio     ${DOMINIO}`);
  console.log(`fornitore   ${sorgente.chiave}\n`);

  const corsa = await researchService.avvia(attore, v.v, DOMINIO, { sorgente });

  console.log(`corsa       ${corsa.code}  [${corsa.stato}]`);
  console.log(`domande     ${corsa.domande.length}`);
  for (const d of corsa.domande) console.log(`   · ${d}`);
  console.log(`pagine      lette ${corsa.pagineLette} · non aperte ${corsa.pagineNegate}`);
  console.log(
    `proposte    ${corsa.proposteTotali} totali · ${corsa.propostePassate} passate · ` +
      `${corsa.proposteConAvviso} con avviso · ${corsa.proposteRespinte} respinte\n`,
  );

  const { items } = await researchService.proposte(attore, corsa.runId);
  for (const p of items) {
    console.log(`── ${p.chiaveNaturale}  [${p.stato}]`);
    console.log(`   contenuto  ${JSON.stringify(p.contenuto).slice(0, 220)}`);
    for (const e of p.evidenze) console.log(`   fonte      ${e.url}  sha256=${(e.sha256 ?? "").slice(0, 16)}…  letta ${e.retrievedAt}`);
    for (const c of p.controlli) {
      const m = c.messaggio ? ` — ${c.messaggio.slice(0, 140)}` : "";
      console.log(`   ${c.esito.padEnd(7)} ${c.regola}${m}`);
    }
    console.log("");
  }

  console.log(`corsa ${corsa.runId} · consultabile con GET /v1/seed-acquisition-runs/${corsa.runId}/candidates`);
}

main()
  .catch((e) => {
    console.error("PROVA LIVE FALLITA:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closePool());
