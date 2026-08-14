/**
 * apps/api/scripts/prova-live-92-f6.mts — #92 F6, la dimostrazione LIVE.
 *
 * Le due pagine costruite in F6 non inventano nulla: chiamano quattro endpoint. Questo
 * script fa **login reale** con due persone vere e interroga esattamente quei quattro,
 * stampando i dati che le pagine mostreranno. Se qui esce vuoto o 403, la pagina è una
 * scenografia — ed è precisamente ciò che la dottrina live-data vieta.
 *
 *   npx tsx apps/api/scripts/prova-live-92-f6.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";
import { pool, closePool } from "../src/db/client.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
/** Mandato HR: vede la pagina manageriale per intero. */
const HR = "federica.marchetti@rtl-bank.org";

function totp(email: string): string {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) return "";
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

async function login(email: string): Promise<string> {
  const password = passwordFor(email);
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

async function get(cookie: string, path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: { cookie } });
  const raw = await r.text();
  if (r.status !== 200) throw new Error(`GET ${path}: ${r.status} ${raw.slice(0, 200)}`);
  return JSON.parse(raw) as { items?: Record<string, unknown>[]; total?: number };
}

async function main() {
  console.log(`\n=== #92 F6 — prova LIVE su ${BASE} ===\n`);

  // ---- lato manageriale, con un mandato HR reale --------------------------------------
  const hr = await login(HR);
  console.log(`login reale: ${HR}`);

  const cicli = await get(hr, "/v1/review-cycles?limit=50&offset=0");
  const reviews = await get(hr, "/v1/performance-reviews?limit=25&offset=0");
  const calib = await get(hr, "/v1/calibration-sessions?limit=100&offset=0");

  console.log(`  /v1/review-cycles         total=${cicli.total ?? 0}`);
  console.log(`  /v1/performance-reviews   total=${reviews.total ?? 0}  (pagina 25)`);
  console.log(`  /v1/calibration-sessions  total=${calib.total ?? 0}`);

  const r0 = reviews.items?.[0];
  if (r0) {
    console.log(`  prima valutazione: periodo ${r0["periodStart"]} → ${r0["periodEnd"]}, ` +
      `tipo ${r0["type"]}, stato ${r0["status"]}, giudizio ${r0["overallRating"] ?? "(assente)"}, ` +
      `comunicata ${r0["sharedAt"] ? "sì" : "no"}`);
  }
  const c0 = calib.items?.[0];
  if (c0) console.log(`  prima sessione: "${c0["name"]}" area ${c0["department"] ?? "—"} stato ${c0["status"]}`);

  // ---- lato ESS, con una persona SENZA mandati ------------------------------------------
  // Derivata dal database, non cablata: dev'essere una che HA valutazioni comunicate,
  // altrimenti la prova guarderebbe una lista vuota e non direbbe nulla.
  const q = await pool.query<{ email: string; comunicate: string }>(
    `SELECT u.user_email AS email, count(*)::text AS comunicate
       FROM sys.sys_users u
       JOIN sys.sys_performance_reviews r ON r.review_subject_user_id = u.user_id
      WHERE u.user_status = 'ACTIVE'
        AND (r.review_shared_at IS NOT NULL OR r.review_acknowledged_at IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles ur
            JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
           WHERE ur.user_auth_role_user_id = u.user_id
             AND ur.user_auth_role_revoked_at IS NULL
             AND ro.auth_role_code NOT IN ('USER', 'TEAM_MEMBER'))
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
  );
  const persona = q.rows[0];
  if (!persona) throw new Error("nessuna persona senza mandati con valutazioni comunicate: prova cieca");

  const ess = await login(persona.email);
  console.log(`\nlogin reale (nessun mandato): ${persona.email}`);
  const mie = await get(ess, "/v1/me/performance");
  console.log(`  /v1/me/performance        total=${mie.total ?? 0}  (il database ne conta ${persona.comunicate} comunicate)`);
  const m0 = mie.items?.[0];
  if (m0) {
    console.log(`  prima: periodo ${m0["periodStart"]} → ${m0["periodEnd"]}, tipo ${m0["type"]}, ` +
      `giudizio ${m0["overallRating"] ?? "(mascherato/assente)"}, mascherati: ` +
      `${JSON.stringify(m0["masked"] ?? [])}`);
  }

  if (Number(mie.total ?? 0) !== Number(persona.comunicate)) {
    throw new Error(`ESS: la persona vede ${mie.total} valutazioni ma ne ha ${persona.comunicate} comunicate`);
  }
  console.log(`\n✓ le quattro superfici rispondono con dati reali\n`);
  await closePool();
}

main().catch(async (e) => {
  console.error("PROVA LIVE FALLITA:", e instanceof Error ? e.message : e);
  await closePool();
  process.exit(1);
});
