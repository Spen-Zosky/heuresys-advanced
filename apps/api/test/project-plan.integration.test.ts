import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { ProjectSchedaSchema, type ProjectScheda } from "@heuresys/shared";

/**
 * V6/V7 del piano processi e progetti — il piano di un progetto (000503) e la sua scheda.
 * Un mandato HR pianifica un progetto vero del suo tenant: una fase, un'attività dentro la fase con le
 * date, una tappa, una dipendenza; la scheda le rilegge. Poi i rifiuti: date al contrario, tappa su
 * due giorni, dipendenza da sé stessa, giro di dipendenze, fase dentro sé stessa. Il file gira in una
 * transazione annullata alla fine (tx-isolation): nessun residuo.
 */
interface S { cookies: string; csrf: string }
let t: TestApp;
let hr: S;
let projectId = "";

async function login(email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  return { cookies: r.cookies.map((c) => `${c.name}=${c.value}`).join("; "), csrf: (r.json() as { csrfToken: string }).csrfToken };
}
const h = (s: S) => ({ cookie: s.cookies, "x-csrf-token": s.csrf, "content-type": "application/json" });
async function scrivi(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown) {
  return t.app.inject({ method, url, headers: body === undefined ? { cookie: hr.cookies, "x-csrf-token": hr.csrf } : h(hr), ...(body === undefined ? {} : { payload: JSON.stringify(body) }) });
}

beforeAll(async () => {
  t = await buildTestApp();
  hr = await login("governo@collaudo.invalid");
  const me = await t.app.inject({ method: "GET", url: "/v1/projects?limit=1", headers: { cookie: hr.cookies } });
  const p = (me.json() as { items: Array<{ projectId: string }> }).items[0];
  if (!p) throw new Error("il tenant del mandato HR non ha progetti: il caso da provare non c'è");
  projectId = p.projectId;
});
afterAll(async () => { await t?.app.close(); });

describe("/v1/projects/:id/scheda e il piano", () => {
  it("la scheda di un progetto si legge, con il piano che il database ha", async () => {
    const r = await t.app.inject({ method: "GET", url: `/v1/projects/${projectId}/scheda`, headers: { cookie: hr.cookies } });
    expect(r.statusCode).toBe(200);
    const s = ProjectSchedaSchema.parse(r.json());
    const n = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM sys.sys_project_phases WHERE project_phase_project_id = $1`, [projectId]);
    expect(s.phases.length).toBe(n.rows[0]!.n);
    expect(s.canManage).toBe(true);
  });

  it("si pianifica: fase, attività con date, tappa e dipendenza, e la scheda le rilegge", async () => {
    let r = await scrivi("POST", `/v1/projects/${projectId}/phases`, { kind: "PHASE", name: "Fase di prova del piano" });
    expect(r.statusCode).toBe(200);
    let s = r.json() as ProjectScheda;
    const fase = s.phases.find((f) => f.name === "Fase di prova del piano")!;
    expect(fase.kind).toBe("PHASE");

    r = await scrivi("POST", `/v1/projects/${projectId}/phases`, { parentId: fase.phaseId, name: "Attività di prova", plannedStart: "2026-12-01", plannedEnd: "2026-12-12" });
    expect(r.statusCode).toBe(200);
    r = await scrivi("POST", `/v1/projects/${projectId}/phases`, { parentId: fase.phaseId, kind: "MILESTONE", name: "Tappa di prova", plannedStart: "2026-12-15", plannedEnd: "2026-12-15" });
    expect(r.statusCode).toBe(200);
    s = r.json() as ProjectScheda;
    const att = s.phases.find((f) => f.name === "Attività di prova")!;
    const tappa = s.phases.find((f) => f.name === "Tappa di prova")!;
    expect(att.plannedStart).toBe("2026-12-01");
    expect(att.plannedEnd).toBe("2026-12-12");
    expect(att.parentId).toBe(fase.phaseId);
    // l'ordine di albero: la fase prima dei suoi figli
    const i = s.phases.findIndex((f) => f.phaseId === fase.phaseId);
    expect(s.phases.findIndex((f) => f.phaseId === att.phaseId)).toBeGreaterThan(i);

    r = await scrivi("POST", `/v1/projects/${projectId}/dependencies`, { predecessorId: att.phaseId, successorId: tappa.phaseId });
    expect(r.statusCode).toBe(200);
    s = r.json() as ProjectScheda;
    expect(s.dependencies.some((d) => d.predecessorId === att.phaseId && d.successorId === tappa.phaseId && d.kind === "FS")).toBe(true);

    // i rifiuti
    expect((await scrivi("POST", `/v1/projects/${projectId}/dependencies`, { predecessorId: tappa.phaseId, successorId: att.phaseId })).statusCode).toBe(409);
    expect((await scrivi("POST", `/v1/projects/${projectId}/dependencies`, { predecessorId: att.phaseId, successorId: att.phaseId })).statusCode).toBe(400);
    expect((await scrivi("PATCH", `/v1/projects/${projectId}/phases/${att.phaseId}`, { plannedEnd: "2026-11-01" })).statusCode).toBe(400);
    expect((await scrivi("PATCH", `/v1/projects/${projectId}/phases/${tappa.phaseId}`, { plannedEnd: "2026-12-20" })).statusCode).toBe(400);
    expect((await scrivi("PATCH", `/v1/projects/${projectId}/phases/${fase.phaseId}`, { parentId: att.phaseId })).statusCode).toBe(409);

    // l'avanzamento si aggiorna; la fase si toglie e porta via figli e dipendenze
    r = await scrivi("PATCH", `/v1/projects/${projectId}/phases/${att.phaseId}`, { progressPct: 40, status: "ACTIVE", actualStart: "2026-12-02" });
    expect(r.statusCode).toBe(200);
    const aggiornata = (r.json() as ProjectScheda).phases.find((f) => f.phaseId === att.phaseId)!;
    expect(aggiornata.progressPct).toBe(40);
    expect(aggiornata.actualStart).toBe("2026-12-02");
    r = await scrivi("DELETE", `/v1/projects/${projectId}/phases/${fase.phaseId}`);
    expect(r.statusCode).toBe(200);
    s = r.json() as ProjectScheda;
    expect(s.phases.some((f) => [fase.phaseId, att.phaseId, tappa.phaseId].includes(f.phaseId))).toBe(false);
    expect(s.dependencies.some((d) => d.predecessorId === att.phaseId)).toBe(false);
  });

  it("senza CSRF la scrittura è rifiutata, e una fase che non c'è risponde 404", async () => {
    const r = await t.app.inject({ method: "POST", url: `/v1/projects/${projectId}/phases`, headers: { cookie: hr.cookies, "content-type": "application/json" }, payload: JSON.stringify({ name: "x" }) });
    expect(r.statusCode).toBe(403);
    expect((await scrivi("DELETE", `/v1/projects/${projectId}/phases/00000000-0000-4000-8000-000000000000`)).statusCode).toBe(404);
  });
});
