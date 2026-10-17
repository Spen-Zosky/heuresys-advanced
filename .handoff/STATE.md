# STATE — vista rapida

**Updated**: 2026-10-17 (S1119 — O2-01: migrazione 000458, contenuto v0.3 del modello; esito in `.programmi/onda2/esiti/O2-01.md`)

*I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**S1119, O2-01 (17 ottobre)**: scritta la migrazione `000458` (14 tabelle `sys_blueprint_content_*` di piattaforma, colonne sul pacchetto e su 8 tabelle del modello), con inversa fuori catena e prova su copia del gemello (`db/scripts/onda2/`). Righe di classificazione in `000429` (282 diventa 296) e registro in `000062`. Dove lo schema JSON v0.3 contraddice il disegno vince lo schema: 9 casi nell'esito. Prova generale e cancello verdi; commit `1330d70d` e `303e75a8` su `main`. **Stato**: lavoro dimostrato sul gemello e su copia, NON applicato in produzione e non armato; non è una catena a metà (O2-02 scrive nelle tabelle nuove, ma la 000458 sta in piedi da sola).

**Stati intermedi ereditati, dichiarati e invariati**: `000454`…`000457` committate e provate sul gemello, NON in produzione; il passo 2 di PE-4 provato su copia e non eseguito in produzione; #265 F4 sospesa sul ramo `f4-livello-contrattuale` (ADR-0045). Esiti in `.programmi/esiti-onda0/`.

## Top priorities

1. **Rilascio** di `000454`…`000458` e corsa del passo 2 di PE-4 in produzione (Amministratore di Sistema): è la precondizione del passo 3 (#270).
2. **Decisioni dell'onda 2**: approvazione di ADR-0046 (#269) e delle tre scelte sul passo 3 (#270). Senza, `O2-07`…`O2-10` non partono.
3. **Onda 2 (#271)**: `O2-01` fatta; `O2-03` (struttura del tenant) può partire; `O2-02` (caricatore) può usare le tabelle della 000458 e attende il pacchetto v0.3 della banca.

## Open questions

- Dopo il passo 3a la visibilità funzionale per processo diventa vuota per tutti, se l'Amministratore di Sistema non sceglie una regola per gli OWNER (D-P3-1 in `PIANO_passo3-partecipazione.md`).
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
