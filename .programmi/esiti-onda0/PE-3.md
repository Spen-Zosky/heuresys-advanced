# Esito PE-3 — residui di advanced dopo le approvazioni degli ADR

Sessione S1119, 2026-10-17. Mandato di Cowork (PE-3). Chiusura leggera: nessuna propagazione, nessun rilascio armato, `refs/heads/prod` non mosso, `close-propagate.sh` non eseguito.

## Cosa è fatto

| voce | esito |
|---|---|
| 1. I21, ADR-0039, indice ADR | fatto: in `CLAUDE.md` I21 dice «nel datastore; in advanced un tenant ne vede solo il proprio perimetro (ADR-0043)»; ADR-0039 porta «Superseded in part by ADR-0043» (regole 1 e 4, seconda frase); `ADR_INDEX.md` rigenerato con `build_adr_index.py` (43 ADR, 0043-0045 ora ACCETTATO) |
| 2. 263.4, tipi RD-09 | fatto: migrazione nuova `000456_pacchetto_date_e_istante_tipizzati.sql` (la `000454` non è toccata). `source_created_at` → timestamptz; `ccnl_effective` e `institute_valid_from` → date. Guardia sul formato (se un valore non ha la forma attesa si ferma e lo nomina), post-condizione su righe e valori non nulli, idempotente. Inversa fuori catena: `db/scripts/pacchetto/inversa-000456.sql`. Caricatore `accogli-pacchetto.mjs` aggiornato (date come stringa, istante in ISO UTC). NON applicata in produzione |
| 3. 265.3 (F3) | fatto: `PATCH` e `POST /v1/organization-units` (riporto, responsabile) e le proposte `POST /v1/user-position-assignments` e `/:id/transfer` rispondono con `avvisiGerarchiaLivelli`: solo gli avvisi che quella modifica introduce (dopo meno prima), con la motivazione scritta, nominando i posti. Non blocca: la modifica si applica e la proposta nasce comunque. Nessuna rotta di scrittura sui dati contrattuali (ADR-0045) |

## Misure

- Voce 2, prova a andata e ritorno su copia del gemello (`db/scripts/pacchetto/prova-000456.sh`): 8 controlli su 8. Andata (tipi cambiati, righe e valori non nulli invariati), seconda passata senza effetto, inversa che rende gli stessi valori carattere per carattere, e rifiuto di un valore sporco (`'ieri'`) con la colonna rimasta testo.
- Falsificabilità: la prima versione della prova aveva un controllo che dava verde con due misure vuote; l'ho corretto (una misura vuota ora è rossa) e rilanciato.
- Caricatore, `db/scripts/pacchetto/prova-caricatore-000456.sh`: con il caricatore vecchio dopo la `000456` la rilettura dà 3 differenze (le tre colonne, rosso); con il nuovo 0 (verde); sul testo il nuovo dà 0.
- `ci-rehearsal.sh` VERDE (427 migrazioni applicate, seconda passata 20 s, sentinelle 53/53 a zero) e `prova-idempotenza.sh` VERDE, entrambi sul gemello, sul codice del commit con la `000456`.
- Voce 3: 7 test di integrazione sul gemello (`apps/api/test/hierarchy-levels-modifiche.integration.test.ts`), tutti con esito opposto per la stessa mossa (QD3 sotto QD2 avvisa, QD1 no; abbassare il responsabile avvisa, rialzarlo no; un avviso già presente non si ripete; una modifica che non tocca riporto o responsabile non ne porta; assegnazione e trasferimento). 7 test unitari nuovi sulla logica pura (17 in totale nel file). Mutazioni (`apps/api/test/mutazione-avvisi-modifica.sh`): M1 (avvisi mai in risposta), M2 (`avvisiNuovi` ripete anche i vecchi), M3 (assegnazione senza avvisi): ognuna fa fallire 2 test su 7; dopo il ripristino 7 su 7 verdi.
- Prove collaterali verdi sul gemello: `organization-units`, `g1-position-assignment`, `exposure-gate`, e `data-steward` (la prova DIF-4 resta verde); `typecheck:test` pulito.
- Cancello `verify_gate.py run` sul HEAD finale: VERDE (7 suite su 7: `typecheck`, `test-api` 1753 s con contenuto propagato dalla suite stessa e guardia byte per byte, `migrate-idempotent`, `handoff-lint`, `programmi`, `db-health`, `no-contamination`). Per ore `db-health` è stato rosso su «tabelle popolate mai analizzate: 8» in PRODUZIONE (condizione non nata da questo lavoro: nessuna scrittura su produzione); non ho fatto nessun `ANALYZE`, ed è tornato verde da solo (analisi automatica di PostgreSQL).
- Per far girare `migrate-idempotent` ho copiato sul gemello, nel checkout vero, il solo file `db/migrations/000456_pacchetto_date_e_istante_tipizzati.sql` (non tracciato lì; il `git pull --ff-only` consigliato dalla suite era impossibile perché quel checkout ha modifiche locali non mie). Non applicato a nessun database oltre alle copie di prova: un futuro `git pull` lì darà un conflitto su quel file, da risolvere togliendolo.

