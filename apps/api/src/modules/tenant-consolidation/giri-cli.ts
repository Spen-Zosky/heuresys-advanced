/**
 * apps/api/src/modules/tenant-consolidation/giri-cli.ts — i giri avviati dalla piattaforma.
 *
 *   pnpm --filter @heuresys/api consolidation:run -- --tenant <codice|uuid> [--trigger RILASCIO]
 *
 * In una piattaforma agentica l'agente non aspetta che una persona prema un bottone per
 * cominciare: quando arriva un rilascio o una versione nuova del prototipo, la piattaforma
 * apre la sessione e fa i giri del gruppo aperto da sé. Ciò che resta della persona è la
 * decisione (specifica §6): questo comando scrive soltanto il registro del consolidamento
 * (sessione, giri, copia di lavoro, proposte) e non tocca nessun dato del tenant.
 *
 * Nessuna autenticazione e nessun utente, come gli altri comandi di questa cartella
 * (`approvals/sla-cli.ts`): chi avvia è la piattaforma, e la sessione lo dice con
 * `started_by` nullo. Il tenant si indica per codice o identificativo; la versione del
 * prototipo è quella attiva per il tenant; il giudice è quello dell'ambiente
 * (`CONSOLIDATION_GATEWAY_URL`/`_TOKEN`). Se una sessione è già aperta la riprende: lancia i
 * giri del suo gruppo aperto, invece di aprirne una seconda.
 */
import { pool } from "../../db/client.js";
import {
  CONSOLIDATION_GROUP_VALUES,
  ConsolidationTriggerSchema,
  type ConsolidationTrigger,
  type TenantConsolidation,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { eseguiGiri } from "./service.js";
import { giudiceDaAmbiente } from "./giudice.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function argomento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function tenantDa(valore: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    UUID.test(valore)
      ? `SELECT tenant_id AS id FROM sys.sys_tenants WHERE tenant_id = $1`
      : `SELECT tenant_id AS id FROM sys.sys_tenants WHERE tenant_code = $1`,
    [valore],
  );
  if (!rows[0]) throw new Error(`tenant non trovato: ${valore}`);
  return rows[0].id;
}

export async function runConsolidationCli(): Promise<Record<string, unknown>> {
  const quale = argomento("tenant");
  if (!quale) throw new Error("manca --tenant <codice|uuid>");
  const trigger: ConsolidationTrigger = ConsolidationTriggerSchema.parse(argomento("trigger") ?? "RICHIESTA");
  const giudice = giudiceDaAmbiente();
  if (!giudice) throw new Error("CONSOLIDATION_GATEWAY_URL o CONSOLIDATION_GATEWAY_TOKEN non configurati");

  const tenantId = await tenantDa(quale);
  const aperte = (await repo.listConsolidations(pool, tenantId)).filter((s) => s.status === "GIRI");
  let s: TenantConsolidation | null = aperte[0] ?? null;
  if (!s) {
    const versione = await repo.activeVariantVersion(pool, tenantId);
    if (!versione) throw new Error("il tenant non ha una versione del prototipo attiva");
    s = await repo.createConsolidation(pool, tenantId, {
      variantVersionId: versione, trigger, userId: null, openGroup: CONSOLIDATION_GROUP_VALUES[0],
    });
    if (!s) throw new Error("una sessione è già aperta in un altro stato: niente da avviare");
  }
  const group = s.openGroup;
  if (!group) throw new Error("la sessione non ha un gruppo aperto");
  if (!(await repo.claimRun(pool, tenantId, s.consolidationId, group))) {
    throw new Error("un giro di questa sessione è già in corso");
  }
  // Qui si aspetta: il comando finisce quando il registro è scritto, buono o no.
  await eseguiGiri(tenantId, s, group, giudice);
  const dopo = await repo.getConsolidation(pool, tenantId, s.consolidationId);
  const esito = { cli: "consolidation-run", consolidationId: s.consolidationId, group, lastRun: dopo?.lastRun ?? null };
  console.log(JSON.stringify(esito));
  if (!dopo?.lastRun?.ok) throw new Error(`giro non riuscito: ${dopo?.lastRun?.error ?? "sconosciuto"}`);
  return esito;
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("giri-cli.ts") || invoked.endsWith("giri-cli.js")) {
  runConsolidationCli()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("consolidation-run CLI FAILED:", err instanceof Error ? err.message : err);
      void pool.end().finally(() => process.exit(1));
    });
}
