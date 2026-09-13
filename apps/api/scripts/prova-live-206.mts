/**
 * apps/api/scripts/prova-live-206.mts — prova LIVE di #206 (Tenant Builder P4): le persone vere
 * entrano in un'azienda costruita da P3, dalla fonte alla firma, TUTTO via rotte reali.
 *
 * ⚠ DOVE GIRA: **E27 — prima sul gemello.** L'azienda usa e getta nasce sul clone del linux-pc;
 * il base URL e' il primo argomento e viene stampato in testa. La corsa vera in produzione
 * (T9 di P4) resta a `#198` T9b, che aspetta un modello non bancario dalla ricerca: qui il
 * modello proposto sara' quello che il catalogo del bersaglio offre, e non importa quale — la
 * prova e' sull'importazione, non sulla forma dell'azienda.
 *
 *   cd apps/api && pnpm exec tsx scripts/prova-live-206.mts http://192.168.1.11:8013 "<settore|ateco-id|fascia-id>"
 *
 * ⚠ IL MODELLO: misurato il 2026-09-13 sul gemello, l'UNICO modello con contenuto in produzione
 *   (`REGIONAL_RETAIL_BANK_MEDIUM`) non e' costruibile — l'atto si rifiuta con
 *   `BLUEPRINT_CONTENT_INCOHERENT` (132 competenze senza categoria). Quindi, con
 *   `SEMINA_MODELLO=1`, questo script SEMINA nel database bersaglio lo stesso modello di prova
 *   dei test (`seminaModello`: una piccola manifattura, E29) e lo ancora al fascicolo al posto
 *   della proposta. Il database e' quello che `POSTGRES_*` dell'ambiente indica: e' cosi' che
 *   lo script e' sicuro di seminare NELLO STESSO database contro cui gira l'API.
 *
 * LA CATENA:
 *   1-8. la costruzione di P3 (stessa catena di `prova-live-198-t9.mts`): azienda, fascicolo,
 *        identita', modello, approvazione, applicazione → le righe GENERATED;
 *   9.   un requisito CRITICAL su una posizione (via API), cosi' che E19 abbia una domanda;
 *   10.  POST /v1/tenant-import-runs/sources   → la fonte con impronta; '31/02/2024' entra;
 *   11.  POST /v1/tenant-import-runs/sources   → stesso contenuto, altro nome: STESSA fonte;
 *   12.  POST /v1/tenant-import-runs           → la corsa, col referto;
 *   13.  POST …/:id/submit → firma → apply     → le persone entrano;
 *   14.  le misure: persone STANDARD nate, posizioni CONFIRMED, NESSUNA SUPERSEDED, fonte INGESTED.
 *
 * LE PROVE CHE DEVONO POTER FALLIRE:
 *   A. l'impronta riconosce la fonte con un nome diverso;
 *   B. una posizione senza requisiti CRITICAL esce CIECA, non AMMESSA;
 *   C. una data inesistente entra nell'atterraggio ed esce NOMINATA dalla validazione;
 *   D. dopo la firma nessuna posizione e' SUPERSEDED e le persone hanno il loro incarico.
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";
import { readCollaudoKey, deriveCollaudoPassword } from "./collaudo-access.mjs";
import { pool } from "../src/db/client.js";
import { seminaModello } from "../test/helpers/modello-di-prova.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const PLATFORM = "enzo.spenuso@heuresys.com";
const MARCA = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const CODICE = `P4PROVA${MARCA}`;

type Sessione = { cookie: string; csrf: string };

function totp(email: string): string | null {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) return null;
  return new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) }).generate();
}

/** La password: derivata dalla chiave madre per le personas, dalla chiave PROPRIA di collaudo per le tre identita' `@collaudo.invalid` (#169 F4). */
function passwordDi(email: string): string {
  if (email.endsWith("@collaudo.invalid")) return deriveCollaudoPassword(readCollaudoKey(), email);
  // l'amministratore dell'azienda usa-e-getta nasce col provisioning, con la password che
  // questo stesso script gli ha dato (quella derivata di PLATFORM)
  if (email.startsWith(`admin.${CODICE.toLowerCase()}@`)) return passwordFor(PLATFORM);
  return passwordFor(email);
}

