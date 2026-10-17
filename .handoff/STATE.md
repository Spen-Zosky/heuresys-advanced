# STATE — vista rapida

**Updated**: 2026-10-17 (S1119 — PE-6.1: disegno dell'onda 2, ADR-0046 PROPOSTO, mandati Sonnet in `.programmi/onda2/`)

*I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**S1119, PE-6.1 (17 ottobre)**: solo disegno, nessuna migrazione, nessuna scrittura su database, nessun accesso alla produzione. Prodotti: ADR-0046 sul perimetro del tenant (PROPOSTO, #269); disegno delle tabelle e colonne dell'onda 2 con la migrazione inversa di ciascuna (`.programmi/onda2/DISEGNO_tabelle-onda2.md`); piano del passo 3 della partecipazione per posizione (`PIANO_passo3-partecipazione.md`, #270); dieci mandati Sonnet `O2-01` … `O2-10` con prova e tetto (`.programmi/onda2/README.md`, #271). Non è uno stato intermedio di una catena: nessun file di migrazione è stato scritto. Verdetto USCITA-SICURA.

**Stati intermedi ereditati, dichiarati e invariati**: `000454`, `000455`, `000456`, `000457` committate su `main` e provate sul gemello, NON in produzione, non armate; il passo 2 di PE-4 (`db/scripts/pe4-passo2-riempi.sql`) è provato su copia e non eseguito in produzione; #265 F4 sospesa sul ramo `f4-livello-contrattuale` (ADR-0045). Esiti in `.programmi/esiti-onda0/`.

## Top priorities

1. **Rilascio** di `000454`…`000457` e corsa del passo 2 di PE-4 in produzione (Amministratore di Sistema): è la precondizione del passo 3 (#270).
2. **Decisioni dell'onda 2**: approvazione di ADR-0046 (#269) e delle tre scelte sul passo 3 (#270). Senza, `O2-07`…`O2-10` non partono.
3. **Onda 2 (#271)**: `O2-01` (contenuto del modello v0.3) e `O2-03` (struttura del tenant) possono partire subito; `O2-02` attende il pacchetto v0.3 della banca dal datastore.

## Open questions

- Dopo il passo 3a la visibilità funzionale per processo diventa vuota per tutti, se l'Amministratore di Sistema non sceglie una regola per gli OWNER (D-P3-1 in `PIANO_passo3-partecipazione.md`).
- `public-stats` resta dichiarato di piattaforma fino a S6: la decisione su che cosa pubblica è rimandata (ADR-0046 §8).
- Al push del 2026-10-17 GitHub segnala vulnerabilità Dependabot aperte sul ramo principale: da riesaminare (`gh api repos/Spen-Zosky/heuresys-advanced/dependabot/alerts`).

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/check_canale_cowork.py               # atteso: 0 voci aperte
python docs/kb/tools/verify_gate.py check
bash scripts/verifica-deploy.sh                            # esito dell'armamento (se armato)
```
