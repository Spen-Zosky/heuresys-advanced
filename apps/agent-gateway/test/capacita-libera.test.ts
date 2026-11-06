/**
 * ADR-0053 A3, piano dei principi agentici voce T3b: il cancello per classe, modo e tetto.
 *
 * Una scrittura passa senza ponte di approvazione SOLO se è di classe B, se il registro dice che per
 * il tenant della persona una capacità `LIBERA` la contiene, e sotto il tetto della conversazione.
 * Ogni altro caso torna davanti alla persona, come prima.
 */
import { describe, it, expect, vi } from "vitest";
import { makeCanUseTool } from "../src/write-gate.js";
import { MemoryAuditSink } from "../src/audit-sink.js";
import { DbRegistroCapacita, ContatoreVolume, type CapacitaLibera, type RegistroCapacita } from "../src/capacita.js";
import type { Operazione } from "../src/operazione.js";

const LIBERA: CapacitaLibera = { code: "struttura.unita", version: 1, volumeCap: 2 };

/** Un registro che libera solo le operazioni dichiarate, e ricorda le domande ricevute. */
function registro(risposta: (op: Operazione) => CapacitaLibera | undefined | Error) {
  const domande: Array<{ agentCode: string; tenantCode: string; op: Operazione }> = [];
  const r: RegistroCapacita = {
    async liberaPer(agentCode, tenantCode, op) {
      domande.push({ agentCode, tenantCode, op });
      const x = risposta(op);
      if (x instanceof Error) throw x;
      return x;
    },
  };
  return { r, domande };
}

function gate(reg: RegistroCapacita | undefined, tenant: string | null = "RTL_BANK") {
  const audit = new MemoryAuditSink();
  const approve = vi.fn(async () => false);
  const canUseTool = makeCanUseTool(approve, {
    audit,
    persone: { conta: () => 0, livello: () => "silenzioso" },
    principal: { principal: "user", subject: "u-1", ...(tenant ? { tenant } : {}) },
    ...(reg ? { capacita: { registro: reg, agentCode: "assistente-hr" } } : {}),
  });
  return { canUseTool, approve, audit };
}

const ragioni = (a: MemoryAuditSink) => a.entries.map((e) => e.reason);

describe("cancello per classe, modo e tetto (ADR-0053 A3)", () => {
  it("una scrittura B di una capacità LIBERA passa senza chiedere, e il diario dice quale capacità", async () => {
    const { r, domande } = registro(() => LIBERA);
    const { canUseTool, approve, audit } = gate(r);
    const d = await canUseTool("hrx_org_units_upsert", { payload: { name: "x" } });
    expect(d.behavior).toBe("allow");
    expect(approve).not.toHaveBeenCalled();
    expect(ragioni(audit)).toEqual(["WRITE_CAPABILITY_LIBERA struttura.unita@1"]);
    expect(domande[0]).toEqual({
      agentCode: "assistente-hr",
      tenantCode: "RTL_BANK",
      op: { conceptId: "organization-units", operationId: "post", method: "POST" },
    });
  });

  it("oltre il tetto della conversazione si ferma e chiede alla persona", async () => {
    const { r } = registro(() => LIBERA);
    const { canUseTool, approve, audit } = gate(r);
    await canUseTool("hrx_org_units_upsert", { payload: {} });
    await canUseTool("hrx_org_units_upsert", { id: "a", payload: {} });
    const terza = await canUseTool("hrx_org_units_upsert", { payload: {} });
    expect(terza.behavior).toBe("deny"); // la persona (finta) nega
    expect(approve).toHaveBeenCalledTimes(1);
    expect(ragioni(audit)[2]).toBe("WRITE_DENIED_OR_TIMEOUT OVER_VOLUME_CAP struttura.unita@1");
  });

  it("una cancellazione (classe C) non passa mai da sola, anche se il registro la dichiarasse libera", async () => {
    const { r, domande } = registro(() => LIBERA);
    const { canUseTool, approve } = gate(r);
    const d = await canUseTool("hrx_org_units_delete", { id: "a" });
    expect(d.behavior).toBe("deny");
    expect(approve).toHaveBeenCalledTimes(1);
    expect(domande).toEqual([]); // la C non arriva nemmeno a chiedere al registro
  });

  it("l'interruttore vale dalla chiamata successiva: tornata a CONFERMA, la scrittura torna al ponte", async () => {
    let libera = true;
    const { r } = registro(() => (libera ? LIBERA : undefined));
    const { canUseTool, approve } = gate(r);
    expect((await canUseTool("hrx_org_units_upsert", { payload: {} })).behavior).toBe("allow");
    libera = false; // il Direttore HR riporta la capacità a CONFERMA
    expect((await canUseTool("hrx_org_units_upsert", { payload: {} })).behavior).toBe("deny");
    expect(approve).toHaveBeenCalledTimes(1);
  });

  it("registro guasto, registro assente o tenant ignoto: si chiede alla persona, non si esegue", async () => {
    for (const g of [
      gate(registro(() => new Error("connessione persa")).r),
      gate(undefined),
      gate(registro(() => LIBERA).r, null),
    ]) {
      const d = await g.canUseTool("hrx_org_units_upsert", { payload: {} });
      expect(d.behavior).toBe("deny");
      expect(g.approve).toHaveBeenCalledTimes(1);
    }
  });

  it("un'operazione che il registro non libera va al ponte come sempre", async () => {
    const { r } = registro((op) => (op.conceptId === "positions" ? LIBERA : undefined));
    const { canUseTool, approve } = gate(r);
    expect((await canUseTool("hrx_org_units_upsert", { payload: {} })).behavior).toBe("deny");
    expect((await canUseTool("hrx_positions_upsert", { payload: {} })).behavior).toBe("allow");
    expect(approve).toHaveBeenCalledTimes(1);
  });
});

describe("ContatoreVolume", () => {
  it("conta per capacità e versione", () => {
    const c = new ContatoreVolume();
    expect(c.prenota(LIBERA)).toBe(true);
    expect(c.prenota(LIBERA)).toBe(true);
    expect(c.prenota(LIBERA)).toBe(false);
    expect(c.prenota({ ...LIBERA, version: 2 })).toBe(true);
    expect(c.usateDa(LIBERA)).toBe(2);
  });
});

describe("DbRegistroCapacita", () => {
  const op: Operazione = { conceptId: "organization-units", operationId: "patch_by_id", method: "patch" };

  it("passa i parametri nell'ordine della query e legge la riga", async () => {
    const query = vi.fn(async () => ({ rows: [{ code: "struttura.unita", version: 3, volume_cap: "10" }] }));
    const r = new DbRegistroCapacita({ query });
    await expect(r.liberaPer("assistente-hr", "RTL_BANK", op)).resolves.toEqual({
      code: "struttura.unita", version: 3, volumeCap: 10,
    });
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(params).toEqual(["RTL_BANK", "assistente-hr", "organization-units", "patch_by_id", "PATCH"]);
    expect(sql).toContain("'LIBERA'");
    expect(sql).toContain("'PUBBLICATA'");
    expect(sql).toContain("action_class = 'B'");
  });

  it("nessuna riga, o una riga senza tetto valido, non libera niente", async () => {
    for (const rows of [[], [{ code: "x", version: 1, volume_cap: 0 }], [{ code: 7, version: 1, volume_cap: 1 }]]) {
      const r = new DbRegistroCapacita({ query: async () => ({ rows }) });
      await expect(r.liberaPer("a", "T", op)).resolves.toBeUndefined();
    }
  });
});
