/**
 * apps/api/src/lib/scope/guardia.ts — S-10 del piano interfacce (2026-11-04).
 *
 * Ogni rotta porta un permesso (`requirePermission`), oppure e' scritta qui con la ragione per
 * cui non ne porta uno. Prima di S-10 l'elenco delle rotte senza guardia esisteva solo come
 * misura di un'analisi (V1, V2 INC-18): una rotta nuova senza permesso entrava in silenzio.
 *
 * Il collettore non ferma l'avvio: raccoglie, e la prova `rotte-senza-guardia` confronta la
 * raccolta con questo elenco nei due sensi (una rotta nuova senza ragione e' rossa, una ragione
 * che non ha piu' la sua rotta anche). Fermare l'avvio di produzione per un elenco sarebbe un
 * rischio piu' grande del difetto che cura.
 */
import type { FastifyInstance } from "fastify";
import { permissionCodesOf } from "./gate.js";

/**
 * Le rotte che non chiedono un permesso, per scelta, con la ragione. Chiave: «METODO url»,
 * con l'url come lo registra Fastify (prefisso compreso).
 */
export const ROTTE_SENZA_PERMESSO: Readonly<Record<string, string>> = {
  "DELETE /v1/auth/mfa/factors/:factorId":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "GET /healthz":
    "sonda di vita per il bilanciatore e systemd: risponde solo «ok», nessun dato",
  "GET /metrics":
    "metriche Prometheus: rispondono solo al loopback e con PROM_METRICS_ENABLED, nginx blocca /metrics dal pubblico",
  "GET /openapi.json":
    "specifica dell'API (A-9): esiste solo con API_DOCS_ENABLED, e risponde solo a chi è autenticato",
  "GET /readyz":
    "sonda di prontezza: dice solo se il database risponde",
  "GET /v1/auth/me":
    "dati della propria sessione: richiede l'autenticazione e risponde solo sull'utente che chiama",
  "GET /v1/auth/mfa/factors":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "GET /v1/auth/mfa/recovery-codes":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "GET /v1/auth/sessions/current":
    "dati della propria sessione: richiede l'autenticazione e risponde solo sull'utente che chiama",
  "GET /v1/dashboard/catalog":
    "il permesso dipende dalla famiglia del cruscotto: il servizio filtra riga per riga e nega con FORBIDDEN",
  "GET /v1/dashboard/catalog/:code":
    "il permesso dipende dal codice richiesto: lo applica il servizio, con FORBIDDEN",
  "GET /v1/dashboard/catalog/:code/data":
    "il permesso dipende dal codice richiesto: lo applica il servizio, con FORBIDDEN",
  "GET /v1/job-families":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/job-families/:id":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/me/interfaces":
    "dati della propria sessione: richiede l'autenticazione e risponde solo sull'utente che chiama",
  "GET /v1/me/permissions":
    "dati della propria sessione: richiede l'autenticazione e risponde solo sull'utente che chiama",
  "GET /v1/meta/operations":
    "scoperta delle operazioni (A-9): esiste solo con API_DOCS_ENABLED, risponde solo a chi è autenticato e dice che cosa può fare lui",
  "GET /v1/public/job-postings":
    "vetrina pubblica delle offerte di lavoro pubblicate: per scelta, con limite di frequenza",
  "GET /v1/public/job-postings/:id":
    "vetrina pubblica delle offerte di lavoro pubblicate: per scelta, con limite di frequenza",
  "GET /v1/public/platform-stats":
    "numeri aggregati della piattaforma per il sito: per scelta, con limite di frequenza",
  "GET /v1/skill-aliases":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/skill-aliases/:id":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/skill-categories":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/skill-categories/:id":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/skill-families":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/skill-families/:id":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/skill-proficiency-levels":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/skill-taxonomy-edges":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/skill-taxonomy-edges/:id":
    "catalogo di tassonomia comune (ADR-0039, catalogGate): lettura aperta a ogni utente autenticato, nessun dato di persona",
  "GET /v1/whistleblowing/status/:code":
    "il segnalante segue la pratica con il codice ricevuto: il codice e' la credenziale, 20 al minuto",
  "POST /v1/auth/agent-tokens":
    "piano interfacce L9, A-1/A-2/A-3: la persona presta a un agente al più il proprio perimetro senza mandati (ADR-0050 D6), con CSRF, sessione viva e limite di frequenza; un gettone d'agente non ne chiede un altro",
  "POST /v1/auth/login":
    "si entra senza sessione: e' la porta d'accesso, protetta dal limite di frequenza della rotta",
  "POST /v1/auth/logout":
    "chiude la propria sessione: non ha effetto senza un cookie valido",
  "POST /v1/auth/mfa/email-otp/enroll":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/email-otp/resend":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/email-otp/resend-login":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/email-otp/verify-setup":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/enroll":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/enroll-confirm":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/enroll-confirm/resend":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/recovery-codes":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/sms-otp/enroll":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/sms-otp/resend":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/sms-otp/resend-login":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/sms-otp/verify-setup":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/step-up/begin":
    "ADR-0050 D5, conferma del secondo fattore nella propria sessione: richiede l'autenticazione e il CSRF, agisce solo su chi chiama, con limite di frequenza",
  "POST /v1/auth/mfa/step-up/verify":
    "ADR-0050 D5, conferma del secondo fattore nella propria sessione: richiede l'autenticazione e il CSRF, agisce solo su chi chiama, con limite di frequenza",
  "POST /v1/auth/mfa/step-up/webauthn/verify":
    "ADR-0050 D5, conferma del secondo fattore nella propria sessione: richiede l'autenticazione e il CSRF, agisce solo su chi chiama, con limite di frequenza",
  "POST /v1/auth/mfa/verify-login":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/verify-setup":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/webauthn/authentication/options":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/webauthn/authentication/verify":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/webauthn/registration/options":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/mfa/webauthn/registration/verify":
    "secondo fattore della propria sessione: agisce solo sull'utente autenticato (o sul login in corso), con limite di frequenza",
  "POST /v1/auth/password-reset/complete":
    "completa il reset con il codice ricevuto: il codice e' la credenziale, con limite di frequenza",
  "POST /v1/auth/password-reset/request":
    "si entra senza sessione: e' la porta d'accesso, protetta dal limite di frequenza della rotta",
  "POST /v1/auth/refresh":
    "rinnovo con il cookie di refresh: il token e' la credenziale, con limite di frequenza",
  "POST /v1/leads":
    "modulo di contatto del sito: scrittura pubblica per scelta, 5 al minuto per indirizzo",
  "POST /v1/whistleblowing":
    "segnalazione anonima (d.lgs. 24/2023): deve poter arrivare senza identita', 5 al minuto",
};

