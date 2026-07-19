/**
 * apps/api/src/modules/whistleblowing/service.ts — #51 E/E1.
 *
 * Two audiences, kept strictly apart:
 *   - the PUBLIC reporter: submits anonymously, follows the case by tracking code;
 *   - the CUSTODIAN: the only role that can read/manage reports (isolation enforced by
 *     RBAC at the route — whistleblowing:read/manage belong to WHISTLEBLOWING_CUSTODIAN
 *     alone, mig 000181).
 *
 * The service never leaks internal fields to the public path: findStatusByCode returns a
 * public-safe projection, and the submit response is the tracking code alone.
 */
import { randomBytes } from "node:crypto";
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { NotFoundError } from "../../errors/index.js";
import type {
  WhistleblowingSubmit, WhistleblowingSubmitResponse, WhistleblowingStatusResponse,
  WhistleblowingListResponse, WhistleblowingReport, WhistleblowingUpdate,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export type { ActorContext };

/** Human-friendly, high-entropy, unguessable tracking code (e.g. WB-7QF3K9X2M1AB). */
function generateTrackingCode(): string {
  const raw = randomBytes(9).toString("base64").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12);
  return `WB-${raw}`;
}

export const whistleblowingService = {
  /**
   * PUBLIC submit. Honeypot-tripped requests are accepted but NOT stored (don't tip off
   * bots), mirroring leadsService. Anonymous by construction: no actor, no IP, and contact
   * is stored only if the reporter chose to leave one.
   */
  async submit(input: WhistleblowingSubmit): Promise<WhistleblowingSubmitResponse> {
    const trackingCode = generateTrackingCode();
    if (input.website && input.website.length > 0) {
      // honeypot trip — return a plausible code without persisting anything
      return { trackingCode };
    }
    await repo.insertReport(pool, {
      trackingCode,
      tenantId: null, // channel is tenant-agnostic; a report is not tied to the reporter's org
      category: input.category,
      subject: input.subject,
      body: input.body,
      contact: input.contact ?? null,
    });
    return { trackingCode };
  },

  /** PUBLIC status-by-code. Public-safe projection only; a bad code is a 404, no enumeration hint. */
  async statusByCode(code: string): Promise<WhistleblowingStatusResponse> {
    const status = await repo.findStatusByCode(pool, code);
    if (!status) throw new NotFoundError("Whistleblowing report", "WHISTLEBLOWING_NOT_FOUND");
    return status;
  },

  /** CUSTODIAN. Gated at the route by whistleblowing:read (custodian-only). */
  async list(_actor: ActorContext): Promise<WhistleblowingListResponse> {
    const items = await repo.listReports(pool);
    return { items, total: items.length };
  },

  /** CUSTODIAN. Gated by whistleblowing:read. */
  async getById(_actor: ActorContext, id: string): Promise<WhistleblowingReport> {
    const r = await repo.findReportById(pool, id);
    if (!r) throw new NotFoundError("Whistleblowing report", "WHISTLEBLOWING_NOT_FOUND");
    return r;
  },

  /** CUSTODIAN. Gated by whistleblowing:manage. */
  async update(_actor: ActorContext, id: string, patch: WhistleblowingUpdate): Promise<WhistleblowingReport> {
    const r = await repo.updateReport(pool, id, patch);
    if (!r) throw new NotFoundError("Whistleblowing report", "WHISTLEBLOWING_NOT_FOUND");
    return r;
  },
};
