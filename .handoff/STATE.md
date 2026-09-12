# STATE — vista rapida

*Ultimo aggiornamento: S1097 (2026-09-12, sera). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Mandato di Enzo: tutte le corsie P1→P3, `#198`, `#41`, i HOLD e i fuori registro, in autonomia
col solo guardiano della capienza. Registro in `.programmi/S1097-mandato-tutte-le-corsie.md`:
**dodici voci su sedici**, una parziale. La coda dell'agente aveva in testa un falso neutro
(`candidates` sotto un permesso condiviso: escluso, poi quattordicesimo perimetro `job-roles`);
il registro di eccezione delle valutazioni è entrato nel prodotto; `#232` e `#233` chiuse, `#41`
WON'T-DO per misura, `#76` riattivata dopo la verifica di tutti i 216 cluster (153 validi =
974 h); la fase «indirizzi» della ricerca ora legge le mappe dei siti, ma la corsa non è stata
eseguita. Non fatte per capienza: `#159` F2, `#205` F3, `#198` T9b.

## Top priorities

1. **`#159` F2 — il componente del ponte in `ux-design-shared`** (~250k): il repo è **libero**
   (misurato: la sessione registrata era un pid riusato) e la capienza a inizio sessione è piena.
2. **`#205` F2 — la corsa su `positions`** con la fase «indirizzi» che ora legge le mappe dei
   siti: una corsa con `percorri-dominio.mts` (modello su Windows, API+lettore sul gemello via
   `ssh -R 8790`) e leggere `fonti` nell'esito. Se produce, `#205` F3 e `#198` T9b si sbloccano.
3. **`#76` F2 — riportare i 59 verdetti nel piano** zero-pendenze (49 già fatti, 10 superati) e
   ri-contare con `zp_state.py piano` prima di qualunque ondata.

▸ Poi: `#214` F6 (coda ri-derivata: 22 neutri, i prossimi sono a 1 pagina) · `#149` F4 e `#79` F3
(continuativi, oggi verdi) · `#240` e `#250` aspettano un tuo sì.

## Open questions

- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY`.
- **`#240`**: sì o no alla rimozione dei due worktree `gov/w1` `gov/w2` (contenuto superato da main).
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta (S1096): senza, la corsa di
  `#205` gira solo col modello su Windows. Vuoi ri-loggare le due macchine?
- **Igiene fuori repo**: `C:\Git\` porta ~29 log di sessioni CLI e
  `.handoff/session-journal.recovered.ndjson` del 6 settembre è già consolidato. Mai cancellati
  senza il tuo sì.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/aggiorna_numeri_sot.py --check         # atteso: exit 0 (§0 allineata)
python docs/kb/tools/check_concetti_agente.py               # atteso: 14 aperti · 41 in coda
python docs/kb/tools/lab_inbox.py --selftest                 # 6/6
python docs/kb/tools/check_exposure.py                       # 0 lacune
cd apps/api && pnpm exec vitest run -c vitest.unit.config.ts test/unit/research-mappa-del-sito.unit.test.ts   # 8/8
bash scripts/verifica-deploy.sh                              # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
