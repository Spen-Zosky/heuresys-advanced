/**
 * Piano interfacce, lotto L10 — A-10: la qualità dell'API per un agente che riprova.
 *
 *  - `Idempotency-Key` (migrazione 000478): la stessa scrittura ripetuta con la stessa chiave non
 *    si duplica e riceve la risposta di allora; la chiave riusata per un'altra richiesta è 422;
 *    la chiave è di chi chiama, e l'agente non condivide quelle della persona;
 *  - `ETag` e `If-None-Match` sulle letture, `If-Match` sulle modifiche: una modifica fondata su
 *    una lettura vecchia è 412 e non scrive;
 *  - i limiti di frequenza sono dichiarati nelle intestazioni di ogni risposta.
 *
 * Le scritture sono sul proprio profilo e sulle proprie certificazioni (permessi `:self`), nella
 * transazione del file.
 */
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";
import type { AgentTokenResponse } from "@heuresys/shared";
import { unCapoConSottoposti, unSottopostoOrganizzativo, type Attore } from "./helpers/org-actors.js";

senzaCacheDiSessione();

interface Sessione { cookies: Map<string, string>; csrf: string }

let t: TestApp;
let persona: Attore;

async function accedi(email: string): Promise<Sessione> {
  const r = await loginRaw(t.app, email);
  if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies as { name: string; value: string }[]) cookies.set(c.name, c.value);
  return { cookies, csrf: (r.json() as { csrfToken: string }).csrfToken };
}
const cookie = (s: Sessione) => [...s.cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
function chiama(
  s: Sessione,
  method: "GET" | "POST" | "PATCH",
  url: string,
  payload?: Record<string, unknown>,
  extra: Record<string, string> = {},
) {
  return t.app.inject({
    method,
    url,
    headers: {
      cookie: cookie(s),
      ...(method === "GET" ? {} : { "x-csrf-token": s.csrf, "content-type": "application/json" }),
      ...extra,
    },
    ...(payload ? { payload } : {}),
  });
}
async function quanteCertificazioni(s: Sessione): Promise<number> {
  const r = await chiama(s, "GET", "/v1/me/certifications");
  expect(r.statusCode, r.body).toBe(200);
  const corpo = r.json() as { items?: unknown[] } | unknown[];
  return Array.isArray(corpo) ? corpo.length : (corpo.items?.length ?? 0);
}
async function righeDellaChiave(chiave: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM audit.chiavi_idempotenza WHERE chiave_idempotenza_chiave = $1",
    [chiave],
  );
  return Number(r.rows[0]?.n ?? 0);
}

beforeAll(async () => {
  t = await buildTestApp();
  const capo = await unCapoConSottoposti(pool);
  persona = await unSottopostoOrganizzativo(pool, capo.userId);
}, 60_000);

afterAll(async () => {
  await t.app.close();
});

