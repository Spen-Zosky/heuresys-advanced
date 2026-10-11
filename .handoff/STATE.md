# STATE — vista rapida

*Ultimo aggiornamento: S1118 (2026-10-11), mandato W0-A1 (onda 0 del piano di adesione). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**W0-A1 eseguito (chiusura leggera, nessuna propagazione).** La `000454` porta dentro la direzione del dato delle sue tabelle ed è provata sul gemello insieme alla `000455` (`ci-rehearsal.sh` e `prova-idempotenza.sh` verdi): rilascio pronto, **non armato**. Il caricatore del pacchetto del datastore è nel repository (`db/scripts/pacchetto/`) e ha dimostrato la giunzione su una copia usa-e-getta del gemello: il pacchetto della banca entra senza perdite (257 percorsi su 257) e si costruisce come modello in un tenant della copia.

**#265 costruito**: modulo `hierarchy-levels` (avviso con motivazione, rotta di sola lettura, avvisi nell'anteprima di attivazione). **#264 in attesa del datastore** (richiesta in `.programmi/esiti-onda0/RICHIESTA_datastore_attivazione.md`). Censimento della separazione in `.programmi/esiti-onda0/CENSIMENTO_separazione.md`. Esito intero: `.programmi/esiti-onda0/W0-A1.md`.

## Top priorities

1. **Armare il deploy** di `000454`/`000455` (decisione di Enzo, `scripts/close-propagate.sh`).
2. **#264** attende il pacchetto con ruoli, cruscotti, porte, variante pubblicata (datastore). **#265** resta l'aggancio alle modifiche di posto e riporto e la scelta sul livello contrattuale (nessuna rotta lo scrive). **#263** resta il tipo delle tre date della `000454` (RD-09).
3. **#266** struttura albero RTL (WAIT-INPUT, non toccata) · **#254** apertura dei perimetri (P1, non avviata).

## Open questions

- La copia di prova `heuresys_advanced_w0a1_prova1` resta sul gemello (non si cancella da sola): si toglie su richiesta.
- Il gesto «pubblica la versione» del modello caricato è oggi dell'operatore, solo sulle copie (in attesa dello schema 0.3 del pacchetto).

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/check_canale_cowork.py               # atteso: 0 voci aperte
python docs/kb/tools/verify_gate.py check
bash scripts/verifica-deploy.sh                            # esito dell'armamento (se armato)
```
