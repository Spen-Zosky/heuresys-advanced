# STATE — vista rapida

*Ultimo aggiornamento: S1103 (2026-09-15, dall'1:30 alle 22:00 con due interruzioni — mandato K, seconda sessione). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Il **mandato K** (`#259`) ha chiuso le Fasi 0, 1 e 2 e si è fermato alla fermata (b) come prescritto. La prova di
ripresa ha retto sui quattro casi; le sette indagini hanno un esito con numeri ri-misurati dalla sessione (gli agenti
leggono, la sessione verifica); Enzo ha risposto a **D5 = C** e la risposta è recepita; cinque sentinelle esistono,
viste rosse su dati finti e verdi sul vivo — due sono viste in produzione (`000418`, `000419`), tre sono test.
Il cancello `test-api` è tornato verde, ma **con la cura che `#250`/`#258` escludono** (vedi domande aperte).
Rapporto non tecnico in `.programmi/K-ruoli-direzione/esiti/RAPPORTO_2026-09-15.md`; stato per voce in `STATO.md`.

## Top priorities

1. **`#259` — mandato K, Fase 3** (X-0 ADR direzione del dato + I23; K1-ADR catena del semilavorato; confutazione W3;
   poi `ATTESA_ENZO` per la ratifica). Ripresa: `git pull --ff-only`, `python .programmi/K-ruoli-direzione/tools/dove_siamo.py`.
   Gli ingredienti sono nei sette `esiti/I-*.md`; le 103 righe dubbie di I-E aspettano X-1 (F5).
2. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): è diventata **urgente**, perché il clone notturno
   cancellerà di nuovo il fattore di Enzo e il gemello tornerà rosso; la cura vera è una persona nuova, non il fattore.
3. **`#251` → `#252`** (contatore di persone distinte, poi il ponte sulle letture): invariate da S1101.
4. **`#159` F3** e **`#198`**: invariate.

▸ Poi: `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#149` F4 e `#79` F3 (continuativi).

## Open questions

- **Il fattore `derived-access` rimesso a Enzo (S1103, 21:30)**: `pnpm db:provision-access` l'ha creato in produzione e sul
  gemello leggendo la deroga #139, mentre `#250` dice che il secondo fattore di Enzo è suo. **Toglierlo subito** (una
  cancellazione, serve il tuo sì) o lasciarlo finché `#258` non porta la persona nuova?
- **Le due file scritti da agenti fuori cartella** (`tools/misura_i_b.py`, `D:temp_source_lineage.txt` alla radice) e le
  sette bozze `esiti/_bozza_*.md`: materiale grezzo, si cancella solo con il tuo sì.
- **Tuple morte 51% su `sys_position_skill_requirements`** (sonda `db_health`, fuori mandato): `VACUUM (ANALYZE)` sulla VM?
- **La regola globale in `~/.claude/CLAUDE.md`** sul canale Cowork (invariata da S1101): la parte globale è tua.
- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY`.
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta. Vuoi ri-loggare le due macchine?
- **Cowork non raggiunge più Linux via SSH** dal 2026-09-08: la prova generale delle migrazioni la fa sempre la CLI.

## Verification

```bash
python docs/kb/tools/session_start.py                        # atteso: #259 in testa alle P1 (Fase 3), #258 P1 urgente, CANALE [OK]
python .programmi/K-ruoli-direzione/tools/dove_siamo.py      # atteso: prima PRONTA = X-0 (poi K1-ADR); 000418/000419 effetto PRESENTE; exit 0
python docs/kb/tools/handoff_lint.py                         # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check         # atteso: exit 0 (000001..000419)
python docs/kb/tools/db_health.py                            # atteso: tutto nei limiti; v_permessi_solo_plenipotenziari 0; v_registro_provenienza_orfano 11 [i ]
cd apps/api && pnpm exec vitest run -c vitest.unit.config.ts controlli-per-nome   # atteso: 2 passed (baseline 102 file / 327)
bash scripts/verifica-deploy.sh                              # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