describe("A-10 — Idempotency-Key: chi riprova non duplica", () => {
  it("la stessa scrittura con la stessa chiave si esegue una volta e la risposta si ripete", async () => {
    const s = await accedi(persona.email);
    const prima = await quanteCertificazioni(s);
    const chiave = `a10-${randomUUID()}`;
    const corpo = { name: "Prova A-10", issuer: "Heuresys collaudo", issuedDate: "2026-11-05" };

    const r1 = await chiama(s, "POST", "/v1/me/certifications", corpo, { "idempotency-key": chiave });
    expect(r1.statusCode, r1.body).toBe(201);
    expect(r1.headers["idempotent-replayed"]).toBeUndefined();
    const r2 = await chiama(s, "POST", "/v1/me/certifications", corpo, { "idempotency-key": chiave });
    expect(r2.statusCode, r2.body).toBe(201);
    expect(r2.headers["idempotent-replayed"]).toBe("true");
    expect(r2.json()).toEqual(r1.json());
    expect(await quanteCertificazioni(s)).toBe(prima + 1);
    expect(await righeDellaChiave(chiave)).toBe(1);

    // Senza la chiave nulla cambia: due richieste, due righe.
    const r3 = await chiama(s, "POST", "/v1/me/certifications", { ...corpo, name: "Prova A-10 senza chiave" });
    expect(r3.statusCode, r3.body).toBe(201);
    expect(await quanteCertificazioni(s)).toBe(prima + 2);
  });

  it("la chiave riusata per un'altra richiesta è 422, e una chiave malformata è 400", async () => {
    const s = await accedi(persona.email);
    const chiave = `a10-${randomUUID()}`;
    const r1 = await chiama(s, "POST", "/v1/me/certifications", { name: "Prova A-10 bis", issuer: "Heuresys collaudo" }, { "idempotency-key": chiave });
    expect(r1.statusCode, r1.body).toBe(201);
    const r2 = await chiama(s, "POST", "/v1/me/certifications", { name: "Un'altra", issuer: "Heuresys collaudo" }, { "idempotency-key": chiave });
    expect(r2.statusCode, r2.body).toBe(422);
    expect(r2.json().error.code).toBe("IDEMPOTENCY_KEY_REUSED");

    const r3 = await chiama(s, "POST", "/v1/me/certifications", { name: "x", issuer: "y" }, { "idempotency-key": "con spazio" });
    expect(r3.statusCode, r3.body).toBe(400);
  });

  it("la chiave dell'agente non è quella della persona: stessa chiave, due scritture distinte", async () => {
    const s = await accedi(persona.email);
    const chiave = `a10-${randomUUID()}`;
    const corpo = { name: "Prova A-10 persona e agente", issuer: "Heuresys collaudo" };
    const prima = await quanteCertificazioni(s);
    const rp = await chiama(s, "POST", "/v1/me/certifications", corpo, { "idempotency-key": chiave });
    expect(rp.statusCode, rp.body).toBe(201);

    const g = await chiama(s, "POST", "/v1/auth/agent-tokens", { agentCode: "assistente-hr", task: "prova A-10: idempotenza" });
    expect(g.statusCode, g.body).toBe(201);
    const cookies = new Map(s.cookies);
    cookies.set(COOKIES.ACCESS, (g.json() as AgentTokenResponse).token);
    cookies.delete(COOKIES.REFRESH);
    const agente: Sessione = { cookies, csrf: s.csrf };
    // Un corpo diverso: la stessa certificazione due volte violerebbe la chiave naturale della
    // tabella. Qui conta che la stessa chiave, per l'agente, apra una scrittura nuova.
    const corpoAgente = { ...corpo, name: "Prova A-10 dell'agente" };
    const ra = await chiama(agente, "POST", "/v1/me/certifications", corpoAgente, { "idempotency-key": chiave });
    expect(ra.statusCode, ra.body).toBe(201);
    expect(ra.headers["idempotent-replayed"]).toBeUndefined();
    const ra2 = await chiama(agente, "POST", "/v1/me/certifications", corpoAgente, { "idempotency-key": chiave });
    expect(ra2.headers["idempotent-replayed"]).toBe("true");
    expect(await quanteCertificazioni(s)).toBe(prima + 2);
    expect(await righeDellaChiave(chiave)).toBe(2);
  });
});

describe("A-10 — ETag e If-Match: una modifica su una lettura vecchia non scrive", () => {
  it("la lettura porta l'ETag e risponde 304 a chi ce l'ha; If-Match vecchio è 412, quello attuale passa", async () => {
    const s = await accedi(persona.email);
    const l1 = await chiama(s, "GET", "/v1/me/profile");
    expect(l1.statusCode, l1.body).toBe(200);
    const etag = l1.headers.etag as string;
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    const l2 = await chiama(s, "GET", "/v1/me/profile", undefined, { "if-none-match": etag });
    expect(l2.statusCode).toBe(304);
    expect(l2.body).toBe("");

    const bio = `A-10 ${randomUUID()}`;
    const m1 = await chiama(s, "PATCH", "/v1/me/profile", { bio }, { "if-match": etag });
    expect(m1.statusCode, m1.body).toBe(200);

    // Il profilo è cambiato: chi ha ancora l'impronta di prima non sovrascrive.
    const m2 = await chiama(s, "PATCH", "/v1/me/profile", { bio: "sovrascrittura cieca" }, { "if-match": etag });
    expect(m2.statusCode, m2.body).toBe(412);
    expect(m2.json().error.code).toBe("PRECONDITION_FAILED");
    const dopo = await chiama(s, "GET", "/v1/me/profile");
    expect((dopo.json() as { bio: string | null }).bio).toBe(bio);

    const m3 = await chiama(s, "PATCH", "/v1/me/profile", { bio: `${bio} 2` }, { "if-match": dopo.headers.etag as string });
    expect(m3.statusCode, m3.body).toBe(200);
  });

  it("un If-Match su una risorsa che non si può leggere non si dà per vero", async () => {
    const s = await accedi(persona.email);
    const r = await chiama(s, "PATCH", `/v1/me/inbox/${randomUUID()}`, { status: "READ" }, { "if-match": "*" });
    expect(r.statusCode, r.body).toBe(412);
    expect(r.json().error.code).toBe("PRECONDITION_UNVERIFIABLE");
  });
});

describe("A-10 — i limiti di frequenza sono dichiarati", () => {
  it("ogni risposta porta il limite, quanto ne resta e quando si azzera", async () => {
    const s = await accedi(persona.email);
    const r = await chiama(s, "GET", "/v1/me/profile");
    expect(r.headers["x-ratelimit-limit"]).toBeDefined();
    expect(r.headers["x-ratelimit-remaining"]).toBeDefined();
    expect(r.headers["x-ratelimit-reset"]).toBeDefined();
  });
});
