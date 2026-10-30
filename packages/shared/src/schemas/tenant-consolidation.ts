/**
 * packages/shared/src/schemas/tenant-consolidation.ts
 *
 * Il consolidamento del tenant rispetto al prototipo (AC-5, `.programmi/consolidamento/agente/`).
 *
 * Un tenant che ha già i suoi dati riceve un prototipo: l'agente propone, voce per voce, se le
 * due parti parlano della stessa cosa (corrispondenza), se il prototipo offre qualcosa che il
 * tenant non ha (lacuna) o se il tenant ha qualcosa che il prototipo non conosce
 * (personalizzazione). Decide sempre una persona: il Direttore HR o un suo delegato.
 *
 * Due famiglie di forme stanno qui:
 *   · quelle delle rotte `/v1/tenant-consolidations/*` (sessione, proposta, decisione);
 *   · quelle del **giudice**, il passo del modello nel gateway (`POST /consolidation/propose`):
 *     il lotto che riceve e la risposta che deve dare. Il giudice non ha strumenti, quindi ciò
 *     che gli arriva è tutto ciò che vede: per questo la voce del lotto è un elenco CHIUSO di
 *     campi strutturali, senza alcun identificativo di persona (specifica §7).
 */

import { z } from "zod";

/** I cinque gruppi, nell'ordine fisso in cui si consolidano (specifica §9, R-6). */
export const CONSOLIDATION_GROUP_VALUES = [
  "ORGANIZATION",
  "POSITIONS_ROLES",
  "SKILLS",
  "PROCESSES",
  "INDICATORS_GOALS",
] as const;
export const ConsolidationGroupSchema = z.enum(CONSOLIDATION_GROUP_VALUES);
export type ConsolidationGroup = z.infer<typeof ConsolidationGroupSchema>;

/** Il gruppo che viene dopo, o `null` dopo l'ultimo. L'ordine è un dato, non un'abitudine. */
export function nextConsolidationGroup(g: ConsolidationGroup): ConsolidationGroup | null {
  const i = CONSOLIDATION_GROUP_VALUES.indexOf(g);
  return CONSOLIDATION_GROUP_VALUES[i + 1] ?? null;
}

export const CONSOLIDATION_TRIGGER_VALUES = ["RILASCIO", "VERSIONE_NUOVA", "RICHIESTA"] as const;
export const ConsolidationTriggerSchema = z.enum(CONSOLIDATION_TRIGGER_VALUES);
export type ConsolidationTrigger = z.infer<typeof ConsolidationTriggerSchema>;

export const CONSOLIDATION_STATUS_VALUES = ["GIRI", "IN_CONFERMA", "APPLICATA", "CHIUSA"] as const;
export const ConsolidationStatusSchema = z.enum(CONSOLIDATION_STATUS_VALUES);
export type ConsolidationStatus = z.infer<typeof ConsolidationStatusSchema>;

export const PROPOSAL_OUTCOME_VALUES = ["CORRISPONDENZA", "LACUNA", "PERSONALIZZAZIONE"] as const;
export const ProposalOutcomeSchema = z.enum(PROPOSAL_OUTCOME_VALUES);
export type ProposalOutcome = z.infer<typeof ProposalOutcomeSchema>;

/** Come è nata la proposta: chiave comune, vocabolario comune approvato, oppure significato. */
export const PROPOSAL_METHOD_VALUES = ["CHIAVE", "VOCABOLARIO", "SEMANTICA"] as const;
export const ProposalMethodSchema = z.enum(PROPOSAL_METHOD_VALUES);
export type ProposalMethod = z.infer<typeof ProposalMethodSchema>;

export const DECISION_VALUES = [
  "CONFERMATA",
  "RIFIUTATA",
  "ADOTTATA",
  "NON_ADOTTATA",
  "PERSONALIZZAZIONE",
] as const;
export const DecisionSchema = z.enum(DECISION_VALUES);
export type Decision = z.infer<typeof DecisionSchema>;

/**
 * La forma di una corrispondenza (specifica §5). `NORMALIZZATA` è la predefinita: nome e codice
 * restano del tenant, il prototipo porta ciò che manca. `NOME_PROTOTIPO` solo su richiesta.
 */
export const LINK_FORM_VALUES = ["NORMALIZZATA", "FORMA_TENANT", "NOME_PROTOTIPO"] as const;
export const LinkFormSchema = z.enum(LINK_FORM_VALUES);
export type LinkForm = z.infer<typeof LinkFormSchema>;

/** Fiducia da 0 a 100: un intero, perché un decimale finge una precisione che il modello non ha. */
export const ConfidenceSchema = z.number().int().min(0).max(100);

/* ── Il lotto del giudice ─────────────────────────────────────────────────────────────── */

/**
 * Una voce come la vede il giudice. `.strict()`: un campo in più non passa, perché un campo in
 * più è proprio il modo in cui un dato di persona finirebbe nel lotto.
 */
