/**
 * K31 del giro forense del 23/11/2026: la scheda «Storia» di /users/<id> riceveva un 500 da
 * GET /v1/user-timeline. Il registro dell'API lo dice senza ambiguità: RESPONSE_CONTRACT_VIOLATION
 * su items[2].sourceId e items[3].sourceId, «Invalid UUID».
 *
 * La colonna user_timeline_event_source_id è di tipo uuid in PostgreSQL, che accetta qualunque
 * valore di 32 cifre esadecimali; z.uuid() di Zod 4 pretende invece la versione e la variante
 * dell'RFC 9562. Le valutazioni importate hanno identificativi come
 * b2000002-0000-0000-0000-000000000002: validi per il database, rifiutati dal contratto, e la
 * persona che li ha nella storia non vedeva più niente della propria scheda.
 *
 * sourceId è un riferimento a una riga di un'altra tabella, non un identificativo che l'API genera:
 * il contratto deve accettare ciò che il database accetta.
 */
import { describe, expect, it } from "vitest";
import { UserTimelineListResponseSchema } from "@heuresys/shared";

const UUID = "00000000-0000-4000-8000-000000000001";

function evento(sourceId: string | null) {
  return {
    userTimelineEventId: UUID,
    tenantId: UUID,
    userId: UUID,
    type: "REVIEW_COMPLETED" as const,
    occurredAt: "2025-01-15T10:00:00.000Z",
    sourceTable: "performance_reviews",
    sourceId,
    summary: null,
    payload: {},
  };
}

describe("K31 — la storia regge un riferimento uuid che non segue l'RFC", () => {
  it("un sourceId importato senza versione né variante si serializza", () => {
    const r = UserTimelineListResponseSchema.safeParse({
      items: [evento("b2000002-0000-0000-0000-000000000002"), evento("b2000001-0000-0000-0000-000000000001")],
      total: 2,
    });
    expect(r.success, JSON.stringify(r.error?.issues ?? [])).toBe(true);
  });

  it("restano accettati un uuid RFC e il valore nullo, e resta rifiutato ciò che uuid non è", () => {
    const sourceId = UserTimelineListResponseSchema.shape.items.element.shape.sourceId;
    expect(sourceId.safeParse("0703eaea-cb7d-4fd5-9426-e1d8e316c4e3").success).toBe(true);
    expect(sourceId.safeParse(null).success).toBe(true);
    expect(sourceId.safeParse("TESTFIX::TL::1").success).toBe(false);
  });
});
