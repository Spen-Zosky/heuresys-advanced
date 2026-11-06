/**
 * apps/api/src/middleware/auth.ts
 * Decorates `req.user` from a valid JWT access cookie. Does NOT enforce
 * presence — public routes (login, healthz, readyz) still work. Per-route
 * enforcement is done by the RBAC middleware (requirePermission).
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { COOKIES } from "../config/constants.js";
import { ForbiddenError, UnauthorizedError } from "../errors/index.js";
import type { RoleCode } from "../config/constants.js";
import { pool } from "../db/client.js";

/**
 * Piano interfacce L9, A-1/A-2/A-3 (ADR-0050 D6): chi chiama è un AGENTE che agisce per conto
 * della persona del token (`sub`). Lo porta solo il gettone emesso da
 * `POST /v1/auth/agent-tokens` (claim `agt`, e `scp` quando il compito restringe i permessi).
 */
export interface AgenteDelGettone {
  /** Il codice dell'agente (come in `x-heuresys-superficie: agente:<codice>`). */
  codice: string;
  /** Il compito dichiarato da chi ha emesso il gettone. */
  compito: string;
  /** A-2: i soli permessi del compito; null = tutti quelli dei ruoli del gettone. */
  permessi: ReadonlySet<string> | null;
}

export interface AuthUser {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
  jti?: string;
  /** Refresh-token family of THIS session (access JWT `fam` claim). Lets self-service
   *  session management flag the current device without the refresh cookie (which is
   *  path-scoped to /v1/auth and not sent to /api/* through the web proxy). */
  familyId?: string;
  /** Mandatory-MFA enrollment-only session (access JWT `enr` claim, MVP-4 par. 2.5 #4).
   *  Such sessions carry roles [] so every requirePermission() denies them; the only
   *  usable surface is the MFA self-service enrollment under /v1/auth/mfa. */
  enrollmentOnly?: boolean;
  /** ADR-0050 D5: ultima verifica del secondo fattore della sessione (claim `sua`, secondi epoch). */
  stepUpAt?: number;
  /** A-1: presente solo se chi chiama è un agente per conto di `userId` (claim `agt`). */
  agente?: AgenteDelGettone;
}

declare module "fastify" {
  interface FastifyRequest {
    tenantId?: string;
    /** Mandato K, R-0 (D9=B). Popolato da tenantContext.ts SOLO per un ruolo di piattaforma
     *  assegnato (`PLATFORM_ASSIGNED_MANDATE_ROLES`, oggi vuoto): l'elenco dei clienti attivi
     *  in sys_platform_user_tenant_assignments. Assente per chiunque altro. */
    assignedTenantIds?: readonly string[];
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      tenant_id: string | null;
      roles: RoleCode[];
      jti?: string;
      fam?: string;
      enr?: boolean;
      sua?: number;
      /** A-1: gettone d'agente — codice e compito. */
      agt?: { cod: string; cmp: string };
      /** A-2: permessi del compito. */
      scp?: string[];
      iat?: number;
      exp?: number;
      iss?: string;
      aud?: string;
    };
    // Typed as nullable: our auth hook is non-enforcing, so req.user remains
    // undefined for public routes and for requests with no/invalid token.
    // RBAC middleware re-checks via `if (!req.user)`.
    user: AuthUser | null;
  }
}

/**
 * Positive allowlist for enrollment-only sessions (mandatory-MFA #4, review
 * fix S981): an `enr` session may ONLY reach the MFA self-service surface,
 * /login (the post-enroll re-login re-submits the password with the enr
 * cookie still set), /logout, and the health probes. Everything else gets a
 * 401 MFA_ENROLLMENT_ONLY — containment no longer rests on roles:[] alone,
 * and a gated user who deep-links into the SPA bounces back to /login via
 * the existing 401 handling instead of landing in a dead authenticated shell.
 */
const ENR_ALLOW_PREFIXES = [
  "/v1/auth/mfa/",
  "/v1/auth/login",
  "/v1/auth/logout",
  "/healthz",
  "/readyz",
];

