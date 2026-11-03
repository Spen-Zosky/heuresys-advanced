# ADR-0052 — La copia ripristinabile di advanced a ogni fine fase

- **Status**: ACCETTATO il 2026-11-01 da Enzo Spenuso (in chat alle 00:50 UTC, 01:50 ora di Roma: «sì» alla copia ripristinabile al posto del gemello vivo; alle 00:53 UTC conferma delle due sedi, VM e Drive)
- **Date**: 2026-11-01
- **Redatto da**: Claude Code, thread «Proteggere advanced durante lo sviluppo»
- **Richiesta**: Enzo Spenuso, 2026-11-01: congelare advanced mentre si sviluppa, per non perdere in modo irrimediabile il lavoro fatto se una serie di modifiche lo rompe
- **Relates to**: ADR-0028 (rilascio armato), ADR-0026 (un solo ambiente di produzione), ADR-0035 (ritirare non è cancellare)
- **Strumenti**: `scripts/copia-fase.sh` (copia, prova, drive, ritorna), `scripts/copia-fase-chiave.sh` (coppia di chiavi gpg, una volta)

> **In parole semplici.**
> 1. A ogni fine fase si fotografa advanced per intero: codice, database, configurazione.
> 2. La fotografia si rimette in piedi subito su un database a parte, e si contano tutte le righe di tutte le tabelle: se un numero non torna, la copia non vale.
> 3. La copia sta sulla VM (le ultime due) e su Drive (tutte), cifrata.
> 4. Tornare indietro si può, ma solo con il sì di Enzo, e il database di quel momento non si cancella: si rinomina.

---

## Contesto

Nei prossimi giorni advanced cambierà molto, in ogni sua parte. Si è valutato un gemello vivo (una seconda advanced completa sulla VM, con passaggi a fine fase): costa circa 6 GB di disco e 1 GB di memoria, e protegge da un rischio che qui è piccolo, perché i dati di advanced sono creati per lo sviluppo (gli utenti non sono persone fisiche, RTL non è una banca vera) e il codice ha già un rilascio armato con istantanea e ritorno (ADR-0028).

Esistono già un backup giornaliero (`scripts/backup-db.sh`), un'istantanea prima di ogni rilascio e una prova settimanale (`scripts/dr-drill.sh`). Nessuno lega insieme codice, database e configurazione in un punto preciso, e la prova settimanale ripristina senza proprietari né permessi e ignora gli errori: dimostra che il dump si legge, non che advanced si rimette in piedi.

## Decisione

1. **La copia.** A ogni fine fase `scripts/copia-fase.sh copia <nome>` produce, in `~/backup-hr/copie-fase/<AAAAMMGG>-<nome>/`:
   - l'etichetta git `fase-AAAAMMGG-<nome>` sul commit in produzione (`LAST_GOOD_SHA`), pubblicata su origin;
   - il dump completo di `heuresys_advanced` (`pg_dump -Fc`, con proprietari e permessi), preso dentro una transazione `REPEATABLE READ` con istantanea esportata;
   - i conteggi esatti di ogni tabella, le estensioni e il registro delle migrazioni letti **nella stessa istantanea** del dump, così una scrittura concorrente non li fa divergere;
   - i ruoli di advanced senza password (`pg_dumpall --roles-only --no-role-passwords`, filtrato sui soli ruoli di advanced), le chiavi del `.env` senza valori, le unità systemd, la configurazione nginx, il crontab, le versioni;
   - le impronte SHA-256 dei segreti (`.env`, `/etc/heuresys/*`), che restano dove sono;
   - un manifesto e le impronte di ogni file.
   Nella copia non entra niente degli altri progetti della VM.
2. **La prova.** `copia-fase.sh prova` ripristina la copia su `heuresys_advanced_prova_ripristino` (database marcato da un commento: lo script non tocca un database con quel nome che non abbia creato lui), con proprietari e permessi, fermandosi al primo errore, e confronta conteggi, estensioni e registro delle migrazioni. **Una copia senza prova verde non è un punto di ritorno.** L'esito si scrive nel manifesto.
3. **Le due sedi.** Sulla VM restano l'ultima copia e la precedente; le altre, e una copia fallita a metà, si spostano in `_da_eliminare/<AAAAMMGG>_copie-fase/` del repository. Su Drive (`gdrive-hr:Heuresys/copie-fase`, fuori dalla rotazione di restic) restano tutte: `copia-fase.sh drive` cifra dump e segreti con la chiave pubblica gpg dedicata (`~/.config/heuresys/copie-fase.pub.asc`), carica, riscarica e confronta le impronte SHA-256. La chiave privata, protetta dalla passphrase di Enzo, sta solo in `Heuresys/30_cassaforte` su Drive; la crea una volta Enzo con `scripts/copia-fase-chiave.sh` in un terminale della VM. Finché la chiave non c'è, su Drive va solo la parte in chiaro, e il manifesto lo dice.
4. **Il ritorno.** Solo con il sì di Enzo. `copia-fase.sh ritorna <copia>` stampa la sequenza e non esegue niente: si fermano timer e servizi, il database attuale si rinomina (`<db>_prima_del_ritorno_<data>`, mai cancellato), si ripristina il dump, il codice torna con `scripts/vm-rollback.sh <etichetta>`, si verificano le impronte dei segreti e si fa un login vero su RTL.
5. **Cosa non cambia.** Sviluppo, rilascio armato (ADR-0028), backup giornaliero e prova settimanale restano come sono.

## Conseguenze

- Costo misurato il 2026-11-01: il dump di produzione pesa circa 0,14 GB; la prova di ripristino dura qualche minuto.
- Si torna indietro fino all'ultima fine fase con prova verde, perdendo il lavoro fatto dopo.
- Il gemello vivo non si costruisce. La prova che advanced gira senza riferimenti assoluti resta un esercizio separato: il censimento del 2026-11-01 ha trovato che `scripts/vm-deploy.sh`, `scripts/backup-db.sh`, `scripts/dr-drill.sh` e `scripts/clone-vm-db.sh` danno per scontato una sola advanced per macchina, sul cluster 5432.
