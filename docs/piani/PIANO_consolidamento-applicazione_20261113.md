# PIANO — applicazione delle decisioni del consolidamento (AC-8) e modale di decisione (2026-11-13)

Richiesta di Enzo (2026-11-13): cliccando la decisione attuale di una proposta su /consolidation si apre una modale con la raccomandazione dell'agente, le scelte e Conferma. Contrordine di Enzo (2026-11-13, 02:01): decidere REGISTRA soltanto; la catena che applica ai dati RTL parte a richiesta con il pulsante «Esegui modifiche», che prende tutte le decisioni non ancora eseguite e le applica in un ciclo solo. RTL è un tenant di prova: si cambia la catena relazionale; restano fermi anagrafica e utenze.

Fuori da questo ciclo (non si chiude qui): materializzazione di una posizione adottata (richiede unità e ruolo di catalogo scelti da una persona), vocabolario comune (AC-11), ritorno al datastore (AC-14).

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| P1 | Migrazione: tabella `sys.sys_tenant_consolidation_links` (voce del tenant ↔ voce del prototipo, forma, stato ADR-0048, decisione) e giornale `staging.tenant_consolidation_undo` | Claude | applicata su copia, idempotente, riapplicata senza cambiare righe | da fare |
| P2 | `applicazione.ts`: per ogni decisione calcola lo stato voluto e scrive solo la differenza; prima ritira gli effetti della decisione sostituita | Claude | prove su copia: prima applicazione, riconferma uguale (0 righe), cambio di forma, ritorno indietro | da fare |
| P3 | `POST /:id/apply-changes` («Esegui modifiche», una transazione) e `GET /:id/pending-changes`; `decide` e `confirm-certain` registrano soltanto | Claude | prova d'integrazione 4/4 su copia | fatta |
| P4 | Modale in `/consolidation` (raccomandazione, scelte, forma, Conferma che registra) e pulsante «Esegui modifiche (N)» con il rapporto | Claude | login reale di Valentina Conti (HRMS_MANAGER) sulla pagina | da fare |
| P5 | PR, CI verde, backup verificato, rilascio, verifica dal vivo | Claude | `scripts/verifica-deploy.sh` = DEPLOYATO e P4 ripetuta in produzione | da fare |

## Che cosa cambia per decisione (dai gruppi e dalle tabelle di `sorgenti.ts`)

Tabelle del tenant per gruppo: ORGANIZATION `sys_organization_units` (nome, codice); POSITIONS_ROLES `sys_positions` (titolo, codice); SKILLS `sys_skills` (nome, codice, descrizione; solo righe del tenant, mai le globali); PROCESSES `sys_tenant_processes` (nome, codice, descrizione); INDICATORS_GOALS `sys_kpi_definitions` (nome, codice, descrizione).

| decisione | effetto sui dati | stato ADR-0048 |
|---|---|---|
| CONFERMATA, forma NORMALIZZATA | riga di collegamento; la descrizione del tenant, se vuota, prende quella del prototipo; nome e codice restano | EREDITATA |
| CONFERMATA, forma FORMA_TENANT | solo la riga di collegamento | CONSERVATA |
| CONFERMATA, forma NOME_PROTOTIPO | nome e codice del tenant prendono quelli del prototipo (guardia: se il codice è già di un'altra voce del tenant si salta e si dice) | EREDITATA |
| ADOTTATA | la voce del prototipo si crea nel tenant per competenze, processi, indicatori e unità; per le posizioni resta registrata come adottata e il rapporto dice «da materializzare» | EREDITATA |
| RIFIUTATA, NON_ADOTTATA | nessun dato; la riga di collegamento porta il rifiuto | — |
| PERSONALIZZAZIONE | nessun dato; la voce è marcata propria | PROPRIA |

Regole di scrittura: misura prima; guardia che rilegge la decisione corrente al momento di applicare; post-condizione (nessuna tabella di persone o utenze cambia, conteggi uguali); ogni valore sovrascritto va nel giornale con il valore di prima; niente cancellazioni.
