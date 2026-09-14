# STATE — vista rapida

*Ultimo aggiornamento: S1102 (2026-09-14, notte — mandato K, prima sessione). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

È partito il **mandato K** (`#259`: ruoli senza titolare e direzione del dato, nove decisioni di Enzo in testa, D5 rinviata).
La Fase 0 è a sei voci su sette: lo stato del mandato vive in `.programmi/K-ruoli-direzione/STATO.md` con la sua procedura di
ripresa (`tools/dove_siamo.py`), gli agenti leggono il database solo con `q.py` (provato a rifiutare, anche una scrittura
nascosta in una CTE), il modo di applicare una migrazione è scritto e provato (mig `000415`, una vista vuota di prova),
il censimento di chi sorveglia i sei oggetti è fatto con dodici agenti e le spie trovate, il baseline riproduce il dossier.
**F0.4 è SOSPESA di proposito**: la prova di ripresa consiste nel chiudere la sessione e riaprirla. Nessun ruolo,
permesso o dato di persona toccato. Rapporto per Enzo in `.programmi/K-ruoli-direzione/esiti/RAPPORTO_2026-09-14.md`.

## Top priorities

1. **`#259` — mandato K, sessione 2** (perimetro F0→F2): riprendere con la procedura R1-R2 del mandato (`git pull --ff-only`,
   `python .programmi/K-ruoli-direzione/tools/dove_siamo.py`), annotare se `.handoff/session-id` è ancora S1102, chiudere
   F0.4 (`000416` rollback per rinomina, `000417` incompleta poi vuota, K-PROVA RITIRATA), poi W1 (sei indagini, guardiano
   sotto il 50%), W2, code in linea; **fermata obbligatoria** alla chiusura di I-D: rapporto a Enzo per D5.
2. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): invariata da S1101; al prossimo rinfresco del clone
   il cancello locale `test-api` diventa rosso su ogni tocco ad `apps/api/`.
3. **`#251` → `#252`** (contatore di persone distinte, poi il ponte sulle letture): invariate da S1101.
4. **`#159` F3** e **`#198`** (le due scoperte prima di T9b): invariate.

▸ Poi: `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#149` F4 e `#79` F3 (continuativi).

## Open questions

- **D5 (mandato K)**: non è ancora da decidere — lo diventa quando I-D dice quante righe sono oggi in conflitto fra gesto
  nativo e saldo importato. La CLI non la decide in nessun caso.
- **La regola globale in `~/.claude/CLAUDE.md`** sul canale Cowork (invariata da S1101): la parte globale è tua.
- **A6 — correzioni alla skill `saas-investor-due-diligence`** (fuori repo): affidate a Cowork con te.
- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY`.
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta. Vuoi ri-loggare le due macchine?
- **Igiene fuori repo** (scratch, `webapps-*.md`, `~/scp-aside-<ts>`): mai cancellati senza il tuo sì.
- **Cowork non raggiunge più Linux via SSH** dal 2026-09-08: la prova generale delle migrazioni la fa sempre la CLI.

## Verification

```bash
python docs/kb/tools/session_start.py                        # atteso: #259 in testa alle P1, #251-#258 nel menu, CANALE [OK]
python .programmi/K-ruoli-direzione/tools/dove_siamo.py      # atteso: F0.4 e K-PROVA SOSPESA; 000415 completo · registrata · effetto PRESENTE; exit 0
python .programmi/K-ruoli-direzione/tools/q.py "delete from sys.sys_auth_roles"   # atteso: SOLO SELECT, exit 3
python docs/kb/tools/handoff_lint.py                         # atteso: 0 FAIL
python docs/kb/tools/programmi.py --verifica                 # atteso: nessun difetto
python docs/kb/tools/aggiorna_numeri_sot.py --check         # atteso: exit 0
python docs/kb/tools/db_health.py                            # atteso: tutto nei limiti (51 viste, v_prova_ripresa_k a zero)
bash scripts/verifica-deploy.sh                              # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
