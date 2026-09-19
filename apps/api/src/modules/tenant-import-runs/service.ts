/**
 * apps/api/src/modules/tenant-import-runs/service.ts
 * #206 — Tenant Builder P4: i tre atti, e chi puo' compierli.
 *
 *   registraFonte   → l'estrazione del cliente diventa una fonte con impronta; le righe atterrano
 *                     senza tipi. Lo stesso contenuto, con qualunque nome, e' la stessa fonte.
 *   apriCorsa       → ogni riga atterrata diventa una persona candidata, validata regola per
 *                     regola contro l'azienda di destinazione (E19). La corsa resta RUNNING:
 *                     nessuna persona nasce qui.
 *   sottometti      → la corsa va alla firma (E26): UNA richiesta di approvazione per corsa, con
 *                     le eccezioni nominate nel corpo. L'iniezione la fa l'effetto
 *                     `TENANT_IMPORT_RUN` quando la firma arriva, in una transazione sola.
 *
 * Visibilita': tenant-scoped — un attore vede le corse della propria azienda; PLATFORM_ADMIN le
 * vede tutte e puo' importare in un'azienda che non e' la sua (e' il caso normale: un'azienda
 * appena costruita non ha ancora nessuno che possa fare nulla).
 */
import { pool, withTransaction } from "../../db/client.js";
import { perimetroClienti, puoVedereCliente, type ActorContext } from "../../lib/actor.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/index.js";
import { maskFields } from "../../lib/scope/mask.js";
import type {
  CreateTenantImportRunBody,
  RegisterTenantImportSourceBody,
  RegisterTenantImportSourceResponse,
  SubmitTenantImportRunResponse,
  TenantImportRun,
  TenantImportRunDetail,
  TenantImportRunListQuery,
  TenantImportValidation,
} from "@heuresys/shared";
import { approvalService } from "../approvals/service.js";
import { TENANT_IMPORT_RUN } from "../approvals/effects/tenant-import-run.js";
import * as repo from "./repository.js";
import { valutaPersona } from "./validation.js";

function visibile(a: ActorContext, r: TenantImportRun): boolean {
  return puoVedereCliente(a, r.tenantId);
}

/**
 * Mandato K, R-6 s2 (passo 57): DATA_STEWARD legge una corsa "mascherato dei dati
 * personali" — chi puo' gia' leggere questo modulo per un altro motivo (plenipotenziari,
 * IMPLEMENTATION_CONSULTANT che avvia l'azienda) non perde visibilita' solo perche' porta
 * ANCHE il ruolo DATA_STEWARD. Locale a questo servizio: non tocca I16/I18/I20.
 */
const RUOLI_CHE_VEDONO_I_CANDIDATI_IN_CHIARO = new Set<ActorContext["roles"][number]>([
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
  "HRMS_MANAGER",
  "IMPLEMENTATION_CONSULTANT",
]);

function deveMascherareICandidati(a: ActorContext): boolean {
  if (!a.roles.includes("DATA_STEWARD")) return false;
  return !a.roles.some((r) => RUOLI_CHE_VEDONO_I_CANDIDATI_IN_CHIARO.has(r));
}

function tenantDiDestinazione(a: ActorContext, richiesto: string | undefined): string {
  const perimetro = perimetroClienti(a);
  if (perimetro === undefined) {
    // PLATFORM_ADMIN: nessun filtro, indica il tenant.
    const t = richiesto ?? a.tenantId;
    if (!t) throw new ForbiddenError("PLATFORM_ADMIN deve indicare tenantId", "TENANT_ID_REQUIRED");
    return t;
  }
  if (a.assignedTenantIds !== undefined) {
    // Ruolo di piattaforma assegnato (es. IMPLEMENTATION_CONSULTANT, D9=B): il
    // proprio tenant "di casa" (a.tenantId, sempre valorizzato — I-G #35) NON e'
    // il perimetro. Deve indicare un tenant fra quelli assegnati. 404 sul tenant
    // fuori perimetro, per non confermarne l'esistenza (stesso criterio di
    // puoVedereCliente altrove).
    if (!richiesto) throw new ForbiddenError("Serve indicare tenantId", "TENANT_ID_REQUIRED");
    if (!perimetro.has(richiesto)) throw new NotFoundError("Tenant");
    return richiesto;
  }
  // TENANT_ADMIN e simili: sempre e solo il proprio tenant.
  if (!a.tenantId) throw new ForbiddenError("Serve un contesto di azienda");
  if (richiesto && richiesto !== a.tenantId) {
    throw new ForbiddenError("Si importa solo nella propria azienda", "CROSS_TENANT_IMPORT");
  }
  return a.tenantId;
}

