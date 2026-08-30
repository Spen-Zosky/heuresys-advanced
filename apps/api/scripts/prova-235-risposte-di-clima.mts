/**
 * #235 — LE RISPOSTE AI SONDAGGI DI CLIMA SI LEGGONO DENTRO LA PROPRIA CATENA, E BASTA.
 *
 * Il difetto misurato (S1083): `surveys` non era classificata, quindi le sue rotte read erano
 * gated dal solo RBAC + tenant. Chiunque avesse `surveys:read` leggeva *chi ha detto cosa sul
 * clima aziendale*, anche di persone fuori dalla propria catena organizzativa — e non c'è una
 * sola risposta anonima: 862 su 862 portano `response_subject_user_id`.
 *
 * QUESTA PROVA DEVE POTER FALLIRE, e fallisce in tre modi diversi:
 *   · se il MANAGER vedesse le stesse risposte del mandato HR, l'org-gate non sta filtrando
 *     niente — cioè la cura non c'è, e il verde sarebbe una bugia;
 *   · se il mandato HR vedesse MENO del tenant, avrei rotto un uso legittimo (I20: il mandato
 *     HR legge tutto il tenant per mandato esplicito) — peggio del difetto di partenza;
 *   · se il MANAGER non vedesse NIENTE, il filtro sarebbe una porta murata invece che un
 *     cancello: la sua catena esiste, e le risposte di chi ci sta dentro deve leggerle.
 *
 * E c'è un quarto criterio, quello che nessuna somma dimostra: OGNI risposta che il manager
 * riceve deve avere un soggetto DENTRO la sua catena. Un conteggio più piccolo può essere
 * giusto per la ragione sbagliata (una paginazione, un caso limite): qui si guarda riga per
 * riga, incrociando con l'albero delle unità che il resolver percorre.
 *
 * Uso (con l'API su :3001):  cd apps/api && pnpm exec tsx scripts/prova-235-risposte-di-clima.mts
 */
import { createHmac } from "node:crypto";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";
import { passwordFor } from "../test/helpers/personas.js";
import { pool } from "../src/db/client.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const MANDATO_HR = process.env.ATTORE_HR ?? "federica.marchetti@rtl-bank.org";
const CAPO_DI_CATENA = process.env.ATTORE_MANAGER ?? "paolo.caputo@rtl-bank.org";

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secretBase32: string): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac("sha1", key).update(buf).digest();
  const o = h[h.length - 1]! & 0x0f;
  const code = ((h[o]! & 0x7f) << 24) | ((h[o + 1]! & 0xff) << 16) |
    ((h[o + 2]! & 0xff) << 8) | (h[o + 3]! & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

async function login(email: string): Promise<string> {
  const password = passwordFor(email);
  const cookiesFrom = (r: Response) =>
    (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const r1 = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j1 = (await r1.json()) as { status: string; challengeToken?: string };
  if (j1.status === "success") return cookiesFrom(r1);
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (j1.status !== "mfa_required" || !j1.challengeToken || !secret) {
    throw new Error(`login inatteso per ${email}: ${JSON.stringify(j1)}`);
  }
  const r2 = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, challengeToken: j1.challengeToken, mfaCode: totp(secret) }),
  });
  const j2 = (await r2.json()) as { status: string };
  if (j2.status !== "success") throw new Error(`secondo fattore fallito per ${email}: ${JSON.stringify(j2)}`);
  return cookiesFrom(r2);
}

interface Risposta { responseId: string; subjectUserId: string | null }

