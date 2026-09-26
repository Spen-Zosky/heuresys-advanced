/**
 * #252 — IL PONTE DI APPROVAZIONE UMANA SI AGGANCIA ANCHE ALLE LETTURE (ADR-0040 R2).
 *
 * Oltre la soglia alta di persone distinte (`#251`) una lettura non è più `READ_AUTO_ALLOW`: si
 * ferma e chiede, con lo stesso `canUseTool` e lo stesso evento `approval_required` delle
 * scritture. **Non è un tetto**: chi conferma legge tutto il suo tenant (I22), e l'assenso vale
 * per il resto della conversazione (D5).
 *
 * ⭐ PERCHÉ UN FILE A PARTE E NON UN `describe` IN `write-gate.test.ts`. Lì l'helper `gate()`
 * inietta un contatore **sotto soglia** per non far inciampare le prove che misurano altro
 * (allowlist, classificazione, diario). Un freno si prova senza quella comodità: qui ogni prova
 * costruisce il proprio lettore, e il caso «contatore assente» — che in `write-gate.test.ts`
 * sarebbe invisibile per costruzione — è una prova come le altre.
 *
 * Ogni ramo ha il suo gemello opposto, perché i rami che contano sono quelli in cui il gate NON
 * sa (soglie illeggibili, contatore guasto, contatore assente): un freno cieco che si legge come
 * verde è il difetto vero di questo perimetro.
 */
import { describe, it, expect, vi } from "vitest";
import { makeCanUseTool } from "../src/write-gate.js";
import { MemoryAuditSink } from "../src/audit-sink.js";
import { ContatorePersone, type LettoreContatore } from "../src/persone-distinte.js";
import type { LivelloPersone, Soglie } from "../src/soglie-persone.js";

/** Le soglie di RTL Bank al 2026-09-26, DICHIARATE: il file generato cambia, queste prove no. */
const SOGLIE: Soglie = {
  bassa: 25,
  alta: 40,
  provenienza: { tenant: "PROVA", misuratoIl: "2026-09-26" },
};

/** Un lettore che dichiara numero e livello: prova i rami senza costruire risposte JSON. */
function lettore(quante: number, livello: LivelloPersone): LettoreContatore {
  return { conta: () => quante, livello: () => livello };
}

function gate(
  approve: Parameters<typeof makeCanUseTool>[0],
  opts: Parameters<typeof makeCanUseTool>[1] = {},
) {
  const audit = new MemoryAuditSink();
  const canUseTool = makeCanUseTool(approve, { audit, ...opts });
  return { canUseTool, audit };
}

const LETTURA = "hrx_positions_list";

describe("#252 — la lettura sotto soglia non disturba nessuno", () => {
  it("livello silenzioso: passa da sé, READ_AUTO_ALLOW come è sempre stato", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const { canUseTool, audit } = gate(approve, { persone: lettore(7, "silenzioso") });
    const d = await canUseTool(LETTURA, { limit: 10 });
    expect(d).toEqual({ behavior: "allow", updatedInput: { limit: 10 } });
    expect(approve).not.toHaveBeenCalled();
    expect(audit.entries.at(-1)?.reason).toBe("READ_AUTO_ALLOW");
  });

  it("livello dichiarato (fra le due soglie): passa, e il diario porta il numero", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const { canUseTool, audit } = gate(approve, { persone: lettore(38, "dichiarato") });
    expect((await canUseTool(LETTURA, {})).behavior).toBe("allow");
    expect(approve).not.toHaveBeenCalled();
    expect(audit.entries.at(-1)?.reason).toBe("READ_AUTO_ALLOW");
    expect(audit.entries.at(-1)?.personeDistinte).toBe(38);
    expect(audit.entries.at(-1)?.livelloPersone).toBe("dichiarato");
  });
});

