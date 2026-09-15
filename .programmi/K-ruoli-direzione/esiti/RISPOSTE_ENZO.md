# RISPOSTE DI ENZO — mandato K

Una riga per risposta, nella forma: `<voce> | <data> | <risposta>`
La CLI legge questo file per prima cosa a ogni ripresa (`tools/dove_siamo.py`) e sblocca la voce corrispondente.
Le sole voci che possono aspettare qui: D5 (alla chiusura di I-D), X-0 e K1-ADR (ratifica ADR), X-1 (righe dubbie), X-2 (mappa di sys_attendance), D10+ se nasce.


D5 | 2026-09-15 | C

Risposta di Enzo, raccolta da Cowork il 2026-09-15 alle 03:50 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Opzione C: l'importazione non tocca i saldi che hanno un gesto nativo aperto; il disaccordo finisce nel registro dei conflitti e lo chiude una persona (il DATA_STEWARD, che nasce in R-6).
Ragione della scelta, da riportare nell'ADR di X-4: i conflitti fra una persona e un'importazione oggi sono ZERO (I-D: 681 righe su 682 modificate a blocchi da lavori automatici, una sola ambigua e dello stesso giorno dei blocchi), quindi il costo di C - un passaggio manuale per conflitto - oggi e' nullo e comincia solo quando il caso diventa reale, con un cliente vero davanti e piu' informazione di adesso. Ed e' l'unica delle tre coerente con la regola data da Enzo sulla direzione del dato: ne' il gestionale esterno ne' la piattaforma sovrascrivono l'altro in silenzio.
X-4 e X-5 si sbloccano.
