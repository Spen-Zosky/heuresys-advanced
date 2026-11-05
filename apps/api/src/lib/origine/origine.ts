/**
 * apps/api/src/lib/origine/origine.ts — piano interfacce L10, voce A-14.
 *
 * L'origine del dato (I23, ADR-0041) resa visibile per modulo:
 *  - ogni lettura JSON 200 su /v1/* porta `x-heuresys-data-origin` con il riassunto del modulo
 *    che risponde (nativo, importato, ibrido, misto, infrastruttura): l'agente sa da dove viene
 *    ciò che legge, senza chiederlo;
 *  - `GET /v1/meta/data-origins` dice, modulo per modulo, le tabelle, lo stato di ciascuna e se
 *    porta l'origine riga per riga (`origine_dato`, X-2): le pagine lo mostrano.
 *
 * La struttura (modulo → prefissi, tabelle) è generata dall'atlante
 * (`moduli.generated.ts`); lo stato di ogni tabella si legge dal database
 * (`sys.sys_classificazione_direzione_dato`) e si rinnova ogni dieci minuti, così una
 * riclassificazione non chiede un rilascio.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  DATA_ORIGIN_HEADER,
  DataOriginsQuerySchema,
  DataOriginsResponseSchema,
  type DataOriginModule,
  type DataOriginState,
  type DataOriginSummary,
} from "@heuresys/shared";

import { pool } from "../../db/client.js";
import { UnauthorizedError } from "../../errors/index.js";
import { MODULI_DELLE_TABELLE } from "./moduli.generated.js";

const DURATA_MS = 10 * 60 * 1000;

interface Classificazione {
  stati: ReadonlyMap<string, DataOriginState>;
  perRiga: ReadonlySet<string>;
  lettaIl: Date;
}

let corrente: Classificazione | null = null;
let inLettura: Promise<Classificazione> | null = null;

async function leggi(): Promise<Classificazione> {
  const [cl, col] = await Promise.all([
    pool.query<{ tabella: string; stato: DataOriginState }>(
      "SELECT tabella, stato FROM sys.sys_classificazione_direzione_dato",
    ),
    pool.query<{ tabella: string }>(
      `SELECT table_name AS tabella FROM information_schema.columns
        WHERE table_schema = 'sys' AND column_name = 'origine_dato'`,
    ),
  ]);
  return {
    stati: new Map(cl.rows.map((r) => [r.tabella, r.stato])),
    perRiga: new Set(col.rows.map((r) => r.tabella)),
    lettaIl: new Date(),
  };
}

/** La classificazione, letta al più ogni dieci minuti (una lettura in volo alla volta). */
export async function classificazione(): Promise<Classificazione> {
  if (corrente && Date.now() - corrente.lettaIl.getTime() < DURATA_MS) return corrente;
  inLettura ??= leggi()
    .then((c) => (corrente = c))
    .finally(() => {
      inLettura = null;
    });
  return inLettura;
}

/** Solo per le prove: la prossima richiesta rilegge il database. */
export function dimenticaClassificazione(): void {
  corrente = null;
}

export function riassunto(stati: readonly (DataOriginState | null)[]): DataOriginSummary | null {
  const noti = stati.filter((s): s is DataOriginState => s !== null);
  if (noti.length === 0) return null;
  const delCliente = new Set(noti.filter((s) => s !== "infrastruttura"));
  if (delCliente.size === 0) return "infrastruttura";
  if (delCliente.size > 1) return "misto";
  return [...delCliente][0]!;
}

/** Il modulo di un percorso /v1/*: il prefisso più lungo che lo contiene. */
export function moduloDelPercorso(percorso: string): string | null {
  const p = percorso.split("?")[0] ?? "";
  let migliore: { nome: string; lunghezza: number } | null = null;
  for (const [nome, m] of Object.entries(MODULI_DELLE_TABELLE)) {
    for (const prefisso of m.prefissi) {
      if ((p === prefisso || p.startsWith(`${prefisso}/`)) && prefisso.length > (migliore?.lunghezza ?? 0)) {
        migliore = { nome, lunghezza: prefisso.length };
      }
    }
  }
  return migliore?.nome ?? null;
}

export function descriviModulo(nome: string, c: Classificazione): DataOriginModule | null {
  const m = MODULI_DELLE_TABELLE[nome];
  if (!m) return null;
  const tables = m.tabelle.map((t) => ({ table: t, state: c.stati.get(t) ?? null, perRow: c.perRiga.has(t) }));
  return { module: nome, prefixes: [...m.prefissi], origin: riassunto(tables.map((t) => t.state)), tables };
}

function etichetta(req: FastifyRequest, reply: FastifyReply): void {
  if (req.method !== "GET" || reply.statusCode !== 200) return;
  const rotta = req.routeOptions?.url ?? "";
  if (!rotta.startsWith("/v1/")) return;
  const tipo = reply.getHeader("content-type");
  if (typeof tipo !== "string" || !tipo.startsWith("application/json")) return;
  if (!corrente) return;
  const nome = moduloDelPercorso(rotta);
  if (!nome) return;
  const origine = descriviModulo(nome, corrente)?.origin;
  if (origine) reply.header(DATA_ORIGIN_HEADER, origine);
}

/**
 * Da chiamare prima di registrare le rotte. L'onSend è sincrono (vedi idempotenza.ts): usa la
 * classificazione già letta e, se è vecchia, ne avvia la rilettura senza attenderla.
 */
export function registraOrigineDelDato(app: FastifyInstance): void {
  app.addHook("onReady", async () => {
    await classificazione().catch((err: unknown) => app.log.warn({ err }, "origine del dato: classificazione non letta"));
  });
  app.addHook("onSend", (req, reply, payload, done) => {
    etichetta(req, reply);
    if (corrente && Date.now() - corrente.lettaIl.getTime() >= DURATA_MS) {
      void classificazione().catch(() => undefined);
    }
    done(null, payload);
  });
}

/** `GET /v1/meta/data-origins`: per ogni modulo (o per quello di `path`), tabelle e stati. */
export function registraRottaDelleOrigini(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/v1/meta/data-origins",
    { schema: { querystring: DataOriginsQuerySchema, response: { 200: DataOriginsResponseSchema } } },
    async (req) => {
      if (!req.user || req.user.enrollmentOnly) throw new UnauthorizedError("Authentication required");
      const c = await classificazione();
      const nomi = req.query.path
        ? [moduloDelPercorso(req.query.path)].filter((n): n is string => n !== null)
        : Object.keys(MODULI_DELLE_TABELLE).sort();
      const modules = nomi.map((n) => descriviModulo(n, c)).filter((m): m is DataOriginModule => m !== null);
      return { classifiedAt: c.lettaIl.toISOString(), modules };
    },
  );
}
