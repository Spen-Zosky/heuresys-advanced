/**
 * apps/api/src/modules/leads/repository.ts — raw SQL over sys.sys_leads.
 */
import { pool } from "../../db/client.js";
import type { LeadResponse, LeadCompanySize, LeadListQuery } from "@heuresys/shared";

export interface InsertLeadRow {
  name: string; company: string; email: string;
  role: string | null; companySize: LeadCompanySize | null; message: string | null;
  source: string; consentVersion: string;
}

export async function insertLead(r: InsertLeadRow): Promise<void> {
  await pool.query(
    `INSERT INTO sys.sys_leads
       (lead_name, lead_company, lead_email, lead_role, lead_company_size,
        lead_message, lead_source, lead_consent_at, lead_consent_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8)`,
    [r.name, r.company, r.email, r.role, r.companySize, r.message, r.source, r.consentVersion],
  );
}

/** #62 G3 — filtered + paginated list; `total` is the FILTERED count (window fn). */
export async function listLeads(q: LeadListQuery): Promise<{ items: LeadResponse[]; total: number }> {
  const params: unknown[] = [];
  const where: string[] = ["TRUE"];
  if (q.status) {
    params.push(q.status);
    where.push(`lead_status = $${params.length}`);
  }
  if (q.source) {
    params.push(q.source);
    where.push(`lead_source = $${params.length}`);
  }
  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(
      `(lead_name ILIKE $${params.length} OR lead_company ILIKE $${params.length} OR lead_email ILIKE $${params.length})`,
    );
  }
  if (q.from) {
    params.push(q.from);
    where.push(`created_at >= $${params.length}::date`);
  }
  if (q.to) {
    params.push(q.to);
    where.push(`created_at < ($${params.length}::date + 1)`);
  }
  params.push(q.limit, q.offset);
  const res = await pool.query(
    `SELECT lead_id, lead_name, lead_company, lead_email, lead_role, lead_company_size,
            lead_message, lead_source, lead_status, lead_consent_at, lead_consent_version, created_at,
            count(*) OVER ()::int AS full_count
       FROM sys.sys_leads
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = (res.rows[0]?.full_count as number | undefined) ?? 0;
  return { total, items: res.rows.map((x: Record<string, unknown>) => ({
    leadId: x.lead_id as string,
    name: x.lead_name as string,
    company: x.lead_company as string,
    email: x.lead_email as string,
    role: (x.lead_role as string | null),
    companySize: (x.lead_company_size as LeadCompanySize | null),
    message: (x.lead_message as string | null),
    source: x.lead_source as string,
    status: x.lead_status as LeadResponse["status"],
    consentAt: (x.lead_consent_at as Date).toISOString(),
    consentVersion: x.lead_consent_version as string,
    createdAt: (x.created_at as Date).toISOString(),
  })) };
}

/**
 * Avanza lo stato di una richiesta di contatto (#4 W4). Ritorna null se l'id non esiste,
 * così il service può distinguere «non trovato» da «aggiornato».
 *
 * Solo `lead_status`: gli altri campi sono ciò che la persona ha dichiarato di sé, e il
 * consenso raccolto vale su quei valori.
 */
export async function updateLeadStatus(leadId: string, status: string): Promise<LeadResponse | null> {
  const res = await pool.query(
    `UPDATE sys.sys_leads
        SET lead_status = $2
      WHERE lead_id = $1
      RETURNING lead_id, lead_name, lead_company, lead_email, lead_role, lead_company_size,
                lead_message, lead_source, lead_status, lead_consent_at, lead_consent_version,
                created_at`,
    [leadId, status],
  );
  const x = res.rows[0] as Record<string, unknown> | undefined;
  if (!x) return null;
  return {
    leadId: x.lead_id as string,
    name: x.lead_name as string,
    company: x.lead_company as string,
    email: x.lead_email as string,
    role: x.lead_role as string | null,
    companySize: x.lead_company_size as LeadCompanySize | null,
    message: x.lead_message as string | null,
    source: x.lead_source as string,
    status: x.lead_status as LeadResponse["status"],
    consentAt: (x.lead_consent_at as Date).toISOString(),
    consentVersion: x.lead_consent_version as string,
    createdAt: (x.created_at as Date).toISOString(),
  };
}
