# STATE — vista rapida

*Ultimo aggiornamento: S1106 (2026-09-23), giro di governo Cowork: R-0b (mandato K, voce nuova). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Chiusa **R-0b**: le porte che R-0 (2026-09-16) aveva lasciato deliberatamente scollegate, con
la condizione scritta per riaprirle — «il giorno in cui R-5/R-8/R-9 concedono uno di quei
permessi a un ruolo assegnato». Quel giorno è arrivato (`PLATFORM_ASSIGNED_MANDATE_ROLES` non è
più vuoto). Misurato sul vivo: `tenant-blueprints` era già collegata (fatta da R-5/R-8, nessuna
azione); `tenant-materialization` resta chiusa per costruzione (solo `PLATFORM_ADMIN` detiene il
permesso); `observability` collegata da questa sessione (`tenantFleet`/`auditFeed` →
`perimetroClienti`, prova TDD rosso→verde in `observability.integration.test.ts`).
La quarta, `content-blueprint-links`, resta **debito dichiarato per decisione di Enzo**
(2026-09-23): il costo di estendere `ScopeFilter` (condiviso con `content`/`media-service`)
non si paga isolato — condizione di riapertura scritta in
`esiti/RISPOSTE_ENZO.md` e `.programmi/K-ruoli-direzione/esiti/R-0b.md`. `verify_gate.py run`
GREEN due volte (piena dopo il codice, solo `programmi` dopo il commit di sola documentazione).
Il mandato K torna esaurito lato CLI: restano solo le stesse tre decisioni di prodotto di Enzo
già note (D11, `sys_attendance`, D12), nessuna voce `PRONTA` in `.programmi/K-ruoli-direzione/STATO.md`.

## Top priorities

1. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): invariata — non
   toccata in questa sessione, resta urgente per la stessa ragione (`derived-access` di Enzo
   rimesso in produzione/gemello come cura temporanea che `#250` esclude).
2. **`#251` → `#252`** (contatore persone distinte, poi il ponte sulle letture): invariate.
3. **`#149` F4** e **`#159` F3**: invariate.

▸ Poi: `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#79` F3 (continuativi).

## Open questions

- **`#259` mandato K — tre decisioni di Enzo, nessun lavoro CLI residuo**: D11 (masking dossier DPO,
  `esiti/R-2_domanda_masking.md`), `sys_attendance` (mappatura proposta, `esiti/X-2_tabelle.md`), D12
  (completamento registro presenze, 3 opzioni, `esiti/X-6.md`). Risposte in `esiti/RISPOSTE_ENZO.md`.
- **Le due file scritti da agenti fuori cartella** (`tools/misura_i_b.py`, `D:temp_source_lineage.txt`)
  e le sette bozze `esiti/_bozza_*.md`: si cancellano solo con il tuo sì.
- **Due file non tracciati, lavoro in corso di Enzo, non toccarli**: `scripts/align-claude-ecosystem.sh`
  (modificato) e `scripts/align-codex-ecosystem.sh` (nuovo), 22 notte — restano intoccati anche in
  questa chiusura.
- **Tuple morte, tabella variabile** — manutenzione ordinaria, non urgente.
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta.
- **Il runner CI self-hosted è condiviso** fra la CI reale e le prove manuali: proposta mai decisa.

## Verification

```bash
python docs/kb/tools/session_start.py                        # atteso: #259 in WAIT-INPUT, nessun P1 nuovo
python .programmi/K-ruoli-direzione/tools/dove_siamo.py      # atteso: nessuna PRONTA, 2 ATTESA_ENZO (D11, D12)
python docs/kb/tools/handoff_lint.py                         # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check          # atteso: exit 0
bash scripts/verifica-deploy.sh                               # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
