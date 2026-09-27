# STATE — vista rapida

*Ultimo aggiornamento: S1115 (2026-09-27), governo del canale + ciclo 4 quasi completo. I numeri
stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**Governo del canale preso** (era libero) e tenuto per l'intera sessione: 12 approvazioni RTL Bank
ferme dal 3 giugno approvate dal vivo su decisione di Enzo, causa trovata e registrata (**Z-263**:
`runApprovalSla` scala al creatore, che qui coincide con l'approvatore — escalation inutile).

**Ciclo 4: la maggioranza delle voci chiusa.** `#76-F3`/**Z-123** (nuovo test che il boot dell'API usi
davvero il loader RBAC con retry, rilievi adversarial corretti); **`#260`** (chiave di collaudo
allineata sul gemello, era già cambiata da un riavvio non registrato). **`#253`** non affrontata,
resta aperta.

**Trovato e corretto il vero collo di bottiglia della CI**: fallimenti identici e ripetuti di `Test
(api integration)` sembravano un problema di rete di casa (coincidenza reale, verificata e poi
esclusa). La causa vera: la suite è cresciuta parecchio nel tempo (conteggio in SOT_STATE) e i run
sani vivevano già vicinissimi al tetto del job. Tetto alzato (deciso da Enzo). CI verde dopo.

**Nuova scoperta, non risolta**: il cancello locale (`verify_gate.py`) è rosso da Windows per un
deposito TOTP di collaudo stantio (`platform-test-admin@collaudo.invalid`), non per il lavoro di
stanotte — vedi `#261`.

**Correzione di metodo registrata in memoria**: davanti a un blocco del guardiano su un segreto, ho
delegato a Enzo troppo presto invece di provare uno script su file (che ha funzionato). Non ripetere.

## Top priorities

1. **`#253`** (il diario del gate diventa interrogabile) — P2, ~1 sessione, ultima voce del ciclo 4.
2. **`#261`** (deposito TOTP di collaudo stantio su Windows) — P2, breve indagine + un comando.
3. **`#254`** (apertura di tutti i perimetri) — resta GATED sul solo `#253`.

Poi, invariata: `#149` F4 · `#159` F3 · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 (chiusa via
Z-123, la voce madre `#76` piano zero-pendenze resta aperta per le altre ondate) · `#79` F3.

## Open questions

- Il destinatario dell'escalation quando creatore=approvatore (Z-263): decisione di prodotto di
  Enzo, non tecnica — proporgliela con un'opzione sola quando si riprende quella voce.
- `#261`: quale comando rideposita il segreto TOTP di un'identità `@collaudo.invalid` su una macchina
  — non ancora indagato.
- Il `[ERR] R24 GUARD-RAIL ASSENTE` sul CLAUDE.md **globale** segnalato al boot di S1114, mai
  verificato oltre l'osservazione.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check       # atteso: exit 0
python docs/kb/tools/verify_gate.py check                 # atteso: rosso su test-api (#261, non nuovo)
bash scripts/verifica-deploy.sh                            # esito dell'armamento di questa sessione
```
