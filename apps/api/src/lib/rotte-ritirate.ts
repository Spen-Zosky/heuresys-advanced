/**
 * Le rotte RITIRATE (ondata 5 degli endpoint senza consumatori, classe c; piano
 * docs/piani/PIANO_endpoint-orfani-ondate_20261117.md, classifica della PR #280 approvata da Enzo).
 *
 * Ritirare non è cancellare (ADR-0035). La rotta resta registrata, con i suoi permessi e il suo
 * controllo CSRF: chi non poteva chiamarla riceve ancora 401/403. A chi poteva risponde 410 con il
 * motivo e, dove c'è, l'alternativa. Nessuna riga si tocca: si spegne solo il gesto.
 *
 * Le ragioni, per gruppo (più i ritiri del registro delle scoperte: team, storia delle unità, sondaggi):
 *  - una CANCELLAZIONE di un dato che ha una storia: si disattiva con lo stato o la validità
 *    (PATCH o PUT della stessa risorsa), non si toglie la riga;
 *  - la CANCELLAZIONE DI UNA PERSONA: si fa con la procedura GDPR, che lascia il registro.
 *
 * Le scritture a mano sui grafi di visualizzazione (classe c «rigenera» nella classifica) non sono
 * qui: le loro prove costruiscono i grafi proprio con quelle rotte, e il ritiro chiede prima che la
 * rigenerazione copra stili e disposizioni. È una voce a sé del piano.
 *
 * L'elenco si confronta con le rotte vere a ogni avvio dei test (`rotte-ritirate.integration.test.ts`):
 * un percorso rinominato senza aggiornare qui farebbe un ritiro che non ritira niente.
 */
import type { FastifyInstance } from "fastify";
import { GoneError } from "../errors/index.js";

export interface RottaRitirata {
  metodo: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Il percorso completo, come lo registra Fastify (con `/v1` e i segnaposto). */
  percorso: string;
  motivo: string;
  alternativa: string | null;
}

const DISATTIVA = "Una cancellazione non toglie più la riga: la risorsa si disattiva con lo stato o la validità.";

const SONDAGGIO = "Resta un solo modello di sondaggio, quello della pagina «Clima e coinvolgimento» (000497): il modello vecchio non si scrive più.";
const SONDAGGI: RottaRitirata[] = [
  { metodo: "POST", percorso: "/v1/surveys/templates", motivo: SONDAGGIO, alternativa: "GET /v1/engagement/templates" },
  { metodo: "PATCH", percorso: "/v1/surveys/templates/:id", motivo: SONDAGGIO, alternativa: "GET /v1/engagement/templates" },
  { metodo: "DELETE", percorso: "/v1/surveys/templates/:id", motivo: SONDAGGIO, alternativa: "GET /v1/engagement/templates" },
  { metodo: "POST", percorso: "/v1/surveys", motivo: SONDAGGIO, alternativa: "GET /v1/engagement/surveys" },
  { metodo: "PATCH", percorso: "/v1/surveys/:id", motivo: SONDAGGIO, alternativa: "GET /v1/engagement/surveys" },
  { metodo: "DELETE", percorso: "/v1/surveys/:id", motivo: SONDAGGIO, alternativa: "GET /v1/engagement/surveys" },
];
const SQUADRA = "Una squadra è un progetto (000363): i team non si scrivono più.";
const SQUADRE: RottaRitirata[] = [
  { metodo: "POST", percorso: "/v1/teams", motivo: SQUADRA, alternativa: "POST /v1/projects" },
  { metodo: "PATCH", percorso: "/v1/teams/:id", motivo: SQUADRA, alternativa: "PATCH /v1/projects/:id" },
  { metodo: "PUT", percorso: "/v1/teams/:id/members/:userId", motivo: SQUADRA, alternativa: "PUT /v1/projects/:id/members/:userId" },
  { metodo: "DELETE", percorso: "/v1/teams/:id/members/:userId", motivo: SQUADRA, alternativa: "DELETE /v1/projects/:id/members/:userId" },
];

const d = (percorso: string, alternativa: string | null): RottaRitirata => ({ metodo: "DELETE", percorso, motivo: DISATTIVA, alternativa });

