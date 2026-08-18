/**
 * apps/api/scripts/prova-live-198-t9-archivio.mts — #198 T9, PROVA C: archiviare NON cancella.
 *
 * E20 chiede che l'azienda costruita venga poi **archiviata**, e ADR-0035 dice perché la
 * differenza conta: ritirare non è cancellare. Se il `DELETE` portasse via le righe, la
 * costruzione sarebbe irreversibile nel verso sbagliato — si perderebbe la prova di ciò che
 * è stato costruito proprio nel momento in cui si smette di usarlo.
 *
 * La prova misura **prima e dopo** tre cose che devono restare identiche: le righe create,
 * le righe del registro dell'origine, e il legame col fascicolo. Cambia una cosa sola: lo
 * stato dell'azienda.
 *
 *   cd apps/api && pnpm exec tsx scripts/prova-live-198-t9-archivio.mts <base> <tenantId>
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const TENANT = process.argv[3];
const PLATFORM = "enzo.spenuso@heuresys.com";

if (!TENANT) throw new Error("manca l'id dell'azienda da archiviare");

type Sessione = { cookie: string; csrf: string };

async function accedi(email: string): Promise<Sessione> {
  const password = passwordFor(email);
  const post = (p: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
    });
  type Body = { status?: string; challengeToken?: string; csrfToken?: string };
  let r = await post({ email, password });
  let b = (await r.json()) as Body;
  if (b.status === "mfa_required") {
    const secret = FIXTURE_TOTP_SECRETS[email];
    const code = new OTPAuth.TOTP({
      algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret!),
    }).generate();
    r = await post({ email, password, challengeToken: b.challengeToken, mfaCode: code });
    b = (await r.json()) as Body;
  }
  if (!b.csrfToken) throw new Error(`login fallito: ${JSON.stringify(b)}`);
  return {
    cookie: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; "),
    csrf: b.csrfToken,
  };
}

async function chiama(s: Sessione, metodo: string, percorso: string): Promise<{ stato: number; dati: any }> {
  const headers: Record<string, string> = { cookie: s.cookie };
  if (metodo !== "GET") headers["x-csrf-token"] = s.csrf;
  const r = await fetch(`${BASE}${percorso}`, { method: metodo, headers });
  let dati: any = null;
  try { dati = await r.json(); } catch { dati = null; }
  return { stato: r.status, dati };
}

async function fotografia(s: Sessione): Promise<{ registro: number; unita: number; stato: string }> {
  const reg = await chiama(s, "GET", "/v1/generated-origins?limit=1");
  const ou = await chiama(s, "GET", "/v1/organization-units?limit=1");
  const t = await chiama(s, "GET", `/v1/tenants/${TENANT}`);
  return {
    registro: reg.dati?.total ?? -1,
    unita: ou.dati?.total ?? -1,
    stato: t.dati?.status ?? t.dati?.tenantStatus ?? "?",
  };
}

async function main(): Promise<void> {
  console.log(`# PROVA C — archiviare non cancella — ${BASE} — ${new Date().toISOString()}`);
  const s = await accedi(PLATFORM);
  const prima = await fotografia(s);
  console.log(`  prima:  registro ${prima.registro} · unità ${prima.unita} · azienda ${prima.stato}`);

  const del = await chiama(s, "DELETE", `/v1/tenants/${TENANT}`);
  console.log(`  DELETE /v1/tenants/${TENANT.slice(0, 8)}… → HTTP ${del.stato}`);

  const dopo = await fotografia(s);
  console.log(`  dopo:   registro ${dopo.registro} · unità ${dopo.unita} · azienda ${dopo.stato}`);

  const esiti: Array<[string, boolean, string]> = [
    ["l'azienda è passata ad ARCHIVED", dopo.stato === "ARCHIVED", `stato ${prima.stato} → ${dopo.stato}`],
    ["le righe del registro RESTANO", dopo.registro === prima.registro, `${prima.registro} → ${dopo.registro}`],
    ["le righe costruite RESTANO", dopo.unita === prima.unita, `${prima.unita} → ${dopo.unita}`],
  ];
  for (const [che, ok, d] of esiti) console.log(`  ${ok ? "[OK]" : "[!!]"} ${che} — ${d}`);
  const rossi = esiti.filter(([, ok]) => !ok).length;
  console.log(`\n${esiti.length - rossi}/${esiti.length} verdi`);
  console.log(rossi ? "PROVA ROSSA" : "PROVA VERDE");
  if (rossi) process.exit(1);
}

main().catch((e) => {
  console.error(`PROVA INTERROTTA: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
