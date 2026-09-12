/**
 * @heuresys/shared — annunci di lavoro PUBBLICI (#54 F4, percorso prospect ADR-0026).
 *
 * Copre la PUBLIC `GET /v1/public/job-postings` (nessuna autenticazione, nessun CSRF,
 * rate-limit per IP). Espone SOLO ciò che un annuncio dice a chiunque: titolo, testo, sede,
 * date, e il nome dell'azienda che assume. Niente candidati, niente requisizione, niente
 * headcount, niente metadata: un annuncio pubblico è una vetrina, non un fascicolo.
 *
 * Il filtro è nel repository e non nel chiamante: `PUBLISHED` **e** `PUBLIC` **e** non
 * scaduto. Un annuncio `INTERNAL` pubblicato è per i dipendenti; uno `EXTERNAL` per chi lo
 * riceve dall'azienda; solo `PUBLIC` è per chiunque passi di qui.
 */
import { z } from "zod";

export const PublicJobPostingSchema = z.object({
  postingId: z.uuid(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  publishedOn: z.string().nullable(),
  expiresOn: z.string().nullable(),
  /** Il nome dell'azienda che assume — `sys_tenancies.tenant_name`, mai l'id. */
  companyName: z.string(),
});
export type PublicJobPosting = z.infer<typeof PublicJobPostingSchema>;

export const PublicJobPostingListResponseSchema = z.object({
  items: z.array(PublicJobPostingSchema),
  total: z.number().int().min(0),
});
export type PublicJobPostingListResponse = z.infer<typeof PublicJobPostingListResponseSchema>;

export const PublicJobPostingIdParamSchema = z.object({ id: z.uuid() });
