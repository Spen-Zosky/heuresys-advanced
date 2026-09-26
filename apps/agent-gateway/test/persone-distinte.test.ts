/**
 * #251 F2/F3/F4 — il contatore di persone distinte, provato a ESITI OPPOSTI.
 *
 * Un contatore che non si è mai visto sbagliare non è un freno: è un numero. Quindi ogni
 * proprietà qui ha la sua controprova — il campo che conta e quello che non deve contare, lo
 * stesso identificativo due volte, un valore che non è un UUID, e il sabotaggio dichiarato di
 * F4 (contando anche gli attori di audit il conto CAMBIA, e la prova lo dimostra dal vivo
 * invece di affermarlo).
 */
import { describe, it, expect } from "vitest";
import {
  ATTORI_DI_AUDIT,
  ContatorePersone,
  raccogliPersone,
} from "../src/persone-distinte.js";
import { derivaSoglie } from "../src/soglie-persone.js";
import { HeuresysClient, type FetchLike, type Session } from "../src/heuresys-client.js";
import { MemoryAuditSink, RAGIONE_CHIUSURA, registraChiusuraConversazione } from "../src/audit-sink.js";
import { makeCanUseTool } from "../src/write-gate.js";

const U = (n: number): string => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);
const A = U(1);
const B = U(2);
const C = U(3);

const SOGLIE = derivaSoglie({
  tenantPiuGrande: "RTL_BANK",
  massimoPosizioniPerUnita: 38,
  p90PersonePerCatena: 21.4,
  misuratoIl: "2026-09-14",
});

describe("#251 F2 — quali identificativi contano", () => {
  it("un soggetto conta, un attore di audit NO (gli esiti opposti, nella stessa risposta)", () => {
    const risposta = { items: [{ subjectUserId: A, createdByUserId: B }] };
    expect(raccogliPersone(risposta)).toEqual([A]);
  });

  it("tutti e sei gli attori dichiarati sono esclusi, uno per uno", () => {
    for (const attore of ATTORI_DI_AUDIT) {
      expect(raccogliPersone({ [attore]: A }), `${attore} non dovrebbe contare`).toEqual([]);
    }
    expect(ATTORI_DI_AUDIT.size).toBe(6); // se cresce, la decisione D3 va riaperta, non subita
  });

  it("lo stesso identificativo ripetuto conta UNA volta (è l'insieme che conta, non le righe)", () => {
    const c = new ContatorePersone(SOGLIE);
    c.aggiungi({ items: [{ userId: A }, { userId: A }, { ownerUserId: A }] });
    c.aggiungi({ items: [{ userId: A }] }); // seconda lettura, stessa persona
    expect(c.conta()).toBe(1);
  });

  it("si conta per FORMA del nome: un campo nuovo `coacheeUserId` è contato dal primo giorno", () => {
    expect(raccogliPersone({ coacheeUserId: A })).toEqual([A]);
  });

  it("un nome che NON è di persona non conta, nemmeno se contiene un UUID", () => {
    expect(raccogliPersone({ positionId: A, tenantId: B, id: C })).toEqual([]);
  });

  it("un valore che non è un UUID non conta: `userId: \"me\"` è un segnaposto, non una persona", () => {
    expect(raccogliPersone({ userId: "me" })).toEqual([]);
    expect(raccogliPersone({ userId: "" })).toEqual([]);
    expect(raccogliPersone({ userId: 42 })).toEqual([]);
  });

  it("percorre in profondità e dentro gli array (le risposte di /v1 sono annidate)", () => {
    const risposta = {
      items: [{ posizione: { incumbent: { userId: A } }, delegati: [{ delegateUserId: B }] }],
      meta: { ownerUserId: C },
    };
    expect(new Set(raccogliPersone(risposta))).toEqual(new Set([A, B, C]));
  });

  it("gli identificativi si normalizzano: MAIUSCOLO e minuscolo sono la stessa persona", () => {
    const c = new ContatorePersone(SOGLIE);
    c.aggiungi({ userId: A.toUpperCase() });
    c.aggiungi({ userId: A });
    expect(c.conta()).toBe(1);
  });

  it("una risposta vuota, nulla o primitiva non alza e non conta niente", () => {
    const c = new ContatorePersone(SOGLIE);
    for (const r of [null, undefined, 3, "x", {}, [], { items: [] }]) c.aggiungi(r);
    expect(c.conta()).toBe(0);
    expect(c.eGuasto()).toBe(false);
  });
});

