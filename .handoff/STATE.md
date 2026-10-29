# STATE — vista rapida

**Updated**: 2026-10-29 (riallineamento del registro allo stato vero: ADR-0043, 0044, 0046, 0047, 0048 accettati; `refs/heads/prod` = `main` = `0c3088c3`, misurato con `git ls-remote`)

*I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**Riallineamento del 29 ottobre (thread di progetto, solo documenti)**: il registro diceva ancora in attesa di te due decisioni già prese. `#267` (ADR-0043) e `#268` (ADR-0044) erano `WAIT-INPUT`, ma i due ADR sono ACCETTATI dal 12 ottobre: chiuse e archiviate. ADR-0046, 0047 e 0048 sono ACCETTATI dal 23 ottobre, ADR-0049 dal 29 ottobre. `ADR_INDEX.md` rigenerato: ora elenca anche ADR-0049. Misurato con `git ls-remote origin refs/heads/prod refs/heads/main`: produzione e `main` coincidono su `0c3088c3`, DEPLOYATO il sera del 27 ottobre (registro del thread «Collegare le attività ai processi»); la CI «Atlas freshness» è verde su quel commit (corsa manuale del 27 ottobre). Le migrazioni `000454`…`000458` sono nella catena del rilascio `bb97ea3` del 25 ottobre, quindi in produzione: lo stato «NON in produzione» scritto qui sotto il 17 ottobre è superato.

**27 ottobre, PR #116 e #117 (DEPLOYATE su `61b1a82a`)**: l'owner di un processo vede chi lavora al processo in tutte le unità collaboranti (ADR-0036 §8, rotta `GET /v1/me/processes/:oupId/participants`); prova dal vivo superata. Scioglie la domanda aperta di O2-09 sul perimetro dell'owner.

**27 ottobre, PR #118 (DEPLOYATA su `0c3088c3`)**: le attività appartengono a un processo (ADR-0049, migrazione `000462`, rotta `GET /v1/me/processes/:oupId/activities`); riempimento in produzione con giornale e inversa, prova dal vivo superata. ADR-0049, applicato con la delega sulle decisioni raccomandate, è ACCETTATO dal 29 ottobre.

**O2-09 e O2-10 (26-27 ottobre, thread di progetto sulla VM)**: decisioni dell'Amministratore di Sistema sul passo 3 (D-P3-1 corretta: un solo process owner per processo, il responsabile dell'unità di governo; D-P3-2; D-P3-3; vincolo condizionato). In produzione, con backup verificato prima di ogni passo: passo 2 di PE-4, regole (un process owner per ognuno dei processi), D-P3-2. Codice del 3a e del 3b con `000459` e `000184` emendata: **DEPLOYATO su `3a323bde`** (CI 9/9), prova dal vivo registrata. Sbloccati lungo la strada due rossi di CI già presenti su `main` (atlante non rigenerato; font di Google, passeggero). Datastore: partizione di dicembre dell'audit creata (D-66, PR #7 del datastore da unire). ADR-0046 accettato il 23 ottobre: #269 chiusa; #270 chiusa.

**S1119, O2-02 (17 ottobre)**: il caricatore del pacchetto (`db/scripts/pacchetto/`) scrive e rilegge per codice ogni sezione e campo v0.3 nelle tabelle della `000458` e accetta ancora il v0.2; convalida il pacchetto (schema, impronte, limiti delle colonne) prima di toccare il database, riporta senza fermarsi le regole che marcano. Prova su copia del gemello: 111 controlli, zero rossi (v0.2 come prima, tre pacchetti v0.3 riletti uguali, sette rifiuti, sette mutazioni rosse). **`WAIT-INPUT`: il pacchetto v0.3 vero della banca non è depositato dal datastore**; la prova ha girato su un pacchetto di prova costruito dal v0.2 e dallo schema, dichiarato tale. Lavoro NON applicato in produzione.

**S1119, O2-01 (17 ottobre)**: scritta la migrazione `000458` (14 tabelle `sys_blueprint_content_*` di piattaforma, colonne sul pacchetto e su 8 tabelle del modello), con inversa fuori catena e prova su copia del gemello (`db/scripts/onda2/`). Righe di classificazione in `000429` (282 diventa 296) e registro in `000062`. Dove lo schema JSON v0.3 contraddice il disegno vince lo schema: 9 casi nell'esito. Prova generale e cancello verdi; commit `1330d70d` e `303e75a8` su `main`. **Stato**: lavoro dimostrato sul gemello e su copia, NON applicato in produzione e non armato; non è una catena a metà (O2-02 scrive nelle tabelle nuove, ma la 000458 sta in piedi da sola).

**Stati intermedi ereditati**: superati il 25 e 26 ottobre — `000454`…`000458` in produzione con `bb97ea3`, il passo 2 di PE-4 eseguito in produzione in O2-09. Resta #265 F4 sospesa sul ramo `f4-livello-contrattuale` (ADR-0045). Esiti in `.programmi/esiti-onda0/`.

## Top priorities

1. **Onda 2 (#271)**: `O2-01`, `O2-02`, `O2-09`, `O2-10` fatte; `O2-03` (struttura del tenant) può partire; `O2-07` e `O2-08` sono sbloccati (ADR-0046 accettato).
2. **#263**: rifare la prova del caricatore quando il datastore deposita il pacchetto v0.3 vero della banca.

## Open questions

- `public-stats` resta dichiarato di piattaforma fino a S6: la decisione su che cosa pubblica è rimandata (ADR-0046 §8).
- Vulnerabilità Dependabot e la PR #119 (fastify) con la CI rossa: da riesaminare (`gh api repos/Spen-Zosky/heuresys-advanced/dependabot/alerts`).

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/check_canale_cowork.py               # atteso: 0 voci aperte
python docs/kb/tools/verify_gate.py check
bash scripts/verifica-deploy.sh                            # esito dell'armamento (se armato)
```
