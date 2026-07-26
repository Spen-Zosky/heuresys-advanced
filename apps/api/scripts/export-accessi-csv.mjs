/**
 * apps/api/scripts/export-accessi-csv.mjs
 * Z-262 — genera .secrets/accessi.csv con le credenziali di ogni utente.
 *
 * Usa LO STESSO modulo di derivazione di `dev:whoami` (derive-access.mjs), in
 * un solo passaggio invece di 162 invocazioni separate: i valori sono per
 * costruzione identici, il tempo scende da oltre dieci minuti a pochi secondi.
 *
 * Il file finisce in .secrets/ — gitignored — perché contiene password in
 * chiaro di 158 accessi. Non spostarlo altrove.
 *
 * Sulla colonna "Codice": un codice TOTP vive 30 secondi, quindi nel file è
 * gia' scaduto quando lo leggi. È riportato perché richiesto, con l'istante in
 * cui è stato calcolato; la colonna che serve davvero è "SegretoTOTP", da dare
 * in pasto a un'app authenticator per avere codici sempre validi — oppure usa
 * `pnpm dev:whoami <email> --watch`.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import * as OTPAuth from "otpauth";
import pg from "pg";
import dotenv from "dotenv";
import { REPO, readMaster, derivePassword, deriveTotpSecret, isRealPerson } from "./derive-access.mjs";

dotenv.config({ path: join(REPO, ".env"), quiet: true });

const master = readMaster();
const OUT = join(REPO, ".secrets", "accessi.csv");

function csv(v) {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const client = new pg.Client({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5433),
  user: process.env.POSTGRES_USER ?? "heuresys",
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB ?? "heuresys_advanced",
});
await client.connect();

const { rows } = await client.query(
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
    WHERE u.user_status = 'ACTIVE'
    ORDER BY t.tenant_name, u.user_email`,
);
await client.end();

const stampedAt = new Date().toISOString();
const lines = ["Utente;Nome;Tenant;Ruoli;Posizione;Password;Codice;SegretoTOTP;CodiceCalcolatoAlle"];
let derivati = 0;
let esclusi = 0;

for (const r of rows) {
  const email = r.user_email;
  const posizione = r.position_title
    ? `${r.position_title}${r.unit_name ? ` - ${r.unit_name}` : ""}`
    : "";
  if (isRealPerson(email)) {
    esclusi++;
    lines.push(
      [email, r.user_display_name, r.tenant_name, r.roles, posizione,
       "<scelta dalla persona>", "", "", ""].map(csv).join(";"),
    );
    continue;
  }
  derivati++;
  const secret = deriveTotpSecret(master, email);
  const code = new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
  lines.push(
    [email, r.user_display_name, r.tenant_name, r.roles, posizione,
     derivePassword(master, email), code, secret, stampedAt].map(csv).join(";"),
  );
}

writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
console.log(`
  scritto     ${OUT}
  righe       ${rows.length}   (derivate ${derivati}, escluse ${esclusi})
  separatore  ";"  (Excel italiano lo apre a colonne senza importazione)
`);
