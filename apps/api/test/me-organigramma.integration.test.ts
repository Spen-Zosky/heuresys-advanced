/**
 * apps/api/test/me-organigramma.integration.test.ts — GET /v1/me/organigramma (piano
 * docs/piani/PIANO_organigrammi-a-blocchi_20261114.md, V1).
 *
 * Che cosa si prova:
 *  - 401 senza sessione;
 *  - una persona del cliente riceve le unità attive del suo cliente, ognuna con le persone che
 *    vi lavorano scritte «Cognome, Nome», e le posizioni attive con il riporto: i numeri attesi
 *    si derivano dal database, non si scrivono qui;
 *  - i collegamenti sono quelli vivi: ogni posizione con un riporto attivo lo porta;
 *  - un cliente fuori dal perimetro risponde 404 come uno che non esiste.
 * Più la funzione pura `comporre`: livelli, addetti totali e un ciclo che non manda in loop.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { comporre } from "../src/modules/organigramma/repository.js";
import type { OrganigrammaResponse } from "@heuresys/shared";

const EMAIL = "paolo.caputo@rtl-bank.org";

describe("GET /v1/me/organigramma", () => {
  let t: TestApp;
  let cookie = "";
  beforeAll(async () => {
    t = await buildTestApp();
    const login = await loginRaw(t.app, EMAIL, TEST_PERSONA_PASSWORD);
    cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  });
  afterAll(async () => { await t.app.close(); });

  it("401 senza sessione", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/me/organigramma" });
    expect(r.statusCode).toBe(401);
  });

  it("unità, persone «Cognome, Nome» e riporti vivi del proprio cliente", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/me/organigramma", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as OrganigrammaResponse;

    const { rows } = await pool.query<{ tenant: string; unita: number; posizioni: number; persone: number; riporti: number; cognome: string; nome: string }>(
      `SELECT u.user_tenant_id AS tenant,
              (SELECT count(*)::int FROM sys.sys_organization_units o
                WHERE o.organization_unit_tenant_id = u.user_tenant_id AND o.organization_unit_is_active) AS unita,
              (SELECT count(*)::int FROM sys.sys_positions p
                WHERE p.position_tenant_id = u.user_tenant_id AND p.position_is_active) AS posizioni,
              (SELECT count(DISTINCT (a.user_position_assignment_user_id, p.position_organization_unit_id))::int
                 FROM sys.sys_user_position_assignments a
                 JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
                 JOIN sys.sys_organization_units o ON o.organization_unit_id = p.position_organization_unit_id AND o.organization_unit_is_active
                WHERE p.position_tenant_id = u.user_tenant_id AND p.position_is_active
                  AND a.user_position_assignment_status = 'ACTIVE') AS persone,
              (SELECT count(*)::int FROM sys.sys_positions p
                 JOIN sys.sys_positions c ON c.position_id = p.position_reports_to_position_id AND c.position_is_active
                                         AND c.position_tenant_id = p.position_tenant_id
                WHERE p.position_tenant_id = u.user_tenant_id AND p.position_is_active) AS riporti,
              u.user_last_name AS cognome, u.user_first_name AS nome
         FROM sys.sys_users u WHERE lower(u.user_email) = $1`,
      [EMAIL],
    );
    const atteso = rows[0]!;
    expect(b.tenantId).toBe(atteso.tenant);
    expect(b.unita.length).toBe(atteso.unita);
    expect(b.posizioni.length).toBe(atteso.posizioni);
    expect(b.unita.reduce((s, u) => s + u.persone.length, 0)).toBe(atteso.persone);
    expect(b.posizioni.filter((p) => p.riportaAId).length).toBe(atteso.riporti);
    const tutte = b.unita.flatMap((u) => u.persone.map((p) => p.etichetta));
    expect(tutte).toContain(`${atteso.cognome}, ${atteso.nome}`);

    // Le radici hanno livello 1 e gli addetti totali della radice sono tutte le persone sotto di lei.
    const radici = b.unita.filter((u) => !u.padreId);
    expect(radici.length).toBeGreaterThan(0);
    expect(radici.every((u) => u.livello === 1)).toBe(true);
    expect(radici.reduce((s, u) => s + u.addettiTotali, 0)).toBe(atteso.persone);
  });

  it("un cliente fuori dal perimetro risponde 404", async () => {
    const r = await t.app.inject({ method: "GET", url: `/v1/me/organigramma?tenantId=${randomUUID()}`, headers: { cookie } });
    expect(r.statusCode).toBe(404);
  });
});

describe("comporre (funzione pura)", () => {
  const u = (id: string, padreId: string | null, tipo = "DEPARTMENT") => ({
    id, codice: id, nome: id, tipo, relazione: "LINEA", padreId, responsabileId: null, responsabile: null,
  });
  const p = (id: string, unitaId: string, cognome: string) => ({
    id, etichetta: `${cognome}, X`, posizioneId: `pos-${id}`, posizione: "Addetto", unitaId, cognome, nome: "X",
  });

  it("livelli, addetti totali, filiali e una persona contata una volta per unità", () => {
    const r = comporre("t", "Cliente",
      [u("A", null), u("B", "A"), u("C", "B", "BRANCH")],
      [p("1", "A", "Rossi"), p("2", "B", "Bianchi"), p("2", "B", "Bianchi"), p("3", "C", "Verdi")],
      [],
    );
    const per = new Map(r.unita.map((x) => [x.id, x]));
    expect([per.get("A")!.livello, per.get("B")!.livello, per.get("C")!.livello]).toEqual([1, 2, 3]);
    expect([per.get("A")!.addettiTotali, per.get("B")!.addettiTotali, per.get("C")!.addettiTotali]).toEqual([3, 2, 1]);
    expect(per.get("B")!.persone).toHaveLength(1);
    expect(per.get("C")!.filiale).toBe(true);
  });

  it("un ciclo nei padri non manda in loop e ogni unità resta nel disegno", () => {
    const r = comporre("t", "Cliente", [u("A", "B"), u("B", "A")], [], []);
    expect(r.unita).toHaveLength(2);
    expect(r.unita.every((x) => x.livello >= 1)).toBe(true);
  });
});
