# Allineamento di RTL Bank alla corsa p20261010010521tjb

Applicato in produzione l'11/11/2026 (frase di Enzo delle 18:33 Roma), dopo la copia di ritorno `20261111-rtl-allineamento-20261111` (prova di ripristino VERDE: 402 tabelle, 727.192 righe) e la prova finale su un suo ripristino (due corse, la seconda senza variazioni di contenuto).
Ordine: `bash applica.sh "<comando psql>" <cartella-log>` (B, A1, A2, A3, C1, D1, D2, E1, G, H, I, J, J2, K, L, M, N, O, P, Q, I, S, R). Ogni blocco e' idempotente e ha il suo giornale in `staging.rtl_allinea_*_undo`.
Fuori dall'ordine, dopo il rilascio della PR: migrazioni 000486 (colonna etichetta ESCO) e 000487, poi `F_etichette_esco_it.sh`.
Verifiche: `impronta.sql` (contenuto di ogni tabella), `impronta_anagrafica.sh` (le 25 tabelle di anagrafica e utenze, elenco in `ANAGRAFICA.txt`).
Aperto: custodia storia36 con 5 check rossi legati alla storia chiusa (C2c, C3c, C3d, C3e) e ai successori scelti fra i pari (C5g); proposte ESCO di `/positions/[id]` e colonne `difficulty` e `industryCode` lette dall'interfaccia ma assenti dall'API (sono codice).

## Convergenza (12/11/2026)

Prova: ripristina il dump «prima», `applica.sh` (corsa 1), poi `bash convergenza.sh "<psql>" <cartella-log>` due volte: ogni script rieseguito non deve cambiare nessuna riga (updated_at compreso) ne' aggiungere righe ai giornali. Va fatta su un database con un nome proprio (`DB_NAME=<nome> copia-fase.sh prova`), mai sul nome condiviso.
