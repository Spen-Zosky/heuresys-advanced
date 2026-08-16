/**
 * apps/api/scripts/prova-live-199.mts — prova LIVE di #199 / E24 (S1066).
 *
 * Definition of Done del progetto: nessuno step si chiude su green-test. Questa
 * prova non usa `app.inject()` né la transazione rollbackata della suite: parla
 * HTTP con l'API in esecuzione, con login reale (password derivata + secondo
 * fattore) e agisce sul fascicolo VERO di RTL Bank, sul database di produzione.
 *
 * Che cosa dimostra: `linkTenant` aggiornava senza guardare il valore precedente,
 * quindi `RTL-BANK-CONFIG` — approvato e legato a RTL_BANK — poteva essere
 * spostato su un'altra azienda con UNA chiamata, e riusciva. Qui si tenta
 * davvero quello spostamento.
 *
 * Perché è sicuro tentarlo sul dato vero: se la guardia c'è, l'UPDATE non trova
 * righe e non scrive nulla; se non ci fosse, lo si vedrebbe dal passo 3, che
 * ri-legge il legame dal database — ed è esattamente ciò che la prova deve poter
 * mostrare. Il passo 3 è la rete: senza, un 409 di comodo passerebbe per prova.
 *
 *   pnpm exec tsx scripts/prova-live-199.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";
import { pool, closePool } from "../src/db/client.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const ADMIN = "enzo.spenuso@heuresys.com";

function totp(email: string): string {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) throw new Error(`nessun secondo fattore di prova per ${email}`);
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

async function login(email: string): Promise<{ cookie: string; csrf: string }> {
  const password = passwordFor(email);
  const post = async (payload: Record<string, unknown>): Promise<Response> =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  type Body = { status?: string; challengeToken?: string; csrfToken?: string };
  let r = await post({ email, password });
  let body = (await r.json()) as Body;
  if (body.status === "mfa_required") {
    r = await post({ email, password, challengeToken: body.challengeToken, mfaCode: totp(email) });
    body = (await r.json()) as Body;
  }
  if (!body.csrfToken) throw new Error(`login fallito per ${email}: ${JSON.stringify(body)}`);
  const cookie = (r.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("login senza cookie di sessione");
  return { cookie, csrf: body.csrfToken };
}

async function legameDi(code: string): Promise<{ id: string; tenant: string | null }> {
  const { rows } = await pool.query<{ id: string; tenant: string | null }>(
    `SELECT b.tenant_blueprint_id AS id, t.tenant_code AS tenant
       FROM sys.sys_tenant_blueprints b
       LEFT JOIN sys.sys_tenancies t ON t.tenant_id = b.tenant_blueprint_tenant_id
      WHERE b.tenant_blueprint_code = $1`,
    [code],
  );
  if (!rows[0]) throw new Error(`il fascicolo ${code} non esiste: la prova non è misurabile`);
  return rows[0];
}

async function main(): Promise<void> {
  console.log(`# prova LIVE #199 (E24) — ${BASE} — ${new Date().toISOString()}`);

  // 1. lo stato PRIMA, letto dal database e non assunto
  const prima = await legameDi("RTL-BANK-CONFIG");
  const { rows: [altra] } = await pool.query<{ id: string; code: string }>(
    `SELECT t.tenant_id AS id, t.tenant_code AS code FROM sys.sys_tenancies t
      WHERE t.tenant_id <> (SELECT tenant_blueprint_tenant_id FROM sys.sys_tenant_blueprints
                             WHERE tenant_blueprint_code = 'RTL-BANK-CONFIG')
      ORDER BY t.tenant_code LIMIT 1`,
  );
  if (!altra) throw new Error("serve una seconda azienda su cui tentare lo spostamento");
  console.log(`1. PRIMA  — RTL-BANK-CONFIG (${prima.id}) è legato a: ${prima.tenant}`);
  console.log(`   bersaglio del tentativo: ${altra.code} (${altra.id})`);

  // 2. il tentativo vero, via HTTP, con una sessione reale
  const s = await login(ADMIN);
  const r = await fetch(`${BASE}/v1/tenant-blueprints/${prima.id}/link-tenant`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: s.cookie, "x-csrf-token": s.csrf },
    body: JSON.stringify({ tenantId: altra.id }),
  });
  const corpo = (await r.json()) as { error?: { code?: string; message?: string } };
  console.log(`2. TENTATIVO — POST link-tenant → HTTP ${r.status}`);
  console.log(`   codice : ${corpo.error?.code ?? "(nessuno: la chiamata è RIUSCITA)"}`);
  console.log(`   messaggio: ${corpo.error?.message ?? "-"}`);

  // 3. lo stato DOPO. È qui che la prova può fallire: un 409 senza questo passo
  //    non dimostra che non sia stato scritto nulla.
  const dopo = await legameDi("RTL-BANK-CONFIG");
  console.log(`3. DOPO   — RTL-BANK-CONFIG è legato a: ${dopo.tenant}`);

  const ok =
    r.status === 409 &&
    corpo.error?.code === "BLUEPRINT_LINK_IS_PERMANENT" &&
    dopo.tenant === prima.tenant &&
    dopo.tenant !== null;
  console.log(`\nVERDETTO: ${ok ? "GUARDIA ATTIVA — lo spostamento è rifiutato e il legame è intatto"
    : "FALLITA — " + (r.status !== 409 ? `HTTP ${r.status}` : "")
      + (corpo.error?.code !== "BLUEPRINT_LINK_IS_PERMANENT" ? ` codice ${corpo.error?.code}` : "")
      + (dopo.tenant !== prima.tenant ? ` IL LEGAME È CAMBIATO: ${prima.tenant} → ${dopo.tenant}` : "")}`);
  await closePool();
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => {
  console.error("ERRORE:", e instanceof Error ? e.message : e);
  await closePool();
  process.exit(2);
});
