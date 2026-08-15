/**
 * apps/api/scripts/prova-live-99-f7.mts — #99 F7, la dimostrazione LIVE.
 *
 * F7 fa discendere la sidebar dalla matrice M1 invece che dal flag `requires_admin`. Il
 * contro-oracolo sul database dice che l'accesso di nessuno cambia, tranne una voce; questo
 * script lo verifica **dal lato in cui lo vede una persona**: tre login reali, la stessa
 * rotta che alimenta la sidebar (`GET /v1/me/interfaces`), e le voci che ne escono.
 *
 * I tre soggetti sono scelti per essere DIVERSI dal punto di vista dei domini, perché una
 * prova che interroga tre persone equivalenti non è una prova:
 *   · chi non ha alcun dominio che apre una superficie  → la matrice non ha nulla da aprirgli
 *   · chi dirige un'unità                                → M1 gli apre EVALUATION e maschera la paga
 *   · il custode delle segnalazioni                      → il dominio `custody`, nato con F7
 *
 *   npx tsx apps/api/scripts/prova-live-99-f7.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { readMaster, derivePassword, deriveTotpSecret } from "./derive-access.mjs";
import { pool, closePool } from "../src/db/client.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const master = readMaster();

function totp(email: string): string {
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(deriveTotpSecret(master, email)),
  }).generate();
}

async function login(email: string): Promise<string> {
  const password = derivePassword(master, email);
  const post = async (payload: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  type Body = { status?: string; challengeToken?: string };
  let r = await post({ email, password });
  let body = (await r.json()) as Body;
  if (body.status === "mfa_required") {
    r = await post({ email, password, challengeToken: body.challengeToken, mfaCode: totp(email) });
    body = (await r.json()) as Body;
  }
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(body)}`);
  const cookies = (r.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

interface Interfacce {
  perspectives: { code: string; interfaces: { code: string; label: string }[] }[];
}

async function vociDi(email: string): Promise<Set<string>> {
  const cookie = await login(email);
  const r = await fetch(`${BASE}/v1/me/interfaces`, { headers: { cookie } });
  if (r.status !== 200) throw new Error(`GET /v1/me/interfaces: ${r.status}`);
  const body = (await r.json()) as Interfacce;
  const out = new Set<string>();
  for (const p of body.perspectives) for (const i of p.interfaces) out.add(i.code);
  return out;
}

/** Una persona attiva SENZA alcun dominio che apra una superficie — derivata, non scelta. */
const SENZA_DOMINI = `
  SELECT u.user_email FROM sys.sys_users u
   WHERE u.user_status = 'ACTIVE'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_units o
                      WHERE o.organization_unit_manager_user_id = u.user_id AND o.organization_unit_is_active)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_teams t WHERE t.team_lead_user_id = u.user_id)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_process_participants p
                      WHERE p.process_participant_user_id = u.user_id
                        AND p.process_participant_role = 'OWNER' AND p.process_participant_is_active)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
                       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
                      WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
                        AND (r.auth_role_is_platform OR r.auth_role_code IN ('TENANT_ADMIN','HRMS_MANAGER')))
   ORDER BY u.user_email LIMIT 1`;

const CUSTODE = `
  SELECT u.user_email FROM sys.sys_users u
    JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
     AND ur.user_auth_role_revoked_at IS NULL
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
   WHERE u.user_status = 'ACTIVE' AND r.auth_role_code = 'WHISTLEBLOWING_CUSTODIAN'
   ORDER BY u.user_email LIMIT 1`;

const CAPO = `
  SELECT u.user_email FROM sys.sys_users u
   WHERE u.user_status = 'ACTIVE'
     AND EXISTS (SELECT 1 FROM sys.sys_organization_units o
                  WHERE o.organization_unit_manager_user_id = u.user_id AND o.organization_unit_is_active)
     AND EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
                   JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
                  WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
                    AND r.auth_role_code = 'MANAGER')
   ORDER BY u.user_email LIMIT 1`;

async function unaEmail(sql: string, cosa: string): Promise<string> {
  const { rows } = await pool.query<{ user_email: string }>(sql);
  const e = rows[0]?.user_email;
  if (!e) throw new Error(`nessuna persona trovata per: ${cosa}`);
  return e;
}

async function main() {
  console.log(`\n=== #99 F7 — prova LIVE su ${BASE} ===\n`);

  const senzaDomini = await unaEmail(SENZA_DOMINI, "persona senza domini");
  const capo = await unaEmail(CAPO, "capo di unità");
  const custode = await unaEmail(CUSTODE, "custode delle segnalazioni");

  const vSenza = await vociDi(senzaDomini);
  const vCapo = await vociDi(capo);
  const vCustode = await vociDi(custode);

  console.log(`login reale: ${senzaDomini}  (nessun dominio)   → ${vSenza.size} voci`);
  console.log(`login reale: ${capo}  (dirige un'unità)  → ${vCapo.size} voci`);
  console.log(`login reale: ${custode}  (custode)          → ${vCustode.size} voci\n`);

  const esiti: [string, boolean, string][] = [
    ["chi non ha domini NON riceve la pagina di governo delle iniziative formative",
     !vSenza.has("LEARNING_INITIATIVES"),
     "era offerta a 109 persone con `requires_admin=false`: stesso difetto di D1"],
    ["…e conserva la sua area personale (I17, il pavimento universale)",
     [...vSenza].some((c) => c.startsWith("me-") || c.startsWith("ME_")),
     "se sparisse anche questa, la derivazione avrebbe mangiato il pavimento"],
    ["chi dirige un'unità riceve le valutazioni (M1: line_management/EVALUATION = edit)",
     vCapo.has("performance") || vCapo.has("goals") || vCapo.has("okrs"),
     "M1 gliele apre: se non arrivano, la derivazione è troppo stretta"],
    ["il custode riceve la console delle segnalazioni (dominio `custody`, nato con F7)",
     vCustode.has("whistleblowing-console"),
     "prima di F7 `custody` non esisteva come dominio: è la prova che si accende"],
    ["…e chi non ha domini NON la riceve",
     !vSenza.has("whistleblowing-console"),
     "l'isolamento assoluto di ADR-0036 §5, guardato dal lato del menu"],
  ];

  let rossi = 0;
  for (const [titolo, ok, perche] of esiti) {
    console.log(`  ${ok ? "OK  " : "ROSSO"}  ${titolo}`);
    if (!ok) { console.log(`         ↳ ${perche}`); rossi++; }
  }

  console.log(`\n=== ESITO: ${rossi === 0 ? "VERDE" : `${rossi} ROSSI`} ===\n`);
  await closePool();
  process.exit(rossi === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await closePool();
  process.exit(1);
});
