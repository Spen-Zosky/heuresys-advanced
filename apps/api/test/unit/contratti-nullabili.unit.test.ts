/**
 * S-11 del piano interfacce (2026-11-03; analisi V6 contratti.tsv righe 3 e 4).
 *
 * Uno schema di risposta che dichiara non nullo un campo la cui colonna puo' essere nulla
 * trasforma in un 500 l'intero elenco al primo dato vuoto (il caso gia' corretto e'
 * skill-categories.familyId, D-10). Qui due colonne annullabili per costruzione:
 *  - sys_seed_candidate_records.seed_candidate_record_tenant_id, annullabile dalla 000333;
 *  - sys_gdpr_requests.gdpr_request_tenant_id, ON DELETE SET NULL nella 000186.
 */
import { describe, expect, it } from "vitest";
import { GdprRequestSchema, SeedCandidateRecordSchema } from "@heuresys/shared";

const UUID = "00000000-0000-4000-8000-000000000001";
const ISTANTE = "2026-11-03T10:00:00.000Z";

describe("S-11 — contratti che reggono una colonna vuota", () => {
  it("un candidato di una ricerca di piattaforma (tenantId null) si serializza", () => {
    const shape = SeedCandidateRecordSchema.shape;
    expect(shape.tenantId.safeParse(null).success).toBe(true);
    expect(shape.tenantId.safeParse(UUID).success).toBe(true);
  });

  it("una richiesta GDPR sopravvissuta al suo tenant (tenantId null) si serializza", () => {
    const r = GdprRequestSchema.safeParse({
      gdprRequestId: UUID,
      tenantId: null,
      subjectUserId: null,
      type: "ERASURE",
      status: "COMPLETED",
      requestedBy: null,
      report: {},
      createdAt: ISTANTE,
    });
    expect(r.success, JSON.stringify(r.error?.issues ?? [])).toBe(true);
  });
});
