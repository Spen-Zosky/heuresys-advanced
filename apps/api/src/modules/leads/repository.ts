/**
 * apps/api/src/modules/leads/repository.ts — raw SQL over sys.sys_leads.
 */
import { pool } from "../../db/client.js";
import type { LeadResponse, LeadCompanySize } from "@heuresys/shared";

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

export async function listLeads(): Promise<LeadResponse[]> {
  const res = await pool.query(
    `SELECT lead_id, lead_name, lead_company, lead_email, lead_role, lead_company_size,
            lead_message, lead_source, lead_status, lead_consent_at, lead_consent_version, created_at
       FROM sys.sys_leads ORDER BY created_at DESC`,
  );
  return res.rows.map((x: Record<string, unknown>) => ({
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
  }));
}
