/**
 * apps/api/test/user-dossier-sections.integration.test.ts
 *
 * #124 D2 (S1053) — strato 1: l'anagrafica del dossier si spacca in
 * professionale e privata, per SEZIONE.
 *
 * La matrice dei domini (decisione lab 2026-08-03, cella line_management /
 * IDENTITY = mask) dice che il manager di linea vede CHI è la persona sul
 * lavoro — nome, email, organizzazione, rapporto — ma NON la sua sfera
 * privata: indirizzo di casa, familiari, documenti d'identità, coordinate
 * bancarie, contatti personali, emergenze, titoli di studio. Oggi il dossier
 * gli consegna tutto.
 *
 * Nota di perimetro, dichiarata: per la stessa matrice il manager di linea
 * LEGGE la retribuzione (cella line_management/CONTRACT_PAY portata a `read`
 * da Enzo) e la valutazione: qui si trattiene la sfera privata, non il denaro.
 * Self (I17), mandato HR (I20) e mandato piattaforma (IDENTITY = read) vedono
 * le sezioni; il platform resta mascherato su denaro/giudizio (ADR-0032, D1).
 *
 * Attori DERIVATI dal vivo (org-actors): mai email fissate a mano.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { unSottopostoOrganizzativo, type Attore } from "./helpers/org-actors.js";

const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org"; // TENANT_ADMIN — I20
const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";

/** Le sezioni della sfera privata, in ordine alfabetico (il contratto le dichiara così). */
const PRIV_SECTIONS = [
  "addresses", "banking", "contacts", "documents",
  "education", "emergency", "family", "identity",
];

interface Session {
  cookies: Map<string, string>;
}

function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let t: TestApp;
let capo: Attore;
let sottoposto: Attore;
let sessions: Record<string, Session>;
/** Valori privati veri del sottoposto (dal DB): non devono passare al capo. */
let privateValues: string[] = [];

async function login(email: string): Promise<Session> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

