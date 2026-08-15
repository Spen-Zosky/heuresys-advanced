/**
 * apps/api/scripts/prova-live-142-f2.mts — #142 F2, la dimostrazione LIVE.
 *
 * F2 consegna il MODELLO dei cruscotti (mig. `000316`) e corregge i due residui del modulo
 * `dashboard`. Le pagine delle otto famiglie non esistono ancora — le costruisce F4 — quindi
 * cio' che si dimostra qui e' cio' che F2 ha davvero cambiato **dal lato in cui lo vede una
 * persona**:
 *
 *   1. l'etichetta del ruolo non viene piu' da una lista scritta a mano ma dall'ampiezza
 *      reale della concessione (`valentina.conti` e' il caso che le due strade separano);
 *   2. il perimetro di chi guida viene dall'albero delle UNITA' (ADR-0036) e non piu' da
 *      quello delle posizioni: chi vedeva una pagina vuota ora vede i propri dati;
 *   3. il modello e' interrogabile: per ciascuna persona si stampa a quali famiglie ha
 *      diritto — il permesso RBAC come *se*, M1 come restrizione.
 *
 * I soggetti sono scelti DIVERSI fra loro, perche' interrogare quattro persone equivalenti
 * non e' una prova:
 *   · valentina.conti  HRMS_MANAGER + ORG_DIRECTOR  → tier TENANT, ed e' il caso in cui la
 *                                                     lista cancellata sbagliava
 *   · luca.bianchi     PROCESS_OWNER                → tier TENANT per un altro mandato
 *   · marta.pellegrini MANAGER                      → tier TEAM: perimetro guadagnato
 *   · cristina.gatti   BRANCH_MANAGER               → tier TEAM, ed e' la titolare designata
 *                                                     del cruscotto Filiale
 *
 *   npx tsx apps/api/scripts/prova-live-142-f2.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { readMaster, derivePassword, deriveTotpSecret } from "./derive-access.mjs";
import { pool, closePool } from "../src/db/client.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const master = readMaster();

const SOGGETTI = [
  "valentina.conti@rtl-bank.org",
  "luca.bianchi@rtl-bank.org",
  "marta.pellegrini@rtl-bank.org",
  "cristina.gatti@rtl-bank.org",
];

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

interface Widgets {
  role: string;
  scope: { kind: string; tenantId: string | null; teamPositionIds: string[] };
  counters: Record<string, number>;
}

async function main(): Promise<void> {
  console.log(`\n#142 F2 — dimostrazione LIVE su dati reali · ${new Date().toISOString()}`);
  console.log(`API: ${BASE}\n`);

  console.log("── Il modello, letto dal database di produzione ─────────────────────────");
  const modello = await pool.query<{ code: string; permesso: string | null; viste: string; classi: string }>(
    `SELECT d.dashboard_code AS code, d.dashboard_permission_code AS permesso,
            count(DISTINCT b.dashboard_block_id)::text AS viste,
            coalesce(string_agg(DISTINCT c.data_class, ',' ORDER BY c.data_class), '—') AS classi
       FROM sys.sys_dashboards d
       LEFT JOIN sys.sys_dashboard_blocks b ON b.dashboard_id = d.dashboard_id
       LEFT JOIN sys.sys_dashboard_block_data_classes c ON c.dashboard_block_id = b.dashboard_block_id
      GROUP BY 1, 2 ORDER BY 1`,
  );
  for (const r of modello.rows) {
    console.log(`  ${r.code.padEnd(9)} ${(r.permesso ?? "(nessuno — I17)").padEnd(26)} ${r.viste} viste · ${r.classi}`);
  }

  console.log("\n── Quattro persone reali, quattro profili diversi ───────────────────────");
  for (const email of SOGGETTI) {
    const cookie = await login(email);
    const r = await fetch(`${BASE}/v1/dashboard/widgets`, { headers: { cookie } });
    if (r.status !== 200) throw new Error(`GET /v1/dashboard/widgets per ${email}: ${r.status}`);
    const w = (await r.json()) as Widgets;

    // A quali famiglie ha diritto, secondo il modello appena creato.
    const diritti = await pool.query<{ code: string }>(
      `SELECT d.dashboard_code AS code
         FROM sys.sys_dashboards d
         JOIN sys.sys_auth_permissions p ON p.auth_permission_code = d.dashboard_permission_code
         JOIN sys.sys_auth_role_permissions rp ON rp.auth_permission_id = p.auth_permission_id
         JOIN sys.sys_user_auth_roles uar ON uar.user_auth_role_role_id = rp.auth_role_id
         JOIN sys.sys_users u ON u.user_id = uar.user_auth_role_user_id
        WHERE u.user_email = $1 AND uar.user_auth_role_revoked_at IS NULL
        GROUP BY 1 ORDER BY 1`,
      [email],
    );

    console.log(`\n  ${email}`);
    console.log(`    etichetta ruolo (derivata) : ${w.role}`);
    console.log(`    tier                       : ${w.scope.kind}`);
    console.log(`    perimetro (posizioni)      : ${w.scope.teamPositionIds.length}`);
    console.log(`    utenti visti dal cruscotto : ${w.counters.users ?? "—"}`);
    console.log(`    famiglie a cui ha diritto  : ${diritti.rows.map((x) => x.code).join(", ") || "(nessuna)"} + self`);
  }

  console.log("\n── La sentinella del disallineamento ────────────────────────────────────");
  const drift = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM sys.v_dashboard_class_drift`);
  console.log(`  v_dashboard_class_drift: ${drift.rows[0]!.n} righe (atteso 0)`);

  await closePool();
  console.log("\nfine.\n");
}

main().catch(async (e) => {
  console.error(e);
  await closePool();
  process.exit(1);
});
