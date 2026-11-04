# Piano: cancellazione degli oggetti di lavoro non più necessari (VM, 4/11/2026)

Richiesta di Enzo, 4/11/2026 14:39 Roma: «è necessario cancellare immediatamente tutti gli oggetti di lavoro non più necessari». Misure di riferimento: `df -h /`, `du -sh <oggetto>`.

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| P1 | Cluster di prova sulla porta 55432 e scratchpad del 31/10 della sessione YWF2AQ (`pgprova`, due dump SQL) | Claude | porta libera, cartella assente | fatta |
| P2 | `~/heuresys-advanced/_da_eliminare/*` | non Claude: autore non accertato | cartella vuota | vuota alle 13:47 UTC |
| P3 | Rami locali già uniti, senza worktree, di advanced e datastore (`git branch -d`) | Claude | elenco vuoto | fatta |
| P4 | Verifica finale: `df -h /`, produzione e `heuresys_ci` intatti | Claude | registro compilato | fatta |

## Simulazione

P1. Deve essere vero: nessun client connesso, nessun file toccato da 48 ore fuori da `pgprova`. Strumento: `pg_ctl -D <dir> stop`, poi `rm -r` con percorso esplicito; la guardia considera rigenerabile `/tmp/claude-<uid>/`. Non serve Enzo.

P2. Deve essere vero: nessun processo aperto dentro; ogni copia di fase con riga `drive ... VERDE` in `~/backup-hr/copie-fase/REGISTRO.txt` e presente su `gdrive-hr:Heuresys/copie-fase`. La copia `20261101-rilascio-ec4c2586_fallita_200127` è un tentativo fallito, superato dalla copia riuscita con lo stesso nome. Strumento: `rm -r`, che la guardia ferma nei thread di progetto: se la ferma non si aggira, serve il gesto di Enzo.

P3. `git branch -d` rifiuta da solo un ramo non unito. La regola «il ramo resta» riguarda la chiusura di un worktree; qui vale la richiesta esplicita di Enzo.

## Fuori da questo ciclo, non si tocca

Produzione (`heuresys_advanced`), `heuresys_ci`, restic, `pg_dump_snapshots` (conservazione di 48 ore già scritta negli script), le ultime due copie di fase, mod-platform, i worktree bloccati dalle sessioni dei thread.

## Non si chiude in questa sessione

Niente: P2 si è risolta da sola prima che servisse Enzo.

## Registro

- P1 fatta: cluster 55432 fermato (`pg_ctl stop -m fast`, nessun client connesso); cancellati `pgprova` e i due `dump_dopo_pass*.sql`. `df -h /` da 73G usati (76%) a 70G (73%).
- P2 bloccata: `rm -r` su `_da_eliminare/20261103_lotto-l1` rifiutato dal controllo dei permessi della sessione. Non aggirato. Alle 13:47 UTC il cestino risultava vuoto per mano di un altro: questa sessione non l'ha cancellato, e chi l'ha fatto non è stato accertato. Verifiche fatte prima: nessun processo aperto; per le cinque copie in `20261104_copie-fase` impronte SHA-256 uguali fra Drive e locale (`rclone hashsum sha256 --download` contro `DRIVE_IMPRONTE.sha256`, escluso `MANIFESTO.txt`); `20261101-rilascio-ec4c2586` presente su Drive con 50 file e riga `drive VERDE` nel registro delle copie (impronte non ricontrollate: il suo file locale non esiste più).

- P3 fatta: `git branch -d` su 5 rami di advanced e 8 di datastore, uniti e senza worktree. Restano i rami i cui worktree bloccati esistono ancora.
- P4 fatta: `df -B1M /` da 24G a 27428 MB liberi; `readyz` 200; `heuresys_advanced` e `heuresys_ci` presenti; ultime due copie di fase al loro posto.

CICLO CHIUSO: 4/4 voci fatte, non resta niente.

## Secondo giro: worktree (sì di Enzo, 4/11/2026 14:50 Roma)

Chiusi 37 worktree (32 di advanced, 5 di datastore) con il rito di progetto più lo sblocco chiesto da Enzo: commit tutti in `origin/main`, nessuna modifica, nessun processo, nessuna sessione attiva da 6 ore. Rami uniti cancellati con `git branch -d`; parti rigenerabili e residui ignorati cancellati. `df -h /`: da 70G a 67G usati. Tenuti: i worktree dei thread attivi (questo, interfacce, `/tmp`) e `bridge-cse_01L8VLYSxh4b6cyRRx3yCMpp` di datastore, che ha file di configurazione locale e una misura non salvati altrove. I temporanei di `/tmp` restano al thread dedicato.

CICLO CHIUSO: secondo giro fatto, non resta niente.
