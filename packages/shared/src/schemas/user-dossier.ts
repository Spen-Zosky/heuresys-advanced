/**
 * packages/shared/src/schemas/user-dossier.ts
 * Il DOSSIER di una persona visto da chi ne ha titolo (#81).
 *
 * Perché esiste: il portale personale (`/v1/me/*`) racconta i 36 mesi di una
 * persona a SE STESSA, mentre chi apriva la scheda di quella persona
 * (`/users/[id]`) vedeva solo l'anagrafica tecnica — identificativi grezzi,
 * fuso orario, data di creazione. I dati c'erano tutti: mancava una via per
 * leggerli su un'altra persona. Questo schema è quella via.
 *
 * Non duplica nulla: ogni sezione riusa lo schema che il portale personale già
 * definisce, così le due viste non possono divergere.
 *
 * Autorizzazione (ADR-0027, I18/I20): sono dati SENSIBILI, quindi passano dalla
 * catena ORGANIZZATIVA — se stessi, la propria sotto-struttura organizzativa
 * transitiva, o un ruolo con mandato HR. L'appartenenza a un team NON basta.
 */
import { z } from "zod";
import {
  MeAttendanceResponseSchema,
  MeCareerTargetSchema,
  MeCertificationSchema,
  MeContractSchema,
  MeGoalSchema,
  MeLearningAssignmentSchema,
  MePaySlipSchema,
  MePerformanceReviewSchema,
  MePositionAssignmentSchema,
  MeProfileFullSchema,
  MeSkillEvidenceSchema,
} from "./me.js";

export const UserDossierParamSchema = z.object({
  userId: z.string().uuid(),
});
export type UserDossierParam = z.infer<typeof UserDossierParamSchema>;

export const UserDossierSchema = z.object({
  /** Chi è: anagrafica, organizzazione, rapporto di lavoro. */
  profile: MeProfileFullSchema,
  /** Dove sta nell'organizzazione, oggi e prima. */
  positions: z.array(MePositionAssignmentSchema),
  /** Il rapporto di lavoro nel tempo (inquadramento, tipo, decorrenze). */
  contracts: z.array(MeContractSchema),
  /** Le ultime buste paga (le più recenti per prime). */
  paySlips: z.array(MePaySlipSchema),
  /** Le valutazioni ricevute. */
  performance: z.array(MePerformanceReviewSchema),
  /** Presenze, straordinari e saldi di assenza. */
  attendance: MeAttendanceResponseSchema,
  /** Le competenze possedute, con la loro evidenza. */
  skills: z.array(MeSkillEvidenceSchema),
  /** Formazione assegnata e frequentata. */
  learning: z.array(MeLearningAssignmentSchema),
  /** Abilitazioni e certificazioni, con le scadenze. */
  certifications: z.array(MeCertificationSchema),
  /** Gli obiettivi assegnati. */
  goals: z.array(MeGoalSchema),
  /** Dove vuole arrivare: gli obiettivi di carriera. */
  careerTargets: z.array(MeCareerTargetSchema),
});
export type UserDossier = z.infer<typeof UserDossierSchema>;
