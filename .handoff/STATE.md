# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1085 (2026-08-31). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief — l'ultima sessione, in breve

Batch delegato da Enzo: «consuma tutte le voci di P1, P2 e P3». **Sei voci chiuse** e quattro
migrazioni in produzione. Il filo conduttore, non cercato: quasi tutti i rossi di partenza erano
**falsi allarmi** — un clone in corso scambiato per guasto, un tunnel degradato scambiato per database
irraggiungibile, un atlante superato, uno strumento che bocciava un login sano. Tre voci risultavano
eseguibili e non lo erano: la loro corsia è stata corretta.

La ricerca del Tenant Builder **funziona e ascolta l'azienda**: alla banca propone Banca d'Italia e
Consob, a una società di consulenza la sua associazione di categoria — zero fonti in comune.

## Top priorities — le priorita'

1. **`#219` — il triage dei 42 falliti della suite E2E** (~1-2 sessioni). Due corse integrali hanno
   raggiunto per la prima volta 4 fasi su 4 (`327 · 42 · 78`). La causa dominante sono **403 sulle
   scritture**, ma prima va tolto un difetto dell'impianto: la corsa parla con **due API diverse**
   (proxy su `:8013`, test su `:3001`). Finché è così, nessun 403 è interpretabile.
2. **`#239` — il nome del cliente può rendere la ricerca impossibile** (~1 sessione). Un'azienda che
   si chiama come il proprio settore non può essere cercata: la guardia §4.5 confonde il nome col
   dominio. Trovato eseguendo le prove di `#132`.
3. **`#227` F4 è chiusa, `#132` è chiusa**: le due voci grandi del Tenant Builder e del grafo
   competenze non sono più in coda. Restano `#143`, `#54`, `#159`, `#50` — tutte multi-sessione.

## Open questions — le domande aperte

- **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082.
- **I due fascicoli di prova in produzione**: `PROVA-F7-CONSULENZA` va rimosso (vuoto, e il suo nome
  inquina la guardia); `PROVA-F7-ALFA` è la prova di `#132` F7 — si tiene o si rimuove?
- **`#198` e `#205`** sono `GATED` su `#132`, che ora è chiusa: la prossima sessione verifichi se il
  blocco è caduto (le quattro tabelle del contenuto erano 0/0/0/0).

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py     # menu + salute, un solo giro
bash scripts/verifica-deploy.sh           # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
python docs/kb/tools/check_marciume.py    # deve dire «niente e' marcito»
```
