/**
 * apps/api/src/lib/openapi/rotte.ts — piano interfacce L10, voce A-9.
 *
 * Le due porte della specifica, entrambe dietro l'autenticazione (persona o gettone d'agente):
 *  - `GET /openapi.json`: la specifica intera, con `ETag` (l'impronta) e risposta 304 quando
 *    chi chiama ce l'ha già;
 *  - `GET /v1/meta/operations`: la scoperta, cioè le operazioni con il permesso che chiedono e se
 *    chi chiama può farle adesso, filtrabili per testo, etichetta e «solo le mie».
 * Esistono solo con la specifica accesa (API_DOCS_ENABLED): accenderla in produzione è una
 * decisione di Enzo.
 */
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  ApiOperationsQuerySchema,
  ApiOperationsResponseSchema,
  OPENAPI_PERMISSION_EXTENSION,
  type ApiOperation,
} from "@heuresys/shared";

import { userHasPermission } from "../../middleware/rbac.js";
import { improntaDi, richiediAutenticazione } from "./specifica.js";

interface OperazioneDellaSpecifica {
  operationId?: string;
  tags?: string[];
  summary?: string;
  [OPENAPI_PERMISSION_EXTENSION]?: string | null;
}

interface SpecificaServita {
  testo: string;
  impronta: string;
  versione: string;
  operazioni: Omit<ApiOperation, "allowed">[];
}

const METODI = ["get", "post", "put", "patch", "delete"] as const;

function costruisci(app: FastifyInstance): SpecificaServita {
  const spec = app.swagger() as {
    info?: { version?: string };
    paths?: Record<string, Partial<Record<string, OperazioneDellaSpecifica>>>;
  };
  const testo = JSON.stringify(spec);
  const operazioni: Omit<ApiOperation, "allowed">[] = [];
  for (const [path, voce] of Object.entries(spec.paths ?? {})) {
    for (const m of METODI) {
      const op = voce[m];
      if (!op) continue;
      operazioni.push({
        operationId: op.operationId ?? `${m} ${path}`,
        method: m.toUpperCase(),
        path,
        tag: op.tags?.[0] ?? "meta",
        summary: op.summary ?? "",
        permission: op[OPENAPI_PERMISSION_EXTENSION] ?? null,
      });
    }
  }
  operazioni.sort((a, b) => a.operationId.localeCompare(b.operationId));
  return { testo, impronta: improntaDi(testo), versione: spec.info?.version ?? "0.0.0", operazioni };
}

/** Da chiamare dopo la registrazione di @fastify/swagger. La specifica si calcola alla prima richiesta. */
export function registraRotteDellaSpecifica(app: FastifyInstance): void {
  let servita: SpecificaServita | null = null;
  const leggi = (): SpecificaServita => (servita ??= costruisci(app));
  const z = app.withTypeProvider<ZodTypeProvider>();

  // hide: le porte della specifica non fanno parte della specifica che servono.
  z.get("/openapi.json", { schema: { hide: true } }, async (req, reply) => {
    richiediAutenticazione(req);
    const s = leggi();
    const etag = `"${s.impronta}"`;
    reply.header("etag", etag).header("cache-control", "private, no-cache");
    if (req.headers["if-none-match"] === etag) return reply.code(304).send();
    return reply.type("application/json; charset=utf-8").send(s.testo);
  });

  z.get(
    "/v1/meta/operations",
    { schema: { querystring: ApiOperationsQuerySchema, response: { 200: ApiOperationsResponseSchema } } },
    async (req) => {
      richiediAutenticazione(req);
      const utente = req.user!;
      const s = leggi();
      const q = req.query.q?.toLowerCase();
      const tutte = s.operazioni.map((op) => ({
        ...op,
        allowed: op.permission === null || op.permission.split(" ").every((p) => userHasPermission(utente, p)),
      }));
      const operations = tutte.filter(
        (op) =>
          (!req.query.tag || op.tag === req.query.tag) &&
          (req.query.allowedOnly !== "true" || op.allowed) &&
          (!q ||
            op.operationId.toLowerCase().includes(q) ||
            op.path.toLowerCase().includes(q) ||
            op.summary.toLowerCase().includes(q) ||
            (op.permission ?? "").toLowerCase().includes(q)),
      );
      return { version: s.versione, specHash: s.impronta, total: operations.length, operations };
    },
  );
}
