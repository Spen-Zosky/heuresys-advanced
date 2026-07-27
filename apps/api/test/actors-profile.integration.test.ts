/**
 * apps/api/test/actors-profile.integration.test.ts — S1033.
 *
 * La guardia degli attori. I test hanno bisogno di quattro profili — un
 * amministratore di piattaforma, una coppia manager→riporto vera, un estraneo
 * alla linea gerarchica, un utente senza secondo fattore — e finora li davano
 * per scontati nominando cinque utenti letterali.
 *
 * Quando Z-262 ha assegnato un fattore MFA a ogni utente, la premessa "esiste
 * un utente senza secondo fattore" è caduta e sono usciti 158 file rossi con un
 * messaggio che parlava d'altro. Questo file esiste perché quel cambiamento
 * rompa UN test, con scritto che cosa manca.
 *
 * Falsificabilità: ogni asserzione qui sotto è una proprietà del DATO, non del
 * codice — se domani l'organigramma perde la sua unica coppia gerarchica, o il
 * ruolo PLATFORM_ADMIN resta senza titolari, questi test diventano rossi. È il
 * comportamento voluto.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import {
  platformAdmin,
  tenantAdmin,
  managerAndReport,
  outsiderOf,
  actorWithoutMfaFactor,
  functionalPeers,
  hierarchyChain,
  actorWithoutPosition,
} from "./helpers/actors.js";
import { pool } from "../src/db/client.js";

describe("profili degli attori (guardia sul dato reale)", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.app.close();
  });

  it("esiste un amministratore di piattaforma impersonabile", async () => {
    const a = await platformAdmin();
    expect(a.userId).toBeTruthy();
    expect(a.email).toContain("@");
  });

  it("esiste un amministratore di tenant impersonabile", async () => {
    const a = await tenantAdmin();
    expect(a.tenantId).toBeTruthy();
  });

  it("la coppia manager→riporto è una relazione REALE dell'organigramma", async () => {
    const { manager, report } = await managerAndReport();
    expect(report.userId).not.toBe(manager.userId);
    // Non ci si fida di ciò che l'helper ha restituito: si ri-verifica il legame
    // sull'organigramma, che è la fonte.
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n
         FROM sys.sys_positions child
         JOIN sys.sys_positions parent ON child.position_reports_to_position_id = parent.position_id
        WHERE parent.position_owner_user_id = $1 AND child.position_owner_user_id = $2`,
      [manager.userId, report.userId],
    );
    expect(Number(rows[0]?.n ?? 0)).toBeGreaterThan(0);
  });

  it("l'estraneo NON appartiene al sotto-albero del manager (isolamento fra pari, I19)", async () => {
    const { manager } = await managerAndReport();
    const outsider = await outsiderOf(manager);
    expect(outsider.userId).not.toBe(manager.userId);
    const { rows } = await pool.query<{ n: string }>(
      `WITH RECURSIVE sub AS (
         SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = $1
         UNION ALL
         SELECT p.position_id FROM sys.sys_positions p JOIN sub s ON p.position_reports_to_position_id = s.position_id
       )
       SELECT count(*) AS n FROM sys.sys_positions p
        WHERE p.position_owner_user_id = $2 AND p.position_id IN (SELECT position_id FROM sub)`,
      [manager.userId, outsider.userId],
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(0);
  });

  it("l'utente senza secondo fattore viene PREPARATO, non cercato", async () => {
    const a = await actorWithoutMfaFactor("READ_ONLY");
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sys.sys_auth_mfa_factors
        WHERE auth_mfa_factor_user_id = $1 AND auth_mfa_factor_verified`,
      [a.userId],
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(0);
  });

  it("i colleghi funzionali condividono un team e NON un legame gerarchico (I18)", async () => {
    const { a, b } = await functionalPeers();
    expect(a.userId).not.toBe(b.userId);
    // Il team condiviso e' la meta' del profilo...
    const team = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sys.sys_team_members m1
         JOIN sys.sys_team_members m2 ON m1.team_member_team_id = m2.team_member_team_id
        WHERE m1.team_member_user_id = $1 AND m2.team_member_user_id = $2
          AND m1.team_member_is_active AND m2.team_member_is_active`,
      [a.userId, b.userId],
    );
    expect(Number(team.rows[0]?.n ?? 0)).toBeGreaterThan(0);
    // ...l'altra meta' e' l'ASSENZA di gerarchia, in entrambe le direzioni e a
    // qualunque profondita': e' cio' che rende il caso probante per I18.
    const gerarchia = await pool.query<{ n: string }>(
      `WITH RECURSIVE sub AS (
         SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = $1
         UNION ALL
         SELECT p.position_id FROM sys.sys_positions p JOIN sub s ON p.position_reports_to_position_id = s.position_id
       ), sub2 AS (
         SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = $2
         UNION ALL
         SELECT p.position_id FROM sys.sys_positions p JOIN sub2 s ON p.position_reports_to_position_id = s.position_id
       )
       SELECT count(*) AS n FROM sys.sys_positions p
        WHERE (p.position_owner_user_id = $2 AND p.position_id IN (SELECT position_id FROM sub))
           OR (p.position_owner_user_id = $1 AND p.position_id IN (SELECT position_id FROM sub2))`,
      [a.userId, b.userId],
    );
    expect(Number(gerarchia.rows[0]?.n ?? 0)).toBe(0);
  });

  it("la catena gerarchica ha tre livelli REALI e transitivi (I20)", async () => {
    const { top, middle, bottom } = await hierarchyChain();
    expect(new Set([top.userId, middle.userId, bottom.userId]).size).toBe(3);
    // bottom deve stare nel sotto-albero di top SENZA riportargli direttamente:
    // e' esattamente la differenza che la sola coppia diretta non sa esprimere.
    const r = await pool.query<{ diretto: string; transitivo: string }>(
      `WITH RECURSIVE sub AS (
         SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = $1
         UNION ALL
         SELECT p.position_id FROM sys.sys_positions p JOIN sub s ON p.position_reports_to_position_id = s.position_id
       )
       SELECT
         (SELECT count(*) FROM sys.sys_positions c
            JOIN sys.sys_positions pa ON c.position_reports_to_position_id = pa.position_id
           WHERE pa.position_owner_user_id = $1 AND c.position_owner_user_id = $2) AS diretto,
         (SELECT count(*) FROM sys.sys_positions p
           WHERE p.position_owner_user_id = $2 AND p.position_id IN (SELECT position_id FROM sub)) AS transitivo`,
      [top.userId, bottom.userId],
    );
    expect(Number(r.rows[0]?.diretto ?? 0)).toBe(0);
    expect(Number(r.rows[0]?.transitivo ?? 0)).toBeGreaterThan(0);
  });

  it("esiste un utente senza posizione assegnata (il codice non deve presumerla)", async () => {
    const a = await actorWithoutPosition();
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_user_id = $1`,
      [a.userId],
    );
    expect(Number(rows[0]?.n ?? 0)).toBe(0);
  });

  it("gli attori sono davvero impersonabili: il login arriva a una sessione", async () => {
    // La prova che conta: un profilo che non si può autenticare non serve a
    // nessun test. `loginRaw` assorbe il secondo fattore e restituisce la
    // sessione finale, quindi un 401/400 qui fallisce forte.
    const { manager } = await managerAndReport();
    const r = await loginRaw(app.app, manager.email);
    expect(r.statusCode).toBe(200);
    expect((r.json() as { status?: string }).status ?? "success").toBe("success");
  });
});
