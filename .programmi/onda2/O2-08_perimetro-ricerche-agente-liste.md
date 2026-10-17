# Mandato O2-08 — perimetro S4, parte 2: tutte le risorse, la ricerca per significato, l'agente, le liste di scelta

Modello: `claude-sonnet-5-5`. Tetto di spesa: 10 USD. Onda 2, sessione 8 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Leggi

`CLAUDE.md`, memoria, `.claude/rules/security-auth.md`, `.claude/rules/frontend-live-data.md`; ADR-0046 per intero, ADR-0040; l'esito di O2-07; `.programmi/esiti-onda0/CENSIMENTO_separazione.md` (lettori dei cataloghi); `docs/kb/agent-perimetri.json`, `docs/kb/tools/build_agent_operations.py`, `check_concetti_agente.py`; i moduli `semantic-matching`, `capability-composition`, `learning-modules`, `occupation-classifications`, `activity-classifications`, `skill-*`, `job-families`, `compensation`, `process-kpi-templates`, `organization-unit-kpi-templates`, `analytics`, `positions`, `public-stats`.

## Consegna

1. `RISORSE_DI_CATALOGO` esteso a tutte le risorse di catalogo del censimento (elenco misurato sulle rotte, scritto nell'esito con la dichiarazione scelta per ognuna); `public-stats` resta `platform` con la ragione di ADR-0046 §8; ogni `open` porta la ragione accanto.
2. Ricerca per significato e ricerca testuale: il filtro del perimetro nel `WHERE` della stessa query che ordina (§5); piano di esecuzione misurato con `EXPLAIN (ANALYZE)` sulla copia del gemello prima e dopo, nell'esito.
3. Agente (§7): `build_agent_operations.py` rifiuta operazioni su rotte di catalogo `platform` o `open`; `check_concetti_agente.py` lo mostra.
4. Liste di scelta (§6): controllo statico nuovo in `docs/kb/tools/` che diventa rosso se un componente di scelta di `apps/web` chiama una rotta dichiarata `platform` fuori dalle pagine di piattaforma.
5. `docs/kb/tools/check_perimetro_tenant.py` (§2): elenca i tenant in `TRANSITORIO` e quelli in `PERIMETRO`, in sola lettura.

## Prova di chiusura

- Prove 1, 2 e 5 di ADR-0046 per tutte le risorse: rosse prima, verdi dopo, su un tenant di prova con perimetro caricato dal test.
- Ricerca per significato: con un perimetro di prova di poche voci, i risultati sono solo del perimetro e il loro numero non dipende da quante voci ci sono fuori (mutazione: filtro a valle sui primi k, deve diventare rosso).
- Il controllo statico delle liste di scelta si vede rosso su una chiamata costruita apposta e verde sul codice vero.
- RTL Bank `TRANSITORIO`: risposte identiche prima e dopo per una persona reale, su copia.
- `pnpm test:api:vm` verde; `cd apps/web && pnpm test:e2e:prod:node22` sulle pagine che usano le liste toccate, se ne hai cambiate.

## Non fare

Nessun perimetro nei dati di RTL Bank (S5). Nessun ritiro di voci o moduli (S6).