/**
 * A-3: un gettone d'agente non tocca l'autenticazione. Non rinnova (non c'è niente da rinnovare:
 * scaduto, si ripassa dalla persona), non conferma il secondo fattore, non chiede un altro gettone,
 * non chiude la sessione della persona. Legge solo chi è (`GET /v1/auth/me`).
 */
function agenteSuAutenticazione(method: string, url: string): boolean {
  if (!url.startsWith("/v1/auth/") && url !== "/v1/auth") return false;
  const percorso = url.split("?", 1)[0];
  return !(method === "GET" && percorso === "/v1/auth/me");
}

/**
 * Il gettone vive al più quanto la sessione della persona da cui nasce: chiusa la sessione
 * (uscita, revoca, cambio di parola d'ordine), il gettone smette di valere subito, non alla
 * sua scadenza. Solo per i gettoni d'agente: le sessioni delle persone restano senza database.
 */
async function sessioneDellaPersonaViva(familyId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM sys.sys_auth_refresh_tokens
      WHERE auth_refresh_token_family_id = $1
        AND auth_refresh_token_user_id = $2
        AND auth_refresh_token_revoked_at IS NULL
        AND auth_refresh_token_expires_at > now()
      LIMIT 1`,
    [familyId, userId],
  );
  return (rowCount ?? 0) > 0;
}

const plugin: FastifyPluginAsync = async (app) => {
  // Try to decode the JWT from the access cookie on every request. Failure
  // is non-fatal here — req.user remains undefined and downstream RBAC will
  // reject if the route requires auth.
  app.addHook("onRequest", async (req: FastifyRequest) => {
    const token = req.cookies[COOKIES.ACCESS];
    if (!token) return;
    try {
      const payload = await app.jwt.verify<{
        sub: string;
        tenant_id: string | null;
        roles: RoleCode[];
        jti?: string;
        fam?: string;
        enr?: boolean;
        sua?: number;
        agt?: { cod: string; cmp: string };
        scp?: string[];
      }>(token);
      const agt = payload.agt;
      if (agt) {
        // Un gettone d'agente senza la sessione della persona viva non vale: niente utente.
        if (
          typeof agt.cod !== "string" ||
          typeof agt.cmp !== "string" ||
          !payload.fam ||
          !(await sessioneDellaPersonaViva(payload.fam, payload.sub))
        ) {
          return;
        }
      }
      req.user = {
        userId: payload.sub,
        tenantId: payload.tenant_id,
        roles: payload.roles ?? [],
        jti: payload.jti,
        familyId: payload.fam,
        enrollmentOnly: payload.enr === true,
        ...(typeof payload.sua === "number" ? { stepUpAt: payload.sua } : {}),
        ...(agt
          ? {
              agente: {
                codice: agt.cod,
                compito: agt.cmp,
                permessi: Array.isArray(payload.scp) ? new Set(payload.scp) : null,
              },
            }
          : {}),
      };
    } catch (err) {
      // Token invalid / expired — leave req.user undefined; RBAC handles 401.
      req.log.debug({ err }, "JWT verify failed");
    }
    // OUTSIDE the try/catch (the catch above swallows verify failures and must
    // never swallow this): A-3, l'agente resta fuori dall'autenticazione.
    if (req.user?.agente && agenteSuAutenticazione(req.method, req.url)) {
      throw new ForbiddenError(
        "An agent token cannot use the authentication surface: the person acts there",
        "AGENT_FORBIDDEN_AUTH",
      );
    }
    // Same: enforce the enrollment-only allowlist.
    if (req.user?.enrollmentOnly && !ENR_ALLOW_PREFIXES.some((p) => req.url.startsWith(p))) {
      throw new UnauthorizedError(
        "MFA enrollment required before this session can be used",
        "MFA_ENROLLMENT_ONLY",
      );
    }
  });
};

export const authPlugin = fp(plugin, { name: "auth", dependencies: ["@fastify/jwt", "@fastify/cookie"] });
