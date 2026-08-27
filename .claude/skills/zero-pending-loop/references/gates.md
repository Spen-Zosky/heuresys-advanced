# Gate — quali controlli servono, e perche' non si lancia tutto

## Il principio

I gate si derivano dallo **scope reale toccato**, non da una lista fissa:

```bash
git diff --name-only HEAD
git status --short
```

Due ragioni per non lanciare sempre tutta la suite. La prima e' il costo: la suite E2E completa richiede un build di produzione, e ripetuta su tutta la fila di cluster che il piano contiene e' una spesa che non compra informazione. La seconda e' peggiore — quando lanci tutto, nessuno sa piu' quale controllo stava proteggendo cosa, e un gate che nessuno capisce e' un gate che verra' disattivato la prima volta che rompe.

`zp_gate.py` fa la derivazione e l'esecuzione. Se il diff tocca un'area **senza** gate mappato in `zp.config.yaml`, si ferma con errore: e' un'area di cui nessuno ha deciso come verificare le modifiche, e proseguire significherebbe committare senza sapere cosa si e' rotto.

## La matrice

| Area toccata | Gate |
|---|---|
| `apps/api/**` | `pnpm typecheck` · `pnpm lint` · vitest sui file toccati **e** sui moduli dipendenti · integration su DB reale (tunnel :5433) |
| `apps/web/**` | `pnpm typecheck` · `pnpm lint` · `pnpm i18n:check` · Playwright sulle spec pertinenti |
| `packages/shared/**` | `typecheck` a monte + rebuild dei consumer (`api`, `web`, `showcase`) |
| `db/migrations/**` | **`bash db/scripts/prova-idempotenza.sh`** — catena ×2 + 26 sentinelle **sul gemello, su una copia usa-e-getta** (~13 s) · **`pnpm db:validate:vm`** (7 viste + twice-run proof, ~20 s). ⚠ **MAI `pnpm db:migrate` né `pnpm db:validate` da questa macchina** — vedi il riquadro sotto |
| `db/seeds/**`, `db/scripts/**` | seed idempotente eseguito due volte · **`pnpm db:validate:vm`** |
| `scripts/**`, `deploy/**` | lint shell + dry-run del percorso modificato |
| `docs/kb/**` | `python docs/kb/tools/handoff_lint.py` (10 check, bloccante) |
| `packages/shared/package.json` (subpath exports) | `typecheck` di tutti i consumer + import risolto a runtime |

## ⭐ Un lavoro sul database si esegue DOVE IL DATABASE VIVE (Enzo, 2026-08-27)

*«Non deve più accadere in nessun caso e in nessun controllo.»*

Il database **non sta su questa macchina**: da qui ogni istruzione attraversa un tunnel SSH fino
alla VM. Per una manciata di letture non pesa; per un controllo che ne fa migliaia diventa
un'altra cosa. Misurato lo stesso giorno, **stesso comando e stesso esito**:

| controllo | da qui, via tunnel | dove il DB è locale |
|---|---|---|
| catena di migrazioni ×2 | **~80 min** ciascuna | **17 s** (VM) · **13 s** su copia (gemello) |
| `db:validate` | **>10 min, non ha finito** | **20 s** |
| un file di test API | 83 s | 14 s |

**In un loop non presidiato come questo, quelle ore le perde una corsa che nessuno sta
guardando** — e un controllo che nessuno aspetta è un controllo che si finisce per saltare.

Comandi da usare: **`bash db/scripts/prova-idempotenza.sh`** (catena ×2 + sentinelle sul gemello)
· **`pnpm db:validate:vm`** · **`pnpm test:api:vm`** · **`pnpm db:migrate:vm`** (applica alla
produzione, sulla VM) · in generale **`bash db/scripts/sul-gemello.sh '<comando>'`**.

Tutti escono **rossi** se l'host non risponde, e **non ripiegano qui**: ripiegare rimetterebbe il
lavoro sul tunnel, cioè il difetto che esistono per togliere.

## Trappole verificate del repo — non ri-diagnosticarle

**Playwright e Node ≥23 (D-36).** Su un host con Node 24 — cioe' Windows — Playwright 1.61 crasha all'import. Usa `pnpm test:e2e:prod:node22` (o `test:e2e:node22`), che gira sotto un Node 22 portabile e fa passthrough su Node ≤22, quindi CI e VM non ne sono toccate. Se vedi un crash all'import di Playwright, questa e' la causa: non indagare.

**`test:e2e` vs `test:e2e:prod`.** La configurazione dev serve all'iterazione su una singola spec perche' le sessioni di auth vivono 15 minuti. L'unica modalita' supportata per la suite intera e' `test:e2e:prod` (D-24).

**Vitest gira singleThread** e condivide un pool DB. Ogni file di test gira in **una** transazione reale che viene rollbackata alla fine (D-52): `now()` e' congelato per file, e le fixture create in `beforeAll` vengono annullate anche loro. Se un test sembra non vedere dati che hai appena inserito, e' quasi sempre questo.

**Il tunnel deve essere su.** I test colpiscono il DB reale della VM. Nessun mock, da nessuna parte.

**`$ErrorActionPreference = "Stop"` in PowerShell** tratta qualunque riga su stderr di un eseguibile nativo (`pg_dump`, `git`, `ssh`) come errore terminante, anche quando e' informativa e l'exit code sarebbe 0. Nei blocchi che invocano eseguibili chiacchieroni usa `Continue` e verifica `$LASTEXITCODE`, non `try/catch`.

## Gate rosso: si corregge, non si aggira

Un gate rosso e' un errore da correggere (R3), incluso il caso in cui l'errore preesisteva o l'ha introdotto qualcun altro. Non esiste «non l'ho fatto io»: il repo va lasciato in stato migliore, e in un progetto con un solo contributore la distinzione non ha nemmeno senso.

Non aggiungere mai `--no-verify` per far passare un hook. Se un hook fallisce, la cosa da capire e' perche' — l'hook e' l'unica cosa che sta guardando in quel momento.

Se un gate rosso non appartiene al cluster corrente e correggerlo lo farebbe esplodere di scope, allargare lo scope e' preferibile a lasciarlo rosso: dichiaralo nel commit message. Se e' davvero troppo grande, diventa un cluster a se' con `blocking: HARD`, e ha la priorita' al giro successivo.

## Prima del push

Nell'ordine, come fa `handoff`: gate verdi → `handoff_lint.py` verde → `git pull --rebase origin main` → **ri-esegui `handoff_lint.py`** (il rebase puo' aver portato dentro lo stato di un'altra sessione) → push. Su conflitto in `STATE.md` o nel register, la risoluzione fa parte del lavoro: si uniscono i fatti delle due sessioni, mai `-X ours` o `-X theirs` alla cieca.
