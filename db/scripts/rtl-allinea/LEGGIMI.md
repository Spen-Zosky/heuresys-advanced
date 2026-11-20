# Allineamento di RTL Bank alla corsa p20261010010521tjb

Applicato in produzione l'11/11/2026 (frase di Enzo delle 18:33 Roma), dopo la copia di ritorno `20261111-rtl-allineamento-20261111` (prova di ripristino VERDE: 402 tabelle, 727.192 righe) e la prova finale su un suo ripristino (due corse, la seconda senza variazioni di contenuto).
Ordine: `bash applica.sh "<comando psql>" <cartella-log>` (B, A1, A2, A3, C1, D1, D2, E1, G, H, I, J, J2, K, L, M, N, O, P, Q, I, S, R). Ogni blocco e' idempotente e ha il suo giornale in `staging.rtl_allinea_*_undo`.
Fuori dall'ordine, dopo il rilascio della PR: migrazioni 000486 (colonna etichetta ESCO) e 000487, poi `F_etichette_esco_it.sh`.
Verifiche: `impronta.sql` (contenuto di ogni tabella), `impronta_anagrafica.sh` (le 25 tabelle di anagrafica e utenze, elenco in `ANAGRAFICA.txt`).
Aperto: custodia storia36 con 5 check rossi legati alla storia chiusa (C2c, C3c, C3d, C3e) e ai successori scelti fra i pari (C5g); proposte ESCO di `/positions/[id]` e colonne `difficulty` e `industryCode` lette dall'interfaccia ma assenti dall'API (sono codice).

## Convergenza (12/11/2026)

Prova: ripristina il dump «prima», `applica.sh` (corsa 1), poi `bash convergenza.sh "<psql>" <cartella-log>` due volte: ogni script rieseguito non deve cambiare nessuna riga (updated_at compreso) ne' aggiungere righe ai giornali. Va fatta su un database con un nome proprio (`DB_NAME=<nome> copia-fase.sh prova`), mai sul nome condiviso.

## J3 e J4 (15/11/2026)

J3_testi_inglesi.sql (generato da genera_J3_testi.py) traduce i testi inglesi di RTL; J4_residui_prova.sql toglie i tre residui di prova. Idempotenti, con giornale (`staging.rtl_allinea_testi_undo`, `staging.rtl_residui_prova_undo`). Provati sul banco, NON applicati in produzione e non ancora in `applica.sh`: l inserimento nell ordine e la produzione sono una decisione di Enzo.

## Vettori e J6/J6b (20/11/2026)

Causa del blocco del rilascio: J3 e J3b (19/11, 12:08 UTC) hanno cambiato la descrizione di 26 righe di sys_skills (giornale staging.rtl_allinea_testi_undo) senza ricalcolare i vettori; la sentinella 000342 confronta l'impronta sha256 del testo con source_text_hash e li ha visti stantii.
Guardia: `bash vettori.sh --verifica ["<psql>"]` (rosso se un vettore non combacia) e `--ricalcola` (pnpm embeddings:backfill, salto per impronta, poi verifica). J, J2, J3, J3b escono rossi se lasciano vettori stantii (si rinvia con `-v vettori_rinvia=1`, come fa applica.sh, che chiude con `vettori.sh --verifica`).
J6 toglie da RTL le 54 righe di sys_user_skills della competenza «materiali avanzati»; J6b, dopo J6, ne toglie le 54 evidenze (giornali staging.rtl_competenze_fuori_industria_undo e staging.rtl_evidenze_fuori_industria_undo).

## J3c e l'origine di J (20/11/2026)

J3c (generato da genera_J3c_testi_residui.py) traduce i testi inglesi o misti restanti di RTL: motivazioni di assenza e straordinario, commenti del clima, competenze e commenti delle valutazioni, sedi delle calibrazioni, ostacoli e passi dei check-in, categorie degli obiettivi, sondaggi e modelli, programmi di mentoring, modelli predittivi, KPI, nota di prima versione dei contenuti. Ripara anche 419 righe di sys_user_timeline_events a cui J aveva tolto la prima lettera del nome della certificazione (substr(s, 24) al posto di substr(s, 23): corretto in J). Lo stesso modello di J3b: valori esatti, solo RTL, giornale staging.rtl_allinea_testi_undo, guardia vettori in coda. Non e' in applica.sh.
