/**
 * packages/shared/src/schemas/job-offers.ts
 * Schemi per /v1/job-offers/* (sys.sys_job_offers).
 *
 * #54 F3, settima e ultima fetta — l'offerta, cioè l'entità che la prima versione del
 * legacy non aveva e che la seconda ha dovuto aggiungere: è il segno che serve davvero.
 *
 * ⚠ QUI C'È UNA RETRIBUZIONE, e va detto per esteso perché è l'unico punto del ciclo in cui
 * accade. `offerGrossAnnualSalary` è `COMPENSATION` per natura, ma il soggetto **non è un
 * dipendente**: è un candidato esterno, che non ha una posizione, non sta in una catena
 * organizzativa e non è nemmeno un utente. Le regole di mascheramento di ADR-0036 sono
 * scritte per persone dentro l'organizzazione, e **non si ereditano qui per analogia** — è
 * quanto la migrazione `000364` aveva lasciato scritto da decidere in F3. La decisione, con
 * la sua ragione, è nel service.
 *
 * Tre vincoli del database che questo contratto rispecchia:
 *   · la retribuzione, se dichiarata, è **positiva** — `sys_job_offers_salary_check`;
 *   · una risposta non può precedere l'invio — `sys_job_offers_dates_check`;
 *   · `ACCEPTED` e `DECLINED` pretendono che l'offerta sia **stata mandata** —
 *     `sys_job_offers_flow_check`. Una risposta a un'offerta mai spedita è una
 *     contraddizione, non un caso limite.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

/** Gli stessi sei di `sys_job_offers_status_check`. */
export const JOB_OFFER_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "WITHDRAWN",
] as const;
export const JobOfferStatusSchema = z.enum(JOB_OFFER_STATUSES);
export type JobOfferStatus = z.infer<typeof JobOfferStatusSchema>;

export const JobOfferSchema = z.object({
  offerId: z.uuid(),
  tenantId: z.uuid(),
  applicationId: z.uuid(),
  status: JobOfferStatusSchema,
  /**
   * ⚠ **Opzionale perché mascherabile**, non perché possa mancare: quando l'attore ha il
   * solo mandato tecnico il campo viene **rimosso** e il suo nome compare in `masked`.
   * Assenza, non `null` e non `0` — un importo sostituito è una bugia, perché il chiamante
   * non distinguerebbe «non ti è consentito vederlo» da «non c'è». È la quarta modalità di
   * ADR-0036, e il meccanismo è quello di `lib/scope/mask.ts`, riusato e non riscritto.
   */
  grossAnnualSalary: z.number().nullable().optional(),
  contractType: z.string().nullable(),
  startDate: z.string().nullable(),
  sentOn: z.string().nullable(),
  respondedOn: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** I campi tolti dalla maschera, dichiarati per nome (ADR-0036, quarta modalità). */
  masked: z.array(z.string()).optional(),
});
export type JobOffer = z.infer<typeof JobOfferSchema>;

export const JobOfferListQuerySchema = z.object({
  applicationId: z.uuid().optional(),
  status: JobOfferStatusSchema.optional(),
  ...paginationFields(200, 50),
});
export type JobOfferListQuery = z.infer<typeof JobOfferListQuerySchema>;

export const JobOfferListResponseSchema = z.object({
  items: z.array(JobOfferSchema),
  total: z.number().int().min(0),
});
export type JobOfferListResponse = z.infer<typeof JobOfferListResponseSchema>;

export const JobOfferIdParamSchema = z.object({ id: z.uuid() });

/**
 * POST /v1/job-offers — si prepara un'offerta su una candidatura (`job-requisition:manage`).
 *
 * Nasce `DRAFT`, e non è un dettaglio: un'offerta esiste come bozza prima di essere mandata,
 * e la data di invio è ciò che la fa diventare reale. Accettare uno stato in creazione
 * permetterebbe di registrare come «accettata» un'offerta che nessuno ha mai spedito — che è
 * proprio la contraddizione che il `flow_check` del database esiste per impedire.
 */
export const JobOfferCreateBodySchema = z.object({
  applicationId: z.uuid(),
  grossAnnualSalary: z.number().positive().nullable().optional(),
  contractType: z.string().max(32).nullable().optional(),
  startDate: z.iso.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tenantId: z.uuid().optional(),
});
export type JobOfferCreateBody = z.infer<typeof JobOfferCreateBodySchema>;

/**
 * PATCH /v1/job-offers/:id — il ciclo di vita dell'offerta (`job-requisition:manage`).
 *
 * ⚠ `applicationId` NON è modificabile: un'offerta è fatta a una persona per un posto, e
 * spostarla su un'altra candidatura significherebbe attribuire a qualcuno una proposta
 * economica che non ha mai ricevuto.
 *
 * ⚠ Le transizioni di stato NON sono qui: questo schema guarda il corpo e non sa da dove
 * l'offerta stia arrivando. `SENT` senza data di invio, o una risposta a un'offerta mai
 * spedita, li decide il service — che legge la riga. È la lezione della quarta fetta, dove
 * un `refine` messo dove non aveva i dati per giudicare respingeva un caso legittimo.
 */
export const JobOfferUpdateBodySchema = z
  .object({
    status: JobOfferStatusSchema.optional(),
    grossAnnualSalary: z.number().positive().nullable().optional(),
    contractType: z.string().max(32).nullable().optional(),
    startDate: z.iso.date().nullable().optional(),
    sentOn: z.iso.date().nullable().optional(),
    respondedOn: z.iso.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { error: "Almeno un campo dev'essere fornito" });
export type JobOfferUpdateBody = z.infer<typeof JobOfferUpdateBodySchema>;