async function accedi(email: string): Promise<Sessione> {
  const password = passwordDi(email);
  const post = (payload: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  type Body = { status?: string; challengeToken?: string; csrfToken?: string };
  let r = await post({ email, password });
  let b = (await r.json()) as Body;
  if (b.status === "mfa_required") {
    const code = totp(email);
    if (!code) throw new Error(`${email} chiede il secondo fattore e non ho il suo segreto`);
    r = await post({ email, password, challengeToken: b.challengeToken, mfaCode: code });
    b = (await r.json()) as Body;
  }
  if (!b.csrfToken) throw new Error(`login fallito per ${email}: ${JSON.stringify(b)}`);
  return { cookie: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; "), csrf: b.csrfToken };
}

async function chiama(s: Sessione, metodo: string, percorso: string, corpo?: unknown): Promise<{ stato: number; dati: any }> {
  const headers: Record<string, string> = { cookie: s.cookie };
  if (metodo !== "GET") headers["x-csrf-token"] = s.csrf;
  if (corpo !== undefined) headers["content-type"] = "application/json";
  const r = await fetch(`${BASE}${percorso}`, { method: metodo, headers, ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}) });
  let dati: any = null;
  try { dati = await r.json(); } catch { dati = null; }
  return { stato: r.status, dati };
}

/**
 * Porta a termine una richiesta: decide ogni passo PENDING — il mio con la mia sessione, quelli
 * di un altro approvatore entrando come lui (i detentori di piattaforma sono personas impersonabili:
 * la password si deriva). Poi applica.
 */
async function firma(s: Sessione, richiestaId: string, che: string): Promise<void> {
  const det = await chiama(s, "GET", `/v1/approvals/${richiestaId}`);
  if (det.stato !== 200) throw new Error(`${che}: la richiesta non si legge (${det.stato})`);
  const me = await chiama(s, "GET", "/v1/auth/me");
  const mioId: string | undefined = me.dati?.userId ?? me.dati?.user?.userId;
  const passi: Array<{ approvalStepId: string; status: string; approverUserId?: string | null }> = det.dati?.steps ?? [];
  for (const passo of passi.filter((p) => p.status === "PENDING")) {
    let sessione = s;
    if (passo.approverUserId && passo.approverUserId !== mioId) {
      const u = await chiama(s, "GET", `/v1/users/${passo.approverUserId}`);
      const email: string | undefined = u.dati?.email;
      if (!email) throw new Error(`${che}: approvatore ${passo.approverUserId} senza email leggibile`);
      sessione = await accedi(email);
    }
    const d = await chiama(sessione, "POST", `/v1/approvals/${richiestaId}/steps/${passo.approvalStepId}/decide`, { decision: "APPROVE", comment: `#206 — prova live ${MARCA}` });
    if (d.stato !== 200) throw new Error(`${che}: passo non firmato (${d.stato} ${JSON.stringify(d.dati)})`);
    const stato = await chiama(s, "GET", `/v1/approvals/${richiestaId}`);
    if (stato.dati?.status === "APPROVED") break;
  }
  const app = await chiama(s, "POST", `/v1/approvals/${richiestaId}/apply`);
  if (app.stato !== 200) throw new Error(`${che}: apply della richiesta fallito (${app.stato} ${JSON.stringify(app.dati)})`);
}

/** Tutte le pagine di una lista, filtrate per azienda (il filtro server-side non esiste per PLATFORM_ADMIN). */
async function tuttiDi<T extends { tenantId: string | null }>(s: Sessione, percorso: string, tenantId: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 200) {
    const r = await chiama(s, "GET", `${percorso}?limit=200&offset=${offset}`);
    const items: T[] = r.dati?.items ?? [];
    out.push(...items.filter((x) => x.tenantId === tenantId));
    if (items.length < 200) break;
  }
  return out;
}

const esiti: Array<[string, boolean, string]> = [];
const nota = (che: string, ok: boolean, dettaglio: string) => {
  esiti.push([che, ok, dettaglio]);
  console.log(`  ${ok ? "[OK]" : "[!!]"} ${che} — ${dettaglio}`);
};

