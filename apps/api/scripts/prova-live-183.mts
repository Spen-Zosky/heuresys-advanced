/**
 * apps/api/scripts/prova-live-183.mts — prova LIVE di #183 (S1055).
 *
 * Definition of Done del progetto: nessuno step si chiude su green-test. Questa
 * prova non usa `app.inject()`: parla HTTP con l'API in esecuzione, con login
 * reale (password derivata + secondo fattore) di una persona con mandato HR, e
 * misura il FASCICOLO dell'art. 15 di una persona reale.
 *
 * Che cosa dimostra: prima di `000304` il registro GDPR era cieco su 27 tabelle
 * di appartenenza, quindi ferie, straordinari, obiettivi, sondaggi e squadre NON
 * comparivano nel fascicolo. Qui si guarda se ci sono.
 *
 *   pnpm exec tsx scripts/prova-live-183.mts [https://www.heuresys.com]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const HR = "federica.marchetti@rtl-bank.org";

/** Le tabelle che PRIMA di 000304 non erano nel registro: se compaiono nel
 *  fascicolo, la correzione è arrivata fino all'interessato. */
const ATTESE = [
  "sys_survey_assignments",
  "sys_goal_check_ins",
  "sys_time_off_requests",
  "sys_time_off_balances",
  "sys_overtime",
  "sys_team_members",
];

function totp(email: string): string {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) throw new Error(`nessun secondo fattore di prova per ${email}`);
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

async function login(email: string): Promise<{ cookie: string; csrf: string; userId: string }> {
  const password = passwordFor(email);
  const post = async (payload: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  type Body = { status?: string; challengeToken?: string; csrfToken?: string; user?: { userId?: string; id?: string } };
  let r = await post({ email, password });
  let body = (await r.json()) as Body;
  if (body.status === "mfa_required") {
    r = await post({ email, password, challengeToken: body.challengeToken, mfaCode: totp(email) });
    body = (await r.json()) as Body;
  }
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(body)}`);
  const cookies = (r.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
  return {
    cookie: cookies.map((c) => c.split(";")[0]).join("; "),
    csrf: body.csrfToken ?? "",
    userId: body.user?.userId ?? body.user?.id ?? "",
  };
}

const main = async (): Promise<void> => {
  console.log(`\n=== PROVA LIVE #183 — fascicolo art. 15 su ${BASE} ===`);
  console.log(`quando: ${new Date().toISOString()}\n`);

  const hr = await login(HR);
  console.log(`login reale: ${HR} → ok`);

  // Il soggetto è una persona reale del tenant, scelta fra chi ha storia:
  // si interroga l'elenco utenti invece di cablare un identificativo.
  const lista = await fetch(`${BASE}/v1/users?limit=50`, { headers: { cookie: hr.cookie } });
  if (lista.status !== 200) throw new Error(`GET /v1/users: ${lista.status}`);
  const { items } = (await lista.json()) as { items: { userId: string; email: string }[] };
  const soggetto = items.find((u) => u.email.endsWith("@rtl-bank.org") && u.userId !== hr.userId);
  if (!soggetto) throw new Error("nessun soggetto reale trovato");
  console.log(`soggetto: ${soggetto.email}`);

  const r = await fetch(`${BASE}/v1/gdpr/users/${soggetto.userId}/export`, {
    method: "POST",
    headers: { cookie: hr.cookie, "x-csrf-token": hr.csrf },
  });
  const raw = await r.text();
  if (r.status !== 200) throw new Error(`export: ${r.status} ${raw.slice(0, 300)}`);
  // `tables` è un dizionario con chiave "schema.tabella[.colonna]", non un elenco.
  const bundle = JSON.parse(raw) as {
    subject?: { email?: string };
    tables?: Record<string, { rows?: unknown[]; rowCount?: number }>;
  };

  const tabelle = bundle.tables ?? {};
  const chiavi = Object.keys(tabelle);
  console.log(`\nvoci nel fascicolo: ${chiavi.length}`);

  const conta = (k: string): number => {
    const t = tabelle[k];
    return t?.rowCount ?? t?.rows?.length ?? 0;
  };

  let mancanti = 0;
  let righeNuove = 0;
  console.log(`\n--- le tabelle che PRIMA di 000304 non c'erano ---`);
  for (const nome of ATTESE) {
    const chiave = chiavi.find((k) => k.split(".")[1] === nome);
    if (!chiave) { console.log(`  ASSENTE  ${nome}`); mancanti++; continue; }
    const n = conta(chiave);
    righeNuove += n;
    console.log(`  presente ${chiave} — ${n} righe`);
  }
  console.log(`\nrighe della persona che prima non entravano nel fascicolo: ${righeNuove}`);

  if (mancanti > 0) {
    console.log(`\n=== ESITO: ROSSO — ${mancanti} tabelle attese non sono nel fascicolo ===`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n=== ESITO: VERDE — il fascicolo contiene tutte e ${ATTESE.length} le tabelle prima invisibili ===`);
};

main().catch((e: unknown) => {
  console.error(`\n=== ESITO: ROSSO — ${e instanceof Error ? e.message : String(e)} ===`);
  process.exitCode = 1;
});