export const tenantImportRunsService = {
  /** T2 + T3. */
  async registraFonte(a: ActorContext, body: RegisterTenantImportSourceBody): Promise<RegisterTenantImportSourceResponse> {
    const { hash, bytes } = repo.improntaRighe(body.rows);
    // Per IMPRONTA, prima di tutto: e' cio' che rende la registrazione idempotente. Il nome
    // viene dopo, ed e' solo un'etichetta.
    const esistente = await repo.findSourceByHash(pool, hash);
    if (esistente) return { source: esistente, alreadyRegistered: true };
    if (await repo.sourceNameTaken(pool, body.name)) {
      throw new ConflictError(
        `Esiste gia' una fonte chiamata «${body.name}» con un contenuto diverso: cambia nome, il contenuto e' nuovo`,
        "SOURCE_NAME_TAKEN",
      );
    }
    const source = await withTransaction((client) =>
      repo.insertSourceWithRows(client, { name: body.name, hash, bytes, rows: body.rows, metadata: body.metadata, registeredBy: a.userId }),
    );
    return { source, alreadyRegistered: false };
  },

  /** T4: la corsa, con la validazione di ogni persona. */
  async apriCorsa(a: ActorContext, body: CreateTenantImportRunBody): Promise<TenantImportRunDetail> {
    const tenantId = tenantDiDestinazione(a, body.tenantId);
    const source = await repo.findSourceById(pool, body.sourceExportId);
    if (!source) throw new NotFoundError("Fonte");
    if (source.status !== "AVAILABLE") {
      throw new ConflictError(`La fonte e' ${source.status}: una fonte gia' ingerita non si importa due volte`, "SOURCE_NOT_AVAILABLE");
    }
    const inVolo = await repo.findRunInFlightForSource(pool, source.sourceExportId);
    if (inVolo) throw new ConflictError(`Esiste gia' una corsa in volo su questa fonte (${inVolo})`, "SOURCE_RUN_IN_FLIGHT");
    const stato = await repo.tenantStatus(pool, tenantId);
    if (stato !== "ACTIVE") throw new ConflictError(`L'azienda di destinazione non e' ACTIVE (${stato ?? "assente"})`, "TENANT_NOT_ACTIVE");
    if (source.rowCount === 0) throw new ConflictError("La fonte non ha righe atterrate", "SOURCE_EMPTY");

    const runId = await withTransaction(async (client) => {
      const id = await repo.insertRun(client, {
        tenantId, source, createdBy: a.userId,
        code: `TENANT-IMPORT-${source.fileHash.slice(0, 12)}-${Date.now()}`,
      });
      const righe = await repo.loadRows(client, source.sourceExportId);
      const chiaviViste = new Set<string>();
      const posizioniViste = new Set<string>();
      for (const riga of righe) {
        const v = await valutaPersona(client, tenantId, riga);
        // La chiave naturale e' l'email; senza email, la riga. Due righe con la stessa email
        // nella stessa estrazione sono un difetto della fonte, e si dichiara sulla seconda.
        let naturalKey = v.email ?? `row:${riga.rowNo}`;
        const regole: TenantImportValidation[] = v.regole.map((r) => ({ ruleCode: r.ruleCode, status: r.status, message: r.message, payload: r.payload }));
        let statoRiga = v.stato;
        if (chiaviViste.has(naturalKey)) {
          regole.push({ ruleCode: "PERSON_NOT_YET_PRESENT", status: "FAILED", message: `email duplicata nella stessa estrazione (riga ${riga.rowNo})`, payload: { duplicateOf: naturalKey } });
          naturalKey = `${naturalKey}#row:${riga.rowNo}`;
          statoRiga = "FAILED";
        }
        chiaviViste.add(naturalKey);
        // Una posizione, una persona: la seconda riga che punta alla stessa posizione in questa
        // estrazione non entra — non e' l'importazione a scegliere chi delle due.
        const posId = v.posizione?.positionId ?? null;
        if (posId && statoRiga !== "FAILED") {
          if (posizioniViste.has(posId)) {
            const i = regole.findIndex((r) => r.ruleCode === "POSITION_VACANT");
            const regola: TenantImportValidation = { ruleCode: "POSITION_VACANT", status: "FAILED", message: `la posizione ${v.posizione!.positionCode} e' gia' assegnata a un'altra persona di questa estrazione`, payload: { positionId: posId } };
            if (i >= 0) regole[i] = regola; else regole.push(regola);
            statoRiga = "FAILED";
          } else {
            posizioniViste.add(posId);
          }
        }
        const { rowNo, ...soloRiga } = riga;
        await repo.insertCandidate(client, {
          runId: id, tenantId, naturalKey, rowNo, riga: soloRiga,
          email: v.email, positionId: v.posizione?.positionId ?? null, positionCode: v.posizione?.positionCode ?? null,
          e19: v.e19, hireDate: v.hireDate,
          placeholderUserId: v.posizione?.occupante?.userType === "GENERATED_INCUMBENT" ? v.posizione.occupante.userId : null,
          status: statoRiga, validations: regole,
        });
      }
      return id;
    });
    return this.dettaglio(a, runId);
  },

  async list(a: ActorContext, query: TenantImportRunListQuery) {
    const tenantIds = perimetroClienti(a);
    return repo.listRuns(pool, { tenantIds, query });
  },

  async dettaglio(a: ActorContext, id: string): Promise<TenantImportRunDetail> {
    const run = await repo.findRunById(pool, id);
    if (!run || !visibile(a, run)) throw new NotFoundError("Corsa di importazione");
    const candidates = await repo.loadCandidates(pool, id);
    // Mandato K, R-6 s2 (passo 57): DATA_STEWARD legge la corsa (stato, referto, conteggi)
    // ma NON i dati personali dei candidati — email/displayName/naturalKey e le sei regole
    // di validazione (PERSON_EMAIL, POSITION_VACANT...) li ripetono in chiaro nei loro
    // message/payload. Mascherare i soli campi non basterebbe (l'email resterebbe leggibile
    // nel payload di una regola): si maschera l'intero campo `candidates` (mask.ts,
    // per-FIELD/DICHIARATO/STABILE) — la corsa resta visibile, la lista delle persone no.
    if (deveMascherareICandidati(a)) {
      return maskFields({ ...run, candidates }, ["candidates"]) as TenantImportRunDetail;
    }
    return { ...run, candidates };
  },

  /** T6 (la parte che apre la firma): E26, si firma la corsa. */
  async sottometti(a: ActorContext, id: string): Promise<SubmitTenantImportRunResponse> {
    const run = await repo.findRunById(pool, id);
    if (!run || !visibile(a, run)) throw new NotFoundError("Corsa di importazione");
    if (run.status !== "RUNNING") throw new ConflictError(`La corsa e' ${run.status}: si firma solo una corsa aperta`, "RUN_NOT_OPEN");
    if (run.approvalRequestId) throw new ConflictError("La corsa e' gia' stata sottomessa alla firma", "RUN_ALREADY_SUBMITTED");
    if (run.referto.persone - run.referto.escluse === 0) {
      throw new ConflictError("Nessuna persona puo' entrare: tutte escluse dalla validazione", "RUN_NOTHING_TO_IMPORT");
    }

    // Chi firma: chi detiene `seed_acquisition:approve` NELL'AZIENDA di destinazione; se non c'e'
    // nessuno — un'azienda appena costruita — i detentori del tenant di piattaforma. Tutti in
    // un tenant solo, perche' la richiesta di approvazione vive in un tenant (I5).
    let approvatori = await repo.findApproversInTenant(pool, run.tenantId);
    if (approvatori.length === 0) {
      const piattaforma = await repo.platformTenantId(pool);
      if (piattaforma) approvatori = await repo.findApproversInTenant(pool, piattaforma);
    }
    if (approvatori.length === 0) {
      throw new ConflictError("Nessun utente puo' firmare l'importazione: manca chi detiene seed_acquisition:approve", "IMPORT_NO_APPROVER");
    }

    const candidati = await repo.loadCandidates(pool, id);
    const escluse = candidati.filter((c) => c.status === "FAILED");
    const conScostamento = candidati.filter((c) => c.status !== "FAILED" && c.e19 === "AMMESSA_CON_SCOSTAMENTO");
    const cieche = candidati.filter((c) => c.status !== "FAILED" && c.e19 === "CIECA");
    const riga = (c: (typeof candidati)[number]) => `${c.displayName ?? c.email ?? c.naturalKey} → ${c.positionCode ?? "—"}`;
    const corpo = [
      `Importazione di ${run.referto.persone - run.referto.escluse} persone nell'azienda, dalla fonte ${run.sourceExportId}.`,
      `Ammesse senza scostamento: ${run.referto.ammesse}.`,
      conScostamento.length
        ? `Con scostamento sui requisiti CRITICAL (entrano comunque — E25, la posizione resta segnalata): ${conScostamento.map(riga).join("; ")}.`
        : "Nessuno scostamento sui requisiti CRITICAL.",
      cieche.length
        ? `Verifica CIECA (posizione senza requisiti CRITICAL: niente da controllare, NON «a posto»): ${cieche.map(riga).join("; ")}.`
        : "",
      escluse.length
        ? `ESCLUSE (non entrano, per una regola FAILED): ${escluse.map((c) => `${riga(c)} [${c.validations.filter((v) => v.status === "FAILED").map((v) => v.ruleCode).join(",")}]`).join("; ")}.`
        : "Nessuna esclusa.",
    ].filter(Boolean).join("\n");

    const richiesta = await approvalService.createRequest(a, {
      title: `Importazione persone — corsa ${run.code}`,
      body: corpo,
      resourceType: TENANT_IMPORT_RUN,
      resourceId: run.runId,
      approverUserIds: approvatori,
      // E26: si firma la CORSA, e una firma basta. Con ALL_OF ogni detentore del permesso
      // dovrebbe firmare la stessa importazione — non e' una co-firma, e' un ingorgo.
      decisionPolicy: "ANY_OF",
      priority: "HIGH",
      metadata: { tenantId: run.tenantId, sourceExportId: run.sourceExportId, referto: run.referto },
    });
    return { approvalRequestId: richiesta.approvalRequestId, runId: run.runId, referto: run.referto };
  },
};
