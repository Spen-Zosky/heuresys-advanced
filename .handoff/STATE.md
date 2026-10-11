# STATE — vista rapida

**Updated**: 2026-10-11 (S1118 — W0-A1 e W0-A2 dell'onda 0 del piano di adesione: giunzione provata su copia, 000454 completa, #265 costruito, censimento, ADR-0043 e ADR-0044 proposti)

*Ultimo aggiornamento: S1118 (2026-10-11). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**Stato intermedio dichiarato.** `000454` e `000455` sono provate sul gemello ma NON in produzione: rilascio pronto, **non armato** (gesto di Enzo). La giunzione col pacchetto del datastore è dimostrata su una copia usa-e-getta del gemello, non su produzione: quindi «in corso». Esiti: `.programmi/esiti-onda0/W0-A1.md` e `W0-A2.md`.

**W0-A2**: due ADR in stato PROPOSTO, da approvare da Enzo: `0043_separazione_dal_datastore.md` (sei regole, sostituisce in parte ADR-0039, nuovo testo di I21, sequenza S3-S6) e `0044_partecipazione_ai_processi_legata_alla_posizione.md` (tre passi con giornale). Nessun codice e nessuna migrazione scritti. La misura sul gemello mostra le partecipazioni ai processi in gran parte rimaste indietro dopo i cambi di posto.

## Top priorities

1. **Armare il deploy** di `000454`/`000455` (decisione di Enzo, `scripts/close-propagate.sh`).
2. **#267 / #268**: approvazione di ADR-0043 e ADR-0044 e scelta sui gruppi dubbi delle partecipazioni (Enzo). Dopo l'approvazione: I21 in `CLAUDE.md` e stato di ADR-0039.
3. **#264** attende il pacchetto con ruoli, cruscotti, porte, variante pubblicata (datastore). **#265** resta l'aggancio alle modifiche di posto e riporto e la scelta sul livello contrattuale. **#263** resta il tipo delle tre date della `000454` (RD-09).
4. **#266** struttura albero RTL (WAIT-INPUT, non toccata) · **#254** apertura dei perimetri (P1, non avviata).

## Open questions

- I 57 OWNER delle partecipazioni ai processi riguardano persone non più nell'unità del processo e danno loro visibilità funzionale sulle attività: si corregge col passo 3 di ADR-0044, oppure prima con una disattivazione a parte (scelta di Enzo).
- La copia di prova `heuresys_advanced_w0a1_prova1` resta sul gemello: si toglie su richiesta.
- Il gesto «pubblica la versione» del modello caricato è oggi dell'operatore, solo sulle copie (in attesa dello schema 0.3).

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/check_canale_cowork.py               # atteso: 0 voci aperte
python docs/kb/tools/verify_gate.py check
bash scripts/verifica-deploy.sh                            # esito dell'armamento (se armato)
```
