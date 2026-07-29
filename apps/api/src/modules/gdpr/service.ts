/**
 * apps/api/src/modules/gdpr/service.ts
 * D-14 F3/F4 — GDPR tooling business logic.
 *
 * Scope model: PLATFORM_ADMIN operates cross-tenant; TENANT_ADMIN and
 * HRMS_MANAGER (the gdpr:* grantees, mig 000186) only within their own tenant
 * — the SUBJECT user must belong to the actor's tenant (I5 via service guard).
 * Self-service (ME surface) calls exportForSubject with the actor as subject.
 *
 * Erasure guards: an ACTIVE subject cannot be erased (contract basis prevails
 * while employed — deactivate first); erasure runs in ONE transaction and is
 * logged in sys_gdpr_requests (Art. 5(2) accountability), like every export
 * and retention run.
 */
import { pool, withTransaction } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../../errors/index.js";
import * as repo from "./repository.js";
import type {
  GdprDataMapResponse,
  GdprExportBundle,
  GdprErasureReport,
  GdprRetentionReport,
} from "@heuresys/shared";

interface SubjectRow {
  user_id: string;
  user_tenant_id: string | null;
  user_email: string;
  user_status: string;
}

async function findSubject(userId: string): Promise<SubjectRow | null> {
  const res = await pool.query<SubjectRow>(
    `SELECT user_id, user_tenant_id, user_email, user_status FROM sys.sys_users WHERE user_id = $1`,
    [userId],
  );
  return res.rows[0] ?? null;
}

/** Tenant guard: non-platform actors only reach subjects of their own tenant. */
function assertTenantScope(actor: ActorContext, subject: SubjectRow): void {
  if (isPlatform(actor)) return;
  if (!actor.tenantId || subject.user_tenant_id !== actor.tenantId) {
    throw new ForbiddenError("Subject is outside your tenant", "TENANT_SCOPE_VIOLATION");
  }
}

export const gdprService = {
  async dataMap(_actor: ActorContext): Promise<GdprDataMapResponse> {
    return { items: await repo.listDataMap(pool) };
  },

  /**
   * Il registro delle richieste dell'interessato, in lettura. Le richieste si
   * scrivevano e non si potevano rileggere: un registro di accountability che
   * nessuno può consultare non dimostra la conformità a nessuno.
   */
  async listRequests(
    actor: ActorContext,
    query: {
      subjectUserId?: string | undefined;
      type?: string | undefined;
      status?: string | undefined;
      limit: number;
      offset: number;
    },
  ) {
    if (!actor.tenantId) {
      throw new ForbiddenError("Tenant context required", "TENANT_ID_REQUIRED");
    }
    return repo.listGdprRequests(pool, actor.tenantId, query);
  },

  /** Art. 15/20 export — used by the admin surface AND the ME self-service
   *  surface (subjectUserId = actor.userId in that case). */
  async exportSubject(actor: ActorContext, subjectUserId: string): Promise<GdprExportBundle> {
    const subject = await findSubject(subjectUserId);
    if (!subject) throw new NotFoundError("User");
    assertTenantScope(actor, subject);

    const entries = await repo.listDataMap(pool);
    await repo.verifyDataMap(pool, entries);
    const tables = await repo.exportSubjectData(pool, entries, subjectUserId);

    const bundle: GdprExportBundle = {
      generatedAt: new Date().toISOString(),
      subject: {
        userId: subject.user_id,
        tenantId: subject.user_tenant_id,
        email: subject.user_email,
      },
      tables,
    };

    // Accountability: log counts only, never the data itself.
    const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.rowCount]));
    await repo.logGdprRequest(pool, {
      tenantId: subject.user_tenant_id,
      subjectUserId: subject.user_id,
      type: "EXPORT",
      status: "COMPLETED",
      requestedBy: actor.userId,
      report: { tables: counts },
    });
    return bundle;
  },

  /** Art. 17 erasure with legal-hold, transactional, dry-run first-class. */
  async eraseSubject(actor: ActorContext, subjectUserId: string, dryRun: boolean): Promise<GdprErasureReport> {
    const subject = await findSubject(subjectUserId);
    if (!subject) throw new NotFoundError("User");
    assertTenantScope(actor, subject);
    if (subject.user_status === "ACTIVE") {
      throw new ConflictError(
        "Subject is ACTIVE — the employment contract basis prevails; deactivate the user first",
        "SUBJECT_STILL_ACTIVE",
      );
    }
    if (subject.user_id === actor.userId) {
      throw new ConflictError("Refusing to erase the requesting actor", "SELF_ERASURE");
    }

    const entries = await repo.listDataMap(pool);
    await repo.verifyDataMap(pool, entries);

    const report = await withTransaction(async (client) => {
      // the root sys_users entry is handled apart (ANONYMIZE), everything else per strategy
      const nonRoot = entries.filter((e) => e.tableName !== "sys_users");
      const tables = await repo.eraseSubjectData(client, nonRoot, subjectUserId, dryRun);
      if (!dryRun) await repo.anonymizeRootUser(client, subjectUserId);
      const out: GdprErasureReport = {
        subjectUserId,
        dryRun,
        executedAt: new Date().toISOString(),
        tables,
        anonymizedRoot: !dryRun,
      };
      await repo.logGdprRequest(client, {
        tenantId: subject.user_tenant_id,
        subjectUserId,
        type: "ERASURE",
        status: dryRun ? "DRY_RUN" : "COMPLETED",
        requestedBy: actor.userId,
        report: {
          tables: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, { s: v.strategy, n: v.affectedRows }])),
        },
      });
      return out;
    });
    return report;
  },

  /** F4 retention sweep over every registry window (platform-wide data). */
  async runRetention(actor: ActorContext, dryRun: boolean): Promise<GdprRetentionReport> {
    // Retention deletes across ALL tenants' rows — platform-level operation.
    if (!isPlatform(actor)) {
      throw new ForbiddenError("Retention sweep is platform-level", "PLATFORM_ONLY");
    }
    const entries = await repo.listDataMap(pool);
    await repo.verifyDataMap(pool, entries);
    const tables = await withTransaction(async (client) => repo.runRetention(client, entries, dryRun));
    const report: GdprRetentionReport = {
      dryRun,
      executedAt: new Date().toISOString(),
      tables,
    };
    await repo.logGdprRequest(pool, {
      tenantId: null,
      subjectUserId: null,
      type: "RETENTION_RUN",
      status: dryRun ? "DRY_RUN" : "COMPLETED",
      requestedBy: actor.userId,
      report: { tables: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.affectedRows])) },
    });
    return report;
  },
};
