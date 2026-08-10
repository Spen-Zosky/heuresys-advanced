/**
 * apps/api/src/modules/calibration-sessions/service.ts — #92 passo 3/7. READ-only.
 *
 * Tre grane, tre trattamenti (ADR-0036):
 * - SESSIONE: meta organizzativa di tenant. `summaryNotes` e' contenuto di
 *   calibrazione aggregato (misurato: 4/35) → mascherato sotto mandato
 *   piattaforma (soggetto null, vincolo 5);
 * - PARTECIPANTI: appartenenza (ACTIVITY), viaggiano con la sessione;
 * - DISCUSSIONI: giudizio su UNA persona (EVALUATION) → filtrate per soggetto
 *   sulla catena organizzativa (I18) e voti mascherati al platform (ADR-0032).
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { NotFoundError } from "../../errors/index.js";
import { masksUnderPlatformMandate, maskFields, type Masked } from "../../lib/scope/mask.js";
import { resolveOrgReadScope } from "../../lib/scope/resolver.js";
import type {
  CalibrationSession, CalibrationSessionListQuery, CalibrationDiscussion,
} from "@heuresys/shared";
import * as repo from "./repository.js";

const SESSION_AGGREGATE_FIELDS = ["summaryNotes"] as const;
const DISCUSSION_JUDGMENT_FIELDS = [
  "adjustmentReason", "calibratedPotential", "calibratedRating",
  "notes", "originalPotential", "originalRating",
] as const;

function catalogTenant(actor: ActorContext): string | undefined {
  return isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
}

function sealSession(actor: ActorContext, s: CalibrationSession): Masked<CalibrationSession> {
  return masksUnderPlatformMandate(actor, "EVALUATION", null)
    ? maskFields(s, SESSION_AGGREGATE_FIELDS)
    : s;
}

export const calibrationSessionsService = {
  async list(actor: ActorContext, query: CalibrationSessionListQuery) {
    const page = await repo.listSessions(pool, catalogTenant(actor), query);
    return { ...page, items: page.items.map((s) => sealSession(actor, s)) };
  },

  async getById(actor: ActorContext, id: string) {
    const session = await repo.findSessionById(pool, id);
    if (!session || (!isPlatform(actor) && session.tenantId !== actor.tenantId)) {
      throw new NotFoundError("CalibrationSession");
    }
    const participants = await repo.listParticipants(pool, id);
    return { session: sealSession(actor, session), participants };
  },

  /** Le discussioni della sessione, limitate ai soggetti che l'attore puo'
   *  leggere sull'asse organizzativo (I18): il mandato HR vede il tenant, il
   *  manager il suo sotto-albero, il platform tutte le righe ma coi voti
   *  mascherati (ADR-0032). */
  async listDiscussions(actor: ActorContext, sessionId: string) {
    const session = await repo.findSessionById(pool, sessionId);
    if (!session || (!isPlatform(actor) && session.tenantId !== actor.tenantId)) {
      throw new NotFoundError("CalibrationSession");
    }
    const scope = await resolveOrgReadScope(pool, actor);
    const allowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    const page = await repo.listDiscussions(pool, sessionId, allowList);
    const items: Masked<CalibrationDiscussion>[] = page.items.map((d) =>
      masksUnderPlatformMandate(actor, "EVALUATION", d.subjectUserId)
        ? maskFields(d, DISCUSSION_JUDGMENT_FIELDS)
        : d,
    );
    return { items, total: items.length };
  },
};
