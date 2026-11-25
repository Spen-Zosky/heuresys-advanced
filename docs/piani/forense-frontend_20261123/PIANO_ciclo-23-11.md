# Piano: ciclo forense del frontend, giro del 23 novembre 2026

Mandato di Enzo del 2026-11-15 (invariato): controllo forense completo di tutte le pagine e di tutti gli oggetti del frontend in produzione, per ogni ruolo e persona di prova, poi correzione, prova e rilascio. Questo ciclo riprende il piano `docs/piani/PIANO_forense-frontend_20261115.md` dal giro v1 del 20/11, rimasto con 4.973 unità in coda.

Che cosa non si chiude in questo ciclo: le classi X1, X2 e X3 di `classi-difetti.md` (organigrammi, rete organizzativa, traduzione del dato), che sono di altri thread; la classe di dato K11 (decisione di Enzo del 24/11/2026: nel registro `FUORI_CICLO.md`, da riprendere dopo) e il popolamento vero dei dati delle attività (K24) e la riscrittura del dato di K08, che restano fuori ciclo.

Strumenti: `~/.claude/tools/qa-web/qa-web.mjs` con `scripts/qa-web/adattatore.mjs`; `scripts/qa-web/dividi-giro.py` (un giro diviso per persona, per lavorare in parallelo); `scripts/qa-web/eredita-verdetti.py` (porta i verdetti già dati per chiave).

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| G1 | Dividere il giro v1 in giri per persona (s2..s6) e visitarli in produzione, sola lettura | Claude | ogni giro con coda vuota | FATTO (20.291 unità, 5 giri) |
| G2 | Giudizio s3 | Claude, giudici Sonnet | `stato` di s3 esce 0 | FATTO |
| G3 | Giudizio s2 | Claude, giudici Sonnet | tutte le righe con verdetto | FATTO (le 315 righe aperte sono state rifatte e giudicate nel giro di verifica) |
| G4 | Giudizio s4, s5, s6 | Claude, giudici Sonnet | idem | FATTO (le 240 righe aperte sono state rifatte e giudicate nel giro di verifica) |
| G5 | Ricattura delle righe aperte (pannelli chiusi, schermate alte, caricamento) e giudizio | Claude | nessuna riga APERTO | FATTO (nessuna riga APERTO in nessun giro; le route dinamiche raggiunte da almeno un giro) |
| R1 | Raggruppamento dei difetti per classe con causa nel codice | subagent Opus | `classi-difetti.md` | FATTO |
| R2 | Classi aggiornate con le righe di s4, s5, s6 | subagent Opus | `classi-difetti.md` aggiornato | FATTO (119.523 righe, 30 classi più K31-K34 e X1-X3) |
| C1 | K04 guscio a 390 px | subagent Opus | PR con CI verde e righe tornate OK | PR #16 della libreria e adozione #454, in produzione; riprovato nel giro di verifica (K04 rigiudicata sulle schermate nuove) |
| C2 | K01 faldone tradotto | subagent Opus | idem | #439, in produzione |
| C3 | K05 testi fissi della libreria | subagent Opus | idem | #454 (1.7.1), poi #470 (1.7.2); K05 residuo («Data table», «Aggiorna», centro notifiche) fuori ciclo |
| C4 | K03 `main` annidato | subagent Opus | idem | #454, in produzione |
| C5 | K27 sezioni del faldone | subagent Opus | idem | #437, in produzione |
| C6 | Altre classi di codice | subagent Opus | idem | K09 #448; K10, K13 #440; K12, K17 #452, #459, #461, #463, #470 (la scelta della tavolozza è stata tolta da #472, di altro thread); K14, K15, K19 #441; K18, K22, K26 #438; K20 #467; K21 #465; K29, K30 #436; K31 #466; K32 #447; K33 #468; K34 #449; K25 da indagare |
| C7 | Rigiudicare K06, K21, K28 | Claude | verdetto visto | FATTO: K06 e K28 non sono più difetti in produzione, K21 corretta in parte (#465) |
| C8 | K08: nascondere nella pagina il prefisso «Proposta dell'agente (0005xx)» (decisione di Enzo, 24/11/2026: solo nella pagina, nessuna scrittura al database né modifica delle migrazioni) | subagent Opus | PR con CI verde e righe OK | FATTO (#475-#477, rilascio 80689227; ripasso: criterio senza numero interno) |
| C9 | K24: nascondere le colonne interamente vuote delle attività con la riga «dati dell'attività non ancora compilati» (decisione di Enzo, 24/11/2026) | subagent Opus | idem | FATTO (#475-#477, rilascio 80689227) |
| C10 | K11: incoerenze del dato di RTL (decisione di Enzo, 24/11/2026: nell'elenco «fuori da questo ciclo», da riprendere dopo) | - | registrata in `FUORI_CICLO.md` | FUORI CICLO |
| V1 | Giro di verifica: visita completa dopo il rilascio e giudizio delle righe nuove | Claude | `stato` di ogni giro esce 0 | FATTO (nove giri, 26.704 unità, `stato` 0 su tutti) |
| V2 | Ripasso sulle pagine toccate dopo l'ultimo rilascio (grafici, tavolozze, barra laterale, lingua, K08, K24) | Claude | righe tornate OK | FATTO (rilascio 835a3880, ripasso di 1.174 unità: classi corrette sparite) |
| X | Rapporto finale in `docs/` e consegnato all'utente, una riga per pagina per ruolo | Claude | file scritti | FATTO (`RAPPORTO_giro-verifica-25-11.md`, `pagina-per-ruolo.tsv`) |

Chiusura: «CICLO CHIUSO N/N» solo quando ogni riga ha un verdetto e le righe corrette sono tornate OK nel giro di verifica; le voci «FUORI CICLO» non contano nel N e si dichiarano nel rapporto.

CICLO CHIUSO — 19/19 voci fatte (la voce C10 è FUORI CICLO e non conta), letto dal 25/11/2026: `stato` esce 0 su tutti i nove giri di verifica, nessuna riga senza verdetto e nessuna APERTO. Limiti e cose rimaste fuori sono nel rapporto `RAPPORTO_giro-verifica-25-11.md` e in `FUORI_CICLO.md` (F11-F15).