describe("#252 — oltre la soglia alta la lettura si ferma e chiede", () => {
  it("l'umano che consente la fa passare", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const { canUseTool, audit } = gate(approve, { persone: lettore(55, "confermato") });
    const d = await canUseTool(LETTURA, { limit: 100 });
    expect(d.behavior).toBe("allow");
    expect(approve).toHaveBeenCalledOnce();
    expect(audit.entries.at(-1)?.reason).toBe("READ_OVER_THRESHOLD_APPROVED");
  });

  it("l'umano che nega la ferma, e il messaggio dice che NON è un divieto di permessi", async () => {
    const approve = vi.fn().mockResolvedValue(false);
    const { canUseTool, audit } = gate(approve, { persone: lettore(55, "confermato") });
    const d = await canUseTool(LETTURA, { limit: 100 });
    expect(d.behavior).toBe("deny");
    if (d.behavior === "deny") {
      expect(d.message).toMatch(/threshold/i);
      // Senza questa metà il modello riferirebbe «non ho i permessi», che è falso (I22).
      expect(d.message).toMatch(/not a permission denial/i);
    }
    expect(audit.entries.at(-1)?.reason).toBe("READ_OVER_THRESHOLD_DENIED");
  });

  it("TIMEOUT dell'approvatore: si nega (fail-closed, come per le scritture)", async () => {
    const approve = vi.fn(() => new Promise<boolean>(() => {})); // non risolve mai
    const { canUseTool, audit } = gate(approve, {
      persone: lettore(55, "confermato"),
      approvalTimeoutMs: 20,
    });
    const d = await canUseTool(LETTURA, {});
    expect(d.behavior).toBe("deny");
    expect(audit.entries.at(-1)?.reason).toBe("READ_OVER_THRESHOLD_DENIED");
  });

  it("l'approvatore che ALZA: si nega, non si lascia passare", async () => {
    const approve = vi.fn(async () => {
      throw new Error("ponte rotto");
    });
    const { canUseTool } = gate(approve, { persone: lettore(55, "confermato") });
    expect((await canUseTool(LETTURA, {})).behavior).toBe("deny");
  });
});

describe("#252 — che cosa arriva all'umano nel payload", () => {
  it("una LETTURA: la classe, quante persone, quale livello — e nessun dato di persona", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const { canUseTool } = gate(approve, { persone: lettore(55, "confermato") });
    await canUseTool(LETTURA, { limit: 100 });
    expect(approve).toHaveBeenCalledWith({
      tool: LETTURA,
      input: { limit: 100 },
      classe: "read",
      personeDistinte: 55,
      livello: "confermato",
    });
  });

  it("anche una SCRITTURA porta il numero: la conferma dice sempre su quante persone", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const { canUseTool } = gate(approve, { persone: lettore(7, "silenzioso") });
    await canUseTool("hrx_positions_upsert", { payload: {} });
    expect(approve).toHaveBeenCalledWith({
      tool: "hrx_positions_upsert",
      input: { payload: {} },
      classe: "write",
      personeDistinte: 7,
      livello: "silenzioso",
    });
  });
});

describe("#252 — D5: l'assenso vale per la conversazione, il diniego per la chiamata", () => {
  it("dopo un assenso le letture successive non ri-chiedono (I22), e il diario lo dice", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const { canUseTool, audit } = gate(approve, { persone: lettore(55, "confermato") });
    expect((await canUseTool(LETTURA, { a: 1 })).behavior).toBe("allow");
    expect((await canUseTool(LETTURA, { a: 2 })).behavior).toBe("allow");
    expect((await canUseTool("hrx_org_units_list", {})).behavior).toBe("allow");
    expect(approve).toHaveBeenCalledOnce(); // UNA volta, non tre
    expect(audit.entries.map((e) => e.reason)).toEqual([
      "READ_OVER_THRESHOLD_APPROVED",
      "READ_OVER_THRESHOLD_CONSENTED",
      "READ_OVER_THRESHOLD_CONSENTED",
    ]);
  });

  it("il DINIEGO non si ricorda: un timeout non sigilla la conversazione", async () => {
    const approve = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { canUseTool } = gate(approve, { persone: lettore(55, "confermato") });
    expect((await canUseTool(LETTURA, { a: 1 })).behavior).toBe("deny");
    expect((await canUseTool(LETTURA, { a: 2 })).behavior).toBe("allow");
    expect(approve).toHaveBeenCalledTimes(2);
  });

  it("D6 — due letture CONCORRENTI oltre soglia interpellano il ponte UNA volta sola", async () => {
    let risolvi: ((ok: boolean) => void) | undefined;
    const approve = vi.fn(
      () =>
        new Promise<boolean>((r) => {
          risolvi = r;
        }),
    );
    const { canUseTool } = gate(approve, { persone: lettore(55, "confermato") });
    const a = canUseTool(LETTURA, { a: 1 });
    const b = canUseTool(LETTURA, { a: 2 });
    await new Promise((r) => setTimeout(r, 5));
    expect(approve).toHaveBeenCalledOnce();
    risolvi?.(true);
    expect((await a).behavior).toBe("allow");
    expect((await b).behavior).toBe("allow");
  });
});

