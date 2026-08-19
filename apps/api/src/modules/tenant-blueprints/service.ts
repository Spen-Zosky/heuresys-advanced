/**
 * apps/api/src/modules/tenant-blueprints/service.ts
 * #131 Tenant Builder P1, T5 — le regole del fascicolo.
 *
 * SUL MODELLO DI AUTORIZZAZIONE. Questo modulo non ha un filtro di scope per
 * tenant, e non e' una dimenticanza: i tre permessi `tenant_blueprint:*` sono
 * concessi al SOLO `PLATFORM_ADMIN` (decisioni E1 ed E6, migrazione 000300, che
 * lo verifica sulla riga intera e non solo sul ruolo appena servito). Il
 * permesso E' il cancello. Un fascicolo, per giunta, nasce PRIMA dell'azienda:
 * un filtro per tenant non avrebbe niente su cui filtrare durante una
 * trattativa. Il giorno in cui un ruolo di cliente ottenesse uno di questi
 * permessi, servirebbe qui uno scope — e quel giorno e' P2, dove nasce l'attore
 * che puo' vederli.
 *
 * Ogni rifiuto porta il suo codice: mai un errore nudo (§9 della specifica).
 */
import { pool, withTransaction } from "../../db/client.js";
import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import * as repo from "./repository.js";
import { proposeModel, isPublishedVariantVersion } from "./derivation.js";
import { diffVersions, diffAgainstModelLatest } from "./diff.js";
import { approvalService } from "../approvals/service.js";
import { TENANT_BLUEPRINT_APPROVAL } from "../approvals/effects/tenant-blueprint-approval.js";
import { TENANT_BLUEPRINT_APPLICATION } from "../approvals/effects/tenant-blueprint-application.js";
import { resolveBuildSource } from "../tenant-materialization/blueprint-build-source.js";
import { materialize } from "../tenant-materialization/repository.js";
import type {
  TenantBlueprint,
  TenantBlueprintDetail,
  TenantBlueprintVersion,
  TenantBlueprintListQuery,
  CreateTenantBlueprintBody,
  UpdateTenantBlueprintBody,
  PatchIdentityBody,
  PutProcessDecisionBody,
  ProcessDecision,
  ModelProposalResponse,
  BlueprintDiffResponse,
  SubmitVersionResponse,
  BlueprintIdentity,
  BuildPlanPreview,
  ApplyVersionResponse,
} from "@heuresys/shared";

/** Violazione di un indice unico. */
const isUniqueViolation = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";

/** Solo una bozza si modifica. Approvata, applicata o superata: si apre una versione nuova. */
const MODIFICABILI = ["DRAFT"] as const;

/**
 * I campi senza i quali un fascicolo non e' sottoponibile alla FIRMA.
 *
 * ⚠ CORRETTO S1068 (#132 F0). Diceva: «i ricavi e il numero di dipendenti descrivono
 * l'azienda ma non entrano in nessuna derivazione, e pretenderli bloccherebbe la firma
 * per un dato che non cambia il risultato». La prima meta' e' **falsa da quando esiste
 * la ricerca**: il numero di addetti e il modello operativo entrano in una derivazione,
 * ed e' la piu' importante — quella che decide che azienda si va a cercare.
 *
 * La correzione NON e' aggiungerli qui, e la distinzione e' voluta: **firmare e cercare
 * sono due momenti diversi**. Un fascicolo si puo' firmare senza sapere quanti addetti
 * ha l'azienda (accadeva, e bloccarlo ora respingerebbe fascicoli legittimi); una
 * RICERCA senza quel numero non e' mirata, e non ce ne accorgeremmo dall'esito — ne
 * uscirebbe un'azienda plausibile e generica.
 *
 * Percio' i requisiti della ricerca vivono a parte, in `@heuresys/shared`
 * (`PARAMETRI_RICERCA` / `parametriRicercaMancanti`), e sono **sei**: questi quattro,
 * piu' `employeeCount` e `operatingModelId`. Il legame fra fascia e numero e' presidiato
 * dal database (trigger `sys_blueprint_size_band_coherence`, mig `000323`), non da questo
 * elenco: un CHECK non puo' leggere la tabella delle fasce, e il trigger regge anche le
 * scritture che non passano da qui.
 */
