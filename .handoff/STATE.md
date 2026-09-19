# STATE — vista rapida

*Ultimo aggiornamento: S1104 (2026-09-19), mandato Cowork breve: collaudo del rito di guardiano + chiusura. I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Mandato Cowork a due passi, non continuazione del mandato K. Passo 1: le due copie di `guardiano.py`
(repo e `~/.claude/tools/`) risultano **identiche**, selftest tutto verde. Passo 2 (chiusura):
rilanciata la prova generale che S1112 aveva lasciato rossa senza conferma — `handoff-lint` verde,
numeri §0 di SOT_STATE ri-derivati (v. quel file). **Il "cancello ROSSO" di S1112 era il runner CI
interrotto** (`shutdown signal` / `operation was canceled` su `Test (api integration)`, non un test
fallito — nessun `✗` nel log), non un difetto: i tre fix di S1112 (headline SOT_STATE, `findApprovers`
PLATFORM_ADMIN, atlas) sono su HEAD. Rilanciato il job (`gh run rerun 35451342230 --failed`) —
**IN-VOLO**, non ancora confermato verde.

## Top priorities

1. **`#259` — mandato K**: F5 chiusa per intero (X-1..X-6, S1112). G-1/F6 **sbloccata ma non aperta**
   (il mandato stesso la dichiara ~2 sessioni, ~160k token — non iniziata per non consegnarla a metà).
   Ripresa: `git pull --ff-only`, `python .programmi/K-ruoli-direzione/tools/dove_siamo.py`.
2. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): resta urgente — il fattore
   `derived-access` di Enzo e' stato rimesso in produzione/gemello (S1103, deroga #139) come cura
   temporanea che `#250` esclude; il clone notturno lo cancellera' di nuovo.
3. **`#251` → `#252`** (contatore persone distinte, poi il ponte sulle letture): invariate.
4. **`#159` F3** e **`#198`**: invariate.

▸ Poi: `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#149` F4 e `#79` F3 (continuativi).

## Open questions

- **`sys_attendance` (X-2, mandato K)**: proposta scritta in `.programmi/K-ruoli-direzione/esiti/X-2_attendance.md`, confermata da due misure indipendenti (CLI + Cowork) — aspetta il tuo sì.
- **119.226 presenze senza provenienza (X-6, voce nuova "D12")**: spiegazione completa trovata (nessuno dei tre scrittori dichiara la provenienza), tre opzioni scritte in `esiti/X-6.md` — **non ancora in nessun registro tracciato dal menu di sessione**, lo segnalo qui perché non vada perso.
- **Il fix `findApprovers`/tenant-blueprints (R-5, S1111→S1112)**: corretto e verificato isolatamente; chiedi conferma che non abbia altre ramificazioni non ancora scoperte.
- **Le due file scritti da agenti fuori cartella** (`tools/misura_i_b.py`, `D:temp_source_lineage.txt`) e le sette bozze `esiti/_bozza_*.md`: si cancellano solo con il tuo sì.
- **Tuple morte 51% su `sys_position_skill_requirements`**: `VACUUM (ANALYZE)` sulla VM?
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta.
- **Cowork non raggiunge più Linux via SSH** dal 2026-09-08: la prova generale delle migrazioni la fa sempre la CLI.

## Verification

```bash
python docs/kb/tools/session_start.py                        # atteso: #259 in testa alle P1, #258 P1 urgente
python .programmi/K-ruoli-direzione/tools/dove_siamo.py      # stato per voce del mandato K
python docs/kb/tools/handoff_lint.py                         # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check          # atteso: exit 0
gh run view 35451342230                                       # atteso: success (rerun del "cancello ROSSO" S1112)
bash scripts/verifica-deploy.sh                               # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
