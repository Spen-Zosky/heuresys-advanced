# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1087 (2026-09-05). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief — l'ultima sessione, in breve

Sessione in delega totale. Il filo conduttore, trovato e non cercato: **tre volte in un giorno la
causa vera stava in un artefatto generato** — quindi gitignored, e invisibile a qualunque ricerca
nel codice. È così che la suite E2E ha resistito a tre sessioni di diagnosi: una porta cablata nel
manifest compilato del proxy, un `.next` servito da un server non riavviato, e il bundle dell'API
costruito due giorni prima degli spec che lo interrogavano. Le spiegazioni precedenti — il job
notturno che satura la VM, il tunnel SSH — erano ragionevoli e sbagliate.

Chiusi tutti e otto i punti non verdi dell'avvio, fra cui **tre servizi fermi in produzione** che il
boot non poteva vedere: sotto ce n'erano **cinque guasti in fila**, ognuno nascosto dal precedente.

## Top priorities — le priorita'

1. **`#219` F5e — la corsa di conferma** (~1 sessione). L'ambiente è ora coerente e la prima fase è
   verde piena, dove prima cadeva sui setup e trascinava con sé quasi tutta la suite. ⚠ Va lanciata **a macchina
   scarica**: il gemello è anche il runner della CI, e il triage dei 44 restanti è già su disco
   (`.programmi/219-triage-2026-09-05.txt`).
2. **`#54` F3 — le quattro fette che restano** (~2 sessioni). Tre fette su sette fatte oggi, tutte
   con i loro test verdi; il pattern è rodato e le prossime costano meno della prima.
3. **`#246` — i 25 contratti a termine senza scadenza** (~1 sessione). Nessuna sentinella li vede,
   e non per svista: la vista cerca chi non ha più un contratto, e uno senza fine è in vigore per
   sempre.

## Open questions — le domande aperte

- ⭐ **Da quali fonti la piattaforma accetta di imparare com'è fatta un'azienda?** — le unità
  organizzative, le posizioni, le competenze, gli indicatori. Oggi il registro delle fonti ne porta
  **una sola**, sul dominio dei processi aziendali. Tre voci ferme su questa domanda sola (`#198`, `#205`,
  il ponte di `#132`), ora entrambe in `WAIT-INPUT`. Non è una misura: è cosa Heuresys accetta come
  sapere, e i piani vietano di scriverlo a mano.
- **`#246`: i 25 `fixed_term` senza data sono a tempo indeterminato col tipo sbagliato, o manca la
  data?** Le due letture producono esattamente le stesse righe — il database non può distinguerle.
- **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082.
- ✅ *Chiusa*: «di chi è la porta 3001?» — **di nessuno**. Era solo un ripiego cablato, scritto in
  tre posti diversi.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py       # menu + salute, un solo giro
bash scripts/verifica-deploy.sh             # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
python docs/kb/tools/check_marciume.py      # deve dire «niente e' marcito»
ssh linux-pc 'cat /proc/loadavg'            # prima di ogni corsa E2E: sotto 2, o i rossi non sono attribuibili
cd apps/web && node scripts/e2e-blocchi.mjs --solo-preflight   # 0 = l'ambiente e' quello che la suite presume
```
