# Indice del wiki

> **Generato** da `docs/kb/tools/build_wiki.py`: non si edita a mano. Si rigenera con `python3 docs/kb/tools/build_wiki.py`.

Il wiki segue il modello llm-wiki: fonti grezze (codice, ADR, registri), pagine di dominio e di concetto che le sintetizzano con i rimandi, e uno schema che dice come si tengono (`docs/wiki/LEGGIMI.md`). Le pagine si controllano con `python3 docs/kb/tools/check_documenti.py`.

## Domini

| Pagina | Dominio | Sintesi | Aggiornata il |
|---|---|---|---|
| [agenti-ia](domini/agenti-ia.md) | agenti-ia | Agenti e assistente con l'abbonamento di Enzo, dentro i permessi di chi chiede | 2026-11-25 |
| [api-backend](domini/api-backend.md) | api-backend | Moduli Fastify in sette passi, catena di plugin fissa, ESS in modulo dedicato | 2026-11-25 |
| [architettura](domini/architettura.md) | architettura | Monorepo pnpm, API Fastify su PostgreSQL 16, SPA Next.js, separazione dal datastore | 2026-11-25 |
| [consolidamento-tenant](domini/consolidamento-tenant.md) | consolidamento-tenant | Allineamento e consolidamento del tenant con le corse del datastore | 2026-11-25 |
| [dati-db](domini/dati-db.md) | dati-db | Schema sys.*, migrazioni idempotenti, regole per toccare dati e oggetti condivisi | 2026-11-25 |
| [frontend-ux](domini/frontend-ux.md) | frontend-ux | SPA Next.js e portale ESS su dati vivi, design system @heuresys/ui, regole d'interfaccia di Enzo | 2026-11-25 |
| [governo](domini/governo.md) | governo | Chi decide, chi scrive dove, come si apre e si chiude una sessione | 2026-11-25 |
| [operazioni-infra](domini/operazioni-infra.md) | operazioni-infra | VM di produzione, gemello sulla Debian, CI, rilascio armato e copie ripristinabili | 2026-11-25 |
| [processi-organizzazione](domini/processi-organizzazione.md) | processi-organizzazione | Posizioni, unità, processi e attività: la partecipazione si lega alla posizione | 2026-11-25 |
| [prodotto-visione](domini/prodotto-visione.md) | prodotto-visione | Heuresys come piattaforma agentica del cambiamento organizzativo | 2026-11-25 |
| [qualita-verifica](domini/qualita-verifica.md) | qualita-verifica | Fatto vuol dire dimostrato dal vivo; cancelli in CI e controlli dei documenti | 2026-11-25 |
| [sicurezza-accessi](domini/sicurezza-accessi.md) | sicurezza-accessi | Autenticazione separata, perimetro gerarchico e modalità funzionale, maschere e mandati | 2026-11-25 |
| [stato-pianificazione](domini/stato-pianificazione.md) | stato-pianificazione | Dove si legge lo stato, il backlog, i debiti e i piani | 2026-11-25 |
| [storia-archivio](domini/storia-archivio.md) | storia-archivio | Che cosa è stato ritirato e da dove si recupera; il brownfield e il legacy come storia | 2026-11-25 |
| [tassonomie-conoscenza](domini/tassonomie-conoscenza.md) | tassonomie-conoscenza | ESCO, ISCO, NACE, ATECO, CCNL: aperte a tutte le industrie nel datastore, il tenant vede il suo perimetro | 2026-11-25 |

## Concetti e schema

| Pagina | Dominio | Sintesi | Aggiornata il |
|---|---|---|---|
| [LEGGIMI](LEGGIMI.md) | governo | Lo schema del wiki: come si scrivono, si aggiornano e si controllano le pagine | 2026-11-25 |

## Altro

- [Indice analitico](indice-analitico.md): concetto → pagine.
- [Registro delle operazioni](log.md): ingest, lint, ritiri, in sola aggiunta.
