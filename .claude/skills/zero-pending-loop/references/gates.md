# Gate — quali controlli servono, e perche' non si lancia tutto

## Il principio

I gate si derivano dallo **scope reale toccato**, non da una lista fissa:

```bash
git diff --name-only HEAD
git status --short
```

Due ragioni per non lanciare sempre tutta la suite. La prima e' il costo: la suite E2E completa
richiede un build di produzione, e su 218 cluster e' una spesa che non compra informazione. La
seconda e' peggiore — quando lanci tutto, nessuno sa piu' quale controllo stava proteggendo cosa, e
un gate che nessuno capisce e' un gate che verra' disattivato la prima volta che rompe.

`zp_gate.py` fa la derivazione e l'esecuzione. Se il diff tocca un'area **senza** gate mappato in
`zp.config.yaml`, si ferma con errore: e' un'area di cui nessuno ha deciso come verificare le
modifiche, e proseguire significherebbe committare senza sapere cosa si e' rotto.

## La matrice

| Area toccata | Gate |
|---|---|
| `apps/api/**` | `pnpm typecheck` · `pnpm lint` · vitest sui file toccati **e** sui moduli dipendenti · integration su DB reale (tunnel :5433) |
| `apps/web/**` | `pnpm typecheck` · `pnpm lint` · `pnpm i18n:check` · Playwright sulle spec pertinenti |
| `packages/shared/**` | `typecheck` a monte + rebuild dei consumer (`api`, `web`, `showcase`) |
| `db/migrations/**` | `pnpm db:migrate` due volte con diff `pg_dump` vuoto · `pnpm db:validate` (7 viste) |
| `db/seeds/**`, `db/scripts/**` | seed idempotente eseguito due volte · `db:validate` |
| `scripts/**`, `deploy/**` | lint shell + dry-run del percorso modificato |
| `docs/kb/**` | `python docs/kb/tools/handoff_lint.py` (10 check, bloccante) |
| `packages/shared/package.json` (subpath exports) | `typecheck` di tutti i consumer + import risolto a runtime |

## Trappole verificate del repo — non ri-diagnosticarle

**Playwright e Node ≥23 (D-36).** Su un host con Node 24 — cioe' Windows — Playwright 1.61 crasha
all'import. Usa `pnpm test:e2e:prod:node22` (o `test:e2e:node22`), che gira sotto un Node 22
portabile e fa passthrough su Node ≤22, quindi CI e VM non ne sono toccate. Se vedi un crash
all'import di Playwright, questa e' la causa: non indagare.

**`test:e2e` vs `test:e2e:prod`.** La configurazione dev serve all'iterazione su una singola spec
perche' le sessioni di auth vivono 15 minuti. L'unica modalita' supportata per la suite intera e'
`test:e2e:prod` (D-24).

**Vitest gira singleThread** e condivide un pool DB. Ogni file di test gira in **una** transazione
reale che viene rollbackata alla fine (D-52): `now()` e' congelato per file, e le fixture create in
`beforeAll` vengono annullate anche loro. Se un test sembra non vedere dati che hai appena
inserito, e' quasi sempre questo.

**Il tunnel deve essere su.** I test colpiscono il DB reale della VM. Nessun mock, da nessuna parte.

**`$ErrorActionPreference = "Stop"` in PowerShell** tratta qualunque riga su stderr di un
eseguibile nativo (`pg_dump`, `git`, `ssh`) come errore terminante, anche quando e' informativa e
l'exit code sarebbe 0. Nei blocchi che invocano eseguibili chiacchieroni usa `Continue` e verifica
`$LASTEXITCODE`, non `try/catch`.

## Gate rosso: si corregge, non si aggira

Un gate rosso e' un errore da correggere (R3), incluso il caso in cui l'errore preesisteva o l'ha
introdotto qualcun altro. Non esiste «non l'ho fatto io»: il repo va lasciato in stato migliore, e
in un progetto con un solo contributore la distinzione non ha nemmeno senso.

Non aggiungere mai `--no-verify` per far passare un hook. Se un hook fallisce, la cosa da capire e'
perche' — l'hook e' l'unica cosa che sta guardando in quel momento.

Se un gate rosso non appartiene al cluster corrente e correggerlo lo farebbe esplodere di scope,
allargare lo scope e' preferibile a lasciarlo rosso: dichiaralo nel commit message. Se e' davvero
troppo grande, diventa un cluster a se' con `blocking: HARD`, e ha la priorita' al giro successivo.

## Prima del push

Nell'ordine, come fa `handoff`: gate verdi → `handoff_lint.py` verde → `git pull --rebase origin
main` → **ri-esegui `handoff_lint.py`** (il rebase puo' aver portato dentro lo stato di un'altra
sessione) → push. Su conflitto in `STATE.md` o nel register, la risoluzione fa parte del lavoro:
si uniscono i fatti delle due sessioni, mai `-X ours` o `-X theirs` alla cieca.
