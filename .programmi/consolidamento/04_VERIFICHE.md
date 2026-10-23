# Consolidamento — verifiche e ripresa

Ogni verifica: comando o procedura, ambiente, data e ora (UTC), esito **PASS / FAIL / NON ESEGUITO**, evidenza. I problemi preesistenti stanno nella sezione «Preesistenti», separati dalle regressioni.

## Verifiche

| # | data | verifica | ambiente | comando | esito | evidenza |
|---|---|---|---|---|---|---|
| V-01 | 2026-10-23 | Revisione indipendente della Fase B (11 rilievi ricontrollati nel codice: 8 confermati, 3 parziali, 0 smentiti) | container, sola lettura | revisore Opus | PASS con correzioni | `lavoro/G_revisione_indipendente.md` |
| V-02 | 2026-10-23 | Post-condizione di 000400 sul conteggio globale delle PUBLISHED (R-50) | container, lettura del file | `sed -n 238,247p db/migrations/000400_*.sql` | confermato nel codice; prova rossa su copia NON ESEGUITA (manca un gemello: il linux-pc non esiste più) | questo registro |
| V-03 | 2026-10-23 | C1 datastore: impronta canonica unica e manifesto `heuresys.fascicolo.consegna/1` | container, node 24, senza database | `node --test tests/fascicolo_manifesto.test.ts` | PASS 8/8; rosso visto con 3 mutazioni | datastore `esecuzione/_misure/CONSOLIDAMENTO_C1_ROSSO_VISTO.txt`, commit `a6a1a5c` |
| V-04 | 2026-10-23 | C2 datastore: deposito della consegna (prima scrittura, seconda idempotente, impronta diversa 409, codice che non diventa percorso) | container, node 24, senza database | `node --test tests/fascicolo_consegna_deposito.test.ts` | PASS 4/4; rosso visto con 3 mutazioni | datastore `esecuzione/_misure/CONSOLIDAMENTO_C2_ROSSO_VISTO.txt` |
| V-05 | 2026-10-23 | C2 datastore: il verbo sul database (5 casi: 201, 200, 404, 422, 400) | VM, database delle prove | `pnpm run prove` su un worktree del ramo | NON ESEGUITO: il container non ha un database del datastore migrato; richiesta alla sessione sulla VM | — |
| V-06 | 2026-10-23 | Datastore, prove pure intere sul ramo | container, node 24 | `node --test` sulle 47 prove pure di `tests/_mappa.json` | PASS 757/761; i 2 FAIL (`macchina.test.ts`, `pdf.test.ts`) sono preesistenti, identici su `origin/main` | output del comando in questa sessione |
| V-07 | 2026-10-23 | Datastore, tipi | container | `tsc --noEmit` (radice, comprende `apps/api`) e `tsc --noEmit -p qa` | PASS; `apps/web` FAIL preesistente (`globals.css`), identico su `origin/main` | — |
| V-08 | 2026-10-23 | Datastore, sezione 21 del rito (vocabolario dei verbi contro le rotte) rifatta a mano | container | la pipeline `sed`/`awk`/`comm` della sezione 21 | PASS: 106 rotte, coincidono | — |
| V-09 | 2026-10-23 | C1 advanced: verifica della consegna (caso d'impronta condiviso, copie allineate, consegna intatta, pacchetto cambiato, manifesto fuori forma, R-54) | container, node 24, Ajv 8.20 del datastore via `NODE_PATH` (advanced non ha `node_modules` qui) | `node --test db/scripts/pacchetto/manifesto-consegna.test.mjs` | PASS 6/6; rosso visto con 4 mutazioni (chiavi non ordinate, niente convalida, niente confronto d'impronta, copia dello schema diversa) | questa riga |
| V-10 | 2026-10-23 | C13: collegamenti dalla posizione alle tre sotto-pagine; conteggi scritti a mano tolti da `/investors` (resta il solo blocco dal vivo); prova E2E nuova in `position-sub.spec.ts` | container | analisi sintattica TypeScript dei tre file | sintassi PASS; `tsc` di `apps/web` ed E2E NON ESEGUITI: in questo container advanced non ha `node_modules` e `@heuresys/ui` vive in un altro repository. Resta «in corso» finché la CI o una corsa E2E sulla VM non lo mostra con un login reale | — |
| V-11 | 2026-10-23 03:43 | CI della PR bozza #104 sul commit `c377b17` | GitHub Actions | controlli della PR | PASS: typecheck, lint, CodeQL (13 rilievi del primo giro corretti, uscite degli strumenti identiche per SHA-256), Analyze, i18n-parity, shell-tests, state-lint. In coda alle 03:43: build-web, playwright-smoke, test-integration | https://github.com/Spen-Zosky/heuresys-advanced/pull/104 |
| V-12 | 2026-10-23 03:43 | Prove sul database del datastore (V-05) e baseline della VM | sessione sulla VM | istruzioni consegnate alle 02:52 | NON ESEGUITO: la sessione sulla VM ha ricevuto le istruzioni e non ha ancora lavorato (ultima attività 01:59) | — |

## Preesistenti (non introdotti da questo programma)

Tutti i rilievi di `01_RILIEVI.md` sono preesistenti al programma. Preesistenti anche i FAIL di V-06 e V-07.

## Ripresa

- **Ramo**: `claude/project-thread-adoo53` in entrambi i repository.
- **Fatto**: Fasi A e B; approvazione del piano (vedi `00_INDICE.md`).
- **Fatto in Fase C**: C0, C1 (datastore e advanced), C2 nel codice (datastore commit `a6a1a5c`).
- **In corso**: baseline della VM e prova sul database di C2 (V-05, V-12), non ancora eseguite dalla sessione sulla VM; CI della PR #104 (build-web, E2E, integrazione in coda).
- **Bloccato**: le prove su database di advanced (C3a, C3, C4, C5, C11) chiedono una copia usa-e-getta dello schema di produzione: il gemello storico (linux-pc) non esiste più e sulla VM l'unico cluster di advanced è la produzione.
- **Prossima azione eseguibile**: vedi l'ultima riga del registro qui sopra e la tabella di `03_PIANO.md`.
