/**
 * apps/api/src/lib/openapi/specifica.ts — piano interfacce L10, voce A-9.
 *
 * La specifica OpenAPI come prodotto: generata dai contratti Zod (jsonSchemaTransform), e
 * completata qui per OGNI operazione con ciò che un integratore o un agente cerca prima di
 * chiamare: un identificativo stabile (`operationId`), un'etichetta (il modulo), un riassunto,
 * una descrizione con il permesso richiesto, e il permesso anche come estensione leggibile da
 * una macchina (`x-heuresys-permission`). Ciò che la rotta dichiara già nel proprio schema vince.
 *
 * Nessun elenco scritto a mano: il permesso viene dal preHandler della rotta (`permissionCodesOf`),
 * la ragione delle rotte senza permesso dall'elenco di S-10 (`ROTTE_SENZA_PERMESSO`).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { FastifyRequest, RouteOptions } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { OPENAPI_PERMISSION_EXTENSION } from "@heuresys/shared";

import { COOKIES } from "../../config/constants.js";
import { UnauthorizedError } from "../../errors/index.js";
import { permissionCodesOf } from "../scope/gate.js";
import { ROTTE_SENZA_PERMESSO } from "../scope/guardia.js";

/** La versione della specifica: quella del pacchetto dell'API. */
export const VERSIONE_SPECIFICA: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

/** Il cookie che porta il token d'accesso (della persona o del gettone dell'agente). */
export const SCHEMA_DI_SICUREZZA = "cookieAuth";

function maiuscolaIniziale(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/** `team-members` → `TeamMembers`; `:id` → `ById`. */
function segmentoInCammello(seg: string): string {
  const param = seg.startsWith(":");
  const base = (param ? seg.slice(1) : seg)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(maiuscolaIniziale)
    .join("");
  return param ? `By${base}` : base;
}

/**
 * L'identificativo dell'operazione, stabile e leggibile: metodo e percorso senza `/v1`.
 * `GET /v1/employees/:id/contracts` → `getEmployeesByIdContracts`.
 */
export function operationIdDi(metodo: string, url: string): string {
  const segmenti = url.split("/").filter((s) => s.length > 0);
  const senzaVersione = segmenti[0] === "v1" ? segmenti.slice(1) : segmenti;
  const corpo = senzaVersione.map(segmentoInCammello).join("");
  return `${metodo.toLowerCase()}${corpo || "Root"}`;
}

/** L'etichetta: il modulo, cioè il primo segmento dopo `/v1` (o il primo segmento). */
export function etichettaDi(url: string): string {
  const segmenti = url.split("/").filter((s) => s.length > 0);
  const primo = segmenti[0] === "v1" ? segmenti[1] : segmenti[0];
  return primo && !primo.startsWith(":") ? primo : "meta";
}

const VERBI: Readonly<Record<string, string>> = {
  GET: "Read",
  POST: "Create or run",
  PUT: "Replace",
  PATCH: "Update",
  DELETE: "Delete",
};

/** Un riassunto quando la rotta non ne dichiara uno: verbo e oggetto, in parole. */
export function riassuntoDi(metodo: string, url: string): string {
  const segmenti = url.split("/").filter((s) => s.length > 0 && s !== "v1");
  const ultimo = segmenti.at(-1) ?? "";
  const oggetto = segmenti
    .filter((s) => !s.startsWith(":"))
    .join(" / ")
    .replace(/-/g, " ");
  const m = metodo.toUpperCase();
  if (m === "GET") {
    return ultimo.startsWith(":") ? `Read one ${oggetto}` : `List or read ${oggetto}`;
  }
  return `${VERBI[m] ?? m} ${oggetto}`.trim();
}

/** La descrizione: il permesso richiesto o, per le rotte senza permesso, la ragione scritta in S-10. */
export function descrizioneDi(metodo: string, url: string, permessi: readonly string[]): string {
  if (permessi.length > 0) {
    return `Requires the permission ${permessi.map((p) => `\`${p}\``).join(" and ")}, checked on the caller's roles (and, for an agent token, on its task scope).`;
  }
  const ragione = ROTTE_SENZA_PERMESSO[`${metodo.toUpperCase()} ${url}`];
  return ragione
    ? `No permission required. Reason (S-10): ${ragione}.`
    : "No permission required: authenticated caller only, scoped to the caller.";
}

