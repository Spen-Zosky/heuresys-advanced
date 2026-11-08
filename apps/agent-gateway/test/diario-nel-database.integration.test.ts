/**
 * Piano interfacce, lotto L10 — A-12: il diario dell'agente nel database.
 *
 * Con un database configurato (`POSTGRES_HOST`, come il servizio del gateway) una conversazione
 * scrive le sue decisioni e la chiusura in `audit.agent_gateway_decisions`, e la vista
 * `sys.v_agente_persone_per_conversazione` la mostra con la persona e il tenant che il gettone
 * dell'agente porta (A-1). Tutto dentro una transazione annullata alla fine: la prova non lascia
 * righe.
 *
 * Senza `POSTGRES_HOST` (la CI dei test unitari del gateway) la prova si salta e lo dice: il
 * gateway, lì, scrive sul file per scelta (#253).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { DbAuditSink, registraChiusuraConversazione } from "../src/audit-sink.js";
import { auditPool, closeAuditPool } from "../src/db-pool.js";

/**
 * Solo su un database di collaudo, dichiarato per nome: mai sulla produzione (D-08). Il runner
 * della CI sta sull'host della produzione e porta POSTGRES_DB=heuresys_advanced; un database
 * non dichiarato vale come produzione (è il valore predefinito di `db-pool.ts`).
 */
const nomeDb = process.env.POSTGRES_DB ?? "";
const conDatabase =
  Boolean(process.env.POSTGRES_HOST) &&
  nomeDb !== "heuresys_advanced" &&
  /^heuresys_(ci|rehearsal_.+|prova_.+|test_.+|collaudo_.+)$/.test(nomeDb);

describe.skipIf(!conDatabase)("A-12 — il diario dell'agente nel database", () => {
  let client: pg.PoolClient;

  beforeAll(async () => {
    client = await auditPool()!.connect();
    await client.query("BEGIN");
  });

  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    await closeAuditPool();
  });

  it("una conversazione chiusa compare nella vista con la persona, il tenant e il totale di persone", async () => {
    const conversazione = randomUUID();
    const persona = randomUUID();
    const sink = new DbAuditSink(client);
    const who = { principal: "user" as const, subject: persona, tenant: "RTL_BANK", conversationId: conversazione };

    await sink.record({
      conversationId: conversazione,
      who: { principal: "user", subject: persona },
      tenant: "RTL_BANK",
      tool: "hrx_positions_list",
      args: { unitId: "u-1" },
      personeDistinte: 0,
      livelloPersone: "silenzioso",
      decision: "allow",
      reason: "READ_ALLOWED",
    });
    await registraChiusuraConversazione(sink, who, { conta: () => 7, livello: () => "silenzioso" });

    const vista = await client.query<{ persone_distinte: number; livello_persone: string; tenant: string }>(
      `SELECT persone_distinte, livello_persone, tenant
         FROM sys.v_agente_persone_per_conversazione WHERE conversazione = $1`,
      [conversazione],
    );
    expect(vista.rows).toEqual([{ persone_distinte: 7, livello_persone: "silenzioso", tenant: "RTL_BANK" }]);

    const diario = await client.query<{ principal_subject: string; tool: string }>(
      `SELECT principal_subject, tool FROM audit.agent_gateway_decisions
        WHERE conversation_id = $1 ORDER BY decision_id`,
      [conversazione],
    );
    expect(diario.rows.map((r) => r.tool)).toEqual(["hrx_positions_list", "(conversazione)"]);
    expect(diario.rows.every((r) => r.principal_subject === persona)).toBe(true);
  });

  it("T5 (000482): la scrittura autonoma porta capacità, versione e per conto di chi; senza, il database la rifiuta", async () => {
    const conversazione = randomUUID();
    const persona = randomUUID();
    const sink = new DbAuditSink(client);
    const base = {
      conversationId: conversazione,
      who: { principal: "user" as const, subject: persona },
      tenant: "RTL_BANK",
      tool: "hrx_org_units_upsert",
      args: { payload: { name: "x" } },
      decision: "allow" as const,
      reason: "WRITE_CAPABILITY_LIBERA struttura.unita@1",
      outcome: "allow-write-autonomous" as const,
      actionClass: "B" as const,
      capability: { code: "struttura.unita", version: 1 },
    };
    await sink.record({ ...base, onBehalfOf: persona });
    const riga = await client.query(
      `SELECT outcome, action_class, capability_code, capability_version, on_behalf_of
         FROM audit.agent_gateway_decisions WHERE conversation_id = $1`,
      [conversazione],
    );
    expect(riga.rows).toEqual([{
      outcome: "allow-write-autonomous", action_class: "B", capability_code: "struttura.unita",
      capability_version: 1, on_behalf_of: persona,
    }]);

    await client.query("SAVEPOINT senza_per_conto_di");
    const rifiuto = await sink.record(base).then(() => "accettata", (e: { code?: string }) => e.code);
    await client.query("ROLLBACK TO SAVEPOINT senza_per_conto_di");
    expect(rifiuto).toBe("23514");

    const sentinella = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM sys.v_agente_scritture_senza_per_conto_di WHERE conversation_id = $1`,
      [conversazione],
    );
    expect(sentinella.rows[0]!.n).toBe("0");
  });
});
