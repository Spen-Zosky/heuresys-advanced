/**
 * apps/api/scripts/prova-live-198-t9.mts — prova LIVE di #198 T9: un'azienda nuova,
 * costruita da un fascicolo e poi archiviata (E20).
 *
 * IL TASK CHE CHIUDE LA PARTE. Tutto il resto di P3 è impalcatura finché questo non è
 * fatto su dati veri: il motore costruisce (T4), l'atto è transazionale (T5), le rotte
 * esistono (T6), le pagine lo mostrano (T7) — ma nessuna riga è mai nata in un database
 * vero, e il registro dell'origine — che è **l'unico scopo di P3** — non ha mai contato
 * niente.
 *
 * ⚠ DOVE GIRA, e non è un dettaglio: **E27 (Enzo, 2026-08-17) impone il gemello prima
 * della produzione.** Le aziende usa e getta nascono sul clone del linux-pc, dove si
 * sbaglia senza conseguenze; la prova che chiude P3 si fa **una volta sola** sul dato
 * vero. Questo script non sceglie da sé: il base URL è il primo argomento, e stampa in
 * testa contro che cosa sta lavorando.
 *
 *   cd apps/api && pnpm exec tsx scripts/prova-live-198-t9.mts http://192.168.1.11:8013
 *   cd apps/api && pnpm exec tsx scripts/prova-live-198-t9.mts http://localhost:3001
 *
 * LA CATENA, per intero — ogni anello è una rotta reale, nessuna scorciatoia via SQL:
 *   1. POST /v1/tenants/provision                     l'azienda-bersaglio
 *   2. POST /v1/tenant-blueprints                     il fascicolo
 *   3. POST …/:id/link-tenant                         il legame (E24: è permanente)
 *   4. PATCH …/versions/1/identity                    la carta d'identità
 *   5. GET   …/model-proposal → PUT …/model           il modello ancorato
 *   6. POST …/submit  → approvazione                  la versione diventa APPROVED
 *   7. POST …/build-plan                              il piano, SENZA scrivere
 *   8. POST …/apply   → approvazione                  ← QUI nascono le righe
 *   9. le misure, il controllo incrociato, l'archiviazione
 *
 * LE TRE PROVE CHE DEVONO POTER FALLIRE (piano di implementazione, T9):
 *   A. una riga creata che NON è nel registro → la parte 3 non ha raggiunto il suo scopo
 *   B. `apply` prima dell'approvazione non costruisce niente
 *   C. archiviare NON cancella: le righe restano dopo il DELETE
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const PLATFORM = "enzo.spenuso@heuresys.com";
const MARCA = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const CODICE = `T9PROVA${MARCA}`;

type Sessione = { cookie: string; csrf: string };

function totp(email: string): string | null {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) return null;
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

async function accedi(email: string): Promise<Sessione> {
  const password = passwordFor(email);
  const post = (payload: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
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
  return {
    cookie: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; "),
    csrf: b.csrfToken,
  };
}

async function chiama(
  s: Sessione, metodo: string, percorso: string, corpo?: unknown,
): Promise<{ stato: number; dati: any }> {
  const headers: Record<string, string> = { cookie: s.cookie };
  if (metodo !== "GET") headers["x-csrf-token"] = s.csrf;
  if (corpo !== undefined) headers["content-type"] = "application/json";
  const r = await fetch(`${BASE}${percorso}`, {
    method: metodo, headers,
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
  let dati: any = null;
  try { dati = await r.json(); } catch { dati = null; }
  return { stato: r.status, dati };
}

/** Porta a termine una richiesta di approvazione: decide ogni passo, poi la applica. */
async function firma(s: Sessione, richiestaId: string, che: string): Promise<void> {
  const det = await chiama(s, "GET", `/v1/approvals/${richiestaId}`);
  if (det.stato !== 200) throw new Error(`${che}: la richiesta non si legge (${det.stato})`);
  const passi: Array<{ approvalStepId: string; status: string }> = det.dati?.steps ?? [];
  for (const passo of passi.filter((p) => p.status === "PENDING")) {
    const d = await chiama(
      s, "POST", `/v1/approvals/${richiestaId}/steps/${passo.approvalStepId}/decide`,
      { decision: "APPROVE", comment: `#198 T9 — prova live ${MARCA}` },
    );
    if (d.stato !== 200) throw new Error(`${che}: passo non firmato (${d.stato} ${JSON.stringify(d.dati)})`);
  }
  const app = await chiama(s, "POST", `/v1/approvals/${richiestaId}/apply`);
  if (app.stato !== 200) throw new Error(`${che}: apply della richiesta fallito (${app.stato} ${JSON.stringify(app.dati)})`);
}

const esiti: Array<[string, boolean, string]> = [];
const nota = (che: string, ok: boolean, dettaglio: string) => {
  esiti.push([che, ok, dettaglio]);
  console.log(`  ${ok ? "[OK]" : "[!!]"} ${che} — ${dettaglio}`);
};

