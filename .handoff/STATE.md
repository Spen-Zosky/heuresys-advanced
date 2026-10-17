# STATE — vista rapida

**Updated**: 2026-10-17 (S1119 — PE-5b: glossario v0.3 in `docs/kb/`; prima PE-4: passi 1 e 2 di ADR-0044 provati su copia del gemello, non in produzione; esito `.programmi/esiti-onda0/PE-4.md`; prima PE-3: I21/ADR-0039/indice, migrazione 000456 (263.4) e avviso gerarchia-livelli nelle modifiche (265.3), non in produzione; esito `.programmi/esiti-onda0/PE-3.md`; prima W0-D: #265 F4 sospesa; prima W0-A3, `chiudi` a tre livelli; prima S1118, W0-A1 e W0-A2, 000454 e 000455 non in produzione)

*Ultimo aggiornamento: S1118 (2026-10-11). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**S1119, PE-5b (17 ottobre)**: copiato senza modifiche `docs/kb/GLOSSARIO_dieci-oggetti_v0.3.md` dal datastore (v0.3 approvata 2026-10-17); impronta SHA-256 `5a129742…b8cb23` uguale a quella in `VERSIONE.json`. Indice percorsi rigenerato con `build_index.py`. Nessun codice, nessuna migrazione, nessun rilascio. Verdetto USCITA-SICURA.

**S1119, PE-4 (17 ottobre)**: ADR-0044 passi 1 e 2 scritti e provati a andata e ritorno su copie del gemello: migrazione `000457` (colonna della posizione) e script fuori catena `db/scripts/pe4-passo2-*.sql` (riempimento con giornale e registro dei dubbi). **Stato intermedio dichiarato**: committati su `main` ma NON in produzione, non armati, non propagati; il passo 2 sulla produzione si lancia a mano dopo la `000457` e disattiva 164 partecipazioni (cambia la visibilità funzionale). Il passo 3 (letture) non è fatto. Copie di prova sul gemello elencate nell'esito.

**S1119, W0-D (12 ottobre)**: la rotta `PATCH /v1/users/:id/contract-level` con avviso (#265 F4) è costruita e provata sul gemello ma tolta da `main` con un revert: `sys_user_contracts` è «importato» (X-1) e nessuna rotta può scriverla. Lavoro sul ramo `f4-livello-contrattuale`. **Stato intermedio dichiarato**: serve la scelta di Enzo (riclassificare «ibrido» o tenere il livello solo da importazione). Esito in `.programmi/esiti-onda0/W0-D.md`.

**S1119, W0-A3**: esiste `python docs/kb/tools/chiudi.py` (livelli `leggero`, `onda`, `rilascio`), esito in cinque righe e registro in `.handoff/close-log.ndjson`; non propaga e non arma. Esito in `.programmi/esiti-onda0/W0-A3.md`.

**Stato intermedio dichiarato.** `000454` e `000455` sono provate sul gemello ma NON in produzione: rilascio pronto, **non armato** (gesto di Enzo). La giunzione col pacchetto del datastore è dimostrata su una copia usa-e-getta del gemello, non su produzione: quindi «in corso». Esiti: `.programmi/esiti-onda0/W0-A1.md` e `W0-A2.md`.

**W0-A2**: due ADR in stato PROPOSTO, da approvare da Enzo: `0043_separazione_dal_datastore.md` (sei regole, sostituisce in parte ADR-0039, nuovo testo di I21, sequenza S3-S6) e `0044_partecipazione_ai_processi_legata_alla_posizione.md` (tre passi con giornale). Nessun codice e nessuna migrazione scritti. La misura sul gemello mostra le partecipazioni ai processi in gran parte rimaste indietro dopo i cambi di posto.

## Top priorities

1. **Armare il deploy** di `000454`/`000455`/`000457` (decisione di Enzo, `scripts/close-propagate.sh`).
2. **#267 / #268**: approvazione di ADR-0043 e ADR-0044 e scelta sui gruppi dubbi delle partecipazioni (Enzo). Dopo l'approvazione: I21 in `CLAUDE.md` e stato di ADR-0039.
3. **#264** attende il pacchetto con ruoli, cruscotti, porte, variante pubblicata (datastore). **#265** resta l'aggancio alle modifiche di posto e riporto e la scelta sul livello contrattuale (F4 in attesa della scelta di Enzo, vedi sopra). **#263** resta il tipo delle tre date della `000454` (RD-09).
4. **#266** struttura albero RTL (WAIT-INPUT, non toccata) · **#254** apertura dei perimetri (P1, non avviata).

## Open questions

- I 57 OWNER delle partecipazioni ai processi riguardano persone non più nell'unità del processo e danno loro visibilità funzionale sulle attività: si corregge col passo 3 di ADR-0044, oppure prima con una disattivazione a parte (scelta di Enzo).
- Le copie di prova `heuresys_advanced_w0a1_prova1` e `heuresys_advanced_w0d_prova1` restano sul gemello: si tolgono su richiesta.
- Il gesto «pubblica la versione» del modello caricato è oggi dell'operatore, solo sulle copie (in attesa dello schema 0.3).

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/check_canale_cowork.py               # atteso: 0 voci aperte
python docs/kb/tools/verify_gate.py check
bash scripts/verifica-deploy.sh                            # esito dell'armamento (se armato)
```
