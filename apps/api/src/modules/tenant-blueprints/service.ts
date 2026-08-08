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
import { ConflictError, NotFoundError, ValidationError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import * as repo from "./repository.js";
import { proposeModel, isPublishedVariantVersion } from "./derivation.js";
import { diffVersions, diffAgainstModelLatest } from "./diff.js";
import { approvalService } from "../approvals/service.js";
import { TENANT_BLUEPRINT_APPROVAL } from "../approvals/effects/tenant-blueprint-approval.js";
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
} from "@heuresys/shared";

/** Violazione di un indice unico. */
const isUniqueViolation = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";

/** Solo una bozza si modifica. Approvata, applicata o superata: si apre una versione nuova. */
const MODIFICABILI = ["DRAFT"] as const;

/**
 * I campi senza i quali un fascicolo non e' sottoponibile alla firma. Non sono
 * tutti i campi dell'identita': i ricavi e il numero di dipendenti descrivono
 * l'azienda ma non entrano in nessuna derivazione, e pretenderli bloccherebbe
 * la firma per un dato che non cambia il risultato.
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

  async linkTenant(a: ActorContext, id: string, tenantId: string): Promise<TenantBlueprint> {
    await esisteFascicolo(id);
    try {
      const b = await repo.linkTenant(pool, id, tenantId, a.userId);
      if (!b) throw new NotFoundError("Fascicolo non trovato");
      return b;
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictError(
          "L'azienda indicata ha gia' un fascicolo attivo",
          "BLUEPRINT_TENANT_ALREADY_LINKED",
        );
      }
      throw e;
    }
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
};
