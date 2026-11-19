/**
 * apps/api/test/faldone.integration.test.ts — il Faldone dell'Utente (la «mega API»).
 *
 * Due cose si provano qui, e la prima conta quanto la seconda:
 *
 *  1. IL CRICCHETTO DEL CATALOGO. Il faldone legge dal database quali tabelle sono legate alla
 *     persona; la classificazione (classe, capitolo, titolo) è scritta a mano in `classi.ts`. Se
 *     nasce una tabella con una chiave esterna verso `sys_users` e nessuno la classifica, questa
 *     prova diventa rossa: «senza esclusione alcuna» vale anche per le tabelle di domani.
 *  2. L'ACCESSO. Le stesse regole del dossier, su ogni sezione: la persona legge sé stessa (salvo i
 *     segreti, che non escono per nessuno), il mandato tecnico vede le buste paga altrui come
 *     {omissis} e nessun importo vero attraversa la risposta, chi è fuori portata riceve 404.
 *
 * Ogni atteso viene dal database vivo.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Le rotte del faldone sono staccate dalla produzione (app.ts): qui si accendono per provarle.
process.env["FALDONE_ATTIVO"] = "1";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { passwordFor } from "./helpers/personas.js";
import { pool, closePool } from "../src/db/client.js";
import { leggiCatalogo, type Catalogo } from "../src/modules/faldone/catalogo.js";
import {
  classificazioneDi, LEGAMI_IMPLICITI, LEGAMI_SOGGETTO, TABELLE_CLASSIFICATE,
} from "../src/modules/faldone/classi.js";
import { FALDONE_OMISSIS } from "@heuresys/shared";
import { TABELLE_CUSTODITE } from "../src/modules/whistleblowing/custodia.js";
import { unCapoConSottoposti, unEstraneoOrganizzativo } from "./helpers/org-actors.js";

const PLATFORM_EMAIL = "platform-test-admin@collaudo.invalid";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org";

interface Session { cookies: Map<string, string> }
function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Session> {
  const r = await loginRaw(t.app, email, passwordFor(email));
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

interface Sezione {
  id: string; titolo: string; capitolo: string; tabella: string; legame: string; classe: string;
  righe: number; colonne: number; visibilita: string; campiOmessi: string[]; motivoOmissis: string | null;
}
interface Indice { persona: { userId: string; nome: string }; totali: Record<string, number>; sezioni: Sezione[] }

let t: TestApp;
let cat: Catalogo;
let platform: Session;
let hr: Session;
let targetId = "";
let trueMoney: string[] = [];

beforeAll(async () => {
  t = await buildTestApp();
  cat = await leggiCatalogo(pool);
  platform = await login(t, PLATFORM_EMAIL);
  hr = await login(t, HR_MANDATE_EMAIL);
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT u.user_id FROM sys.sys_users u
      WHERE EXISTS (SELECT 1 FROM sys.sys_user_pay_slips p
                     WHERE p.user_pay_slip_user_id = u.user_id AND coalesce(p.user_pay_slip_gross_pay, 0) <> 0)
        AND lower(u.user_email) <> $1
      ORDER BY u.user_email LIMIT 1`,
    [HR_MANDATE_EMAIL],
  );
  targetId = rows[0]?.user_id ?? "";
  if (targetId) {
    const m = await pool.query<{ v: string }>(
      `SELECT DISTINCT user_pay_slip_gross_pay::text AS v FROM sys.sys_user_pay_slips
        WHERE user_pay_slip_user_id = $1 AND coalesce(user_pay_slip_gross_pay, 0) <> 0
       UNION SELECT DISTINCT user_pay_slip_net_pay::text FROM sys.sys_user_pay_slips
        WHERE user_pay_slip_user_id = $1 AND coalesce(user_pay_slip_net_pay, 0) <> 0`,
      [targetId],
    );
    trueMoney = m.rows.map((r) => r.v);
  }
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

async function get(s: Session, url: string): Promise<{ status: number; raw: string; body: unknown }> {
  const res = await t.app.inject({ method: "GET", url, headers: { cookie: cookieHeader(s.cookies) } });
  return { status: res.statusCode, raw: res.body, body: res.statusCode === 200 ? res.json() : res.body };
}

describe("faldone — il cricchetto del catalogo", () => {
  it("ogni tabella legata alla persona ha la sua classificazione", () => {
    const senza = [...new Set(cat.legami.map((l) => l.tabella))].filter((x) => !classificazioneDi(x));
    expect(senza, "tabelle legate alla persona senza riga in faldone/classi.ts").toEqual([]);
  });

  it("ogni legame implicito dichiarato esiste ed è un uuid (o la sua tabella è un giornale tolto)", () => {
    const mancanti = LEGAMI_IMPLICITI.filter((id) => !cat.perId.has(id))
      .filter((id) => !id.startsWith("staging."));
    expect(mancanti, "legami impliciti senza colonna uuid nel database").toEqual([]);
  });

  it("ogni legame soggetto dichiarato esiste nel database", () => {
    const mancanti = LEGAMI_SOGGETTO.filter((id) => !cat.perId.has(id)).filter((id) => !id.startsWith("staging."));
    expect(mancanti, "legami soggetto che il database non conosce").toEqual([]);
  });

  it("le tabelle sotto custodia assoluta (ADR-0036 §5) non entrano nel catalogo", () => {
    expect(TABELLE_CUSTODITE.length).toBeGreaterThan(0);
    expect(TABELLE_CUSTODITE.filter((x) => cat.tabelle.has(x))).toEqual([]);
    expect(cat.legami.filter((l) => TABELLE_CUSTODITE.includes(l.tabella) || TABELLE_CUSTODITE.includes(l.madre?.tabella ?? ""))).toEqual([]);
  });

  it("ogni tabella classificata esiste (i giornali di staging possono essere stati tolti)", () => {
    // IN_ARRIVO: classificate prima che la loro migrazione arrivi su main (un'altra PR la porta).
    const IN_ARRIVO = new Set(["sys.sys_alignment_decisions"]);
    const mancanti = TABELLE_CLASSIFICATE.filter((x) => !cat.tabelle.has(x) && !x.startsWith("staging.") && !IN_ARRIVO.has(x));
    expect(mancanti).toEqual([]);
  });

  it("il catalogo è quello misurato: più di 150 tabelle dirette e i dati collegati", () => {
    const dirette = new Set(cat.legami.filter((l) => l.livello === "diretto").map((l) => l.tabella));
    const collegate = cat.legami.filter((l) => l.livello === "collegato");
    expect(dirette.size).toBeGreaterThan(150);
    expect(collegate.length).toBeGreaterThan(0);
  });
});

describe("faldone — l'accesso", () => {
  it("gira su un universo dove può fallire", () => {
    expect(targetId, "nessuna persona con buste paga valorizzate").toBeTruthy();
    expect(trueMoney.length).toBeGreaterThan(0);
  });

  it("sé stessi: indice completo, i propri dati in chiaro, i segreti mai", async () => {
    const r = await get(hr, "/v1/me/faldone");
    expect(r.status, r.raw.slice(0, 300)).toBe(200);
    const b = r.body as Indice;
    expect(b.totali["sezioni"]).toBeGreaterThan(150);
    expect(b.totali["righe"]).toBeGreaterThan(0);
    for (const s of b.sezioni.filter((x) => x.legame === "soggetto")) {
      if (s.visibilita !== "piena") {
        expect(s.motivoOmissis, `${s.id}: a sé stessi si nascondono solo i segreti`).toMatch(/segreti/);
      }
    }
    const conRinnovi = b.sezioni.find((s) => s.tabella === "sys.sys_auth_refresh_tokens" && s.legame === "soggetto");
    expect(conRinnovi).toBeTruthy();
    if (conRinnovi && conRinnovi.righe > 0) {
      const p = await get(hr, `/v1/me/faldone/sezioni/${conRinnovi.id}`);
      expect(p.status).toBe(200);
      const righe = (p.body as { righe: Record<string, unknown>[] }).righe;
      for (const riga of righe) {
        for (const [k, v] of Object.entries(riga)) {
          if (/hash|secret|token(?!_id)/.test(k) && !k.endsWith("_id")) expect(v, k).toBe(FALDONE_OMISSIS);
        }
      }
    }
  });

  it("mandato tecnico: le buste paga altrui sono {omissis}, e nessun importo vero esce", async () => {
    const r = await get(platform, `/v1/faldone/${targetId}`);
    expect(r.status, r.raw.slice(0, 300)).toBe(200);
    const buste = (r.body as Indice).sezioni.find((s) => s.tabella === "sys.sys_user_pay_slips" && s.legame === "soggetto");
    expect(buste?.righe).toBeGreaterThan(0);
    expect(buste?.visibilita).toBe("omissis");
    const p = await get(platform, `/v1/faldone/${targetId}/sezioni/${buste!.id}?limit=500`);
    expect(p.status).toBe(200);
    const righe = (p.body as { righe: Record<string, unknown>[] }).righe;
    expect(righe.length).toBeGreaterThan(0);
    for (const riga of righe) expect(riga["user_pay_slip_gross_pay"]).toBe(FALDONE_OMISSIS);
    expect(trueMoney.filter((v) => p.raw.includes(v))).toEqual([]);
    const c = await get(platform, `/v1/faldone/${targetId}/completo?righePerSezione=500`);
    expect(c.status).toBe(200);
    expect(trueMoney.filter((v) => c.raw.includes(v)), "importi veri nel faldone completo").toEqual([]);
  });

  it("completo: righe per sezione rispettate e troncatura dichiarata", async () => {
    const r = await get(platform, `/v1/faldone/${targetId}/completo?righePerSezione=3`);
    expect(r.status).toBe(200);
    const b = r.body as Indice & { contenuto: Array<{ sezione: Sezione; righe: unknown[]; totale: number; troncata: boolean }> };
    expect(b.contenuto.length).toBe(b.sezioni.filter((s) => s.righe > 0).length);
    for (const s of b.contenuto) {
      expect(s.righe.length).toBeLessThanOrEqual(3);
      expect(s.troncata).toBe(s.totale > s.righe.length);
    }
  });

  it("chi è fuori dalla catena riceve 404, chi ne è a capo legge", async () => {
    const capo = await unCapoConSottoposti(pool);
    const estraneo = await unEstraneoOrganizzativo(pool, capo.userId);
    const s = await login(t, capo.email);
    const r = await get(s, `/v1/faldone/${estraneo.userId}`);
    expect([403, 404], r.raw.slice(0, 200)).toContain(r.status);
  });

  it("una sezione che non esiste risponde 404", async () => {
    const r = await get(platform, `/v1/faldone/${targetId}/sezioni/sys.sys_inesistente.colonna`);
    expect(r.status).toBe(404);
  });
});