const IDENTITA_OBBLIGATORIA: Array<{ campo: keyof BlueprintIdentity; etichetta: string }> = [
  { campo: "industryClassId", etichetta: "settore di attivita' (ATECO)" },
  { campo: "sizeBandId", etichetta: "fascia dimensionale" },
  { campo: "countryCode", etichetta: "paese" },
  { campo: "regulatoryIntensity", etichetta: "intensita' di vigilanza" },
];

async function versioneModificabile(
  blueprintId: string,
  number: number,
): Promise<TenantBlueprintVersion> {
  const v = await repo.findVersion(pool, blueprintId, number);
  if (!v) throw new NotFoundError("Versione di fascicolo non trovata");
  if (!(MODIFICABILI as readonly string[]).includes(v.status)) {
    throw new ConflictError(
      `La versione ${v.number} e' in stato ${v.status}: non si modifica, si apre una versione nuova`,
      "BLUEPRINT_VERSION_NOT_EDITABLE",
    );
  }
  return v;
}

async function esisteFascicolo(id: string): Promise<TenantBlueprint> {
  const b = await repo.findBlueprintById(pool, id);
  if (!b) throw new NotFoundError("Fascicolo non trovato");
  return b;
}

export const tenantBlueprintsService = {
  async list(
    _a: ActorContext,
    query: TenantBlueprintListQuery,
  ): Promise<{ items: TenantBlueprint[]; total: number }> {
    return repo.listBlueprints(pool, query);
  },

  async getById(_a: ActorContext, id: string): Promise<TenantBlueprintDetail> {
    const b = await esisteFascicolo(id);
    const versions = await repo.listVersions(pool, id);
    return { ...b, versions };
  },

  async create(a: ActorContext, body: CreateTenantBlueprintBody): Promise<TenantBlueprint> {
    try {
      return await withTransaction(async (client) =>
        repo.insertBlueprint(client, {
          code: body.code,
          name: body.name,
          tenantId: body.tenantId ?? null,
          actorUserId: a.userId,
        }),
      );
    } catch (e) {
      if (isUniqueViolation(e)) {
        // Due indici unici possono mordere qui: il codice del fascicolo e
        // «un solo fascicolo attivo per azienda». Si distingue leggendo, non
        // indovinando dal messaggio.
        const esistente = await repo.findBlueprintByCode(pool, body.code);
        if (esistente) {
          throw new ConflictError(
            `Esiste gia' un fascicolo con codice ${body.code}`,
            "BLUEPRINT_CODE_CONFLICT",
          );
        }
        throw new ConflictError(
          "L'azienda indicata ha gia' un fascicolo attivo",
          "BLUEPRINT_TENANT_ALREADY_LINKED",
        );
      }
      throw e;
    }
  },

  async update(
    a: ActorContext,
    id: string,
    body: UpdateTenantBlueprintBody,
  ): Promise<TenantBlueprint> {
    await esisteFascicolo(id);
    const b = await repo.updateBlueprint(pool, id, body, a.userId);
    if (!b) throw new NotFoundError("Fascicolo non trovato");
    return b;
  },

  /**
   * E24 (#199) — la firma del legame, che e' PERMANENTE.
   *
   * Due dinieghi, e non vanno confusi: `BLUEPRINT_TENANT_ALREADY_LINKED` riguarda
   * l'azienda di DESTINAZIONE (ne ha gia' uno: si sceglie un'altra azienda, ed e'
   * rimediabile), `BLUEPRINT_LINK_IS_PERMANENT` riguarda QUESTO fascicolo (e' gia'
   * legato: non e' rimediabile, si archivia e se ne fa uno nuovo). Prima erano
   * indistinguibili da un client, e la seconda meta' dei casi non era nemmeno
   * rifiutata.
   *
   * Cio' che E24 NON vieta: una trattativa che non va in porto resta senza azienda
   * e si archivia; un'azienda che riparte da un fascicolo nuovo puo' farlo (l'indice
   * unico parziale conta solo gli ACTIVE); la prima firma di un fascicolo mai legato.
   */
  async linkTenant(a: ActorContext, id: string, tenantId: string): Promise<TenantBlueprint> {
    await esisteFascicolo(id);
    let b: TenantBlueprint | null;
    try {
      b = await repo.linkTenant(pool, id, tenantId, a.userId);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictError(
          "L'azienda indicata ha gia' un fascicolo attivo",
          "BLUEPRINT_TENANT_ALREADY_LINKED",
        );
      }
      throw e;
    }
    if (b) return b;
    // Zero righe con il fascicolo che esiste (`esisteFascicolo` l'ha appena
    // accertato) vuol dire una cosa sola: la guardia ha morso. Si rilegge per dire
    // A QUALE azienda e' legato — un diniego che non lo dice costringe chi lo
    // riceve a indovinare.
    const attuale = await repo.findBlueprintById(pool, id);
    if (!attuale) throw new NotFoundError("Fascicolo non trovato");
    throw new ConflictError(
      `Il fascicolo e' gia' legato a un'azienda (${attuale.tenantId ?? "ignota"}) e il legame e' permanente`,
      "BLUEPRINT_LINK_IS_PERMANENT",
    );
  },

  async getVersion(
    _a: ActorContext,
    id: string,
    number: number,
  ): Promise<TenantBlueprintVersion> {
    await esisteFascicolo(id);
    const v = await repo.findVersion(pool, id, number);
    if (!v) throw new NotFoundError("Versione di fascicolo non trovata");
    return v;
  },

  /** Apre una bozza nuova copiando l'ultima versione chiusa (identita' + decisioni). */
  async openVersion(a: ActorContext, id: string): Promise<TenantBlueprintVersion> {
    await esisteFascicolo(id);
    const versioni = await repo.listVersions(pool, id);
    const aperta = versioni.find((v) => v.status === "DRAFT" || v.status === "IN_APPROVAL");
    if (aperta) {
      throw new ConflictError(
        `La versione ${aperta.number} e' ancora aperta: si chiude quella prima di aprirne un'altra`,
        "BLUEPRINT_VERSION_ALREADY_OPEN",
      );
    }
    const ultima = versioni[versioni.length - 1] ?? null;
    try {
      return await withTransaction(async (client) => {
        const nuova = await repo.insertVersion(
          client,
          id,
          ultima?.tenantBlueprintVersionId ?? null,
          a.userId,
        );
        if (ultima) {
          await repo.copyDecisions(
            client,
            ultima.tenantBlueprintVersionId,
            nuova.tenantBlueprintVersionId,
          );
        }
        return nuova;
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictError(
          "Esiste gia' una versione aperta su questo fascicolo",
          "BLUEPRINT_VERSION_ALREADY_OPEN",
        );
      }
      throw e;
    }
  },

  async patchIdentity(
    a: ActorContext,
    id: string,
    number: number,
    body: PatchIdentityBody,
  ): Promise<TenantBlueprintVersion> {
    await esisteFascicolo(id);
    const v = await versioneModificabile(id, number);

    // #132 F0 — LA COERENZA FASCIA↔ADDETTI, DETTA IN MODO LEGGIBILE.
    // Il presidio vero è nel database (trigger `sys_blueprint_size_band_coherence`,
    // mig `000323`), e ci resta: copre anche le scritture che non passano da qui. Ma un
    // vincolo di database parla con un messaggio SQL e uno stato 500 — cioè, per chi
    // compila il fascicolo, «si è rotto qualcosa» invece di «questi due numeri non
    // stanno insieme». Percio' il controllo si fa ANCHE qui, sullo stato RISULTANTE
    // dalla patch (non su ciò che arriva: si può cambiare la fascia lasciando il numero,
    // o il numero lasciando la fascia, e in entrambi i casi l'incoerenza nasce dalla
    // combinazione, non dal campo toccato).
    const fasciaFinale = body.sizeBandId !== undefined ? body.sizeBandId : v.identity.sizeBandId;
    const addettiFinali =
      body.employeeCount !== undefined ? body.employeeCount : v.identity.employeeCount;
    if (fasciaFinale && addettiFinali !== null && addettiFinali !== undefined) {
      const fascia = await repo.findSizeBand(pool, fasciaFinale);
      // Una fascia che non esiste non si tace: la FK la impedirebbe, ma tacere qui
      // renderebbe il controllo un no-op il giorno in cui la FK cambiasse.
      if (!fascia) {
        throw new UnprocessableEntityError(
          { campo: "sizeBandId" },
          "La fascia dimensionale indicata non esiste nel catalogo",
          "BLUEPRINT_SIZE_BAND_UNKNOWN",
        );
      }
      const sotto = addettiFinali < fascia.min;
      const sopra = fascia.max !== null && addettiFinali > fascia.max;
      if (sotto || sopra) {
        const intervallo = fascia.max === null ? `${fascia.min}+` : `${fascia.min}-${fascia.max}`;
        // 422 e non 400: il corpo e' sintatticamente valido (Zod l'ha accettato), e'
        // la REGOLA di dominio a essere violata — la distinzione che
        // `UnprocessableEntityError` esiste per fare.
        throw new UnprocessableEntityError(
          { fascia: fascia.code, intervallo, dichiarati: addettiFinali },
          `La fascia ${fascia.code} copre ${intervallo} addetti, ma ne sono dichiarati ${addettiFinali}`,
          "BLUEPRINT_SIZE_BAND_MISMATCH",
        );
      }
    }

    const agg = await repo.patchIdentity(pool, v.tenantBlueprintVersionId, body, a.userId);
    if (!agg) throw new NotFoundError("Versione di fascicolo non trovata");
    return agg;
  },

  async modelProposal(
    _a: ActorContext,
    id: string,
    number: number,
  ): Promise<ModelProposalResponse> {
    await esisteFascicolo(id);
    const v = await repo.findVersion(pool, id, number);
    if (!v) throw new NotFoundError("Versione di fascicolo non trovata");
    return proposeModel(pool, v.identity);
  },

  async pinModel(
    a: ActorContext,
    id: string,
    number: number,
    variantVersionId: string,
  ): Promise<TenantBlueprintVersion> {
    await esisteFascicolo(id);
    const v = await versioneModificabile(id, number);
    if (!(await isPublishedVariantVersion(pool, variantVersionId))) {
      throw new ConflictError(
        "La versione di modello indicata non esiste o non e' pubblicata",
        "BLUEPRINT_MODEL_NOT_AVAILABLE",
      );
    }
    const agg = await repo.pinModel(pool, v.tenantBlueprintVersionId, variantVersionId, a.userId);
    if (!agg) throw new NotFoundError("Versione di fascicolo non trovata");
    return agg;
  },

  async listProcesses(
    _a: ActorContext,
    id: string,
    number: number,
  ): Promise<{ items: ProcessDecision[] }> {
    await esisteFascicolo(id);
    const v = await repo.findVersion(pool, id, number);
    if (!v) throw new NotFoundError("Versione di fascicolo non trovata");
    if (!v.variantVersionId) {
      throw new ConflictError(
        "Nessun modello ancorato: non c'e' ancora niente su cui decidere",
        "BLUEPRINT_MODEL_NOT_PINNED",
      );
    }
    return { items: await repo.listProcessesWithDecisions(pool, v.tenantBlueprintVersionId) };
  },

  async putDecision(
    a: ActorContext,
    id: string,
    number: number,
    processId: string,
    body: PutProcessDecisionBody,
  ): Promise<void> {
    await esisteFascicolo(id);
    const v = await versioneModificabile(id, number);
    if (!v.variantVersionId) {
      throw new ConflictError(
        "Nessun modello ancorato: non c'e' ancora niente su cui decidere",
        "BLUEPRINT_MODEL_NOT_PINNED",
      );
    }
    // La motivazione obbligatoria e' imposta su tre strati: lo schema Zod la
    // rifiuta prima di arrivare qui (400 VALIDATION_ERROR), il CHECK del
    // database la rifiuterebbe comunque, e questa guardia copre le chiamate che
    // non passano dall'HTTP. `ValidationError` porta un codice fisso, quindi
    // `BLUEPRINT_DECISION_RATIONALE_REQUIRED` della §9 vive nei dettagli.
    if (body.rationale.trim().length === 0) {
      throw new ValidationError(
        {
          rationale: "una decisione senza motivazione non e' una decisione",
          code: "BLUEPRINT_DECISION_RATIONALE_REQUIRED",
        },
        "Motivazione mancante",
      );
    }
    if (!(await repo.processBelongsToVersion(pool, v.tenantBlueprintVersionId, processId))) {
      throw new NotFoundError("Il processo non appartiene al modello ancorato da questa versione");
    }
    await repo.upsertDecision(
      pool,
      v.tenantBlueprintVersionId,
      processId,
      body.inclusion,
      body.rationale.trim(),
      a.userId,
    );
  },

  /** R1: togliere la decisione NON significa «escluso», significa «come dice il modello». */
  async deleteDecision(
    _a: ActorContext,
    id: string,
    number: number,
    processId: string,
  ): Promise<void> {
    await esisteFascicolo(id);
    const v = await versioneModificabile(id, number);
    // Nessuna decisione da togliere non e' un errore: lo stato voluto e' gia'
    // quello, ed e' cio' che rende l'operazione ripetibile.
    await repo.deleteDecision(pool, v.tenantBlueprintVersionId, processId);
  },

  async submit(a: ActorContext, id: string, number: number): Promise<SubmitVersionResponse> {
    const fascicolo = await esisteFascicolo(id);
    const v = await versioneModificabile(id, number);

    const mancanti = IDENTITA_OBBLIGATORIA.filter(
      ({ campo }) => v.identity[campo] === null || v.identity[campo] === undefined,
    ).map(({ etichetta }) => etichetta);
    if (mancanti.length > 0) {
      throw new ConflictError(
        `La carta d'identita' non e' completa: manca ${mancanti.join(", ")}`,
        "BLUEPRINT_IDENTITY_INCOMPLETE",
      );
    }
    if (!v.variantVersionId) {
      throw new ConflictError(
        "Nessun modello ancorato: la versione non e' sottoponibile alla firma",
        "BLUEPRINT_MODEL_NOT_PINNED",
      );
    }

    const approvatori = await repo.findApprovers(pool);
    if (approvatori.length === 0) {
      throw new ConflictError(
        "Nessun utente puo' firmare un fascicolo: manca chi detiene tenant_blueprint:approve",
        "BLUEPRINT_NO_APPROVER",
      );
    }

    const richiesta = await approvalService.createRequest(a, {
      title: `Fascicolo ${fascicolo.code} — versione ${v.number}`,
      body: `Approvazione della versione ${v.number} del fascicolo di configurazione «${fascicolo.name}».`,
      resourceType: TENANT_BLUEPRINT_APPROVAL,
      resourceId: v.tenantBlueprintVersionId,
      approverUserIds: approvatori.map((x) => x.userId),
      priority: "MEDIUM",
    });

    // Lo stato si muove SOLO dopo che la richiesta esiste: se la creazione
    // fallisse, una versione IN_APPROVAL senza richiesta sarebbe bloccata per
    // sempre — nessuno potrebbe piu' ne' modificarla ne' approvarla.
    const passata = await repo.setVersionStatus(
      pool,
      v.tenantBlueprintVersionId,
      ["DRAFT"],
      "IN_APPROVAL",
      a.userId,
    );
    if (!passata) {
      throw new ConflictError(
        "La versione non e' piu' una bozza: sottomissione rifiutata",
        "BLUEPRINT_VERSION_NOT_EDITABLE",
      );
    }

    const aggiornata = await repo.findVersionById(pool, v.tenantBlueprintVersionId);
    if (!aggiornata) throw new NotFoundError("Versione di fascicolo non trovata");
    return { approvalRequestId: richiesta.approvalRequestId, version: aggiornata };
  },

  async diff(
    _a: ActorContext,
    id: string,
    number: number,
    against: number | "MODEL_LATEST",
  ): Promise<BlueprintDiffResponse> {
    await esisteFascicolo(id);
    const corrente = await repo.findVersion(pool, id, number);
    if (!corrente) throw new NotFoundError("Versione di fascicolo non trovata");
    if (against === "MODEL_LATEST") return diffAgainstModelLatest(pool, corrente);
    const altra = await repo.findVersion(pool, id, against);
    if (!altra) {
      throw new NotFoundError(`La versione ${against} di questo fascicolo non esiste`);
    }
    return diffVersions(pool, corrente, altra);
  },

  /**
   * #198 T6 — IL PIANO, SENZA SCRIVERE. Dice cosa nascerebbe e cosa esiste già, e non tocca
   * niente: `materialize(..., "plan")` fa solo conteggi di esistenza.
   *
   * `alreadyThere` non è un dettaglio di presentazione: è ciò che distingue una costruzione
   * nuova da una ri-applicazione su un'azienda già popolata, e chi guarda il piano deve
   * poterlo vedere **prima** di firmare, non scoprirlo dopo.
   */
  async buildPlan(_a: ActorContext, id: string, number: number): Promise<BuildPlanPreview> {
    const fascicolo = await esisteFascicolo(id);
    const v = await repo.findVersion(pool, id, number);
    if (!v) throw new NotFoundError("Versione di fascicolo non trovata");
    if (!fascicolo.tenantId) {
      throw new ConflictError(
        "Il fascicolo non è legato a un'azienda: non c'è nulla da costruire",
        "BLUEPRINT_TENANT_NOT_LINKED",
      );
    }
    const chiave = v.variantVersionId
      ? await repo.findBuildSourceKey(pool, v.variantVersionId)
      : null;
    if (!chiave) {
      throw new ConflictError(
        "La versione non dichiara una sorgente di costruzione (nessun modello ancorato, o il modello non ne dichiara una)",
        "BLUEPRINT_BUILD_SOURCE_MISSING",
      );
    }
    // La sorgente si risolve dalla chiave (#132 F2). L'anteprima deve vedere ESATTAMENTE
    // ciò che l'atto costruirebbe: se qui si risolvesse diversamente, chi firma guarderebbe
    // un piano e ne otterrebbe un altro.
    const sorgente = resolveBuildSource(pool, chiave, v.variantVersionId);
    if (!sorgente) {
      throw new ConflictError(`Sorgente di costruzione sconosciuta: ${chiave}`, "BLUEPRINT_BUILD_SOURCE_UNKNOWN");
    }
    const piano = await sorgente.plan();
    // `plan` è di sola lettura, ma vuole comunque un client: si prende dal pool e si
    // rilascia. Nessuna transazione — non c'è niente da annullare.
    const client = await pool.connect();
    let conteggi;
    try {
      conteggi = await materialize(client, fascicolo.tenantId, piano, "plan");
    } finally {
      client.release();
    }
    const totali = {
      orgUnits: piano.orgUnits.length,
      positions: piano.positions.length,
      users: piano.incumbents.length,
      assignments: piano.incumbents.length,
      skills: piano.skills.length,
      kpis: piano.kpis.length,
      skillEvidence: piano.incumbents.reduce((n, i) => n + i.skillEvidence.length, 0),
      kpiEvidence: piano.incumbents.reduce((n, i) => n + i.kpiEvidence.length, 0),
    };
    const chiavi = Object.keys(totali) as Array<keyof typeof totali>;
    const alreadyThere = Object.fromEntries(
      chiavi.map((k) => [k, totali[k] - conteggi[k]]),
    ) as BuildPlanPreview["alreadyThere"];
    return {
      sourceKey: piano.sourceKey,
      label: piano.label,
      tenantId: fascicolo.tenantId,
      willCreate: {
        orgUnits: conteggi.orgUnits,
        positions: conteggi.positions,
        users: conteggi.users,
        assignments: conteggi.assignments,
        skills: conteggi.skills,
        kpis: conteggi.kpis,
        skillEvidence: conteggi.skillEvidence,
        kpiEvidence: conteggi.kpiEvidence,
      },
      alreadyThere,
    };
  },

  /**
   * #198 T6 — L'APPLICAZIONE **NON COSTRUISCE**: apre la richiesta di approvazione.
   *
   * È la stessa forma di `submitVersion`, e la ragione è la stessa di P1: costruire
   * un'azienda è un atto, e un atto ha bisogno di qualcuno che lo firmi. Chi chiama questa
   * rotta non vede nascere niente — la costruzione avviene quando l'approvazione arriva, e
   * la fa l'effetto `TENANT_BLUEPRINT_APPLICATION` dentro una transazione sola.
   */
  async applyVersion(a: ActorContext, id: string, number: number): Promise<ApplyVersionResponse> {
    const fascicolo = await esisteFascicolo(id);
    const v = await repo.findVersion(pool, id, number);
    if (!v) throw new NotFoundError("Versione di fascicolo non trovata");
    // L'ordine dei due controlli conta, da quando l'effetto scrive davvero `APPLIED`
    // (S1069): chiedendo prima lo stato, una versione già applicata risponderebbe
    // «non è approvata» — vero alla lettera e fuorviante per chi legge. Si nomina la
    // ragione più specifica per prima.
    if (v.appliedAt) {
      throw new ConflictError(
        `La versione ${v.number} è già stata applicata`,
        "BLUEPRINT_VERSION_ALREADY_APPLIED",
      );
    }
    if (v.status !== "APPROVED") {
      throw new ConflictError(
        `La versione ${v.number} è in stato ${v.status}: si applica solo ciò che è stato approvato`,
        "BLUEPRINT_VERSION_NOT_APPROVED",
      );
    }
    if (!fascicolo.tenantId) {
      throw new ConflictError(
        "Il fascicolo non è legato a un'azienda: non c'è nulla da costruire",
        "BLUEPRINT_TENANT_NOT_LINKED",
      );
    }

    const approvatori = await repo.findApprovers(pool);
    if (approvatori.length === 0) {
      throw new ConflictError(
        "Nessun utente puo' firmare la costruzione: manca chi detiene tenant_blueprint:approve",
        "BLUEPRINT_NO_APPROVER",
      );
    }
    const richiesta = await approvalService.createRequest(a, {
      title: `Costruzione azienda — fascicolo ${fascicolo.code}, versione ${v.number}`,
      body: `Applicazione della versione ${v.number}: dal fascicolo «${fascicolo.name}» alle righe dell'azienda. Ogni riga creata sarà registrata nel registro dell'origine.`,
      resourceType: TENANT_BLUEPRINT_APPLICATION,
      resourceId: v.tenantBlueprintVersionId,
      approverUserIds: approvatori.map((x) => x.userId),
      priority: "HIGH",
    });
    return {
      approvalRequestId: richiesta.approvalRequestId,
      versionId: v.tenantBlueprintVersionId,
      status: v.status,
    };
  },
};
