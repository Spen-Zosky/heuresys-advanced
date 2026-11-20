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

/** Le rotte GET dichiarate. `printRoutes` stampa un ALBERO (i figli portano solo il pezzo che segue il padre,
 *  anche con commonPrefix:false): il percorso intero si ricostruisce dalla profondita' di ogni riga. */
export function rotteDaAlbero(testo: string): string[] {
  const out = new Set<string>();
  const pila: string[] = [];
  for (const riga of testo.split("\n")) {
    const m = /^((?:│   |    )*)(?:├── |└── )(.+?)(?: \(([^)]*)\))?\s*$/.exec(riga);
    if (!m) continue;
    const profondita = m[1]!.length / 4;
    pila.length = profondita;
    pila[profondita] = m[2]!;
    const metodi = m[3]?.split(",").map((x) => x.trim()) ?? [];
    if (metodi.includes("GET")) out.add(pila.join("").replace(/(.)\/$/, "$1"));
  }
  return [...out].sort();
}

function rotteGet(t: TestApp): string[] {
  return rotteDaAlbero(t.app.printRoutes({ commonPrefix: false }));
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

/** Il database della corsa non ha il modello con i contratti, e il difetto delle date compare solo con la riga: la prova
 *  porta con se' un tenant con un contratto datato in una versione non attiva (rollback a fine file, come ogni fixture). */
async function seminaTenantConContratti(): Promise<string> {
  const cod = `T_GUARD_${Math.random().toString(16).slice(2, 10)}`;
  const ind = await pool.query<{ c: string }>(`SELECT tenant_industry_code AS c FROM sys.sys_tenancies WHERE tenant_industry_code IS NOT NULL LIMIT 1`);
  const ten = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status, tenant_industry_code)
     VALUES ($1, 'Guardia risposte', 'ACTIVE', $2) RETURNING tenant_id AS id`, [cod, ind.rows[0]?.c ?? null]);
  const tenantId = ten.rows[0]!.id;
  const fam = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name, blueprint_family_description)
     VALUES ($1, 'Guardia', 'Guardia') RETURNING blueprint_family_id AS id`, [cod]);
  const ver = async (codice: string, stato: string) => {
    const v = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name, blueprint_variant_description)
       VALUES ($1, $2, 'Guardia', 'Guardia') RETURNING blueprint_variant_id AS id`, [fam.rows[0]!.id, `${cod}_${codice}`]);
    const vv = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_blueprint_variant_versions (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
       VALUES ($1, 2, $2) RETURNING blueprint_variant_version_id AS id`, [v.rows[0]!.id, stato]);
    return { variante: v.rows[0]!.id, versione: vv.rows[0]!.id };
  };
  const attiva = await ver("ATTIVA", "PUBLISHED");
  const altra = await ver("ALTRA", "DRAFT");
  await pool.query(
    `INSERT INTO sys.sys_blueprint_activations (blueprint_activation_tenant_id, blueprint_activation_variant_id, blueprint_activation_variant_version_id, blueprint_activation_status)
     VALUES ($1, $2, $3, 'ACTIVE')`, [tenantId, attiva.variante, attiva.versione]);
  await pool.query(
    `INSERT INTO sys.sys_blueprint_content_ccnl (blueprint_content_ccnl_version_id, blueprint_content_ccnl_code, blueprint_content_ccnl_name, blueprint_content_ccnl_effective)
     VALUES ($1, 'CCNL_G', 'Contratto della guardia', DATE '2024-01-01')`, [altra.versione]);
  await pool.query(
    `INSERT INTO sys.sys_blueprint_content_ccnl_levels (blueprint_content_ccnl_level_version_id, blueprint_content_ccnl_level_ccnl_code,
       blueprint_content_ccnl_level_code, blueprint_content_ccnl_level_name, blueprint_content_ccnl_level_annual_minimum_eur)
     VALUES ($1, 'CCNL_G', 'CCNL_G_L1', 'Livello 1', 30000)`, [altra.versione]);
  await pool.query(
    `INSERT INTO sys.sys_blueprint_runs (blueprint_run_tenant_id, blueprint_run_code, blueprint_run_package_version, blueprint_run_package_hash,
       blueprint_run_variant_version_id, blueprint_run_model_label, blueprint_run_model_loaded_at)
     VALUES ($1, 'RG', 1, repeat('a', 64), $2, 'Guardia', now())`, [tenantId, altra.versione]);
  return tenantId;
}

let t: TestApp;
let rtlId = "";
let provaId = "";
const attori: Array<{ nome: string; s: S }> = [];

describe("nessuna risposta fuori contratto con dati veri", () => {
  beforeAll(async () => {
    t = await buildTestApp();
    const { rows: [rtl] } = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    if (!rtl) throw new Error("il tenant RTL_BANK non esiste piu': la prova non ha piu' dati veri da leggere");
    rtlId = rtl.id;
    provaId = await seminaTenantConContratti();
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
    const rotteChiamate = new Set<string>();

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
            if (prefisso === "/v1/tenants") for (const x of [rtlId, provaId]) if (!ids.includes(x)) ids.push(x);
            idDa.set(prefisso, ids);
          }
          urls = (idDa.get(prefisso) ?? []).map((id) => rotta.replace(parametri[0]!, id));
        } else if (parametri.length > 1) {
          continue;
        }
        for (const url of urls) {
          const r = await chiama(url, s);
          chiamate++;
          rotteChiamate.add(rotta);
          const codice = (r.corpo as { error?: { code?: string } } | null)?.error?.code;
          if (r.status === 500 && codice === "RESPONSE_CONTRACT_VIOLATION") violazioni.push(`${nome}: GET ${url}  (rotta ${rotta})`);
        }
      }
    }

    expect(chiamate, "nessuna rotta e' stata chiamata").toBeGreaterThan(50);
    // Canarino: la rotta che ha motivato la guardia deve essere stata davvero chiamata, altrimenti la prova e' cieca.
    expect([...rotteChiamate], "la rotta dei contratti non e' stata chiamata: la guardia e' cieca").toContain("/v1/tenants/:id/contracts");
    expect(violazioni, "rotte che rispondono fuori dal proprio contratto con dati veri").toEqual([]);
  }, 900_000);
});
