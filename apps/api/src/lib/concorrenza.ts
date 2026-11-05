/**
 * apps/api/src/lib/concorrenza.ts — piano interfacce L10, voce A-10 (riga «idempotenza delle
 * scritture» della griglia V6: `ETag` e `If-Match`).
 *
 * Concorrenza ottimistica senza una colonna di versione per tabella: la versione di una risorsa
 * è l'impronta della sua rappresentazione, così come chi chiama la legge.
 *  - ogni GET 200 in JSON su /v1/* porta `ETag: "<sha256 del corpo>"`; con `If-None-Match`
 *    uguale risponde 304 senza corpo;
 *  - una PUT, PATCH o DELETE con `If-Match` procede solo se la rappresentazione attuale della
 *    stessa risorsa (GET sullo stesso percorso, con le credenziali di chi chiama) ha ancora
 *    quell'impronta; altrimenti 412 PRECONDITION_FAILED, e niente si scrive. `If-Match: *`
 *    pretende solo che la risorsa esista. Se il percorso non ha una lettura, 412
 *    PRECONDITION_UNVERIFIABLE: una condizione che non si può controllare non si dà per vera.
 *
 * Senza le intestazioni nulla cambia. Una rappresentazione che contiene un istante calcolato al
 * momento cambia impronta a ogni lettura: per quelle risorse `If-Match` fallisce sempre, ed è
 * il comportamento corretto (non c'è una versione stabile da confrontare).
 */
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { PreconditionFailedError } from "../errors/index.js";

const SCRITTURE_CONDIZIONATE = new Set(["PUT", "PATCH", "DELETE"]);
/**
 * Le intestazioni che passano alla lettura di controllo: chi chiama e la lingua. Non la
 * superficie: la lettura di controllo non è un uso della pagina, e non deve contarsi come tale.
 */
const INTESTAZIONI_DELLA_LETTURA = ["cookie", "accept-language"] as const;

export function etagDi(corpo: string): string {
  return `"${createHash("sha256").update(corpo).digest("hex")}"`;
}

function corrisponde(intestazione: string, etag: string): boolean {
  return intestazione
    .split(",")
    .map((v) => v.trim().replace(/^W\//, ""))
    .some((v) => v === "*" || v === etag);
}

async function verificaIfMatch(app: FastifyInstance, req: FastifyRequest): Promise<void> {
  const ifMatch = req.headers["if-match"];
  if (typeof ifMatch !== "string" || ifMatch.length === 0) return;
  const headers: Record<string, string> = {};
  for (const h of INTESTAZIONI_DELLA_LETTURA) {
    const v = req.headers[h];
    if (typeof v === "string") headers[h] = v;
  }
  const lettura = await app.inject({ method: "GET", url: req.url, headers });
  if (lettura.statusCode !== 200) {
    // Senza una lettura della stessa risorsa (non c'è, non ha una GET, o chi chiama non può
    // leggerla) la condizione non si può verificare: non si dà per vera.
    throw new PreconditionFailedError(
      `The current representation is not readable (${lettura.statusCode}): If-Match cannot be verified`,
      "PRECONDITION_UNVERIFIABLE",
    );
  }
  if (!corrisponde(ifMatch, etagDi(lettura.body))) {
    throw new PreconditionFailedError("The resource has changed since it was read (If-Match)", "PRECONDITION_FAILED");
  }
}

function etichetta(req: FastifyRequest, reply: FastifyReply, payload: unknown): unknown {
  if (req.method !== "GET" || reply.statusCode !== 200 || typeof payload !== "string") return payload;
  if (!(req.routeOptions?.url ?? "").startsWith("/v1/")) return payload;
  const tipo = reply.getHeader("content-type");
  if (typeof tipo !== "string" || !tipo.startsWith("application/json")) return payload;
  if (reply.getHeader("etag") !== undefined) return payload;
  const etag = etagDi(payload);
  reply.header("etag", etag);
  const ifNoneMatch = req.headers["if-none-match"];
  if (typeof ifNoneMatch === "string" && corrisponde(ifNoneMatch, etag)) {
    reply.code(304);
    return "";
  }
  return payload;
}

/**
 * Da chiamare prima di registrare le rotte (e prima di `registraIdempotenza`): la verifica di
 * `If-Match` si aggiunge in coda ai preHandler di ogni PUT, PATCH e DELETE su /v1/*, dopo il
 * CSRF e il permesso e prima della chiave di idempotenza; l'`ETag` a ogni risposta.
 */
export function registraConcorrenza(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    const metodi = Array.isArray(route.method) ? route.method : [route.method];
    if (!metodi.some((m) => SCRITTURE_CONDIZIONATE.has(m))) return;
    if (!route.url.startsWith("/v1/")) return;
    const pre = route.preHandler;
    const esistenti = pre === undefined ? [] : Array.isArray(pre) ? pre : [pre];
    route.preHandler = [
      ...esistenti,
      async function condizioneIfMatch(req: FastifyRequest) {
        await verificaIfMatch(app, req);
      },
    ];
  });
  // Sincrono, come gli altri onSend che toccano le scritture (vedi idempotenza.ts).
  app.addHook("onSend", (req, reply, payload, done) => {
    done(null, etichetta(req, reply, payload));
  });
}