describe("#251 F4 — il sabotaggio dichiarato: l'esclusione porta peso", () => {
  it("contando ANCHE gli attori di audit, lo stesso JSON dà un conto DIVERSO", () => {
    const risposta = { items: [{ subjectUserId: A, createdByUserId: B, actorUserId: C }] };
    // Come è: un soggetto.
    expect(raccogliPersone(risposta)).toEqual([A]);
    // Sabotato: l'elenco delle esclusioni svuotato → tre «persone», due delle quali sono
    // soltanto chi ha toccato la riga. Se questa asserzione fosse uguale alla precedente,
    // l'esclusione non starebbe facendo niente e nessuno se ne accorgerebbe.
    const sabotato = raccogliPersone(risposta, new Set<string>());
    expect(new Set(sabotato)).toEqual(new Set([A, B, C]));
    expect(sabotato.length).toBeGreaterThan(raccogliPersone(risposta).length);
  });

  it("e il sabotaggio cambia il LIVELLO, non solo il numero: è il freno che si sposta", () => {
    // 26 righe, ognuna con un soggetto diverso + lo stesso creatore: soggetti 26 → `dichiarato`.
    const righe = Array.from({ length: 26 }, (_, i) => ({ subjectUserId: U(i + 10), createdByUserId: A }));
    const onesto = new ContatorePersone(SOGLIE);
    onesto.aggiungi({ items: righe });
    expect(onesto.conta()).toBe(26);
    expect(onesto.livello()).toBe("dichiarato");
    // Sabotato, il creatore diventa un soggetto: 27. Il numero cresce, e con popolazioni
    // reali — dove ogni riga porta creatore, revisore ed esecutore — cresce di un fattore.
    expect(raccogliPersone({ items: righe }, new Set<string>()).length).toBeGreaterThan(26);
  });
});

describe("#251 F3 — il livello, e il contatore agganciato al client", () => {
  it("i quattro livelli su un contatore vero, non su una funzione pura", () => {
    const passi: Array<[number, string]> = [
      [1, "silenzioso"],
      [25, "silenzioso"],
      [26, "dichiarato"],
      [40, "dichiarato"],
      [41, "confermato"],
    ];
    for (const [quante, atteso] of passi) {
      const c = new ContatorePersone(SOGLIE);
      c.aggiungi({ items: Array.from({ length: quante }, (_, i) => ({ userId: U(i + 100) })) });
      expect(c.conta()).toBe(quante);
      expect(c.livello(), `${quante} persone`).toBe(atteso);
    }
  });

  it("senza soglie il livello è `non-misurato`, mai `silenzioso` (l'ignoto non è un verde)", () => {
    const c = new ContatorePersone(undefined);
    c.aggiungi({ userId: A });
    expect(c.conta()).toBe(1);
    expect(c.livello()).toBe("non-misurato");
  });

  it("ogni risposta del client alimenta il contatore collegato, una sola volta per chiamata", async () => {
    const fetchImpl: FetchLike = async (url) => ({
      ok: true,
      status: 200,
      json: async () => (url.endsWith("/users") ? { items: [{ userId: A }, { userId: B }] } : { userId: C }),
      text: async () => "",
    });
    const session: Session = { cookieAccess: "ACCESS", cookieCsrf: "CT", csrf: "CT" };
    const client = new HeuresysClient({ baseUrl: "http://api", session, fetchImpl });
    const c = new ContatorePersone(SOGLIE);
    client.collegaContatore(c);
    await client.call("GET", "/users");
    expect(c.conta()).toBe(2);
    await client.call("GET", "/users/x");
    expect(c.conta()).toBe(3);
  });

  it("un client SENZA contatore collegato funziona come prima (nessuna regressione)", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true, status: 200, json: async () => ({ userId: A }), text: async () => "",
    });
    const client = new HeuresysClient({
      baseUrl: "http://api",
      session: { cookieAccess: "A", cookieCsrf: "C", csrf: "C" },
      fetchImpl,
    });
    await expect(client.call("GET", "/users/x")).resolves.toEqual({ userId: A });
  });

  it("un contatore che ALZA non nega la lettura, e si dichiara non misurato", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true, status: 200, json: async () => ({ userId: A }), text: async () => "",
    });
    const client = new HeuresysClient({
      baseUrl: "http://api",
      session: { cookieAccess: "A", cookieCsrf: "C", csrf: "C" },
      fetchImpl,
    });
    client.collegaContatore({ aggiungi: () => { throw new Error("contatore rotto"); } });
    // La lettura passa: contare non è la lettura (D4).
    await expect(client.call("GET", "/users/x")).resolves.toEqual({ userId: A });
  });

  it("il contatore guasto dice `non-misurato`, non un numero rassicurante", () => {
    const c = new ContatorePersone(SOGLIE);
    // Un JSON che fa alzare la raccolta: un riferimento circolare non basta (la visita non
    // ricorre sui già visti per costruzione), quindi si forza con un getter che alza —
    // esattamente ciò che farebbe un oggetto esotico restituito da un `json()` finto.
    const cattivo = { get userId(): string { throw new Error("boom"); } };
    c.aggiungi(cattivo);
    expect(c.eGuasto()).toBe(true);
    expect(c.livello()).toBe("non-misurato");
  });
});

