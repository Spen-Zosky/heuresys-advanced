/**
 * Piano interfacce, lotto L10 — A-9: la specifica OpenAPI come prodotto.
 *
 * Si prova che:
 *  - la specifica, la sua interfaccia e la scoperta stanno dietro l'autenticazione;
 *  - ogni operazione ha un identificativo unico, un'etichetta, un riassunto, una descrizione, la
 *    sicurezza e il permesso leggibile da una macchina; la versione è quella del pacchetto;
 *  - la specifica ha un'impronta (`ETag`) e risponde 304 a chi ce l'ha già;
 *  - la scoperta dice a chi chiama, persona o agente, che cosa può fare, con lo stesso calcolo
 *    dei permessi che l'API applica davvero;
 *  - spenta (il caso di produzione finché Enzo non decide), nessuna delle porte esiste.
 */
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";
import {
  OPENAPI_PERMISSION_EXTENSION,
  type AgentTokenResponse,
  type ApiOperationsResponse,
} from "@heuresys/shared";
import { unCapoConSottoposti, unSottopostoOrganizzativo, type Attore } from "./helpers/org-actors.js";

senzaCacheDiSessione();

interface Sessione { cookies: Map<string, string>; csrf: string }
interface Operazione {
  operationId?: string; tags?: string[]; summary?: string; description?: string;
  security?: unknown[]; [OPENAPI_PERMISSION_EXTENSION]?: string | null;
}
interface Specifica { info: { version: string }; paths: Record<string, Record<string, Operazione>> }

const METODI = new Set(["get", "post", "put", "patch", "delete"]);
const VERSIONE = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

let t: TestApp;
let capo: Attore;
let sotto: Attore;

