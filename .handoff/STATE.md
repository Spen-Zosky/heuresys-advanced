# STATE — vista rapida

**Updated**: 2026-10-26 (O2-09 dal thread di progetto: decisioni del passo 3 prese, passo 3a e regole pronti su copia; produzione ferma sul permesso; esiti in `.programmi/onda2/esiti/O2-09.md` e `O2-10.md`)

*I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**O2-09 (26 ottobre, thread di progetto sulla VM)**: l'Amministratore di Sistema ha deciso D-P3-1 (corretta: un solo process owner per processo, il responsabile dell'unità di governo), D-P3-2, D-P3-3 e il vincolo condizionato del 3b. ADR-0046 risultava già accettato il 23/10: #269 chiusa. Su copia della produzione: passo 2 verde con ritorno byte per byte; script delle regole con inversa e prova verde (un owner per ogni processo); codice del 3a con frammento unico e test del cambio di posto rosso prima e verde dopo; confronto attori senza differenze non spiegate. **Non in produzione**: la corsa del passo 2 è stata negata dal controllo dei permessi della sessione, quindi né il passo 2, né le regole, né il rilascio del 3a sono stati eseguiti. Il 3b (O2-10) è bloccato da una scoperta: la `000184` si riapplica a ogni deploy e la CI ha partecipazioni attive senza posizione. Backup della produzione del 26/10 in `pg_dump_snapshots/` (VM). Datastore: partizione di dicembre dell'audit creata (D-66, PR del datastore).

**S1119, O2-02 (17 ottobre)**: il caricatore del pacchetto (`db/scripts/pacchetto/`) scrive e rilegge per codice ogni sezione e campo v0.3 nelle tabelle della `000458` e accetta ancora il v0.2; convalida il pacchetto (schema, impronte, limiti delle colonne) prima di toccare il database, riporta senza fermarsi le regole che marcano. Prova su copia del gemello: 111 controlli, zero rossi (v0.2 come prima, tre pacchetti v0.3 riletti uguali, sette rifiuti, sette mutazioni rosse). **`WAIT-INPUT`: il pacchetto v0.3 vero della banca non è depositato dal datastore**; la prova ha girato su un pacchetto di prova costruito dal v0.2 e dallo schema, dichiarato tale. Lavoro NON applicato in produzione.

**S1119, O2-01 (17 ottobre)**: scritta la migrazione `000458` (14 tabelle `sys_blueprint_content_*` di piattaforma, colonne sul pacchetto e su 8 tabelle del modello), con inversa fuori catena e prova su copia del gemello (`db/scripts/onda2/`). Righe di classificazione in `000429` (282 diventa 296) e registro in `000062`. Dove lo schema JSON v0.3 contraddice il disegno vince lo schema: 9 casi nell'esito. Prova generale e cancello verdi; commit `1330d70d` e `303e75a8` su `main`. **Stato**: lavoro dimostrato sul gemello e su copia, NON applicato in produzione e non armato; non è una catena a metà (O2-02 scrive nelle tabelle nuove, ma la 000458 sta in piedi da sola).

**Stati intermedi ereditati, dichiarati e invariati**: `000454`…`000457` committate e provate sul gemello, NON in produzione; il passo 2 di PE-4 provato su copia e non eseguito in produzione; #265 F4 sospesa sul ramo `f4-livello-contrattuale` (ADR-0045). Esiti in `.programmi/esiti-onda0/`.

## Top priorities

1. **Permesso dell'Amministratore di Sistema** per la corsa in produzione del passo 2 e delle regole e per armare il rilascio del 3a (#270, `O2-09.md`); la `000457` è già in produzione (DEPLOYATO su `bb97ea3b`).
2. **Decisione sul 3b** (#270, `O2-10.md`): emendare la `000184` e portare in catena la parte certa del passo 2 prima del vincolo. `O2-07` e `O2-08` possono partire (ADR-0046 accettato).
3. **Onda 2 (#271)**: `O2-01` e `O2-02` fatte (`O2-02` con `WAIT-INPUT` sul pacchetto v0.3 vero della banca: va rifatta la prova quando il datastore lo deposita); `O2-03` (struttura del tenant) può partire.

## Open questions

- L'owner di un processo vede solo i partecipanti della riga della sua unità, non delle altre unità che collaborano al processo: da decidere se estendere (registro di `O2-09.md`).
- `public-stats` resta dichiarato di piattaforma fino a S6: la decisione su che cosa pubblica è rimandata (ADR-0046 §8).
- Il workflow CI "Atlas freshness" è rosso su `1330d70d` e già su `2d0cfd7a`; sul commit di correzione `303e75a8` non risulta nessuna corsa: da leggere.
- Al push del 2026-10-17 GitHub segnala vulnerabilità Dependabot aperte sul ramo principale: da riesaminare (`gh api repos/Spen-Zosky/heuresys-advanced/dependabot/alerts`).

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/check_canale_cowork.py               # atteso: 0 voci aperte
python docs/kb/tools/verify_gate.py check
bash scripts/verifica-deploy.sh                            # esito dell'armamento (se armato)
```
