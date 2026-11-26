/**
 * apps/api/src/modules/agent-weekly-summary/service.ts — ADR-0063 D3, piano voce F0c (E5).
 *
 * CHI VEDE CHE COSA. La piattaforma (il mandato di Enzo) vede tutti i tenant; il Direttore HR e
 * l'amministratore del tenant vedono solo il proprio (I5). Un gettone d'agente legge come la
 * persona: è un riepilogo di sola lettura, niente da proteggere dall'agente in più.
 *
 * LE OPERAZIONI SENZA CODICI (R4). Il diario dice concetto e operazione dell'atlante; il nome
 * leggibile viene dal permesso che la rotta chiede (`docs/kb/atlas/agent-operations.json`, lo
 * stesso file che il gateway usa), nelle due lingue di `sys_auth_permissions`.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentWeeklySummary } from "@heuresys/shared";
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { haMandatoPiattaforma } from "../../lib/scope/mandati.js";
import { ForbiddenError } from "../../errors/index.js";
import * as repo from "./repository.js";

/** Oltre questo numero l'elenco delle scritture si tronca, e la risposta lo dice (`writesTotal`). */
export const LIMITE_SCRITTURE = 500;

interface OperazioneAtlante { method?: string; permission?: string }

function radice(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const su = dirname(dir);
    if (su === dir) break;
    dir = su;
  }
  return process.env.HEURESYS_REPO_ROOT ?? process.cwd();
}

let catalogo: Map<string, OperazioneAtlante> | undefined;

/** concetto/operazione → metodo e permesso. Senza file: mappa vuota, le operazioni restano senza nome. */
function operazioni(): Map<string, OperazioneAtlante> {
  if (catalogo) return catalogo;
  const m = new Map<string, OperazioneAtlante>();
  try {
    const dati = JSON.parse(readFileSync(join(radice(), "docs/kb/atlas/agent-operations.json"), "utf8")) as {
      concepts?: Record<string, { operations?: Record<string, OperazioneAtlante> }>;
    };
    for (const [c, v] of Object.entries(dati.concepts ?? {})) {
      for (const [o, op] of Object.entries(v.operations ?? {})) m.set(`${c}/${o}`, op);
    }
  } catch {
    // il riepilogo si legge lo stesso, senza nomi delle operazioni
  }
  catalogo = m;
  return m;
}

export async function perimetro(actor: ActorContext): Promise<string | null> {
  if (haMandatoPiattaforma(actor)) return null;
  if (!actor.tenantId) throw new ForbiddenError("Tenant context required", "PERMISSION_DENIED");
  const code = await repo.codiceTenant(pool, actor.tenantId);
  if (!code) throw new ForbiddenError("Tenant context required", "PERMISSION_DENIED");
  return code;
}

/** Il riepilogo di una settimana per un perimetro (`null` = tutti i tenant). Usato anche dalla CLI. */
export async function riepilogo(giorno: string | null, tenantCode: string | null): Promise<AgentWeeklySummary> {
  const { start, end } = await repo.settimana(pool, giorno);
  const [tot, pers, righe] = await Promise.all([
    repo.totali(pool, start, tenantCode),
    repo.persone(pool, start, tenantCode),
    repo.scritture(pool, start, tenantCode, LIMITE_SCRITTURE),
  ]);
  const cat = operazioni();
  const permessi = new Set<string>();
  for (const r of righe) {
    const p = cat.get(`${r.concept}/${r.operation}`)?.permission;
    if (p) permessi.add(p);
  }
  const nomi = await repo.nomiPermessi(pool, [...permessi]);
  return {
    weekStart: start,
    weekEnd: end,
    totals: {
      confirmed: tot.confirmed,
      denied: tot.denied,
      autonomous: tot.autonomous,
      people: tot.people,
      conversations: tot.conversations,
    },
    people: pers.map((p) => ({
      userId: p.user_id,
      personName: p.person_name,
      tenantCode: p.tenant_code,
      tenantName: p.tenant_name,
      confirmed: p.confirmed,
      denied: p.denied,
      autonomous: p.autonomous,
      lastAt: p.last_at,
    })),
    writes: righe.map((r) => {
      const op = cat.get(`${r.concept}/${r.operation}`);
      return {
        id: r.id,
        at: r.at,
        personName: r.person_name,
        tenantName: r.tenant_name ?? r.tenant_code,
        operationLabel: (op?.permission && nomi.get(op.permission)) || null,
        method: op?.method ?? null,
        conversationId: r.conversation_id,
        outcome: r.outcome,
      };
    }),
    writesTotal: tot.total,
  };
}

export const agentWeeklySummaryService = {
  async get(actor: ActorContext, week: string | undefined): Promise<AgentWeeklySummary> {
    return riepilogo(week ?? null, await perimetro(actor));
  },
};
