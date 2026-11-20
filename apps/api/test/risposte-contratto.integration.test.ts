/**
 * apps/api/test/risposte-contratto.integration.test.ts
 * Guardia di classe: nessuna rotta GET dell'API risponde 500 RESPONSE_CONTRACT_VIOLATION con dati veri.
 *
 * Perche': il driver `pg` consegna `date` e `timestamptz` come `Date`, e un contratto Zod che dichiara
 * `z.string()` rifiuta la risposta con un 500. Il difetto compare solo quando la riga esiste, quindi un
 * test con la tabella vuota non lo vede (casi: elenco incarichi 2026-11-19, scheda Contratti di RTL
 * 2026-11-20). Questa prova chiama ogni GET dell'API con tre attori che vedono dati veri e raccoglie
 * TUTTE le violazioni, non solo la prima.
 *
 * Copertura dichiarata: le rotte senza parametri, e quelle con un solo parametro il cui elenco
 * (la rotta fino al parametro) risponde con almeno una riga da cui ricavare l'identificativo.
 * Le altre non si chiamano: sono elencate nel messaggio d'errore solo quando la prova fallisce.
 * Un 400/403/404 non e' una violazione: conta solo il 500 con codice RESPONSE_CONTRACT_VIOLATION.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { platformAdmin, tenantAdmin, userWithRole } from "./helpers/actors.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

interface S { cookies: Map<string, string>; csrfToken: string }

const hdr = (s: S): Record<string, string> => ({
  cookie: [...s.cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; "),
  "x-csrf-token": s.csrfToken,
});

async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

/** Rotte che non si chiamano: flussi che consumano un gettone, restano aperti o costano. */
const DA_SALTARE = /(esegui|\/run\b|generate|stream|export|download|events|\/sse\b|logout|callback|verify|confirm|unsubscribe|webhook|\/auth\/)/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Le rotte GET dichiarate, lette dall'albero di Fastify (un percorso per riga, con i metodi fra parentesi). */
function rotteGet(t: TestApp): string[] {
  const out = new Set<string>();
  for (const riga of t.app.printRoutes({ commonPrefix: false }).split("\n")) {
    const m = /^\S*\s*(\/\S*)\s+\(([^)]*)\)/.exec(riga.trim());
    if (m && m[2]!.split(",").map((x) => x.trim()).includes("GET")) out.add(m[1]!);
  }
  return [...out].sort();
}

/** I primi identificativi (al massimo 3) che si ricavano da una risposta d'elenco: la prima riga sola puo' essere
 *  quella senza dati, e il difetto compare solo dove il campo e' valorizzato. */
function primiId(corpo: unknown, segmento: string): string[] {
  let righe: unknown = corpo;
  if (!Array.isArray(righe) && righe && typeof righe === "object") {
    righe = Object.values(righe as Record<string, unknown>).find(Array.isArray);
  }
  if (!Array.isArray(righe)) return [];
  const singolare = segmento.replace(/s$/, "").replace(/-/g, "").toLowerCase();
  const out: string[] = [];
  for (const riga of righe.slice(0, 3)) {
    if (!riga || typeof riga !== "object") continue;
    const campi = Object.entries(riga as Record<string, unknown>).filter(([, v]) => typeof v === "string" && UUID.test(v));
    const scelto =
      campi.find(([k]) => k === "id") ??
      campi.find(([k]) => k.toLowerCase() === `${singolare}id`) ??
      campi.find(([k]) => k.toLowerCase().startsWith(singolare) && k.toLowerCase().endsWith("id")) ??
      campi[0];
    if (scelto) out.push(String(scelto[1]));
  }
  return out;
}

let t: TestApp;
let rtlId = "";
const attori: Array<{ nome: string; s: S }> = [];

describe("nessuna risposta fuori contratto con dati veri", () => {
  beforeAll(async () => {
    t = await buildTestApp();
    const { rows: [rtl] } = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    if (!rtl) throw new Error("il tenant RTL_BANK non esiste piu': la prova non ha piu' dati veri da leggere");
    rtlId = rtl.id;
    attori.push({ nome: "PLATFORM_ADMIN", s: await login(t, (await platformAdmin()).email) });
    attori.push({ nome: "TENANT_ADMIN RTL", s: await login(t, (await tenantAdmin({ tenantId: rtl.id })).email) });
    try {
      attori.push({ nome: "HRMS_MANAGER RTL", s: await login(t, (await userWithRole("HRMS_MANAGER", { tenantId: rtl.id })).email) });
    } catch {
      // nessun utente impersonabile con quel ruolo: restano i due attori sopra
    }
  }, 120_000);

  afterAll(async () => {
    await t.app.close();
    await closePool();
  });

  it("ogni GET raggiungibile risponde nel proprio contratto", async () => {
    const tutte = rotteGet(t);
    expect(tutte.length, "l'albero delle rotte e' vuoto: la lettura di printRoutes e' cambiata").toBeGreaterThan(50);
    const insieme = new Set(tutte);
    const violazioni: string[] = [];
    let chiamate = 0;

    const chiama = async (url: string, s: S): Promise<{ status: number; corpo: unknown }> => {
      const r = await Promise.race([
        t.app.inject({ method: "GET", url, headers: hdr(s) }),
        new Promise<never>((_, no) => setTimeout(() => no(new Error(`nessuna risposta in 30 s: ${url}`)), 30_000)),
      ]);
      let corpo: unknown = null;
      try { corpo = r.json(); } catch { /* corpo non JSON */ }
      return { status: r.statusCode, corpo };
    };

    for (const { nome, s } of attori) {
      const idDa = new Map<string, string[]>();
      for (const rotta of tutte) {
        if (DA_SALTARE.test(rotta) || rotta.includes("*")) continue;
        const parametri = rotta.match(/:[A-Za-z0-9_]+/g) ?? [];
        let urls: string[] = [rotta];
        if (parametri.length === 1) {
          const prefisso = rotta.slice(0, rotta.indexOf(":")).replace(/\/$/, "");
          if (!insieme.has(prefisso)) continue;
          if (!idDa.has(prefisso)) {
            const r = await chiama(prefisso, s);
            chiamate++;
            const ids = r.status === 200 ? primiId(r.corpo, prefisso.split("/").pop() ?? "") : [];
            // Il tenant con dati veri (RTL) c'e' sempre fra gli identificativi provati sotto /tenants.
            if (prefisso === "/v1/tenants" && !ids.includes(rtlId)) ids.push(rtlId);
            idDa.set(prefisso, ids);
          }
          urls = (idDa.get(prefisso) ?? []).map((id) => rotta.replace(parametri[0]!, id));
        } else if (parametri.length > 1) {
          continue;
        }
        for (const url of urls) {
          const r = await chiama(url, s);
          chiamate++;
          const codice = (r.corpo as { error?: { code?: string } } | null)?.error?.code;
          if (r.status === 500 && codice === "RESPONSE_CONTRACT_VIOLATION") violazioni.push(`${nome}: GET ${url}  (rotta ${rotta})`);
        }
      }
    }

    expect(chiamate, "nessuna rotta e' stata chiamata").toBeGreaterThan(50);
    expect(violazioni, "rotte che rispondono fuori dal proprio contratto con dati veri").toEqual([]);
  }, 900_000);
});