async function main(): Promise<void> {
  console.log(`# prova LIVE #198 T9 — ${BASE} — ${new Date().toISOString()}`);
  console.log(`# azienda usa e getta: ${CODICE}\n`);
  const s = await accedi(PLATFORM);
  console.log(`  login reale acquisito: ${PLATFORM} (PLATFORM_ADMIN)`);
  // Il registro NON parte da zero: sul gemello porta gia' le righe delle corse precedenti.
  // Ogni confronto qui sotto e' contro QUESTO numero, mai contro zero — un criterio che vale
  // solo alla prima esecuzione e' un criterio che si rompe alla seconda.
  const PARTENZA = await conta(s, "");
  console.log(`  registro dell'origine alla partenza: ${PARTENZA} righe\n`);

  // ── 1. l'azienda-bersaglio ────────────────────────────────────────────────────────
  // I tre id di catalogo NON si cercano via API: /v1/industries non esiste, e le altre due
  // rotte hanno forme di risposta che andrebbero indovinate. Arrivano da fuori, letti sul
  // database CONTRO CUI GIRA QUESTA PROVA — e mai dal pool locale, che punta alla produzione:
  // uno script che si crede sul gemello e scrive in produzione e' il modo peggiore di sbagliare.
  const [industryCode, industryClassId, sizeBandId] = (process.argv[3] ?? "").split("|");
  if (!industryCode || !industryClassId || !sizeBandId) {
    throw new Error(
      "manca il secondo argomento <settore|ateco-id|fascia-id>, da leggere sul database del " +
      "bersaglio: industry_code attivo, activity_classification_id ATECO_2025, " +
      "enterprise_size_band_id della fascia",
    );
  }
  const prov = await chiama(s, "POST", "/v1/tenants/provision", {
    tenantCode: CODICE,
    tenantName: `Prova T9 ${MARCA}`,
    tenantIndustryCode: industryCode,
    tenantCountryCode: "IT",
    adminEmail: `admin.${CODICE.toLowerCase()}@example.org`,
    adminDisplayName: "Amministratore di prova",
    adminPassword: passwordFor(PLATFORM),
  });
  if (prov.stato !== 201) throw new Error(`provisioning fallito: ${prov.stato} ${JSON.stringify(prov.dati)}`);
  const tenantId: string = prov.dati.tenant.id;
  nota("l'azienda-bersaglio esiste", true, `${CODICE} · id ${tenantId.slice(0, 8)}…`);

  // ── 2-3. il fascicolo, legato all'azienda ─────────────────────────────────────────
  const fas = await chiama(s, "POST", "/v1/tenant-blueprints", {
    code: `${CODICE}-CONFIG`, name: `Fascicolo di prova ${MARCA}`,
  });
  if (fas.stato !== 201) throw new Error(`fascicolo non creato: ${fas.stato} ${JSON.stringify(fas.dati)}`);
  const bpId: string = fas.dati.tenantBlueprintId;
  const link = await chiama(s, "POST", `/v1/tenant-blueprints/${bpId}/link-tenant`, { tenantId });
  nota("il fascicolo è legato all'azienda (E24)", link.stato === 200, `HTTP ${link.stato}`);

  // ── 4-5. identità e modello ───────────────────────────────────────────────────────
  const DIPENDENTI = 158;   // il numero DICHIARATO: E23 lo confronta coi segnaposto creati
  const ident = await chiama(s, "PATCH", `/v1/tenant-blueprints/${bpId}/versions/1/identity`, {
    industryClassId, sizeBandId, regulatoryIntensity: "HIGH", countryCode: "IT",
    employeeCount: DIPENDENTI,
  });
  nota("la carta d'identità è compilata", ident.stato === 200, `HTTP ${ident.stato} · ${DIPENDENTI} addetti dichiarati`);

  const prop = await chiama(s, "GET", `/v1/tenant-blueprints/${bpId}/versions/1/model-proposal`);
  const variantVersionId: string | undefined = prop.dati?.variantVersionId;
  if (!variantVersionId) throw new Error(`nessun modello proposto: ${JSON.stringify(prop.dati).slice(0, 200)}`);
  const pin = await chiama(s, "PUT", `/v1/tenant-blueprints/${bpId}/versions/1/model`, { variantVersionId });
  nota("il modello è ancorato", pin.stato === 200, `HTTP ${pin.stato} · variante ${variantVersionId.slice(0, 8)}…`);

  // ── PROVA B: apply PRIMA dell'approvazione non deve costruire ─────────────────────
  const primaUnita = await conta(s, tenantId);
  const anticipo = await chiama(s, "POST", `/v1/tenant-blueprints/${bpId}/versions/1/apply`);
  const dopoAnticipo = await conta(s, tenantId);
  nota(
    "PROVA B — `apply` su una versione non APPROVED non costruisce",
    anticipo.stato >= 400 && dopoAnticipo === primaUnita,
    `HTTP ${anticipo.stato} · registro ${primaUnita} → ${dopoAnticipo}`,
  );

  // ── 6. submit e approvazione della versione ───────────────────────────────────────
  const sub = await chiama(s, "POST", `/v1/tenant-blueprints/${bpId}/versions/1/submit`);
  if (sub.stato !== 200) throw new Error(`submit fallito: ${sub.stato} ${JSON.stringify(sub.dati)}`);
  const richiestaApprovazione: string | undefined =
    sub.dati?.approvalRequestId ?? sub.dati?.approvalRequest?.approvalRequestId;
  if (!richiestaApprovazione) throw new Error(`submit non ha restituito la richiesta: ${JSON.stringify(sub.dati)}`);
  await firma(s, richiestaApprovazione, "approvazione del fascicolo");
  const dopoFirma = await chiama(s, "GET", `/v1/tenant-blueprints/${bpId}/versions/1`);
  nota("la versione è APPROVED", dopoFirma.dati?.status === "APPROVED", `stato ${dopoFirma.dati?.status}`);

  // ── 7. il piano, senza scrivere ───────────────────────────────────────────────────
  const piano = await chiama(s, "POST", `/v1/tenant-blueprints/${bpId}/versions/1/build-plan`);
  const wc = piano.dati?.willCreate ?? {};
  console.log(`\n  il PIANO (nessuna riga scritta): ${JSON.stringify(wc)}`);
  console.log(`  già presenti:                    ${JSON.stringify(piano.dati?.alreadyThere ?? {})}\n`);
  nota("il piano si legge senza scrivere", piano.stato === 200 && (await conta(s, tenantId)) === PARTENZA,
       `HTTP ${piano.stato} · registro ancora a ${await conta(s, tenantId)} (partenza ${PARTENZA})`);

  // ── 8. l'applicazione: QUI nascono le righe ───────────────────────────────────────
  const app = await chiama(s, "POST", `/v1/tenant-blueprints/${bpId}/versions/1/apply`);
  if (app.stato !== 200) throw new Error(`apply fallito: ${app.stato} ${JSON.stringify(app.dati)}`);
  const richiestaCostruzione: string | undefined =
    app.dati?.approvalRequestId ?? app.dati?.approvalRequest?.approvalRequestId;
  if (!richiestaCostruzione) throw new Error(`apply non ha restituito la richiesta: ${JSON.stringify(app.dati)}`);
  nota("`apply` NON ha costruito: ha aperto una richiesta", (await conta(s, tenantId)) === PARTENZA,
       `richiesta ${richiestaCostruzione.slice(0, 8)}… · registro ancora ${await conta(s, tenantId)}`);
  await firma(s, richiestaCostruzione, "applicazione del fascicolo");

  // ── 9. le misure ──────────────────────────────────────────────────────────────────
  const unita = await conta(s, tenantId);
  const nate = unita - PARTENZA;
  const attese = Object.values(wc as Record<string, number>).reduce((a, b) => a + b, 0);
  nota("la costruzione è avvenuta", nate > 0, `${nate} righe nuove nel registro (${PARTENZA} → ${unita})`);
  // LA PROVA A: il registro deve coprire OGNI riga creata. Il piano ha detto quante ne
  // nascerebbero; se il registro ne conta meno, esistono righe senza origine — e la parte 3
  // non ha raggiunto il suo unico scopo.
  nota("PROVA A — ogni riga creata ha la sua origine", nate === attese,
       `${nate} righe di registro contro ${attese} righe che il piano dichiarava`);


  const versione = await chiama(s, "GET", `/v1/tenant-blueprints/${bpId}/versions/1`);
  nota("il fascicolo è APPLIED con la data", versione.dati?.status === "APPLIED" && !!versione.dati?.appliedAt,
       `stato ${versione.dati?.status} · applied_at ${versione.dati?.appliedAt ?? "VUOTO"}`);

  console.log(`\n# CODICE AZIENDA: ${CODICE} · TENANT: ${tenantId} · FASCICOLO: ${bpId}`);
  console.log(`# le misure sul database e l'archiviazione si eseguono da qui in poi con`);
  console.log(`# completezza_tenant.py --contro ${CODICE} e il controllo incrociato.\n`);

  const rossi = esiti.filter(([, ok]) => !ok);
  console.log(`${esiti.length - rossi.length}/${esiti.length} verdi`);
  if (rossi.length) { console.log("PROVA ROSSA"); process.exit(1); }
  console.log("PROVA VERDE");
}

/**
 * Il contatore prima/dopo e' il REGISTRO DELL'ORIGINE, non le unita' organizzative.
 * La prima stesura contava `/v1/organization-units?tenantId=…`, e quel filtro NON ESISTE:
 * la rotta lo ignorava e restituiva 45 — le unita' di RTL — per un'azienda appena creata
 * che ne ha zero. La prova B passava (45 -> 45) misurando una cosa che non poteva cambiare:
 * un falso verde. Il registro invece e' esattamente cio' che la parte 3 deve far nascere,
 * e sul bersaglio parte da zero.
 */
async function conta(s: Sessione, _tenantId: string): Promise<number> {
  const r = await chiama(s, "GET", "/v1/generated-origins?limit=1");
  return r.dati?.total ?? -1;
}

main().catch((e) => {
  console.error(`\nPROVA INTERROTTA: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
