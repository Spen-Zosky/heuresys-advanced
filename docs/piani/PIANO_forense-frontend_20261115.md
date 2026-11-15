# Piano: controllo forense completo del frontend di advanced (15 novembre 2026)

Mandato di Enzo del 2026-11-15 alle 05:07 ora di Roma (thread «Verificare e correggere tutte le pagine di advanced»): controllo forense di tutte le pagine e di tutti gli oggetti del frontend, con specialisti per dominio, per trovare ogni errore e incoerenza visiva e di dati (numeri confrontati col database, coerenza fra viste, testi italiani chiari, regole dell'interfaccia), poi correzione, prova, unione con CI verde, rilascio con backup verificato e verifica dal vivo nel browser. Delega completa: niente domande a Enzo.

Regole dell'interfaccia di riferimento: classi C1-C15 di `docs/piani/PIANO_interfaccia-sistematica_20261111.md`, repertorio R1-R7 di `docs/kb/xtras/INTERFACCE_INTELLIGENTI.md`, `.claude/rules/design-system-ui.md`, `.claude/rules/frontend-live-data.md`.

Perimetro escluso, di altri thread: organigrammi (`organization/org-chart`, `me/org-chart`, organigramma completo), vista a nodi e pagina Rete organizzativa (`analytics/org-network`) sono del thread «Correggere navigazione e dati degli organigrammi»; ciò che si trova lì si segnala a quel thread e si scrive nel registro §3, non si corregge qui. Traduzioni, residui RTL e #254 sono del thread «Rifare l'interfaccia di advanced»: coordinamento prima di toccare gli stessi file.

Che cosa vuol dire «fatto»: ogni voce del §2 nello stato FATTO con la sua prova; il giro qa-web finale esce 0 da `stato` (coda vuota, ogni riga con verdetto) e non ha righe DIFETTO nelle classi corrette; ogni correzione unita con CI verde, rilasciata e vista dal vivo.

Che cosa non si chiude in questo ciclo: le correzioni delle pagine escluse sopra (le chiudono i loro thread).

## 1. Strumenti

| strumento | uso |
|---|---|
| `~/.claude/tools/qa-web/qa-web.mjs` con `qa-web.json` e `scripts/qa-web/adattatore.mjs` | giro su produzione, tutte le rotte, una persona per ruolo, it/en, 1440 e 390; giro in `~/heuresys-advanced-giro/20261115-0415` |
| `apps/api/scripts/chiama-come.mts <email> </v1/...>` | ciò che l'API restituisce a una persona (solo GET) |
| `apps/api/scripts/sql-sola-lettura.mts "<sql>"` | il numero rifatto dal database, in transazione READ ONLY |

## 2. Voci

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| I1 | Giro qa-web completo su produzione (8.064 unità) e giudizio di ogni riga | Claude | `stato` esce 0 | ACTIVE |
| I2 | Dati 1: analytics (tranne org-network), insights, dashboard, visualizations, kpis, okrs, gaps, compensation-intelligence, career-succession, talent-review: ogni numero confrontato col database e con le altre viste | subagent | rapporto `forense-frontend_20261115/dati-1.md` con prova per ogni numero | ACTIVE |
| I3 | Dati 2: portale personale `me/*` (tranne me/org-chart), per persone di ruoli diversi | subagent | rapporto `dati-2.md` | ACTIVE |
| I4 | Dati 3: tutte le altre pagine di prodotto (posizioni, persone, approvazioni, recruiting, learning, engagement, progetti, contenuti, tenant, modelli, processi, admin, org-director, system-health, provenance, consolidation) | subagent | rapporto `dati-3.md` | ACTIVE |
| I5 | Sorgente, rotte e contratto API: regole C1-C15 nel codice, chiamate del web contro le rotte dell'API e i permessi, voci di menu contro pagine raggiungibili, i18n, typecheck e lint | subagent | rapporto `sorgente-api.md` | ACTIVE |
| C* | Correzioni: una riga per causa radice, aggiunte dal §3 quando le indagini chiudono | Claude | PR unita con CI verde, rilascio, verifica dal vivo | — |
| R1 | Rilascio: backup verificato, armo, `verifica-deploy.sh` DEPLOYATO, prova nel browser | Claude | DEPLOYATO e schermate | — |
| V1 | Giro qa-web di verifica sulle righe corrette | Claude | righe tornate OK | — |

## 3. Registro dei rilievi

Si compila dai rapporti delle indagini; una riga per causa radice, con le righe del registro qa-web che la provano.

| id | causa radice | pagine | prova | correzione | voce |
|---|---|---|---|---|---|

## 4. Rilievi per altri thread

| a chi | rilievo | prova |
|---|---|---|

## 5. Chiusura

(binaria, scritta alla fine)