## Cosa non è fatto

- Non applicata la `000456` né in produzione né sul clone gemello `heuresys_advanced` (il gemello di produzione): il rilascio è di Enzo.
- Le due copie già migrate dalla `000454` che esistevano (`heuresys_advanced_w0a1_prova1`, con il pacchetto caricato, e `heuresys_advanced_w0d_prova1`) NON sono state portate alla `000456`: il guardiano di scrittura ha rifiutato l'applicazione diretta con `psql` su di esse e non ho aggirato il rifiuto. Le prove sono state fatte su copie nuove di `w0a1_prova1`.
- F4 del programma 265 (avviso di rinvio al sistema esterno) non è in questo mandato.

## Residui sul gemello (non cancellati)

Database di prova che ho creato (da togliere con `sudo -u postgres dropdb <nome>` se Enzo vuole):
- `heuresys_advanced_p456_prova1` (ricreata una volta: la prima copia, creata da me pochi minuti prima, è stata tolta con `dropdb` per rilanciare la prova; è l'unico database che ho tolto, e l'avevo creato io), `heuresys_advanced_p456_prova2`, `_prova3`, `_prova4` (tutte copie di `heuresys_advanced_w0a1_prova1`; la prova1 contiene un valore sporco messo apposta).
- Cartelle e file: worktree `/tmp/wt-pe3` (con `.env` copiato e `.secrets` come collegamento simbolico al checkout vero), `/tmp/p456`, `/tmp/pacchetto_banca.json`, `/tmp/prova-caricatore-scp.sh`, `/tmp/mutazione-scp.sh`, `/tmp/wt-pe3-nm-link-spostato`, `/tmp/q.sh`, `/tmp/l.sh`, `/tmp/e.sql`, script `wtprep*.sh`, `runt*.sh`, `sec.sh`. Il ramo remoto `pe3-voce2` su origin porta gli stessi commit di `main`.
- Il checkout vero del gemello (`~/heuresys-advanced`) non è stato toccato.

## Cose da sapere

- Un commit di un'altra sessione sullo stesso albero (`1a6231be`, «ESITO MSG-163: PIANO-036 voce 1b») ha raccolto i file che avevo già in indice (indice condiviso): il contenuto è quello della voce 3, il messaggio no. Ora è pubblicato su `main` insieme ai miei: non riscrivo la storia; la voce 3 sta in quel commit.
- La riga che il profilo di chiusura propone (armare, propagare, clone-db, lettura dalle macchine) non è stata eseguita, per il mandato.

VERDETTO: USCITA-SICURA (tutto committato e pubblicato su main; nessun lavoro mio in volo; il cancello è verde)
