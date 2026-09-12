/**
 * apps/api/src/modules/public-job-postings/repository.ts — gli annunci che chiunque puo'
 * leggere (#54 F4, percorso prospect ADR-0026).
 *
 * IL FILTRO STA QUI, non nel chiamante: `PUBLISHED` + `PUBLIC` + non scaduto. Un annuncio
 * `INTERNAL` e' per i dipendenti, uno `EXTERNAL` per chi lo riceve dall'azienda — nessuno
 * dei due passa di qui, qualunque cosa il chiamante chieda. E si legge il NOME dell'azienda,
 * mai il suo id: un uuid di tenant su una pagina pubblica non serve a nessuno e dice
 * qualcosa sulla struttura interna.
 */
import { pool } from "../../db/client.js";
import type { PublicJobPosting } from "@heuresys/shared";

interface Row {
  posting_id: string;
  posting_code: string;
  posting_title: string;
  posting_description: string | null;
  posting_location: string | null;
  posting_published_on: string | null;
  posting_expires_on: string | null;
  company_name: string;
}

function mappa(r: Row): PublicJobPosting {
  return {
    postingId: r.posting_id,
    code: r.posting_code,
    title: r.posting_title,
    description: r.posting_description,
    location: r.posting_location,
    publishedOn: r.posting_published_on,
    expiresOn: r.posting_expires_on,
    companyName: r.company_name,
  };
}

const SELECT_BASE = `
  SELECT p.posting_id, p.posting_code, p.posting_title, p.posting_description,
         p.posting_location,
         to_char(p.posting_published_on, 'YYYY-MM-DD') AS posting_published_on,
         to_char(p.posting_expires_on, 'YYYY-MM-DD')   AS posting_expires_on,
         t.tenant_name                                  AS company_name
    FROM sys.sys_job_postings p
    JOIN sys.sys_tenancies t ON t.tenant_id = p.posting_tenant_id
   WHERE p.posting_status = 'PUBLISHED'
     AND p.posting_visibility = 'PUBLIC'
     AND (p.posting_expires_on IS NULL OR p.posting_expires_on >= CURRENT_DATE)`;

export async function list(): Promise<{ items: PublicJobPosting[]; total: number }> {
  const res = await pool.query<Row>(
    `${SELECT_BASE} ORDER BY p.posting_published_on DESC NULLS LAST, p.posting_code LIMIT 200`,
  );
  return { items: res.rows.map(mappa), total: res.rows.length };
}

export async function getById(id: string): Promise<PublicJobPosting | null> {
  const res = await pool.query<Row>(`${SELECT_BASE} AND p.posting_id = $1`, [id]);
  const r = res.rows[0];
  return r ? mappa(r) : null;
}
