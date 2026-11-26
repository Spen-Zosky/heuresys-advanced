import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CONCETTI_CON_SCHEDA, concettoRiferito, csvDa, fase, messaggiDaRighe, nomeLeggibile, riepilogoProposta, tsvDa } from "./messaggi";

const r = (id: number, kind: string, text: string) => ({ id, kind, text });

describe("messaggiDaRighe", () => {
  it("domanda e risposta; gli strumenti e i comandi della pagina non diventano messaggi", () => {
    const m = messaggiDaRighe([
      r(1, "prompt", "Quante unità?"),
      r(2, "tool", "hrx_org_units_list"),
      r(3, "page_command", "filtra → ok"),
      r(4, "message", "Sono **42**."),
      r(5, "message", "| a | b |\n|---|---|\n| 1 | 2 |"),
      r(6, "done", "{}"),
    ]);
    expect(m.map((x) => x.ruolo)).toEqual(["persona", "assistente"]);
    expect(m[1]?.testo).toBe("Sono **42**.\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(JSON.stringify(m)).not.toContain("hrx_");
  });

  it("il rifiuto prende il posto della risposta di quella domanda, non delle precedenti", () => {
    const m = messaggiDaRighe([
      r(1, "prompt", "prima"),
      r(2, "message", "risposta uno"),
      r(3, "prompt", "stipendi di tutti?"),
      r(4, "message", "Non posso leggere…"),
      r(5, "rifiuto", "Non hai le autorizzazioni necessarie."),
    ]);
    expect(m.map((x) => x.testo)).toEqual(["prima", "risposta uno", "stipendi di tutti?", "Non hai le autorizzazioni necessarie."]);
    expect(m[3]?.rifiuto).toBe(true);
  });

  it("errori e limiti sono avvisi, senza testo tecnico", () => {
    const m = messaggiDaRighe([r(1, "prompt", "x"), r(2, "error", '{"message":"boom"}'), r(3, "limit", '{"limite":"DURATA"}')]);
    expect(m.slice(1)).toEqual([
      { id: 2, ruolo: "avviso", testo: "errore" },
      { id: 3, ruolo: "avviso", testo: "limite" },
    ]);
  });
});

describe("fase", () => {
  it("dice consulta, scrive o pensa dall'ultima riga utile", () => {
    expect(fase([r(1, "prompt", "x")])).toBe("pensa");
    expect(fase([r(1, "prompt", "x"), r(2, "tool", "t")])).toBe("consulta");
    expect(fase([r(1, "prompt", "x"), r(2, "tool", "t"), r(3, "message", "y")])).toBe("scrive");
  });
});

describe("csvDa e tsvDa", () => {
  it("CSV con «;» e virgolette solo dove servono", () => {
    expect(csvDa([["Nome", "Nota"], ["Rossi, Mario", 'dice "sì"; poi']])).toBe('Nome;Nota\r\nRossi, Mario;"dice ""sì""; poi"');
  });
  it("TSV senza tabulazioni o a capo dentro le celle", () => {
    expect(tsvDa([["a\tb", "c\nd"]])).toBe("a b\tc d");
  });
  it("una cella che sembra una formula non si esegue; i numeri restano numeri", () => {
    expect(csvDa([["=HYPERLINK(\"x\")", "+1+1", "@SUM(A1)", "-12,5", "42"]])).toBe('"\'=HYPERLINK(""x"")";\'+1+1;\'@SUM(A1);-12,5;42');
    expect(tsvDa([["=1+1"]])).toBe("'=1+1");
  });
});

describe("riepilogoProposta", () => {
  it("strumento con nome: concetto, aggiornare se c'è l'id, i campi del contenuto senza l'id", () => {
    const r = riepilogoProposta("mcp__heuresys__hrx_kpi_defs_upsert", {
      id: "0b7a6c1e-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
      payload: { description: "Nuova descrizione", ownerUserId: "1b7a6c1e-1f2a-4b3c-8d4e-5f6a7b8c9d0e", isActive: true },
    });
    expect(r).toEqual({
      azione: "aggiorna",
      concetto: "kpi-definitions",
      id: "0b7a6c1e-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
      campi: [
        { campo: "description", valore: "Nuova descrizione" },
        { campo: "ownerUserId", valore: "1b7a6c1e-1f2a-4b3c-8d4e-5f6a7b8c9d0e", riferimento: "users", identificativo: true },
        { campo: "isActive", valore: "true" },
      ],
    });
    expect(riepilogoProposta("hrx_positions_upsert", { payload: { title: "Analista" } }).azione).toBe("crea");
    expect(riepilogoProposta("hrx_org_units_delete", { id: "u1" })).toMatchObject({ azione: "elimina", concetto: "organization-units", id: "u1", campi: [] });
  });

  it("catalogo generico (F1): concetto, azione dal prefisso dell'operazione, id dai parametri", () => {
    const r = riepilogoProposta("mcp__heuresys__hrx_entity_query", {
      conceptId: "goals",
      operationId: "patch_by_id",
      params: { id: "g1" },
      body: { title: "Ridurre i tempi", parentGoalId: "2b7a6c1e-1f2a-4b3c-8d4e-5f6a7b8c9d0e" },
    });
    expect(r).toEqual({
      azione: "aggiorna",
      concetto: "goals",
      id: "g1",
      campi: [
        { campo: "title", valore: "Ridurre i tempi" },
        { campo: "parentGoalId", valore: "2b7a6c1e-1f2a-4b3c-8d4e-5f6a7b8c9d0e", riferimento: "goals", identificativo: true },
      ],
    });
    expect(riepilogoProposta("hrx_entity_query", { conceptId: "goals", operationId: "post", body: {} }).azione).toBe("crea");
    expect(riepilogoProposta("hrx_entity_query", { conceptId: "positions", operationId: "delete_by_id", params: { id: "p" } }).azione).toBe("elimina");
    expect(riepilogoProposta("hrx_entity_query", { conceptId: "approvals", operationId: "post_by_id_approve", params: { id: "a" } }).azione).toBe("altro");
  });
});

describe("nomeLeggibile", () => {
  it("persona «Cognome, Nome»; oggetto con nome e codice; niente nome, niente testo", () => {
    expect(nomeLeggibile({ firstName: "Valentina", lastName: "Conti", displayName: "Valentina Conti" })).toBe("Conti, Valentina");
    expect(nomeLeggibile({ name: "Tempo medio di istruttoria", code: "TJB-M003" })).toBe("Tempo medio di istruttoria (TJB-M003)");
    expect(nomeLeggibile({ data: { title: "Analista" } })).toBe("Analista");
    expect(nomeLeggibile({ id: "x" })).toBeNull();
    expect(nomeLeggibile(null)).toBeNull();
  });
});

/**
 * La classe intera, non il caso visto: ogni concetto con scritture nella mappa dell'agente e ogni
 * campo dei corpi delle scritture ha l'etichetta in italiano e in inglese, e i concetti di cui la
 * finestra chiede il nome hanno davvero la scheda `GET /:id`. Un concetto o un campo nuovi senza
 * etichetta rendono rossa questa prova, invece di comparire alla persona col nome del contratto.
 */
describe("scheda di conferma: etichette per tutta la mappa", () => {
  const RADICE = path.resolve(__dirname, "..", "..", "..", "..", "..");
  const leggi = <T>(p: string) => JSON.parse(fs.readFileSync(path.join(RADICE, p), "utf8")) as T;
  type Operazione = { method: string; path: string };
  const mappa = leggi<{ concepts: Record<string, { base: string; operations: Record<string, Operazione> }> }>("docs/kb/atlas/agent-operations.json").concepts;
  const corpi = leggi<{ corpi: Record<string, Record<string, { body: unknown }>> }>("docs/kb/atlas/agent-write-bodies.json").corpi;
  const lingue = ["it", "en"].map((l) => [l, leggi<{ agente: { concetti: Record<string, string>; campi: Record<string, string> } }>(`apps/web/src/locales/${l}/common.json`).agente] as const);

  it("ogni concetto con scritture ha il nome nelle due lingue", () => {
    const conScritture = Object.entries(mappa).filter(([, c]) => Object.values(c.operations).some((o) => o.method !== "GET")).map(([k]) => k);
    expect(conScritture.length).toBeGreaterThan(50);
    for (const [l, a] of lingue) expect(conScritture.filter((k) => !a.concetti[k]?.trim()), l).toEqual([]);
  });

  it("ogni campo dei corpi delle scritture ha l'etichetta nelle due lingue", () => {
    const campi = new Set<string>();
    const visita = (s: unknown) => {
      if (s === null || typeof s !== "object") return;
      const o = s as Record<string, unknown>;
      for (const [k, v] of Object.entries((o.properties as Record<string, unknown>) ?? {})) {
        campi.add(k);
        visita(v);
      }
      for (const k of ["items", "anyOf", "oneOf", "allOf", "additionalProperties"]) {
        const x = o[k];
        if (Array.isArray(x)) x.forEach(visita);
        else visita(x);
      }
    };
    for (const ops of Object.values(corpi)) for (const op of Object.values(ops)) visita(op.body);
    expect(campi.size).toBeGreaterThan(200);
    for (const [l, a] of lingue) expect([...campi].filter((k) => !a.campi[k]?.trim()), l).toEqual([]);
  });

  it("i concetti di cui la finestra legge il nome hanno la scheda GET /:id con la base uguale al concetto", () => {
    for (const c of CONCETTI_CON_SCHEDA) {
      const voce = mappa[c];
      expect(voce?.base, c).toBe(`/${c}`);
      expect(Object.values(voce?.operations ?? {}).some((o) => o.method === "GET" && o.path === "/:id"), c).toBe(true);
    }
    for (const campo of ["userId", "ownerUserId", "positionId", "reportsToPositionId", "organizationUnitId", "kpiId", "jobRoleId", "skillId"]) {
      const c = concettoRiferito(campo);
      expect(c && CONCETTI_CON_SCHEDA.has(c), campo).toBe(true);
    }
  });
});
