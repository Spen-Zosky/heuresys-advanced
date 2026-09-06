# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1088 (2026-09-06). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief — l'ultima sessione, in breve

Il filo conduttore: **la firma di un errore non è la sua causa**. Quarantadue casi rossi che
tre sessioni avevano attribuito ai permessi erano l'API che rifiutava **l'indirizzo da cui
il browser dei test le parlava** — e le due cose rispondono con lo stesso codice, quindi
nessuno le aveva distinte. La suite E2E è passata da 42 falliti a **zero**, la prima volta
da quando `#219` esiste.

Sono cadute **cinque** spiegazioni precedenti, tutte plausibili: il job notturno della VM,
il tunnel, l'API spenta, il bundle vecchio, i permessi. E ne è caduta una **mia**, nello
stesso giorno: avevo dichiarato che cinque casi «passavano da soli» usando un comando che
li **saltava in silenzio** — cioè il difetto per cui quella voce esiste.

Chiusa anche `#246`: un terzo dell'organico della banca risultava a tempo determinato, e
applicando la regola di Enzo **nessuno dei 51 era ammissibile**. Produzione bonificata, due
sentinelle a presidio, provate rosse.

## Top priorities — le priorità

1. **`#219` — il passaggio in CI** (~1 sessione). È l'unica metà non chiusa del criterio di
   `#211` F4, e ha **tre ostacoli misurati**: la CI esegue solo lo smoke, ha un tetto di 30
   minuti contro i ~35 della corsa, e usa `heuresys_ci`, che non ha i dati su cui la suite è
   tarata. Va scelto quale dei tre cammini prendere — dichiarato in `.programmi/219-*`.
2. **`#248` — le credenziali git di questa macchina** (~10 minuti tuoi, `WAIT-INPUT`).
   Bloccano ogni push e ogni armamento del deploy da Windows, e il guasto **si pianta in
   silenzio** invece di fallire. Aggirato oggi passando dal gemello.
3. **`#54` F3 — le quattro fette che restano** (~2 sessioni). Pattern rodato.

## Open questions — le domande aperte

- ⭐ **Da quali fonti la piattaforma accetta di imparare com'è fatta un'azienda?** — Il
  registro ne porta **una sola**. Tre voci ferme qui (`#198`, `#205`, il ponte di `#132`).
  Non è una misura: è cosa Heuresys accetta come sapere.
- **La ricerca semantica sul gemello ora è accesa**, e ogni corsa integrale costa **due
  chiamate a pagamento** al fornitore di embedding. Va bene, o la si rispegne lì?
- ⚠ **Una chiave API è transitata nell'output di un comando** durante la diagnosi di oggi
  (non scritta in alcun file). Quella del fornitore di embedding è da ruotare, per prudenza.
- **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py       # menu + salute, un solo giro
bash scripts/verifica-deploy.sh             # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
ssh linux-pc 'cat /proc/loadavg'            # prima di ogni corsa E2E: sotto 2, o i rossi non sono attribuibili
cd apps/web && node scripts/e2e-blocchi.mjs --solo-preflight   # 0 = l'ambiente e' quello che la suite presume
cd apps/web && node scripts/e2e-triage.mjs --dettaglio 1       # i falliti raggruppati per firma
```