export const ROTTE_RITIRATE: readonly RottaRitirata[] = Object.freeze([
  {
    metodo: "DELETE", percorso: "/v1/users/:id/purge",
    motivo: "La cancellazione di una persona si fa con la procedura GDPR, che lascia il registro della richiesta.",
    alternativa: "POST /v1/gdpr/users/:userId/erasure",
  },
  {
    metodo: "POST", percorso: "/v1/organization-unit-history",
    motivo: "La storia delle unità la scrive il sistema quando un'unità cambia, non una persona con valori scritti a mano.",
    alternativa: null,
  },
  ...SQUADRE,
  d("/v1/job-families/:id", "PATCH /v1/job-families/:id"),
  d("/v1/career-paths/:id", "PATCH /v1/career-paths/:id"),
  d("/v1/career-path-steps/:id", "PATCH /v1/career-path-steps/:id"),
  d("/v1/user-career-plans/:id", "PATCH /v1/user-career-plans/:id"),
  d("/v1/user-target-positions/:id", "PATCH /v1/user-target-positions/:id"),
  d("/v1/succession-pools/:id", "PATCH /v1/succession-pools/:id"),
  d("/v1/activity-classifications/:id", "PATCH /v1/activity-classifications/:id"),
  d("/v1/activity-classification-mappings/:id", null),
  d("/v1/occupation-classifications/:id", "PATCH /v1/occupation-classifications/:id"),
  d("/v1/enterprise-size-bands/:id", "PUT /v1/enterprise-size-bands"),
  d("/v1/operating-models/:id", "PUT /v1/operating-models"),
  d("/v1/enterprise-typing-profiles/:id", "PUT /v1/enterprise-typing-profiles"),
  d("/v1/blueprint-families/:id", "PATCH /v1/blueprint-families/:id"),
  d("/v1/blueprint-variants/:id", "PATCH /v1/blueprint-variants/:id"),
  d("/v1/blueprint-processes/:id", "PATCH /v1/blueprint-processes/:id"),
  d("/v1/seed-acquisition-runs/:id", "PATCH /v1/seed-acquisition-runs/:id"),
  d("/v1/mentorship/programs/:id", "PATCH /v1/mentorship/programs/:id"),
  d("/v1/mentorship/pairings/:id", "PATCH /v1/mentorship/pairings/:id"),
  d("/v1/mentorship/sessions/:id", "PATCH /v1/mentorship/sessions/:id"),
  ...SONDAGGI,
  d("/v1/engagement-feedback/action-plans/:id", "PATCH /v1/engagement-feedback/action-plans/:id"),
  d("/v1/engagement-feedback/:id", "PATCH /v1/engagement-feedback/:id"),
  d("/v1/goals/:id", "PATCH /v1/goals/:id"),
  d("/v1/okrs/:id", "PATCH /v1/okrs/:id"),
]);

const chiave = (metodo: string, percorso: string) => `${metodo.toUpperCase()} ${percorso.replace(/\/$/, "") || "/"}`;
const PER_CHIAVE = new Map(ROTTE_RITIRATE.map((r) => [chiave(r.metodo, r.percorso), r]));

/** Le rotte ritirate che questa istanza ha davvero incontrato (per la prova d'avvio). */
export const RITIRI_APPLICATI = new Set<string>();

/**
 * Da registrare PRIMA delle rotte dei moduli: `onRoute` vede ogni rotta mentre nasce e, se è
 * nell'elenco, ne sostituisce solo il gestore. I `preHandler` (autenticazione, permesso, CSRF)
 * restano com'erano.
 */
export function applicaRitiri(app: FastifyInstance): void {
  app.addHook("onRoute", (opts) => {
    const metodi = Array.isArray(opts.method) ? opts.method : [opts.method];
    for (const m of metodi) {
      const r = PER_CHIAVE.get(chiave(String(m), opts.url));
      if (!r) continue;
      RITIRI_APPLICATI.add(chiave(r.metodo, r.percorso));
      opts.handler = async () => {
        throw new GoneError(
          r.alternativa ? `Rotta ritirata: ${r.motivo} Si usa ${r.alternativa}.` : `Rotta ritirata: ${r.motivo}`,
          { alternativa: r.alternativa, motivo: r.motivo },
        );
      };
    }
  });
}
