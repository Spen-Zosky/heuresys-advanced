# RISPOSTE DI ENZO — mandato K

Una riga per risposta, nella forma: `<voce> | <data> | <risposta>`
La CLI legge questo file per prima cosa a ogni ripresa (`tools/dove_siamo.py`) e sblocca la voce corrispondente.
Le sole voci che possono aspettare qui: D5 (alla chiusura di I-D), X-0 e K1-ADR (ratifica ADR), X-1 (righe dubbie), X-2 (mappa di sys_attendance), A0 (margine del pavimento del guardiano, mandato S1105), R-2 (come il DPO legge il dossier mascherato), D10+ se nasce.


D5 | 2026-09-15 | C

Risposta di Enzo, raccolta da Cowork il 2026-09-15 alle 03:50 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Opzione C: l'importazione non tocca i saldi che hanno un gesto nativo aperto; il disaccordo finisce nel registro dei conflitti e lo chiude una persona (il DATA_STEWARD, che nasce in R-6).
Ragione della scelta, da riportare nell'ADR di X-4: i conflitti fra una persona e un'importazione oggi sono ZERO (I-D: 681 righe su 682 modificate a blocchi da lavori automatici, una sola ambigua e dello stesso giorno dei blocchi), quindi il costo di C - un passaggio manuale per conflitto - oggi e' nullo e comincia solo quando il caso diventa reale, con un cliente vero davanti e piu' informazione di adesso. Ed e' l'unica delle tre coerente con la regola data da Enzo sulla direzione del dato: ne' il gestionale esterno ne' la piattaforma sovrascrivono l'altro in silenzio.
X-4 e X-5 si sbloccano.

A0 | 2026-09-17 | 1 punto percentuale

Risposta di Enzo, raccolta da Cowork il 2026-09-17 alle 02:40 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Il margine e' quello proposto da A0: 1 punto percentuale, cioe' il 90mo percentile aggregato dei salti (0,29 punti) arrotondato per eccesso al punto intero. La fascia «A RIDOSSO» e' quindi 74-75% per il contesto e 79-80% per la finestra 5 ore, e nella fascia si esce con lo stesso exit 3 della soglia piena.
Ragione della scelta, da riportare nel commento della costante in guardiano.py: il margine copre il ritardo di UNA misura, non un intervallo senza misure. Il caso del 16-17 settembre (74,8% -> 87,3% in 48 minuti) e' coperto da questo margine per la parte iniziale (a 74,8% si sarebbe fermata) e dal terzo momento di misura di A2 per il resto. Il turno pesante raro (massimo osservato 3,47 punti, uno su 1.295 misure) resta fuori dalla fascia: inseguirlo avrebbe portato la soglia effettiva a 71,5%, cioe' circa 40.000 token di capienza buttati a ogni sessione per un evento su mille. Enzo ha scelto di non pagarlo, sapendolo.
A1 e A4 si sbloccano.

R-2 | 2026-09-18 | C

Risposta di Enzo, raccolta da Cowork il 2026-09-18 alle 23:45 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Opzione C: R-2 si chiude sul NUCLEO GDPR — i 4 permessi (gdpr:read, gdpr:export, gdpr:erase, gdpr:retention), il ritiro di gdpr:erase a HRMS_MANAGER, il rollback scritto PRIMA. La lettura mascherata del dossier NON si fa adesso: diventa una voce D-nuova separata, con la sua decisione, e resta BLOCCATA finche' Enzo non la riprende.
Ragione della scelta, spiegata a Enzo in italiano semplice prima che scegliesse: oggi non esiste un cliente che stia chiedendo quella funzione, e l'opzione A avrebbe aperto un concetto architetturale nuovo — un terzo stato «tenant-wide ma mascherato» accanto a I18 e I20 — che una volta creato vive per sempre nel prodotto e che altri ruoli chiederanno. Rimandare non costa niente perche' il lavoro utile (il nucleo GDPR) e' comune a tutte e tre le opzioni e si fa comunque. Quando un cliente vero chiedera' il DPO si sapra' anche COME lo usa, e la decisione sara' migliore di adesso.
⚠ Condizione dichiarata da Cowork al momento della scelta, da non perdere: se l'obiettivo diventa chiudere la fase dei ruoli COMPLETA per una dimostrazione o una certificazione, l'opzione A e' l'unica che la chiude davvero. In quel caso la voce D-nuova torna in cima, non resta in fondo.
NON si tocca HR_MANDATED_ROLES, non si tocca mask.ts, non nasce nessun predicato nuovo: sono la fonte diretta di I18 e I20.
R-2 (nucleo) si sblocca ORA. La voce D-nuova nasce BLOCCATA(Enzo).
