/**
 * apps/api/scripts/chiama-come.mts
 * Legge un endpoint dell'API di produzione come una persona del tenant (solo GET):
 * accesso derivato in due passi (password derivata, poi il fattore TOTP con etichetta
 * derived-access letto dal database in sola lettura, come fa scripts/qa-web/adattatore.mjs).
 * Serve al controllo forense del frontend: confrontare ciò che la pagina riceve con il database.
 * Nessuna password, codice o cookie viene stampato.
 *
 *   cd apps/api && npx tsx scripts/chiama-come.mts <email> </v1/percorso?query> [base]
 *   base predefinita: https://www.heuresys.com/api
 */
import * as OTPAuth from "otpauth";
import { readMaster, derivePassword } from "./derive-access.mjs";
import { pool } from "../src/db/client.ts";
import { decryptSecret } from "../src/modules/auth/secret-crypto.ts";

const [email, percorso, base = "https://www.heuresys.com/api"] = process.argv.slice(2);
if (!email || !percorso || !percorso.startsWith("/v1/")) {
  console.error("uso: npx tsx scripts/chiama-come.mts <email> </v1/percorso> [base]");
  process.exit(1);
}
const password = derivePassword(readMaster(), email);

async function segretoTotp(): Promise<string | null> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN READ ONLY");
    const r = await c.query(
      `select f.auth_mfa_factor_secret s from sys.sys_auth_mfa_factors f
         join sys.sys_users u on u.user_id = f.auth_mfa_factor_user_id
        where lower(u.user_email) = lower($1) and f.auth_mfa_factor_kind = 'TOTP'
          and f.auth_mfa_factor_metadata->>'label' = 'derived-access' limit 1`,
      [email],
    );
    await c.query("ROLLBACK");
    return r.rows[0]?.s ? decryptSecret(r.rows[0].s) : null;
  } finally {
    c.release();
  }
}

const cookie = (r: Response) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const post = (corpo: object) =>
  fetch(`${base}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });

try {
  let r = await post({ email, password });
  let b: any = await r.json().catch(() => ({}));
  if (r.status === 200 && b.status === "mfa_required") {
    const s = await segretoTotp();
    if (!s) throw new Error("secondo fattore richiesto e nessun fattore derived-access");
    const mfaCode = new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(s) }).generate();
    r = await post({ email, password, challengeToken: b.challengeToken, mfaCode });
    b = await r.json().catch(() => ({}));
  }
  if (r.status !== 200) {
    console.error(`accesso rifiutato: HTTP ${r.status} ${b?.error?.code ?? b?.status ?? ""}`);
    process.exitCode = 2;
  } else {
    const g = await fetch(`${base}${percorso}`, { headers: { cookie: cookie(r), accept: "application/json" } });
    console.error(`GET ${percorso} → HTTP ${g.status}`);
    console.log(await g.text());
    if (g.status >= 400) process.exitCode = 3;
  }
} catch (e) {
  console.error(`errore: ${(e as Error).message}`);
  process.exitCode = 2;
} finally {
  await pool.end();
}