describe("#252 — i casi in cui il gate NON sa: si chiede, non si passa", () => {
  it("D2 — livello `non-misurato` (soglie illeggibili) vale come oltre la soglia", async () => {
    const approve = vi.fn().mockResolvedValue(false);
    const { canUseTool, audit } = gate(approve, { persone: lettore(3, "non-misurato") });
    expect((await canUseTool(LETTURA, {})).behavior).toBe("deny");
    expect(approve).toHaveBeenCalledOnce();
    expect(audit.entries.at(-1)?.reason).toBe("READ_OVER_THRESHOLD_DENIED");
  });

  it("D7 — contatore ASSENTE: il gate non ha guardato, quindi chiede", async () => {
    const approve = vi.fn().mockResolvedValue(false);
    const { canUseTool, audit } = gate(approve); // NESSUN `persone`
    expect((await canUseTool(LETTURA, {})).behavior).toBe("deny");
    expect(approve).toHaveBeenCalledOnce();
    expect(audit.entries.at(-1)?.reason).toBe("READ_OVER_THRESHOLD_DENIED");
  });

  it("D4 — un contatore GUASTO che alza non fa esplodere il gate: chiede", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const rotto: LettoreContatore = {
      conta: () => {
        throw new Error("contatore rotto");
      },
      livello: () => {
        throw new Error("contatore rotto");
      },
    };
    const { canUseTool, audit } = gate(approve, { persone: rotto });
    expect((await canUseTool(LETTURA, {})).behavior).toBe("allow");
    expect(approve).toHaveBeenCalledOnce();
    expect(audit.entries.at(-1)?.reason).toBe("READ_OVER_THRESHOLD_APPROVED");
  });
});

describe("#252 — la catena vera, e l'ordine dei cancelli", () => {
  it("un contatore alimentato da risposte VERE porta il gate a fermarsi da sé", async () => {
    // Nessun livello dichiarato a mano: si contano persone da un JSON, con le soglie 25/40. La
    // prima lettura passa (il conto è ancora zero), la seconda no — perché il contatore si
    // aggiorna DOPO la risposta. È il verso in cui il freno funziona davvero, ed è la ragione
    // per cui la prova live deve indurre almeno DUE letture.
    const contatore = new ContatorePersone(SOGLIE);
    const approve = vi.fn().mockResolvedValue(false);
    const { canUseTool, audit } = gate(approve, { persone: contatore });

    expect((await canUseTool(LETTURA, { limit: 100 })).behavior).toBe("allow");
    contatore.aggiungi({
      items: Array.from({ length: 41 }, (_, i) => ({
        userId: `0000${(i + 10).toString().padStart(4, "0")}-0000-4000-8000-000000000000`,
      })),
    });
    expect(contatore.conta()).toBe(41);
    expect(contatore.livello()).toBe("confermato");

    expect((await canUseTool(LETTURA, { limit: 100 })).behavior).toBe("deny");
    expect(approve).toHaveBeenCalledOnce();
    expect(audit.entries.map((e) => e.reason)).toEqual([
      "READ_AUTO_ALLOW",
      "READ_OVER_THRESHOLD_DENIED",
    ]);
    // Il diario porta il numero al MOMENTO della decisione, non un totale finale.
    expect(audit.entries.at(-1)?.personeDistinte).toBe(41);
    expect(audit.entries.at(-1)?.livelloPersone).toBe("confermato");
  });

  it("l'allowlist viene PRIMA della soglia: una lettura non elencata è negata senza chiedere", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const { canUseTool, audit } = gate(approve, {
      persone: lettore(55, "confermato"),
      allowlist: new Set<string>(),
    });
    expect((await canUseTool(LETTURA, {})).behavior).toBe("deny");
    expect(approve).not.toHaveBeenCalled();
    expect(audit.entries.at(-1)?.reason).toBe("TOOL_NOT_ALLOWLISTED");
  });

  it("un'operazione NON RISOLTA resta negata senza chiedere: l'ignoto non passa dal ponte", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    const { canUseTool, audit } = gate(approve, { persone: lettore(55, "confermato") });
    const d = await canUseTool("hrx_entity_query", { conceptId: "users", operationId: "get" });
    expect(d.behavior).toBe("deny");
    expect(approve).not.toHaveBeenCalled();
    expect(audit.entries.at(-1)?.reason).toBe("OPERATION_UNRESOLVED");
  });
});