beforeAll(async () => {
  t = await buildTestApp();

  // Un capo di LINEA: regge un'unità attiva, può autenticarsi, e non ha né
  // mandato HR né mandato piattaforma (altrimenti misureremmo I20, non la cella).
  const capoRes = await pool.query<Attore>(
    `SELECT u.user_id AS "userId", u.user_email AS email
       FROM sys.sys_users u
      WHERE EXISTS (SELECT 1 FROM sys.sys_organization_units ou
                     WHERE ou.organization_unit_manager_user_id = u.user_id
                       AND ou.organization_unit_is_active)
        AND EXISTS (SELECT 1 FROM sys.sys_auth_identities i
                     JOIN sys.sys_auth_credentials c ON c.auth_credential_identity_id = i.auth_identity_id
                    WHERE i.auth_identity_user_id = u.user_id AND i.auth_identity_is_active)
        AND EXISTS (SELECT 1 FROM sys.sys_auth_mfa_factors f
                     WHERE f.auth_mfa_factor_user_id = u.user_id)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
                          JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
                         WHERE ur.user_auth_role_user_id = u.user_id
                           AND ur.user_auth_role_revoked_at IS NULL
                           AND r.auth_role_code IN ('TENANT_ADMIN','HRMS_MANAGER','PLATFORM_ADMIN'))
      ORDER BY u.user_email
      LIMIT 1`,
  );
  if (!capoRes.rows[0]) throw new Error("nessun capo di linea autenticabile senza mandato HR: verifica cieca");
  capo = capoRes.rows[0];
  sottoposto = await unSottopostoOrganizzativo(pool, capo.userId);

  const priv = await pool.query<{ v: string }>(
    `SELECT user_demographics_tax_id AS v FROM sys.sys_user_demographics WHERE user_demographics_user_id = $1 AND user_demographics_tax_id IS NOT NULL
     UNION
     SELECT user_bank_iban FROM sys.sys_user_bank_details WHERE user_bank_user_id = $1 AND user_bank_iban IS NOT NULL
     UNION
     SELECT user_address_street FROM sys.sys_user_addresses WHERE user_address_user_id = $1 AND user_address_street IS NOT NULL`,
    [sottoposto.userId],
  );
  privateValues = priv.rows.map((r) => r.v).filter((v) => v && v.length >= 6);

  sessions = {
    capo: await login(capo.email),
    hr: await login(HR_MANDATE_EMAIL),
    platform: await login(PLATFORM_EMAIL),
  };
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

async function dossierAs(who: string): Promise<{ raw: string; profile: Record<string, unknown> }> {
  const res = await t.app.inject({
    method: "GET",
    url: `/v1/users/${sottoposto.userId}/dossier`,
    headers: { cookie: cookieHeader(sessions[who]!.cookies) },
  });
  expect(res.statusCode, `dossier(${who}) failed: ${res.body.slice(0, 300)}`).toBe(200);
  const body = res.json() as { profile: Record<string, unknown> };
  return { raw: res.body, profile: body.profile };
}

describe("#124 D2 — la sfera privata del dossier è per il capo una sezione trattenuta", () => {
  it("gira su un universo dove PUÒ fallire", () => {
    expect(capo.userId).toBeTruthy();
    expect(sottoposto.userId).toBeTruthy();
    // se il sottoposto non avesse NESSUN dato privato, il leak-check sarebbe vacuo
    expect(privateValues.length, `${sottoposto.email} non ha né taxId né IBAN né indirizzo: scegliere un altro universo`).toBeGreaterThan(0);
  });

  it("capo di linea: sfera privata assente e dichiarata, sfera professionale intera", async () => {
    const { raw, profile } = await dossierAs("capo");

    expect(profile["maskedSections"]).toEqual(PRIV_SECTIONS);
    for (const s of PRIV_SECTIONS) {
      expect(Object.hasOwn(profile, s), `la sezione ${s} dev'essere ASSENTE per il capo`).toBe(false);
    }

    // il professionale resta: chi è, dove sta, il rapporto di lavoro
    expect(profile["displayName"]).toBeTruthy();
    expect(profile["email"]).toBe(sottoposto.email);
    expect(Object.hasOwn(profile, "organization")).toBe(true);
    expect(Object.hasOwn(profile, "employment")).toBe(true);
    // la cella line_management/CONTRACT_PAY è `read` (decisione Enzo): il
    // salario NON viene mascherato al capo — qui si trattiene la sfera privata
    const employment = profile["employment"] as Record<string, unknown> | null;
    if (employment) expect(Object.hasOwn(employment, "salary")).toBe(true);

    const leaked = privateValues.filter((v) => raw.includes(v));
    expect(leaked, "questi valori privati sono sopravvissuti nel body del capo").toEqual([]);
  });

  it("mandato HR (I20): tutte le sezioni presenti, nessuna trattenuta", async () => {
    const { raw, profile } = await dossierAs("hr");
    expect(profile["maskedSections"]).toBeUndefined();
    for (const s of PRIV_SECTIONS) {
      expect(Object.hasOwn(profile, s), `la sezione ${s} deve esserci per l'HR`).toBe(true);
    }
    expect(
      privateValues.some((v) => raw.includes(v)),
      "l'HR non ha visto nessun valore privato: il confronto col capo non dimostra nulla",
    ).toBe(true);
  });

  it("mandato piattaforma: IDENTITY è `read` — sezioni presenti (denaro/giudizio restano mascherati, D1)", async () => {
    const { profile } = await dossierAs("platform");
    expect(profile["maskedSections"]).toBeUndefined();
    for (const s of PRIV_SECTIONS) {
      expect(Object.hasOwn(profile, s), `la sezione ${s} deve esserci per il platform`).toBe(true);
    }
    // e il D1 continua a valere nello stesso response
    const employment = profile["employment"] as Record<string, unknown> | null;
    if (employment) expect(Object.hasOwn(employment, "salary")).toBe(false);
  });
});
