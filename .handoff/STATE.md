# STATE — vista rapida

*Ultimo aggiornamento: S1105 (2026-09-19), mandato Cowork: G-1 (mandato K, ultima voce). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Chiusa **G-1** (assegna/termina/trasferisci persona↔posizione via approvazioni, D4=B): modulo
`user-position-assignments` nuovo, migrazione 000448 (colonna `origine_dato` + permessi a
PEOPLE_MANAGER + classificazione X-1 `importato`→`ibrido`), prove verdi (incluse anti-enumerazione
sui codici HTTP giusti e una controprova che ha visto il proprio rosso vero prima di essere corretta).
Emendata 000432 (ADR-0035) e l'allowlist di S-2. **Il mandato K è ora esaurito dal lato CLI**:
`STATO.md` non ha più righe `PRONTA`, restano solo tre decisioni di Enzo (vedi sotto). Tre giri di
`verify_gate.py run` prima del verde: due rossi reali (baseline S-5 stantia, headline SOT_STATE) più
un rosso apparente dovuto a contesa con la CI reale sullo stesso runner condiviso, e infine la
scoperta che la migrazione era applicata su VM+`heuresys_ci` ma non sul DB persistente del gemello
(corretto). Dettaglio in `.programmi/K-ruoli-direzione/esiti/REGISTRO_SCOPERTE.md`.

## Top priorities

1. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): resta urgente — il fattore
   `derived-access` di Enzo è stato rimesso in produzione/gemello (S1103, deroga #139) come cura
   temporanea che `#250` esclude; il clone notturno lo cancellerà di nuovo.
2. **`#251` → `#252`** (contatore persone distinte, poi il ponte sulle letture): invariate.
3. **`#149` F4** e **`#159` F3**: invariate.

▸ Poi: `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#79` F3 (continuativi).

## Open questions

- **`#259` mandato K — tre decisioni di Enzo, nessun lavoro CLI residuo**: D11 (masking dossier DPO,
  `esiti/R-2_domanda_masking.md`), `sys_attendance` (mappatura proposta, `esiti/X-2_tabelle.md`), D12
  (completamento registro presenze, 3 opzioni, `esiti/X-6.md`). Risposte in `esiti/RISPOSTE_ENZO.md`.
- **Le due file scritti da agenti fuori cartella** (`tools/misura_i_b.py`, `D:temp_source_lineage.txt`)
  e le sette bozze `esiti/_bozza_*.md`: si cancellano solo con il tuo sì.
- **Tuple morte, tabella variabile** (S1112: `sys_position_skill_requirements`; S1105: nessuna nuova
  segnalata) — manutenzione ordinaria, non urgente.
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta.
- **Cowork non raggiunge più Linux via SSH** dal 2026-09-08: la prova generale delle migrazioni la fa
  sempre la CLI.
- **Il runner CI self-hosted è condiviso** fra la CI reale e le prove manuali (`prova-api-sul-gemello.sh`):
  misurato di nuovo in questa sessione (CI cancellata per timeout 25 min mentre giravano insieme) —
  stessa proposta di S1107 mai decisa.

## Verification

```bash
python docs/kb/tools/session_start.py                        # atteso: #259 in WAIT-INPUT, non più P1 attivo
python .programmi/K-ruoli-direzione/tools/dove_siamo.py      # atteso: nessuna PRONTA, 3 ATTESA_ENZO
python docs/kb/tools/handoff_lint.py                         # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check          # atteso: exit 0
bash scripts/verifica-deploy.sh                               # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