describe("#251 F3 — il diario porta il numero", () => {
  it("ogni decisione del gate scrive persone distinte e livello", async () => {
    const audit = new MemoryAuditSink();
    const c = new ContatorePersone(SOGLIE);
    c.aggiungi({ items: [{ userId: A }, { userId: B }] });
    const canUseTool = makeCanUseTool(async () => true, {
      audit,
      persone: c,
      allowlist: new Set(["mcp__heuresys__hrx_users_list"]),
    });
    await canUseTool("mcp__heuresys__hrx_users_list", {});
    await new Promise((r) => setTimeout(r, 0)); // l'audit è best-effort: `void`, non atteso
    expect(audit.entries[0]!.personeDistinte).toBe(2);
    expect(audit.entries[0]!.livelloPersone).toBe("silenzioso");
  });

  it("SENZA contatore il diario non scrive uno zero: «non misurato» ≠ «nessuna persona»", async () => {
    const audit = new MemoryAuditSink();
    const canUseTool = makeCanUseTool(async () => true, {
      audit,
      allowlist: new Set(["mcp__heuresys__hrx_users_list"]),
    });
    await canUseTool("mcp__heuresys__hrx_users_list", {});
    await new Promise((r) => setTimeout(r, 0));
    expect(audit.entries[0]!.personeDistinte).toBeUndefined();
    expect("personeDistinte" in audit.entries[0]!).toBe(false);
  });

  it("anche una decisione NEGATA porta il numero: serve sapere quanto era stato letto prima", async () => {
    const audit = new MemoryAuditSink();
    const c = new ContatorePersone(SOGLIE);
    c.aggiungi({ items: Array.from({ length: 41 }, (_, i) => ({ userId: U(i + 200) })) });
    const canUseTool = makeCanUseTool(async () => true, { audit, persone: c, allowlist: new Set([]) });
    const d = await canUseTool("mcp__heuresys__hrx_qualunque", {});
    expect(d.behavior).toBe("deny");
    await new Promise((r) => setTimeout(r, 0));
    expect(audit.entries[0]!.personeDistinte).toBe(41);
    expect(audit.entries[0]!.livelloPersone).toBe("confermato");
  });

  it("la voce di CHIUSURA porta il totale finale, che nessuna decisione può portare", async () => {
    const audit = new MemoryAuditSink();
    const c = new ContatorePersone(SOGLIE);
    c.aggiungi({ items: Array.from({ length: 160 }, (_, i) => ({ userId: U(i + 1000) })) });
    await registraChiusuraConversazione(audit, { principal: "user", tenant: "RTL_BANK" }, c);
    const voce = audit.entries.at(-1)!;
    expect(voce.reason).toBe(RAGIONE_CHIUSURA);
    expect(voce.personeDistinte).toBe(160);
    expect(voce.livelloPersone).toBe("confermato");
    expect(voce.tenant).toBe("RTL_BANK");
  });

  it("un diario che alza non fa fallire la chiusura della conversazione", async () => {
    const rotto = { record: async () => { throw new Error("disco pieno"); } };
    const c = new ContatorePersone(SOGLIE);
    await expect(
      registraChiusuraConversazione(rotto, { principal: "user" }, c),
    ).resolves.toBeUndefined();
  });
});