/** Esistono solo con una configurazione (API_DOCS_ENABLED): non sono «ragioni orfane» se mancano. */
export const SECONDO_CONFIGURAZIONE: ReadonlySet<string> = new Set(["GET /openapi.json", "GET /v1/meta/operations"]);

export interface GuardiaStats {
  /** «METODO url» di ogni rotta registrata senza un permesso nel preHandler. */
  senzaPermesso: string[];
}

declare module "fastify" {
  interface FastifyInstance {
    guardiaStats: GuardiaStats;
  }
}

/** Da chiamare prima di registrare le rotte: onRoute vede solo quelle dichiarate dopo. */
export function registraGuardiaRotte(app: FastifyInstance): GuardiaStats {
  const stats: GuardiaStats = { senzaPermesso: [] };
  app.decorate("guardiaStats", stats);
  app.addHook("onRoute", (route) => {
    const metodi = (Array.isArray(route.method) ? route.method : [route.method]).filter(
      (m) => m !== "HEAD" && m !== "OPTIONS",
    );
    if (metodi.length === 0) return;
    // L'interfaccia di Swagger (/docs/*) esiste solo con API_DOCS_ENABLED, come /openapi.json.
    if (route.url === "/docs" || route.url.startsWith("/docs/")) return;
    if (permissionCodesOf(route).length > 0) return;
    for (const m of metodi) stats.senzaPermesso.push(`${m} ${route.url}`);
  });
  return stats;
}