async function main(): Promise<void> {
  console.log(`# prova LIVE #206 — ${BASE} — ${new Date().toISOString()}`);
  console.log(`# azienda usa e getta: ${CODICE}\n`);
  const s = await accedi(PLATFORM);
  console.log(`  login reale acquisito: ${PLATFORM} (PLATFORM_ADMIN)`);

  const [industryCode, industryClassId, sizeBandId] = (process.argv[3] ?? "").split("|");
  if (!industryCode || !industryClassId || !sizeBandId) {
    throw new Error("manca il secondo argomento <settore|ateco-id|fascia-id>, da leggere sul database del bersaglio");
  }

  // ── 1-8. la costruzione di P3 ────────────────────────────────────────────────────
  const prov = await chiama(s, "POST", "/v1/tenants/provision", {
    tenantCode: CODICE, tenantName: `Prova P4 ${MARCA}`, tenantIndustryCode: industryCode, tenantCountryCode: "IT",
    adminEmail: `admin.${CODICE.toLowerCase()}@example.org`, adminDisplayName: "Amministratore di prova", adminPassword: passwordFor(PLATFORM),
  });
  if (prov.stato !== 201) throw new Error(`provisioning fallito: ${prov.stato} ${JSON.stringify(prov.dati)}`);
  const tenantId: string = prov.dati.tenant.id;
  nota("l'azienda-bersaglio esiste", true, `${CODICE} · id ${tenantId.slice(0, 8)}…`);

  const fas = await chiama(s, "POST", "/v1/tenant-blueprints", { code: `${CODICE}-CONFIG`, name: `Fascicolo di prova ${MARCA}` });
  if (fas.stato !== 201) throw new Error(`fascicolo non creato: ${fas.stato} ${JSON.stringify(fas.dati)}`);
  const bpId: string = fas.dati.tenantBlueprintId;
  const link = await chiama(s, "POST", `/v1/tenant-blueprints/${bpId}/link-tenant`, { tenantId });
  if (link.stato !== 200) throw new Error(`link-tenant fallito: ${link.stato}`);
  const ident = await chiama(s, "PATCH", `/v1/tenant-blueprints/${bpId}/versions/1/identity`, {
    industryClassId, sizeBandId, regulatoryIntensity: "HIGH", countryCode: "IT", employeeCount: 120,
  });
  if (ident.stato !== 200) throw new Error(`identita' fallita: ${ident.stato} ${JSON.stringify(ident.dati)}`);
  let variantVersionId: string | undefined;
  if (process.env.SEMINA_MODELLO === "1") {
    const modello = await seminaModello(pool, MARCA);
    variantVersionId = modello.variantVersionId;
    nota("il modello di prova e' seminato nel database bersaglio (E29: una manifattura)", true, `${modello.label} · variante ${variantVersionId.slice(0, 8)}…`);
  } else {
    const prop = await chiama(s, "GET", `/v1/tenant-blueprints/${bpId}/versions/1/model-proposal`);
    variantVersionId = prop.dati?.variantVersionId;
  }
  if (!variantVersionId) throw new Error("nessun modello da ancorare: ne' proposto, ne' seminato (SEMINA_MODELLO=1)");
  const pin = await chiama(s, "PUT", `/v1/tenant-blueprints/${bpId}/versions/1/model`, { variantVersionId });
  if (pin.stato !== 200) throw new Error(`modello non ancorato: ${pin.stato}`);
  const sub = await chiama(s, "POST", `/v1/tenant-blueprints/${bpId}/versions/1/submit`);
  const richiestaApprovazione: string | undefined = sub.dati?.approvalRequestId ?? sub.dati?.approvalRequest?.approvalRequestId;
  if (!richiestaApprovazione) throw new Error(`submit del fascicolo: ${sub.stato} ${JSON.stringify(sub.dati)}`);
  await firma(s, richiestaApprovazione, "approvazione del fascicolo");
  const app = await chiama(s, "POST", `/v1/tenant-blueprints/${bpId}/versions/1/apply`);
  const richiestaCostruzione: string | undefined = app.dati?.approvalRequestId ?? app.dati?.approvalRequest?.approvalRequestId;
  if (!richiestaCostruzione) throw new Error(`apply del fascicolo: ${app.stato} ${JSON.stringify(app.dati)}`);
  await firma(s, richiestaCostruzione, "applicazione del fascicolo");

  const posizioni = (await tuttiDi<{ positionId: string; code: string; tenantId: string }>(s, "/v1/positions", tenantId)).map((p) => ({ positionId: p.positionId, positionCode: p.code }));
  const competenze = (await tuttiDi<{ skillId: string; code: string; tenantId: string | null }>(s, "/v1/skills", tenantId)).map((k) => ({ skillId: k.skillId, skillCode: k.code }));
  nota("P3 ha costruito l'azienda", posizioni.length > 1 && competenze.length > 0, `${posizioni.length} posizioni · ${competenze.length} competenze`);
  const origini = async () => {
    const r = await chiama(s, "GET", `/v1/generated-origins?limit=200&tenantId=${tenantId}`);
    const items: Array<{ tenantId?: string; status: string; targetTable: string }> = (r.dati?.items ?? []).filter((x: any) => !x.tenantId || x.tenantId === tenantId);
    return items;
  };

  // ── 9. un requisito CRITICAL, cosi' che E19 abbia una domanda ─────────────────────
  const [posA, posB] = posizioni;
  if (!posA || !posB) throw new Error("servono almeno due posizioni");
  const [skA, skB] = competenze;
  if (!skA) throw new Error("serve almeno una competenza dell'azienda");
  const req = await chiama(s, "POST", `/v1/positions/${posA.positionId}/skills`, {
    skillId: skA.skillId, requiredProficiency: "COMPETENT", weight: 1, criticality: "CRITICAL",
  });
  nota("un requisito CRITICAL e' dichiarato sulla posizione A (via API)", req.stato === 201 || req.stato === 200, `HTTP ${req.stato} · ${posA.positionCode} pretende ${skA.skillCode}`);

  // ── 10-11. la fonte, per impronta ────────────────────────────────────────────────
  const dom = `${CODICE.toLowerCase()}.cliente.invalid`;
  const righe = [
    { external_id: "E001", email: `anna.verdi@${dom}`, first_name: "Anna", last_name: "Verdi", position_code: posA.positionCode, hire_date: "2021-03-15", is_active: "S", skill_codes: skA.skillCode },
    { external_id: "E002", email: `bruno.neri@${dom}`, first_name: "Bruno", last_name: "Neri", position_code: posB.positionCode, hire_date: "31/02/2024", is_active: "S", skill_codes: skB?.skillCode ?? null },
    { external_id: "E003", email: "", first_name: "Carla", last_name: "Bianchi", position_code: posB.positionCode, hire_date: "2020-01-01", is_active: "S", skill_codes: null },
  ];
  const f1 = await chiama(s, "POST", "/v1/tenant-import-runs/sources", { name: `Estrazione HR ${CODICE}`, rows: righe });
  if (f1.stato !== 201) throw new Error(`fonte non registrata: ${f1.stato} ${JSON.stringify(f1.dati)}`);
  const sourceExportId: string = f1.dati.source.sourceExportId;
  nota("PROVA C — la fonte e' registrata e '31/02/2024' e' ENTRATA nell'atterraggio", f1.dati.alreadyRegistered === false && f1.dati.source.rowCount === 3,
       `impronta ${String(f1.dati.source.fileHash).slice(0, 12)}… · ${f1.dati.source.rowCount} righe atterrate`);
  const f2 = await chiama(s, "POST", "/v1/tenant-import-runs/sources", { name: `Copia rinominata ${CODICE}`, rows: righe });
  nota("PROVA A — lo stesso contenuto con un altro nome e' la STESSA fonte (impronta)", f2.stato === 201 && f2.dati?.alreadyRegistered === true && f2.dati?.source?.sourceExportId === sourceExportId,
       `HTTP ${f2.stato} · alreadyRegistered=${f2.dati?.alreadyRegistered}`);

  // ── 12. la corsa ─────────────────────────────────────────────────────────────────
  const run = await chiama(s, "POST", "/v1/tenant-import-runs", { sourceExportId, tenantId });
  if (run.stato !== 201) throw new Error(`corsa non aperta: ${run.stato} ${JSON.stringify(run.dati)}`);
  const runId: string = run.dati.runId;
  const referto = run.dati.referto;
  console.log(`\n  referto: ${JSON.stringify(referto)}`);
  const cand: Array<{ rowNo: number; e19: string | null; status: string; validations: Array<{ ruleCode: string; status: string; message: string | null }> }> = run.dati.candidates;
  const c1 = cand.find((c) => c.rowNo === 1)!; const c2 = cand.find((c) => c.rowNo === 2)!; const c3 = cand.find((c) => c.rowNo === 3)!;
  nota("la persona che copre il requisito CRITICAL e' AMMESSA", c1.e19 === "AMMESSA" && c1.status === "PASSED", `riga 1: ${c1.e19} / ${c1.status}`);
  nota("PROVA B — la posizione senza requisiti CRITICAL esce CIECA, non AMMESSA", c2.e19 === "CIECA", `riga 2: ${c2.e19}`);
  const data = c2.validations.find((v) => v.ruleCode === "HIRE_DATE_PARSEABLE");
  nota("PROVA C — la data inesistente esce NOMINATA dalla validazione", data?.status === "WARNING" && (data.message ?? "").includes("31/02/2024"), `${data?.status}: ${data?.message}`);
  nota("la riga senza email e' ESCLUSA e nominata", c3.status === "FAILED" && c3.validations.some((v) => v.ruleCode === "PERSON_EMAIL" && v.status === "FAILED"), `riga 3: ${c3.status}`);
  nota("il referto e' coerente", referto.persone === 3 && referto.ammesse === 1 && referto.cieche === 1 && referto.escluse === 1, JSON.stringify(referto));

  // ── 13. la firma (E26) e l'iniezione ─────────────────────────────────────────────
  const primaDellaFirma = await tuttiDi<{ userId: string; tenantId: string; userType?: string }>(s, "/v1/users", tenantId);
  const subm = await chiama(s, "POST", `/v1/tenant-import-runs/${runId}/submit`, {});
  if (subm.stato !== 201) throw new Error(`submit della corsa: ${subm.stato} ${JSON.stringify(subm.dati)}`);
  nota("la corsa e' alla firma: UNA richiesta di approvazione (E26)", !!subm.dati?.approvalRequestId, `richiesta ${String(subm.dati?.approvalRequestId).slice(0, 8)}…`);
  const dopoSubmit = await chiama(s, "GET", `/v1/tenant-import-runs/${runId}`);
  nota("sottomettere NON inietta: la corsa e' ancora RUNNING", dopoSubmit.dati?.status === "RUNNING", `stato ${dopoSubmit.dati?.status}`);
  await firma(s, subm.dati.approvalRequestId, "firma dell'importazione");

  // ── 14. le misure ────────────────────────────────────────────────────────────────
  const dopo = await chiama(s, "GET", `/v1/tenant-import-runs/${runId}`);
  nota("PROVA D — la corsa e' COMPLETED e l'esito e' scritto", dopo.dati?.status === "COMPLETED" && dopo.dati?.metadata?.esito?.iniettate === 2,
       `stato ${dopo.dati?.status} · esito ${JSON.stringify(dopo.dati?.metadata?.esito)}`);
  const persone = await tuttiDi<{ userId: string; tenantId: string; email?: string; userEmail?: string }>(s, "/v1/users", tenantId);
  nota("PROVA D — le persone sono nate nell'azienda", persone.length - primaDellaFirma.length === 2, `${primaDellaFirma.length} → ${persone.length} utenti dell'azienda`);
  const reg = await origini();
  const perStato: Record<string, number> = {};
  for (const o of reg) perStato[`${o.targetTable}:${o.status}`] = (perStato[`${o.targetTable}:${o.status}`] ?? 0) + 1;
  const supersededPos = reg.filter((o) => o.targetTable === "sys_positions" && o.status === "SUPERSEDED").length;
  const confirmedPos = reg.filter((o) => o.targetTable === "sys_positions" && o.status === "CONFIRMED").length;
  nota("PROVA D — NESSUNA posizione e' SUPERSEDED, quelle occupate sono CONFIRMED", supersededPos === 0 && confirmedPos >= 2, JSON.stringify(perStato));
  const f3 = await chiama(s, "POST", "/v1/tenant-import-runs", { sourceExportId, tenantId });
  nota("la fonte e' INGESTED: una seconda corsa e' un conflitto", f3.stato === 409 && f3.dati?.error?.code === "SOURCE_NOT_AVAILABLE", `HTTP ${f3.stato} ${f3.dati?.error?.code}`);

  console.log(`\n# CODICE AZIENDA: ${CODICE} · TENANT: ${tenantId} · CORSA: ${runId}`);
  await pool.end();
  const rossi = esiti.filter(([, ok]) => !ok);
  console.log(`${esiti.length - rossi.length}/${esiti.length} verdi`);
  if (rossi.length) { console.log("PROVA ROSSA"); process.exitCode = 1; return; }
  console.log("PROVA VERDE");
}

main().catch((e) => {
  console.error(`\nPROVA INTERROTTA: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
