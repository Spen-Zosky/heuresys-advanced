/**
 * apps/api/test/per-person-mask.integration.test.ts
 *
 * #124 (S1055) — le quattro superfici PER-PERSONA che restavano scoperte dopo
 * D4, e che il register non nominava. Ciascuna nasconde il giudizio o il prezzo
 * in un posto dove un mask per-campo non lo cercherebbe:
 *
 *  - `/v1/kpi-definitions/:id/measurements` — 248 misurazioni su 248 portano un
 *    `userId`: non e' catalogo, e' il risultato di quella persona.
 *  - `/v1/assessments` e `/:id` — MISURATO: **312 righe su 615** portano
 *    `composite_score` dentro `metadata`, cioe' il giudizio vive in un campo
 *    non tipizzato.
 *  - `/v1/user-target-positions` e `/:id` — `reviewNotes` e' il commento scritto
 *    SU una persona a proposito della sua aspirazione.
 *  - `/v1/compensation/profiles/position/:id` — contraddizione interna del
 *    modulo: `position-economic-weight` mascherava gia' «perche' su una
 *    posizione con un solo titolare il valore e' individuale», e 280 posizioni
 *    su 299 hanno un solo titolare.
 *
 * Ogni caso ha il suo contrario: lo stesso dato letto da chi ha mandato HR deve
 * esserci ancora, o la prova non potrebbe fallire.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org";

interface Session { cookies: Map<string, string> }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

let t: TestApp;
let platform: Session;
let hr: Session;

async function login(email: string): Promise<Session> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

async function get<T>(s: Session, url: string): Promise<{ status: number; body: T; raw: string }> {
  const r = await t.app.inject({ method: "GET", url, headers: { cookie: ch(s.cookies) } });
  return { status: r.statusCode, body: r.json() as T, raw: r.body };
}

interface Page<T> { items: T[] }

describe("#124 — le quattro superfici per-persona", () => {
  beforeAll(async () => {
    t = await buildTestApp();
    platform = await login(PLATFORM_EMAIL);
    hr = await login(HR_MANDATE_EMAIL);
  });
  afterAll(async () => {
    await t.app.close();
    await closePool();
  });

  it("kpi measurements: il valore per-persona e' tolto al tecnico e presente all'HR", async () => {
    // L'indicatore si deriva dal dato reale: quello che HA misurazioni per-persona.
    const { rows } = await pool.query<{ id: string }>(
      `SELECT kpi_measurement_kpi_id AS id FROM sys.sys_kpi_measurements
        WHERE kpi_measurement_user_id IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
    );
    const kpiId = rows[0]?.id;
    expect(kpiId, "nessun indicatore con misurazioni per-persona").toBeDefined();
    if (!kpiId) return;

    const url = `/v1/kpi-definitions/${kpiId}/measurements?limit=20`;
    const tecnico = await get<Page<{ userId: string | null; value?: number; masked?: string[] }>>(platform, url);
    expect(tecnico.status).toBe(200);
    const conPersona = tecnico.body.items.filter((m) => m.userId !== null);
    expect(conPersona.length, "servono righe per-persona per provare qualcosa").toBeGreaterThan(0);
    for (const m of conPersona) {
      expect(m.value).toBeUndefined();
      expect(m.masked).toEqual(["source", "unit", "value"]);
    }

    const hrView = await get<Page<{ userId: string | null; value?: number }>>(hr, url);
    expect(hrView.status).toBe(200);
    const hrConPersona = hrView.body.items.filter((m) => m.userId !== null);
    expect(hrConPersona.length).toBeGreaterThan(0);
    expect(hrConPersona.every((m) => typeof m.value === "number")).toBe(true);
  });

  it("assessments: il metadata col punteggio composito e' tolto al tecnico, presente all'HR", async () => {
    const url = "/v1/assessments?limit=25";
    const tecnico = await get<Page<{ metadata?: unknown; masked?: string[]; status: string }>>(platform, url);
    expect(tecnico.status).toBe(200);
    expect(tecnico.body.items.length).toBeGreaterThan(0);
    for (const a of tecnico.body.items) {
      expect(a.metadata).toBeUndefined();
      expect(a.masked).toEqual(["metadata"]);
      // I20: la riga, il soggetto, il periodo e lo STATO restano visibili.
      expect(a.status).toBeTruthy();
    }
    // Nel corpo grezzo non deve sopravvivere la chiave del giudizio.
    expect(tecnico.raw).not.toContain("composite_score");

    const hrView = await get<Page<{ metadata?: Record<string, unknown> }>>(hr, url);
    expect(hrView.status).toBe(200);
    expect(hrView.body.items.some((a) => a.metadata !== undefined)).toBe(true);
  });

  it("user-target-positions: reviewNotes tolto al tecnico, presente all'HR", async () => {
    const url = "/v1/user-target-positions?limit=25";
    const tecnico = await get<Page<{ reviewNotes?: string | null; masked?: string[] }>>(platform, url);
    expect(tecnico.status).toBe(200);
    if (tecnico.body.items.length === 0) {
      throw new Error("nessun obiettivo di carriera: la prova non misurerebbe nulla");
    }
    for (const r of tecnico.body.items) {
      expect(r.reviewNotes).toBeUndefined();
      expect(r.masked).toEqual(["reviewNotes"]);
    }

    const hrView = await get<Page<{ reviewNotes?: string | null; masked?: string[] }>>(hr, url);
    expect(hrView.status).toBe(200);
    expect(hrView.body.items.every((r) => r.masked === undefined)).toBe(true);
  });

  it("compensation profile per posizione: banda tolta al tecnico, presente all'HR", async () => {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT position_id AS id FROM sys.sys_position_compensation_profiles LIMIT 1`,
    );
    const positionId = rows[0]?.id;
    expect(positionId, "nessun profilo retributivo su cui provare").toBeDefined();
    if (!positionId) return;

    const url = `/v1/compensation/profiles/${positionId}`;
    const tecnico = await get<{ band?: unknown; masked?: string[]; positionId: string }>(platform, url);
    expect(tecnico.status).toBe(200);
    expect(tecnico.body.band).toBeUndefined();
    expect(tecnico.body.masked).toEqual(["band", "economicWeight", "metadata", "rewardGatesApplied"]);
    // La posizione resta: si nega il prezzo, non l'esistenza.
    expect(tecnico.body.positionId).toBe(positionId);

    const hrView = await get<{ band?: unknown; masked?: string[] }>(hr, url);
    expect(hrView.status).toBe(200);
    expect(hrView.body.masked).toBeUndefined();
  });
});
