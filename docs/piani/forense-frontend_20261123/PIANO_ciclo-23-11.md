# Piano: ciclo forense del frontend, giro del 23 novembre 2026

Mandato di Enzo del 2026-11-15 (invariato): controllo forense completo di tutte le pagine e di tutti gli oggetti del frontend in produzione, per ogni ruolo e persona di prova, poi correzione, prova e rilascio. Questo ciclo riprende il piano `docs/piani/PIANO_forense-frontend_20261115.md` dal giro v1 del 20/11, rimasto con 4.973 unità in coda.

Che cosa non si chiude in questo ciclo: le classi X1, X2 e X3 di `classi-difetti.md` (organigrammi, rete organizzativa, traduzione del dato), che sono di altri thread; le classi di dato (K08, K11, K24), che richiedono una decisione di Enzo prima di toccare i dati.

Strumenti: `~/.claude/tools/qa-web/qa-web.mjs` con `scripts/qa-web/adattatore.mjs`; `scripts/qa-web/dividi-giro.py` (un giro diviso per persona, per lavorare in parallelo); `scripts/qa-web/eredita-verdetti.py` (porta i verdetti già dati per chiave).

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| G1 | Dividere il giro v1 in giri per persona (s2, s3, s1 poi s4, s5, s6) e avviarli in produzione, sola lettura | Claude | ogni giro con coda vuota | s2 e s3 FATTO; s4, s5, s6 in corso |
| G2 | Giudizio s3 (eredità per chiave 10.379 righe, 666 gruppi a occhio) | Claude, giudici Sonnet | `stato` di s3 esce 0 | FATTO |
| G3 | Giudizio s2 (eredità 22.605 righe, 2.189 gruppi a occhio) | Claude, giudici Sonnet | tutte le righe con verdetto | 315 righe APERTE da ricatturare |
| G4 | Giudizio s4, s5, s6 | Claude | `stato` di s4, s5, s6 esce 0 | da fare |
| G5 | Ricattura delle righe APERTE (pannelli chiusi, schermate alte, caricamento) e giudizio | Claude | nessuna riga APERTO | da fare |
| R1 | Raggruppamento dei difetti per classe con causa nel codice | subagent Opus | `classi-difetti.md` | FATTO (30 classi + 3 escluse, 56.875 righe di s2 e s3) |
| R2 | Aggiornare le classi con le righe di s4, s5, s6 | subagent Opus | `classi-difetti.md` aggiornato | da fare |
| C1 | Correzione K04: guscio più largo di 390 px | subagent Opus, PR piccola | PR con CI verde, righe tornate OK nel giro di verifica | da fare |
| C2 | Correzione K01: faldone tradotto in inglese | subagent Opus, PR piccola | idem | da fare |
| C3 | Correzione K05: testi fissi di `@heuresys/ui` | subagent Opus, PR piccola | idem | da fare |
| C4 | Correzione K03: landmark `main` annidato | subagent Opus, PR piccola | idem | da fare |
| C5 | Correzione K27: sezioni del faldone che non si aprono (414) | subagent Opus, PR piccola | idem | da fare |
| C6 | Altre classi di codice per ordine di `classi-difetti.md` (K10, K12-K15, K17-K22, K25, K26, K29, K30) | subagent Opus | idem | da fare |
| C7 | Rigiudicare K06, K21, K28 (verdetti ereditati smentiti dal codice di oggi) | Claude | verdetto visto | da fare |
| V1 | Giro di verifica sulle righe corrette | Claude | righe tornate OK | da fare |
| X | Rapporto finale in `/mnt/project-files/qa-forense/` e in `docs/`, una riga per pagina×ruolo | Claude | file scritti | da fare |

Chiusura: «CICLO CHIUSO N/N» solo quando ogni riga ha un verdetto e le righe corrette sono tornate OK nel giro di verifica.
