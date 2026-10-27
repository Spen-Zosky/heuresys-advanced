# STATE — vista rapida

**Updated**: 2026-10-27 (O2-09 e O2-10 dal thread di progetto: passo 3 della partecipazione per posizione DEPLOYATO su `3a323bde`; esiti in `.programmi/onda2/esiti/O2-09.md` e `O2-10.md`)

*I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**O2-09 e O2-10 (26-27 ottobre, thread di progetto sulla VM)**: decisioni dell'Amministratore di Sistema sul passo 3 (D-P3-1 corretta: un solo process owner per processo, il responsabile dell'unità di governo; D-P3-2; D-P3-3; vincolo condizionato). In produzione, con backup verificato prima di ogni passo: passo 2 di PE-4, regole (un process owner per ognuno dei processi), D-P3-2. Codice del 3a e del 3b con `000459` e `000184` emendata: **DEPLOYATO su `3a323bde`** (CI 9/9), prova dal vivo registrata. Sbloccati lungo la strada due rossi di CI già presenti su `main` (atlante non rigenerato; font di Google, passeggero). Datastore: partizione di dicembre dell'audit creata (D-66, PR #7 del datastore da unire). ADR-0046 accettato il 23/10: #269 chiusa; #270 chiusa.

**S1119, O2-02 (17 ottobre)**: il caricatore del pacchetto (`db/scripts/pacchetto/`) scrive e rilegge per codice ogni sezione e campo v0.3 nelle tabelle della `000458` e accetta ancora il v0.2; convalida il pacchetto (schema, impronte, limiti delle colonne) prima di toccare il database, riporta senza fermarsi le regole che marcano. Prova su copia del gemello: 111 controlli, zero rossi (v0.2 come prima, tre pacchetti v0.3 riletti uguali, sette rifiuti, sette mutazioni rosse). **`WAIT-INPUT`: il pacchetto v0.3 vero della banca non è depositato dal datastore**; la prova ha girato su un pacchetto di prova costruito dal v0.2 e dallo schema, dichiarato tale. Lavoro NON applicato in produzione.

**S1119, O2-01 (17 ottobre)**: scritta la migrazione `000458` (14 tabelle `sys_blueprint_content_*` di piattaforma, colonne sul pacchetto e su 8 tabelle del modello), con inversa fuori catena e prova su copia del gemello (`db/scripts/onda2/`). Righe di classificazione in `000429` (282 diventa 296) e registro in `000062`. Dove lo schema JSON v0.3 contraddice il disegno vince lo schema: 9 casi nell'esito. Prova generale e cancello verdi; commit `1330d70d` e `303e75a8` su `main`. **Stato**: lavoro dimostrato sul gemello e su copia, NON applicato in produzione e non armato; non è una catena a metà (O2-02 scrive nelle tabelle nuove, ma la 000458 sta in piedi da sola).

**Stati intermedi ereditati, dichiarati e invariati**: `000454`…`000457` committate e provate sul gemello, NON in produzione; il passo 2 di PE-4 provato su copia e non eseguito in produzione; #265 F4 sospesa sul ramo `f4-livello-contrattuale` (ADR-0045). Esiti in `.programmi/esiti-onda0/`.

## Top priorities

1. **Onda 2 (#271)**: `O2-03` (struttura del tenant) può partire; `O2-07` e `O2-08` sono sbloccati (ADR-0046 accettato).
2. **Registro di O2-09**: estendere il perimetro del process owner alle righe delle altre unità dello stesso processo? (decisione dell'Amministratore di Sistema).
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