async function accedi(email: string): Promise<Sessione> {
  const r = await loginRaw(t.app, email);
  if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies as { name: string; value: string }[]) cookies.set(c.name, c.value);
  return { cookies, csrf: (r.json() as { csrfToken: string }).csrfToken };
}
const cookie = (s: Sessione) => [...s.cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
const leggi = (s: Sessione, url: string, headers: Record<string, string> = {}) =>
  t.app.inject({ method: "GET", url, headers: { cookie: cookie(s), ...headers } });
async function permessiDi(s: Sessione): Promise<Set<string>> {
  const r = await leggi(s, "/v1/me/permissions");
  expect(r.statusCode, r.body).toBe(200);
  return new Set((r.json() as { permissions: string[] }).permissions);
}
function operazioni(spec: Specifica): [string, string, Operazione][] {
  return Object.entries(spec.paths).flatMap(([p, voce]) =>
    Object.entries(voce).filter(([m]) => METODI.has(m)).map(([m, op]) => [p, m, op] as [string, string, Operazione]),
  );
}

beforeAll(async () => {
  t = await buildTestApp({ apiDocs: true });
  capo = await unCapoConSottoposti(pool);
  sotto = await unSottopostoOrganizzativo(pool, capo.userId);
}, 60_000);

afterAll(async () => {
  await t.app.close();
});

describe("A-9 — la specifica sta dietro l'autenticazione", () => {
  it("senza sessione: specifica, interfaccia e scoperta rispondono 401", async () => {
    for (const url of ["/openapi.json", "/docs/json", "/v1/meta/operations"]) {
      const r = await t.app.inject({ method: "GET", url });
      expect(r.statusCode, `${url}: ${r.body}`).toBe(401);
    }
  });

  it("spenta, nessuna delle porte esiste", async () => {
    const spento = await buildTestApp({ apiDocs: false });
    try {
      const s = await accedi(sotto.email);
      for (const url of ["/openapi.json", "/docs/json", "/v1/meta/operations"]) {
        const r = await spento.app.inject({ method: "GET", url, headers: { cookie: cookie(s) } });
        expect(r.statusCode, url).toBe(404);
      }
    } finally {
      await spento.app.close();
    }
  });
});

describe("A-9 — ogni operazione è descritta e identificata", () => {
  it("identificativo unico, etichetta, riassunto, descrizione, sicurezza e permesso su tutte; versione del pacchetto", async () => {
    const s = await accedi(sotto.email);
    const r = await leggi(s, "/openapi.json");
    expect(r.statusCode, r.body).toBe(200);
    const spec = r.json() as Specifica;
    expect(spec.info.version).toBe(VERSIONE);
    const ops = operazioni(spec);
    expect(ops.length).toBeGreaterThan(400);
    const visti = new Map<string, string>();
    const difetti: string[] = [];
    for (const [p, m, op] of ops) {
      const chi = `${m.toUpperCase()} ${p}`;
      if (!op.operationId) difetti.push(`${chi}: senza operationId`);
      else if (visti.has(op.operationId)) difetti.push(`${chi}: operationId ${op.operationId} già di ${visti.get(op.operationId)}`);
      else visti.set(op.operationId, chi);
      if (!op.tags?.length) difetti.push(`${chi}: senza etichetta`);
      if (!op.summary) difetti.push(`${chi}: senza riassunto`);
      if (!op.description) difetti.push(`${chi}: senza descrizione`);
      if (!Array.isArray(op.security)) difetti.push(`${chi}: senza sicurezza`);
      if (!(OPENAPI_PERMISSION_EXTENSION in op)) difetti.push(`${chi}: senza ${OPENAPI_PERMISSION_EXTENSION}`);
      // A-10: il limite di frequenza è dichiarato su ogni operazione.
      const limite = (op as { "x-heuresys-rate-limit"?: { max?: number; windowSeconds?: number } })["x-heuresys-rate-limit"];
      if (!limite || !(limite.max! > 0) || !(limite.windowSeconds! > 0)) difetti.push(`${chi}: senza limite di frequenza`);
      const perm = op[OPENAPI_PERMISSION_EXTENSION];
      if (perm && !perm.split(" ").every((x) => op.description?.includes(`\`${x}\``))) {
        difetti.push(`${chi}: la descrizione non nomina il permesso ${perm}`);
      }
    }
    expect(difetti).toEqual([]);
    // Le porte d'ingresso pubbliche non chiedono il cookie; le altre sì.
    expect(spec.paths["/v1/auth/login"]?.post?.security).toEqual([]);
    expect(spec.paths["/v1/meta/operations"]?.get?.security).toEqual([{ cookieAuth: [] }]);
  });

  it("l'impronta è l'ETag, e chi ha già la specifica riceve 304", async () => {
    const s = await accedi(sotto.email);
    const r = await leggi(s, "/openapi.json");
    const etag = r.headers.etag as string;
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    const di_nuovo = await leggi(s, "/openapi.json", { "if-none-match": etag });
    expect(di_nuovo.statusCode).toBe(304);
    const scoperta = (await leggi(s, "/v1/meta/operations")).json() as ApiOperationsResponse;
    expect(`"${scoperta.specHash}"`).toBe(etag);
    expect(scoperta.version).toBe(VERSIONE);
  });
});

describe("A-9 — la scoperta dice a chi chiama che cosa può fare", () => {
  it("per la persona: «allowed» coincide con i suoi permessi, e i filtri restringono", async () => {
    const s = await accedi(sotto.email);
    const miei = await permessiDi(s);
    const r = await leggi(s, "/v1/meta/operations");
    expect(r.statusCode, r.body).toBe(200);
    const tutte = (r.json() as ApiOperationsResponse).operations;
    expect(tutte.length).toBeGreaterThan(400);
    for (const op of tutte) {
      const atteso = op.permission === null || op.permission.split(" ").every((p) => miei.has(p));
      expect(op.allowed, `${op.method} ${op.path} (${op.permission})`).toBe(atteso);
    }
    expect(tutte.some((op) => op.allowed && op.permission !== null)).toBe(true);
    expect(tutte.some((op) => !op.allowed)).toBe(true);

    const mie = (await leggi(s, "/v1/meta/operations?allowedOnly=true")).json() as ApiOperationsResponse;
    expect(mie.operations.every((op) => op.allowed)).toBe(true);
    expect(mie.total).toBe(tutte.filter((op) => op.allowed).length);

    const approvazioni = (await leggi(s, "/v1/meta/operations?tag=approvals")).json() as ApiOperationsResponse;
    expect(approvazioni.total).toBeGreaterThan(0);
    expect(approvazioni.operations.every((op) => op.tag === "approvals")).toBe(true);

    const cercate = (await leggi(s, "/v1/meta/operations?q=agent-tokens")).json() as ApiOperationsResponse;
    expect(cercate.operations.map((op) => `${op.method} ${op.path}`)).toContain("POST /v1/auth/agent-tokens/");
  });

  it("per l'agente: vale il compito del gettone, non tutto il perimetro della persona", async () => {
    const persona = await accedi(capo.email);
    const miei = await permessiDi(persona);
    // Un permesso di sé, che ogni persona ha senza mandati (ruolo USER): il gettone lo può portare.
    const uno = "user_profile:read:self";
    expect(miei.has(uno), "la persona non ha il permesso del proprio profilo").toBe(true);
    const g = await t.app.inject({
      method: "POST",
      url: "/v1/auth/agent-tokens",
      headers: { cookie: cookie(persona), "x-csrf-token": persona.csrf, "content-type": "application/json" },
      payload: { agentCode: "assistente-hr", task: "prova A-9: scoprire che cosa posso fare", permissions: [uno] },
    });
    expect(g.statusCode, g.body).toBe(201);
    const cookies = new Map(persona.cookies);
    cookies.set(COOKIES.ACCESS, (g.json() as AgentTokenResponse).token);
    cookies.delete(COOKIES.REFRESH);
    const agente: Sessione = { cookies, csrf: persona.csrf };

    const r = await leggi(agente, "/v1/meta/operations");
    expect(r.statusCode, r.body).toBe(200);
    for (const op of (r.json() as ApiOperationsResponse).operations) {
      if (op.permission === null) continue;
      const atteso = op.permission.split(" ").every((p) => p === uno);
      expect(op.allowed, `${op.method} ${op.path} (${op.permission})`).toBe(atteso);
    }
  });
});
