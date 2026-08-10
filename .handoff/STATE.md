# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-10 (S1053 chiusura serale — batch P1 chiuso 8/8).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1053, seconda parte)

**Il batch «#124 + P1» scelto da Enzo è chiuso 8/8** (piano R24 con prove per voce:
`docs/superpowers/plans/2026-08-10-batch-p1-s1053.md`). I fatti che contano: la falla del
dossier (buste/stipendi/valutazioni al platform senza mask) è chiusa e provata a due attori;
l'anagrafica del dossier è spaccata in professionale/privata per sezione; il mask copre tutta
la superficie COMPENSATION; cancellare una persona non cancella più le sue approvazioni
(tombstone + sentinella); ADR-0036 formalizza i domini (I16-I20 riscritti + I22); il ciclo di
valutazione è a 3/7 (548 review e 35 calibrazioni reali leggibili con orgGate+mask).
**#149 ha morso**: 6 affermazioni su 10 dei doc lab smentite dalla ri-misura, register
stantio su #92 (2 passi già fatti) e #177 (già implementato al 90%).

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **#183 policy di cancellazione utente** (~1 sessione, **P1**) — mandato di Enzo 2026-08-10:
   «la voglio nel prossimo ciclo». Censimento già in mig `000303`.
2. ✅ **Il freno del cancello è TOLTO (S1054, 2026-08-11)** — non ri-aprire questa voce. Misura
   integrale su `aba41ec5`: typecheck + lint + **test-api verde, 225/225 file, 1544 test**, e i
   ≥50 file rossi del 10/08 passano tutti. Scoperto e chiuso nel farlo: `run` a working tree
   pulito **non esegue nulla** e scriveva `green` (era il motivo per cui il freno pareva
   impossibile da togliere) → ora scrive `not-measured`, e c'è `run --suite NOME` per chiedere
   una misura fuori dal routing. Dettaglio e prove:
   `docs/superpowers/plans/2026-08-11-cancello-verifica-s1054.md`.
3. **#124 residuo**: D4 (mask EVALUATION su ~12 moduli — prima il censimento campo-giudizio
   per schema) e D6 (frontend masked esteso). · **#92 passi 4-5** (macchina a stati +
   ESS /v1/me) — rilievo aperto: mapping RBAC più largo del disegno.
4. **#99 F4** (resolver sull'albero delle unità) — attenzione al contro-oracolo: dopo F4
   resolver e `org-actors` girerebbero sullo stesso albero. · **Z-251** (~2h, classe D:
   serve autorizzazione per lotto) — attenzione al criterio: l'11/08 la corsa integrale è
   verde **senza aver corretto niente**, quindi «una corsa verde» non può essere la prova
   che il difetto è risolto (misura nel blocco Z-251). · **#181** (~2-3h) drift-check: correzioni
   in main via `27c6025d` ma MAI provate — far girare la suite prima di toccarle.

## Open questions

- **#182 — i due rami recuperati** (473 righe mai in main, 317 = versante E2E di Z-112):
  istruire e portare in main, o archiviare dichiarandolo?
- **Il ruolo di database `gov_worker`**: si revoca o resta? (read-only; lo script che lo
  ricreava non esiste più.)

## Verification

```bash
python docs/kb/tools/session_start.py                       # menu + salute, un giro
bash scripts/test/zp-review-tests.sh                        # verdetti su disco (20 prove)
bash db/scripts/storia36.sh custodia                        # custodia con ST-CASCADE #168
python docs/kb/tools/verifica_incrociata.py --famiglia X10  # sentinella F3 (X10c)
cd apps/api && pnpm exec vitest run test/user-dossier-mask.integration.test.ts test/compensation-residual-mask.integration.test.ts
```
