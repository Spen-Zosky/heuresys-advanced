# STATE — vista rapida

> Priorità e domande aperte. I numeri (versioni, conteggi, architettura) stanno in
> `docs/kb/SOT_STATE.md`, che è l'altra metà e non ripete niente di quanto è scritto qui.

## Last session brief — l'ultima sessione, in breve

**S1074 — la ricerca legge il web davvero.** `#132` è arrivata al suo confine: F4, F5 e F6
chiuse, F7 ferma su una decisione di Enzo. Una corsa vera ha aperto **otto pagine della Banca
d'Italia** e ne ha ricavato una proposta approvabile, con indirizzo, data e impronta di ciò che
ha letto. I cinque domini di contenuto sono dichiarati, e il motore non è cambiato di una riga
per farli entrare — era la prova che il contratto reggeva.

Il filo della sessione: **le cose migliori le ha trovate ciò che prova, non ciò che ragiona.**
La prima corsa vera ha acceso un allarme *sbagliato* (la sentinella protestava per una fonte che
il registro non poteva ancora contenere); il primo test del ponte ha scoperto che le proposte di
fonti approvate **bloccavano il ponte**, perché nessuno le applicava da nessuna parte; e la prova
generale ha fermato quattro post-condizioni che contavano cinque tabelle dove ne restavano
quattro — una per volta, come dice il metodo.

## Top priorities — le priorità

1. **`#132` F7 — le due prove.** ⏸ **Aspetta te, e per una cosa sola**: approvare la prima fonte.
   I cinque domini confrontano le fonti col registro, il registro è vuoto, e riempirlo è una
   decisione di business (tua richiesta del 2026-08-05). La corsa di F4h ha già lasciato una
   proposta `PASSED` — Banca d'Italia, istituzionale, due evidenze con impronta. Decisa e
   applicata, i domini diventano ricercabili e F7 può girare.
   → `.programmi/132-ricerca-genera-il-modello.md` · ~1 sessione dopo lo sblocco
2. **`#219` F1 — le due firme che potrebbero non essere guasti.** Corta, e va per prima fra le
   secondarie: MFA e il test che riceve 400 tolgono 3 casi su 12 senza toccare il prodotto.
   → `.programmi/219-otto-guasti-suite-e2e.md`
3. **`#198` T9b — la costruzione in produzione.** Resta dietro a `#132` F7: il modello ancorato
   è ancora vuoto, e l'atto si rifiuta invece di costruire una quarta banca. Si sblocca quando
   una ricerca di contenuto è stata approvata e applicata.

## Open questions — le domande aperte

1. **Il fornitore di proposte non è configurato in produzione.** La corsa di S1074 è girata
   passando le due variabili a mano (`RESEARCH_GATEWAY_URL` / `RESEARCH_GATEWAY_TOKEN`) e
   avviando il gateway per l'occasione. Perché una corsa parta **dall'API**, quelle due vanno
   nel `.env` — che è tuo, non mio. Finché mancano, l'API dice «non c'è chi propone» invece di
   fingere una corsa vuota, ed è il comportamento voluto.
2. **La ricerca è prudente: 1 proposta su 8 pagine lette** (primo giro, dominio delle fonti). Il
   numero si scrive qualunque sia (epica §8.2) e questo è il primo. Va guardato di nuovo dopo la
   prima corsa su un dominio di contenuto: se resta così basso, il collo di bottiglia non è il
   motore ma quante pagine gli si fanno aprire.
3. **La suite E2E non entra in CI**, per criterio dichiarato in `#211` F4: dura ~25 minuti su un
   runner che ne impiega già ~20 per la suite API. Entra quando `#219` porta i falliti a zero.

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py          # menu + salute, un giro solo
python docs/kb/tools/guardiano.py              # contesto e finestra 5h, misurati
python docs/kb/tools/db_health.py              # le sentinelle, che devono stare a zero
bash scripts/verifica-deploy.sh                # com'è finita in produzione
```