/** Le rotte che si chiamano senza sessione: nella specifica non chiedono il cookie. */
export function rottaPubblica(url: string): boolean {
  return (
    url === "/healthz" ||
    url === "/readyz" ||
    url === "/metrics" ||
    url.startsWith("/v1/public/") ||
    url === "/v1/auth/login" ||
    url === "/v1/auth/refresh" ||
    url.startsWith("/v1/auth/password-reset/") ||
    url === "/v1/leads" ||
    url === "/v1/whistleblowing" ||
    url.startsWith("/v1/whistleblowing/status/")
  );
}

type ArgomentiDellaTrasformazione = Parameters<typeof jsonSchemaTransform>[0];

/**
 * La trasformazione della specifica: quella dei contratti Zod, più identificativo, etichetta,
 * riassunto, descrizione, sicurezza e permesso per ogni operazione.
 */
export function trasformaPerLaSpecifica(argomenti: ArgomentiDellaTrasformazione): ReturnType<typeof jsonSchemaTransform> {
  const base = jsonSchemaTransform(argomenti);
  const route: RouteOptions = argomenti.route;
  const metodo = (Array.isArray(route.method) ? route.method[0] : route.method) ?? "GET";
  const url = argomenti.url;
  const schema = { ...(base.schema as Record<string, unknown>) };
  const permessi = permissionCodesOf(route);
  if (schema.operationId === undefined) schema.operationId = operationIdDi(metodo, url);
  if (schema.tags === undefined) schema.tags = [etichettaDi(url)];
  if (schema.summary === undefined) schema.summary = riassuntoDi(metodo, url);
  if (schema.description === undefined) schema.description = descrizioneDi(metodo, url, permessi);
  if (schema.security === undefined) schema.security = rottaPubblica(url) ? [] : [{ [SCHEMA_DI_SICUREZZA]: [] }];
  schema[OPENAPI_PERMISSION_EXTENSION] = permessi.length > 0 ? permessi.join(" ") : null;
  return { ...base, schema };
}

/** L'intestazione OpenAPI della specifica. */
export function intestazioneDellaSpecifica() {
  return {
    info: {
      title: "Heuresys Advanced API",
      description:
        "The /v1/* contract of Heuresys, generated from the shared Zod contracts. Every operation " +
        "carries an operationId, a tag (its module), the permission it requires (description and " +
        `\`${OPENAPI_PERMISSION_EXTENSION}\`) and the cookie security scheme. Discovery for the ` +
        "caller: GET /v1/meta/operations. Agents authenticate with an agent token " +
        "(POST /v1/auth/agent-tokens) in the same cookie.",
      version: VERSIONE_SPECIFICA,
    },
    servers: [{ url: "/", description: "same-origin (behind the /api proxy in the web app)" }],
    components: {
      securitySchemes: {
        [SCHEMA_DI_SICUREZZA]: { type: "apiKey" as const, in: "cookie" as const, name: COOKIES.ACCESS },
      },
    },
  };
}

/** L'impronta di una specifica serializzata: è l'`ETag` di `/openapi.json`. */
export function improntaDi(testo: string): string {
  return createHash("sha256").update(testo).digest("hex");
}

/** La specifica e la scoperta stanno dietro l'autenticazione: una sessione piena o un gettone. */
export function richiediAutenticazione(req: FastifyRequest): void {
  if (!req.user || req.user.enrollmentOnly) {
    throw new UnauthorizedError("Authentication required to read the API specification");
  }
}
