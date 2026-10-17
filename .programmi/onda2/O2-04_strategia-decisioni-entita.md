# Mandato O2-04 — strategia, decisioni con i loro diritti, entità giuridiche, soglie verso le approvazioni

Modello: `claude-sonnet-5-5`. Tetto di spesa: 8 USD. Onda 2, sessione 4 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Contesto

Il disegno è nella sezione 3 di `.programmi/onda2/DISEGNO_tabelle-onda2.md` (T9-T12). Le soglie di escalation (R19) si collegano al motore delle approvazioni che esiste già (`000132`, modulo `apps/api/src/modules/approvals`). Dipende da O2-03 (le decisioni puntano ai processi del tenant).

## Leggi

`CLAUDE.md`, memoria, `.claude/rules/db-migrations.md`, `.claude/rules/api-module-pattern.md`; `DISEGNO_tabelle-onda2.md` sezioni 0 e 3; `000132_approval_runtime.sql` e il modulo `approvals` per intero prima di scrivere la parte R19; l'esito di O2-03; i glossari (`docs/kb/GLOSSARIO_dieci-oggetti_v0.3.md`, sezione «Decisione»).

## Consegna

1. Una migrazione con T9-T12, la colonna `organization_unit_legal_entity_id` su `sys_organization_units`, la colonna `approval_request_decision_id` su `sys_approval_requests`, le sentinelle `sys.v_tenant_priorities_over_five`, `sys.v_decisions_without_decider` e quelle C6, direzione `importato` (le approvazioni restano `nativo`), registrazione in `000062`; l'inversa fuori catena.
2. Nel modulo `approvals`: quando nasce una richiesta legata a una decisione con soglia superata, la richiesta va verso la posizione di escalation. Se la lettura del modulo mostra che le richieste nascono per un'altra strada e la colonna non basta, scrivi nell'esito che cosa serve e fermati su questa voce (non improvvisare un secondo motore).
3. Test di integrazione per la parte R19, rosso prima e verde dopo.

## Prova di chiusura

- Migrazione: due applicazioni, `ci-rehearsal.sh` verde, sentinelle a zero, andata e ritorno.
- Vincoli: due `DECIDE` sulla stessa decisione rifiutati; una soglia senza posizione di escalation rifiutata; sei priorità attive per un tenant di prova accendono la sentinella (la prova poi le toglie, sulla copia).
- `pnpm test:api:vm` verde sul gemello, compreso il test nuovo.

## Non fare

Nessuna rotta di scrittura su strategia, decisioni ed entità (onda 3). Nessuna scrittura sui dati contrattuali (ADR-0045).
