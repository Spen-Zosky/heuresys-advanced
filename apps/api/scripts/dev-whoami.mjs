#!/usr/bin/env node
/**
 * apps/api/scripts/dev-whoami.mjs
 * Z-262 — mostra le credenziali di accesso di un utente, RICALCOLANDOLE dalla
 * chiave madre. Nessuna password e' scritta da nessuna parte: esiste solo per
 * la durata di questo comando.
 *
 * Non invocarlo direttamente: usa `pnpm dev:whoami <email>` (oppure i wrapper
 * scripts/dev-whoami.ps1 / .sh).
 *
 * Vive sotto apps/api e non in scripts/ per una ragione precisa: la risoluzione
 * dei moduli ESM parte dalla POSIZIONE DEL FILE, non dalla cartella di lavoro.
 * Da scripts/ gli import di otpauth/pg/dotenv falliscono con ERR_MODULE_NOT_FOUND
 * anche lanciandolo con `pnpm --filter @heuresys/api exec` (misurato).
 *
 * QUESTA E' L'UNICA implementazione della derivazione. I wrapper non la
 * ripetono: tre copie della stessa crittografia divergono, e il giorno in cui
 * divergono producono password che il server rifiuta senza spiegare perche'.
 */
import { join } from "node:path";
import * as OTPAuth from "otpauth";
import { REPO, REAL_PERSON_EMAILS, isRealPerson, readMaster, derivePassword, deriveTotpSecret } from "./derive-access.mjs";
import pg from "pg";
import dotenv from "dotenv";


function totpNow(secretB32) {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretB32),
  });
  return { code: totp.generate(), remaining: 30 - (Math.floor(Date.now() / 1000) % 30) };
}

async function lookup(email) {
  dotenv.config({ path: join(REPO, ".env"), quiet: true });
  const client = new pg.Client({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5433),
    user: process.env.POSTGRES_USER ?? "heuresys",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "heuresys_advanced",
  });
  await client.connect();
  try {
    const r = await client.query(
      `SELECT u.user_email, u.user_display_name, u.user_status,
              t.tenant_name,
              (SELECT string_agg(ro.auth_role_code, ', ' ORDER BY ro.auth_role_code)
                 FROM sys.sys_user_auth_roles ur
                 JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
                WHERE ur.user_auth_role_user_id = u.user_id) AS roles,
              (SELECT p.position_title
                 FROM sys.sys_user_position_assignments pa
                 JOIN sys.sys_positions p ON p.position_id = pa.user_position_assignment_position_id
                WHERE pa.user_position_assignment_user_id = u.user_id
                ORDER BY pa.created_at DESC LIMIT 1) AS position_title,
              (SELECT ou.organization_unit_name
                 FROM sys.sys_user_position_assignments pa
                 JOIN sys.sys_positions p ON p.position_id = pa.user_position_assignment_position_id
                 JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
                WHERE pa.user_position_assignment_user_id = u.user_id
                ORDER BY pa.created_at DESC LIMIT 1) AS unit_name
         FROM sys.sys_users u
         LEFT JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
        WHERE lower(u.user_email) = lower($1)`,
      [email],
    );
    return r.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

function pad(label) {
  return label.padEnd(11, " ");
}

function render(row, email, password, totp, firstTime) {
  const lines = [];
  if (firstTime) {
    const who = row?.user_display_name ? `  (${row.user_display_name})` : "";
    lines.push("");
    lines.push(`${pad("Utente")}${email}${who}`);
    if (row?.tenant_name) lines.push(`${pad("Tenant")}${row.tenant_name}`);
    if (row?.roles) lines.push(`${pad("Ruoli")}${row.roles}`);
    if (row?.position_title) {
      lines.push(`${pad("Posizione")}${row.position_title}${row.unit_name ? ` — ${row.unit_name}` : ""}`);
    }
    if (row && row.user_status !== "ACTIVE") {
      lines.push(`${pad("ATTENZIONE")}utente in stato ${row.user_status}: il login fallira'`);
    }
    if (password) lines.push(`${pad("Password")}${password}`);
    else {
      lines.push(`${pad("Password")}<scelta dalla persona — non derivabile>`);
      lines.push("");
      lines.push(`Questo indirizzo appartiene a una persona reale (${REAL_PERSON_EMAILS.join(", ")}).`);
      lines.push(`La sua password non e' derivata dalla chiave madre by design: nessuno,`);
      lines.push(`nemmeno chi ha la chiave, deve poter entrare al posto suo.`);
    }
  }
  if (totp) {
    lines.push(`${pad("Codice")}${totp.code}        valido ancora ${String(totp.remaining).padStart(2, " ")}s`);
  }
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const watch = args.includes("--watch") || args.includes("-w");
  const email = args.find((a) => !a.startsWith("-"));
  if (!email) {
    console.error("uso: pnpm dev:whoami <email> [--watch]");
    process.exit(1);
  }

  const row = await lookup(email);
  if (!row) {
    console.error(`\nNessun utente con email ${email}.\n`);
    process.exit(3);
  }

    const realPerson = isRealPerson(email);
  let master = null;
  if (!realPerson) {
    try {
      master = readMaster();
    } catch (e) {
      console.error(`
${e instanceof Error ? e.message : String(e)}
`);
      process.exit(2);
    }
  }
  const password = master ? derivePassword(master, email) : null;
  const secret = master ? deriveTotpSecret(master, email) : null;

  console.log(render(row, email, password, secret ? totpNow(secret) : null, true));
  if (!secret) {
    console.log("");
    return;
  }
  if (!watch) {
    console.log("");
    return;
  }

  // --watch: ristampa SOLO quando il codice cambia, cosi' resta sempre valido
  // sotto gli occhi mentre si lavora nel browser. Ctrl-C per uscire.
  console.log("\n(--watch attivo: il codice si aggiorna da solo. Ctrl-C per uscire)\n");
  let last = null;
  setInterval(() => {
    const t = totpNow(secret);
    if (t.code !== last) {
      last = t.code;
      console.log(`${pad("Codice")}${t.code}        valido ancora ${String(t.remaining).padStart(2, " ")}s`);
    }
  }, 1000);
}

main().catch((e) => {
  console.error(`\nErrore: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
