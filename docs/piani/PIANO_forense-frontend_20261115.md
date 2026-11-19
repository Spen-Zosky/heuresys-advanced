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
| I2 | Dati 1: analytics (tranne org-network), insights, dashboard, visualizations, kpis, okrs, gaps, compensation-intelligence, career-succession, talent-review: ogni numero confrontato col database e con le altre viste | subagent | rapporto `forense-frontend_20261115/dati-1.md` con prova per ogni numero | FATTO (dati-1.md, 21 rilievi) |
| I3 | Dati 2: portale personale `me/*` (tranne me/org-chart), per persone di ruoli diversi | subagent | rapporto `dati-2.md` | FATTO (dati-2.md, 26 rilievi) |
| I4 | Dati 3: tutte le altre pagine di prodotto (posizioni, persone, approvazioni, recruiting, learning, engagement, progetti, contenuti, tenant, modelli, processi, admin, org-director, system-health, provenance, consolidation) | subagent | rapporto `dati-3.md` | FATTO (dati-3.md, 24 rilievi; dettagli NON VERIFICATI per 429, si rifanno nel giro qa-web) |
| I5 | Sorgente, rotte e contratto API: regole C1-C15 nel codice, chiamate del web contro le rotte dell'API e i permessi, voci di menu contro pagine raggiungibili, i18n, typecheck e lint | subagent | rapporto `sorgente-api.md` | FATTO (sorgente-api.md, 14 rilievi) |
| C1 | Prima ondata: S-01, S-02, S-03, S-04, S-05, S-08, D3-04, D3-05, D3-06, D3-06b, D3-07, D3-08, sessione per persona nell'adattatore qa-web | Claude | PR #262 unita con CI verde | FATTO (#262 unita f1e1bee3, DEPLOYATA su 921df8d2) |
| C2 | Portale personale: rilievi D2-01..D2-26 di `dati-2.md` | subagent, ramo `claude/forense-portale` | PR unita con CI verde, tabella rilievo→esito | FATTO (riunita in #262, DEPLOYATA; esiti in esiti-correzioni.md) |
| C3 | Cruscotti e analisi: rilievi D1..D21 di `dati-1.md` | subagent, ramo `claude/forense-cruscotti` | PR unita con CI verde, tabella rilievo→esito | FATTO (riunita in #262, DEPLOYATA; esiti in esiti-correzioni.md) |
| C4 | Amministrazione e sorgente: D3-02, 09, 12-17, 20, 21, 23 di `dati-3.md`; S-06, S-07, S-09, S-10, S-11 di `sorgente-api.md` | subagent, ramo `claude/forense-amministrazione` | PR unita con CI verde, tabella rilievo→esito | FATTO (riunita in #262, DEPLOYATA; esiti in esiti-correzioni.md) |
| C5 | Rilievi della forma «dato sbagliato da cancellare» (residui di prova, utenze di collaudo, richieste ferme): elenco e comandi proposti | Claude | elenco nel §3 con il comando | FATTO (esiti-correzioni.md, sezione «Dati da decidere con Enzo») |
| R1 | Rilascio: backup verificato, armo, `verifica-deploy.sh` DEPLOYATO, prova nel browser | Claude | DEPLOYATO e schermate | FATTO (#262 su 921df8d2, #273 su c6eda765, #277 su 44ac94c9: verifica-deploy DEPLOYATO, schermate in heuresys-advanced-giro/verifica-262 e verifica-277) |
| C6 | Ferie del quadro senza la malattia (verifica dal vivo del 16/11) | Claude | PR unita, DEPLOYATA | FATTO (#273) |
| C7 | Difetti del giudizio delle firme parziali del giro post-#262 (web e API, migrazione 000496) | subagent web + subagent API, ramo `claude/forense-giudizio` | PR unita, DEPLOYATA, verifica dal vivo | FATTO (#277, DEPLOYATA su 44ac94c9; 568 eccezioni riscritte, giornale 1136 righe) |
| C8 | Tempo relativo in italiano nelle pagine inglesi (verifica dal vivo dopo la #277) | Claude | PR unita, DEPLOYATA | ACTIVE (riunita nella PR del giudizio del 18/11) |
| C9 | Difetti del giudizio completo del giro (220.377 verifiche, 4.071 firme nuove giudicate da 10 giudici): testi, tabelle, clic e schermate | subagent, rami `claude/forense-giudizio-2`, `-3`, `-unico` | PR unita, DEPLOYATA, verifica dal vivo | ACTIVE (PR aperta) |
| V1 | Giro qa-web di verifica sulle righe corrette | Claude | righe tornate OK | — |

## 3. Registro dei rilievi

Si compila dai rapporti delle indagini; una riga per causa radice, con le righe del registro qa-web che la provano.

| id | causa radice | pagine | prova | correzione | voce |
|---|---|---|---|---|---|

## 4. Rilievi per altri thread

| a chi | rilievo | prova |
|---|---|---|
| thread organigrammi (inviato 15/11 tramite il coordinatore) | responsabile dal titolare della posizione superiore, non dal proprietario; squadre ≠ albero; 158 persone e non 167; org-network conta posizioni non attive, «(unassigned)», «Span of control»; Direzione Generale assente da org-health; tre versioni dell'organigramma in visualizations | `dati-1.md` §3, `dati-2.md` §3, `dati-3.md` §3 |

Nota sull'esecuzione (15/11): il primo giro qa-web (`20261115-0415`) è stato fermato dopo 448 unità perché il login per unità superava il limite di 10 accessi ogni 5 minuti e 13 persone su 18 finivano «fatte» senza essere entrate (429). L'adattatore ora riusa una sessione per persona; il giro valido è `20261115-0520`.

## 5. Chiusura

(binaria, scritta alla fine)