async function risposte(cookies: string, surveyId: string): Promise<Risposta[]> {
  const r = await fetch(`${API}/v1/surveys/${surveyId}/responses?limit=500`, { headers: { cookie: cookies } });
  if (!r.ok) throw new Error(`responses → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { items?: Risposta[] }).items ?? [];
}

/** La catena di una persona, letta DALL'ALBERO DELLE UNITÀ — la stessa fonte del resolver (I16). */
async function catenaDi(email: string): Promise<Set<string>> {
  const { rows } = await pool.query<{ user_id: string }>(
    `WITH RECURSIVE me AS (SELECT user_id FROM sys.sys_users WHERE user_email = $1),
     radici AS (SELECT organization_unit_id FROM sys.sys_organization_units
                 WHERE organization_unit_manager_user_id = (SELECT user_id FROM me)),
     albero AS (
       SELECT organization_unit_id FROM radici
       UNION
       SELECT u.organization_unit_id FROM sys.sys_organization_units u
         JOIN albero a ON u.organization_unit_parent_id = a.organization_unit_id)
     SELECT DISTINCT pa.user_position_assignment_user_id AS user_id
       FROM sys.sys_user_position_assignments pa
       JOIN sys.sys_positions p ON p.position_id = pa.user_position_assignment_position_id
      WHERE p.position_organization_unit_id IN (SELECT organization_unit_id FROM albero)
        AND pa.user_position_assignment_user_id IS NOT NULL
        AND pa.user_position_assignment_status = 'ACTIVE'
     UNION SELECT user_id FROM me`,
    [email],
  );
  return new Set(rows.map((r) => r.user_id));
}

async function main(): Promise<void> {
  const surveyId = process.env.SURVEY_ID ?? "0a41369b-5bae-450c-a604-aeb47c9f1a02";
  console.log("=== #235 — le risposte di clima, misurate su due attori reali ===\n");

  const { rows: tot } = await pool.query<{ n: string }>(
    `SELECT count(*)::text n FROM sys.sys_engagement_survey_responses WHERE response_survey_id = $1`,
    [surveyId],
  );
  const nDb = Number(tot[0]?.n ?? 0);
  console.log(`sondaggio ${surveyId} — ${nDb} risposte nel database\n`);

  const cookHr = await login(MANDATO_HR);
  console.log(`[login] mandato HR      — ${MANDATO_HR}`);
  const cookCapo = await login(CAPO_DI_CATENA);
  console.log(`[login] capo di catena  — ${CAPO_DI_CATENA}\n`);

  const vistiHr = await risposte(cookHr, surveyId);
  const vistiCapo = await risposte(cookCapo, surveyId);
  const catena = await catenaDi(CAPO_DI_CATENA);
  const fuoriCatena = vistiCapo.filter((r) => r.subjectUserId !== null && !catena.has(r.subjectUserId));

  console.log(`mandato HR     : ${vistiHr.length} risposte`);
  console.log(`capo di catena : ${vistiCapo.length} risposte · catena di ${catena.size} persone · fuori catena: ${fuoriCatena.length}\n`);

  const esiti: Array<[string, boolean]> = [
    ["ci sono risposte da leggere (altrimenti la misura non dice niente)", nDb > 0],
    ["il mandato HR legge TUTTO il tenant (I20: mandato esplicito)", vistiHr.length === nDb],
    ["il capo di catena legge MENO del mandato HR (l'org-gate filtra)", vistiCapo.length < vistiHr.length],
    ["…ma non ZERO: la sua catena esiste e la deve leggere", vistiCapo.length > 0],
    ["NESSUNA risposta che riceve è fuori dalla sua catena", fuoriCatena.length === 0],
  ];

  let rossi = 0;
  for (const [che, ok] of esiti) {
    console.log(`  ${ok ? "[ok]" : "[NO]"} ${che}`);
    if (!ok) rossi += 1;
  }
  if (fuoriCatena.length > 0) {
    console.log(`\n  fuori catena (prime 5): ${fuoriCatena.slice(0, 5).map((r) => r.subjectUserId).join(", ")}`);
  }
  await pool.end();
  if (rossi > 0) {
    console.error(`\nESITO: ROSSO — ${rossi} criteri su ${esiti.length} non soddisfatti.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nESITO: VERDE — ${esiti.length} criteri su ${esiti.length}.`);
}

await main();
