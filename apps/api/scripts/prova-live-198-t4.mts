/**
 * apps/api/scripts/prova-live-198-t4.mts — prova LIVE del T4 di #198 (E21), S1067.
 *
 * Che cosa dimostra: dopo che il motore ha smesso di guardare dentro l'archetipo, la
 * costruzione dice ancora **gli stessi numeri**. Un refactoring che cambia ciò che viene
 * costruito non è un refactoring, ed è la sola cosa che un typecheck verde non può dire.
 *
 * Si usa `mode: "plan"`, che è di SOLA LETTURA: conta le righe che verrebbero create senza
 * crearne nessuna. La prova gira quindi sul tenant di produzione senza scriverci.
 *
 *   cd apps/api && pnpm exec tsx scripts/prova-live-198-t4.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";
import { getArchetype, archetypeUsers } from "../src/modules/tenant-materialization/blueprints.js";
import { ArchetypeBuildSource } from "../src/modules/tenant-materialization/build-source.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const ATTORE = "enzo.spenuso@heuresys.com";
const CHIAVE = "RETAIL_BANK_REFERENCE";

function totp(email: string): string | null {
  const s = FIXTURE_TOTP_SECRETS[email];
  return s ? new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(s) }).generate() : null;
}

async function accedi(email: string): Promise<{ cookie: string; csrf: string }> {
  const password = passwordFor(email);
  const post = (p: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
  type B = { status?: string; challengeToken?: string; csrfToken?: string };
  let r = await post({ email, password });
  let b = (await r.json()) as B;
  if (b.status === "mfa_required") {
    r = await post({ email, password, challengeToken: b.challengeToken, mfaCode: totp(email) });
    b = (await r.json()) as B;
  }
  if (!b.csrfToken) throw new Error(`login fallito: ${JSON.stringify(b)}`);
  return { cookie: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; "), csrf: b.csrfToken };
}

async function main(): Promise<void> {
  const a = getArchetype(CHIAVE);
  if (!a) throw new Error(`archetipo ${CHIAVE} assente`);
  const piano = await new ArchetypeBuildSource(a).plan();

  console.log(`# prova LIVE #198 T4 — ${BASE} — ${new Date().toISOString()}\n`);
  console.log(`  archetipo ${CHIAVE}: ${a.orgUnits.length} unità · ${a.positions.length} posizioni · ${a.skills.length} competenze · ${a.kpis.length} indicatori · ${archetypeUsers(a).length} titolari`);
  console.log(`  piano    ${piano.sourceKey}: ${piano.orgUnits.length} unità · ${piano.positions.length} posizioni · ${piano.skills.length} competenze · ${piano.kpis.length} indicatori · ${piano.incumbents.length} titolari`);

  const evidenzeAttese = piano.incumbents.reduce((n, i) => n + i.skillEvidence.length, 0);
  console.log(`  evidenze di competenza nel piano: ${evidenzeAttese} (= ${piano.incumbents.length} titolari × ${piano.skills.length} competenze)`);

  const { cookie, csrf } = await accedi(ATTORE);
  const tenantRes = await fetch(`${BASE}/v1/tenants?limit=50`, { headers: { cookie } });
  const tenants = ((await tenantRes.json()) as { items: Array<{ tenantId: string; name?: string; tenantName?: string }> }).items;
  const rtl = tenants.find((t) => (t.name ?? t.tenantName ?? "").includes("RTL"));
  if (!rtl) throw new Error(`RTL Bank non trovato fra ${tenants.length} tenant`);

  // mode=plan: NON scrive. Conta le righe che verrebbero create.
  const r = await fetch(`${BASE}/v1/tenant-materialization`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, "x-csrf-token": csrf },
    body: JSON.stringify({ tenantId: rtl.tenantId, archetypeKey: CHIAVE, mode: "plan" }),
  });
  const corpo = (await r.json()) as { total?: Record<string, number>; created?: Record<string, number>; skipped?: Record<string, number> };
  console.log(`\n  POST /v1/tenant-materialization (mode=plan) → HTTP ${r.status}`);
  console.log(`  total   : ${JSON.stringify(corpo.total)}`);
  console.log(`  created : ${JSON.stringify(corpo.created)}   (quante ne nascerebbero)`);
  console.log(`  skipped : ${JSON.stringify(corpo.skipped)}   (quante esistono già)`);

  const t = corpo.total ?? {};
  const esiti: Array<[string, boolean]> = [
    ["HTTP 200", r.status === 200],
    ["il totale delle unità = quelle del piano", t.orgUnits === piano.orgUnits.length],
    ["il totale delle posizioni = quelle del piano", t.positions === piano.positions.length],
    ["il totale delle competenze = quelle del piano", t.skills === piano.skills.length],
    ["il totale degli indicatori = quelle del piano", t.kpis === piano.kpis.length],
    ["le evidenze di competenza = titolari × competenze", t.skillEvidence === evidenzeAttese],
  ];
  console.log("");
  for (const [n, ok] of esiti) console.log(`  ${ok ? "OK  " : "NO  "} ${n}`);
  const ok = esiti.every(([, v]) => v);
  console.log(`\nVERDETTO: ${ok ? "il motore costruito dal PIANO dice gli stessi numeri di prima" : "NON equivalente — vedi sopra"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERRORE:", e instanceof Error ? e.message : e);
  process.exit(2);
});
