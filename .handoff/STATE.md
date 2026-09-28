# STATE — vista rapida

*Ultimo aggiornamento: S1116 (2026-09-28). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**Eredità di S1115 chiuse**: file estraneo spostato fuori dal repo, causa di `marciume:fallito`
isolata e risolta, 5 memorie indicizzate. Poi **tutto il ciclo di governo** (P1/P2/P3 + fuori-menu)
processato: **#253** (diario del gate interrogabile da database), **#255** (scorecard due diligence
rivalidata, verdetto CONDITIONAL-GO — punteggio in `docs/due-diligence/SCORECARD.md`), **#256**
(isolamento clienti: confine sufficiente), **#257**
(nuovo `chi_ripara.py`, poi quinta famiglia USO-PRODOTTO su richiesta di Enzo), **#79** (cancello
esposizione riapplicato), **#159** F3 avviata (assistente su una pagina in più).

**Tre decisioni di Enzo eseguite**: **#262** endpoint `GET /v1/data-classification` (non deroga);
**#261** guardia di collaudo ridisegnata per distinguere la MACCHINA (hostname + porta nativa 5432)
invece del nome del database — dimostrata dal vivo sul gemello reale; **#257** quinta regola
meccanica, USO-PRODOTTO (conteggio in `docs/kb/SOT_BACKLOG.md`).

**Effetto collaterale scoperto e corretto**: il nuovo permesso di `#262` faceva fallire la catena a
ogni fresh-rebuild della CI (due checkpoint precedenti, `000255`/`000449`, non lo conoscevano) —
emendati, CI reale verificata verde.

**Incidente di governo, per onestà**: un fork delegato per l'esecuzione ha aperto 12 sub-agenti
paralleli per una sola voce (#255) — oltre quanto avrei autorizzato; registrato, non ripetere. Due
tentativi di delega sono anche falliti con 0 azioni reali (eco dello stato invece di eseguire) prima
di funzionare al terzo giro.

**Non eseguita per scelta corretta**: `#205` (serve una fonte di settore che solo Enzo approva, non
un comando mancante).

## Top priorities

1. **`#254`** (apertura di tutti i perimetri in una mossa) — P1, sbloccata (`#253` è DONE), NON
   ancora avviata: cambia il risolutore RBAC, `.programmi/254-apertura-perimetri-una-mossa.md`.
2. **`#159`** F3 — 95 pagine su 96 restano, lavoro continuo per natura.
3. **`#149`** F4 · **`#76`** F3 (prossima ondata zero-pendenze) · **`#205`** F2 (bloccata su fonte
   di settore, decisione di Enzo).

## Open questions

- Il destinatario dell'escalation quando creatore=approvatore (Z-263): decisione di prodotto,
  proporla con un'opzione sola quando si riprende quella voce.
- Il `[ERR] R24 GUARD-RAIL ASSENTE` sul CLAUDE.md **globale** segnalato al boot di S1114, mai
  verificato oltre l'osservazione.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/check_marciume.py                     # atteso: niente e' marcito
python docs/kb/tools/aggiorna_numeri_sot.py --check       # atteso: exit 0
bash scripts/verifica-deploy.sh                            # esito dell'armamento di questa sessione
```