export const JudgeItemSchema = z
  .object({
    /** Chiave della voce nel suo lato: codice per il prototipo, identificativo per il tenant. */
    key: z.string().min(1).max(200),
    name: z.string().min(1).max(500),
    code: z.string().max(200).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    type: z.string().max(100).nullable().optional(),
    level: z.string().max(50).nullable().optional(),
    /** Il nome della voce madre già nota (es. l'unità di una posizione, il processo di un'attività). */
    parentName: z.string().max(500).nullable().optional(),
    escoUri: z.string().max(500).nullable().optional(),
    /** Per i processi: i nomi delle attività, che dicono di che cosa parla davvero il processo. */
    activities: z.array(z.string().max(500)).max(50).optional(),
  })
  .strict();
export type JudgeItem = z.infer<typeof JudgeItemSchema>;

export const JudgeQuestionSchema = z
  .object({
    tenantItem: JudgeItemSchema,
    /** I candidati del prototipo scelti dal motore; il giudice sceglie solo fra questi. */
    candidates: z.array(JudgeItemSchema).min(1).max(8),
  })
  .strict();
export type JudgeQuestion = z.infer<typeof JudgeQuestionSchema>;

export const JudgeBatchSchema = z
  .object({
    group: ConsolidationGroupSchema,
    round: z.number().int().min(1),
    questions: z.array(JudgeQuestionSchema).min(1).max(25),
  })
  .strict();
export type JudgeBatch = z.infer<typeof JudgeBatchSchema>;

/**
 * Una risposta del giudice. `prototypeKeys` vuoto = «nessun candidato parla della stessa cosa»;
 * più di una chiave = la voce del tenant copre più voci del prototipo (R-12).
 */
export const JudgeAnswerSchema = z
  .object({
    tenantKey: z.string().min(1).max(200),
    prototypeKeys: z.array(z.string().min(1).max(200)).max(8),
    confidence: ConfidenceSchema,
    reason: z.string().min(1).max(1000),
  })
  .strict();
export type JudgeAnswer = z.infer<typeof JudgeAnswerSchema>;

export const JudgeResponseSchema = z.object({ answers: z.array(JudgeAnswerSchema) }).strict();
export type JudgeResponse = z.infer<typeof JudgeResponseSchema>;

/**
 * I nomi che non devono MAI comparire in un lotto: lo stesso criterio di
 * `apps/agent-gateway/src/persone-distinte.ts` (gli identificativi di persona finiscono in
 * `UserId`). Lo schema `.strict()` lo impedisce già; questa è la seconda cintura, che guarda
 * anche dentro i testi.
 */
const NOME_DI_PERSONA = /userid/i;

export function batchCarriesPersonKeys(batch: unknown): boolean {
  const visita = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.some(visita);
    if (v && typeof v === "object") {
      return Object.entries(v as Record<string, unknown>).some(
        ([k, x]) => NOME_DI_PERSONA.test(k) || visita(x),
      );
    }
    return false;
  };
  return visita(batch);
}

/* ── Le forme delle rotte ─────────────────────────────────────────────────────────────── */

export const TenantConsolidationSchema = z.object({
  consolidationId: z.uuid(),
  tenantId: z.uuid(),
  variantVersionId: z.uuid(),
  trigger: ConsolidationTriggerSchema,
  status: ConsolidationStatusSchema,
  openGroup: ConsolidationGroupSchema.nullable(),
  startedByUserId: z.uuid().nullable(),
  startedAt: z.iso.datetime(),
});
export type TenantConsolidation = z.infer<typeof TenantConsolidationSchema>;

export const ConsolidationProposalSchema = z.object({
  proposalId: z.uuid(),
  consolidationId: z.uuid(),
  group: ConsolidationGroupSchema,
  prototypeKeys: z.array(z.string()),
  tenantKeys: z.array(z.string()),
  outcome: ProposalOutcomeSchema,
  method: ProposalMethodSchema,
  confidence: ConfidenceSchema,
  reason: z.string(),
  round: z.number().int().min(0),
  adoptedInWorkingCopy: z.boolean(),
  dependsOn: z.array(z.uuid()),
  /** L'ultima decisione valida, se c'è. */
  decision: DecisionSchema.nullable(),
});
export type ConsolidationProposal = z.infer<typeof ConsolidationProposalSchema>;

export const StartConsolidationBodySchema = z.object({
  variantVersionId: z.uuid(),
  trigger: ConsolidationTriggerSchema,
});
export type StartConsolidationBody = z.infer<typeof StartConsolidationBodySchema>;

export const DecideProposalBodySchema = z
  .object({
    decision: DecisionSchema,
    form: LinkFormSchema.optional(),
    reason: z.string().max(1000).optional(),
  })
  .strict();
export type DecideProposalBody = z.infer<typeof DecideProposalBodySchema>;

/** La conferma a gruppi degli abbinamenti certi (R-5): un gesto, più proposte. */
export const ConfirmCertainBodySchema = z.object({
  proposalIds: z.array(z.uuid()).min(1).max(500),
});
export type ConfirmCertainBody = z.infer<typeof ConfirmCertainBodySchema>;

/** L'avanzamento di un gruppo (R-8). */
export const GroupProgressSchema = z.object({
  group: ConsolidationGroupSchema,
  linked: z.number().int(),
  adopted: z.number().int(),
  rejected: z.number().int(),
  customized: z.number().int(),
  pending: z.number().int(),
});
export type GroupProgress = z.infer<typeof GroupProgressSchema>;
