/**
 * db/scripts/seed-service-user.ts
 * RITIRATO da ADR-0050 D6 (2026-11-05): gli agenti non portano mandati.
 *
 * Prima creava un'utenza di servizio per l'Agent SDK con PLATFORM_ADMIN su tutta la
 * piattaforma ed esente dal secondo fattore (integrazione #9 WI-A.2, migrazioni 000116 e
 * 000117). Dopo ADR-0050 quella forma non può più esistere:
 *   - D2 (mig 000473): chi porta un mandato non è esentabile, e a chi è esente non si concede
 *     un mandato;
 *   - D3 (mig 000474): un'esenzione ha un autore, una persona, e scade entro 30 giorni;
 *   - D6: un agente non riceve mai un ruolo di MANDATE_ROLES. Agisce con l'identità della
 *     persona (ADR-0040), il gateway inoltra i suoi cookie e dichiara l'agente in
 *     `x-heuresys-superficie`; il suo perimetro è al più quello della persona.
 *
 * Il gateway degli agenti non usa questa utenza (apps/agent-gateway/src/server.ts costruisce
 * solo il principal "user"). Lo script resta, perché `pnpm db:seed-service-user` ha un nome
 * che qualcuno può ancora lanciare: con le variabili dell'utenza impostate si ferma e lo dice,
 * senza toccare il database. La versione precedente è nella storia di git.
 */

const email = process.env.AGENT_SERVICE_USER_EMAIL;
const password = process.env.AGENT_SERVICE_USER_PASSWORD;

if (!email && !password) {
  console.log(
    "[seed-service-user] RITIRATO (ADR-0050 D6): niente da fare. Gli agenti agiscono con l'identità " +
      "della persona (ADR-0040) e non portano mandati.",
  );
} else {
  console.error(
    "[seed-service-user] RITIRATO (ADR-0050 D6): un'utenza di servizio per gli agenti con PLATFORM_ADMIN " +
      "ed esente dal secondo fattore non si crea più. Togli AGENT_SERVICE_USER_EMAIL e " +
      "AGENT_SERVICE_USER_PASSWORD dall'ambiente: gli agenti agiscono con l'identità della persona (ADR-0040).",
  );
  process.exitCode = 1;
}
