# WS-T1 — Architecture & multi-stack soundness
Agente: Engineering (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

> Rivalidazione della baseline 2026-06-17 (HEAD `ce26608`). Ogni claim ricontrollato con comando eseguito ora, non copiato dalla baseline.

## Sintesi

L'architettura resta strutturalmente sana e i tre findings operativi più pesanti di giugno sono stati chiusi o fortemente mitigati: il pool PostgreSQL è ora configurabile via env (`POSTGRES_POOL_MAX`, T1-004 giugno → RISOLTO), `.nvmrc` è allineato a Node 22 (T1-007 → RISOLTO), e `apps/agent-gateway` è entrato nelle pipeline di lint/typecheck/test (T1-001 → quasi risolto, resta fuori solo il gate di `build`). Il rischio più serio di giugno — CI SPOF con 7/8 workflow sullo stesso host della produzione — è stato **mitigato ma non eliminato**: un secondo runner self-hosted (`linux-pc-runner`, label `off-prod`) ora ospita i 3 workflow più pesanti/DB-touching (test-integration, build-web, playwright), ma 6 workflow (lint, typecheck, atlas-freshness, i18n-parity, state-lint, shell-tests) girano ancora sulla VM di produzione. Il debito di lunga data sui subpath exports di `@heuresys/shared` non solo persiste ma è cresciuto in valore assoluto (78→121 entry dichiarate, uso reale invariato a poche unità). La crescita del sistema nel periodo è enorme (moduli API 75→111, migrazioni 130→452) senza segni di degrado architetturale: 0 cicli, 0 import di boundary illeciti, invarianti I5/I9/I13 confermati strutturalmente.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| "13-step plugin chain corretta (requestId→helmet→cors→cookie→JWT→rate-limit→auth→CSRF→tenant→errorHandler→health→routes)" | CONFERMATO | `apps/api/src/app.ts:257` requestId, `:283` helmet, `:296` cors, `:306` cookie, `:312` jwt, `:332` rateLimit, `:338` auth, `:342` csrfPlugin, `:352` errorHandler — ordine invariato, letto live oggi. File cresciuto a 546 righe (era ~420). |
| "0 import illeciti web→api, api→ui; shared è leaf" | CONFERMATO | `grep -rl "@heuresys/api" apps/web/src` → 0 file; `grep -rl "@heuresys/ui" apps/api/src` → 0 file (comandi eseguiti ora). |
| "75 moduli API, tutti registrati, 0 orfani" | PARZIALE (numero cambiato, invariante tenuta) | `ls apps/api/src/modules` → **111** directory (era 75, +48%). `grep -oE "app\.register\([a-zA-Z]+Routes" apps/api/src/app.ts \| sort -u \| wc -l` → **112** registrazioni uniche distinte, `grep -c "app.register"` → **124** call totali (multi-group su alcuni moduli, es. `me`). Coerenza 111 dir ↔ 112 route-registration confermata, nessun modulo orfano rilevato. |
| "130 migration SQL idempotenti" | PARZIALE (numero cambiato) | `ls db/migrations/*.sql \| wc -l` → **452** (era 130, +248%), max `000452`. Non è stata rieseguita la prova di idempotenza (richiede il gemello linux-pc, fuori perimetro sola-lettura di questa sessione) — il claim di idempotenza stessa resta NON RIVERIFICATO qui, ma è coperto da CI (`db:validate:vm`/`migrate-idempotent`) secondo `docs/kb/SOT_STATE.md`. |
| "193 tabelle in sys.*" | NON VERIFICABILE in questa sessione (nessuna query DB eseguita, sola lettura codice) | `docs/kb/SOT_STATE.md:33` riporta **250** tabelle `sys.*` misurate 2026-09-28 nella stessa sessione SoT; non riverificato con query diretta qui. |
| "drizzle rimosso" | CONFERMATO | `grep -rn "drizzle" apps/api/package.json apps/api/src` → 0 hit (comando eseguito ora). |
| "Pool PostgreSQL hardcoded a max=20, non configurabile via env (finding T1-004 giugno)" | SMENTITO (finding giugno RISOLTO) | `apps/api/src/config/env.ts:90` → `POSTGRES_POOL_MAX: z.coerce.number().int().min(1).max(200).default(20)`; `apps/api/src/db/client.ts:60` → `max: env.POSTGRES_POOL_MAX`. Il default resta 20 ma ora è sovrascrivibile via env, come richiesto dalla remediation di giugno. |
| "`.nvmrc`=20.11.0 discrepante da engines>=22 (finding T1-007 giugno)" | SMENTITO (finding giugno RISOLTO) | `cat .nvmrc` → `22`; `package.json` → `"engines": {"node": ">=22.0.0"}`. Allineati. |
| "agent-gateway fuori da pipeline build/lint/CI (finding T1-001 giugno)" | PARZIALE (in gran parte RISOLTO) | `.github/workflows/lint.yml:97-101` esegue `pnpm --filter @heuresys/agent-gateway run lint` e `run test`; `.github/workflows/typecheck.yml:98-99` esegue `run typecheck`. Commenti nel workflow stesso citano S1029 come sessione di fix. Resta assente un gate di `build` in CI (lo script `build` esiste in `package.json` ma nessun workflow lo invoca). |
| "CI SPOF: 7/8 workflow su runner self-hosted = VM PROD (finding T1-003 giugno)" | PARZIALE (mitigato, non eliminato) | `grep -n runs-on .github/workflows/*.yml`: 3 workflow (`test-integration`, `build-web`, `playwright-smoke`, `playwright-integrale`) → `[self-hosted, off-prod]` (secondo runner su linux-pc, DB proprio, da `docs/kb/SOT_STATE.md` riga 2884: D-08 F2-F5 SHIPPED); **6** workflow (`lint`, `typecheck`, `atlas-freshness`, `i18n-parity`, `state-lint`, `shell-tests`) restano `[self-hosted, oci-vm]` = la VM di produzione. 12/12 workflow totali self-hosted (2 soli su `ubuntu-latest`: `codeql`, `showcase`). |
| "78 subpath exports `@heuresys/shared` dichiarate, ~0 usate (finding T1-002 giugno)" | CONFERMATO (peggiorato in valore assoluto) | `packages/shared/package.json`: **121** entry `"./..."` in `exports` (era 78). Uso reale: `grep -rn "@heuresys/shared/schemas/" apps` → **6** file; import da barrel `@heuresys/shared"` → **478 file / 510 occorrenze**. Rapporto uso subpath/dichiarato ancora ~5%. |
| "isolamento tenant via FK+middleware, mai RLS (I5)" | CONFERMATO | `grep -rn "CREATE POLICY\|ENABLE ROW LEVEL SECURITY" db/migrations/*.sql` → 0 hit su 452 file. |
| "PIP come VIEW, mai blob JSONB (I9)" | CONFERMATO | `db/migrations/000023_validation_views_and_checks.sql:43` → `CREATE OR REPLACE VIEW sys.v_pip_completeness AS`. |
| "niente Docker nel runtime (I13)" | CONFERMATO | `grep -rl docker deploy/` → solo `deploy/README.md` (testo, non config); nessun `docker-compose`/`Dockerfile` di runtime prod nel repo sotto `deploy/`. |
| "TypeScript strict: noUncheckedIndexedAccess/noUnusedLocals/noUnusedParameters attivi, exactOptionalPropertyTypes spento" | CONFERMATO | `tsconfig.base.json:14-20` → `strict:true`, `noUnusedLocals:true`, `noUnusedParameters:true`, `noUncheckedIndexedAccess:true`, `exactOptionalPropertyTypes:false`. `apps/api/tsconfig.json` estende questo file. |

## Finding

### T1-001 (aggiornamento del T1-001 di giugno)
**Titolo**: `apps/agent-gateway` ora in CI per lint/typecheck/test, ma senza gate di `build`
**Severità**: Low (era Medium a giugno)
**Tipo**: tech-debt residuo
**Evidenza**: `.github/workflows/lint.yml:94-101`, `.github/workflows/typecheck.yml:96-99` — commenti nel codice stesso ("agent-gateway era fuori da ogni workflow… S1029") confermano il fix intenzionale. Nessun workflow invoca `pnpm --filter @heuresys/agent-gateway run build`, benché lo script esista in `apps/agent-gateway/package.json`.
**Impatto**: Basso — `typecheck` con `tsc --noEmit` copre la stessa superficie di errori che un `build` (`tsc` senza `--noEmit`) rileverebbe per un pacchetto TS-only senza bundling complesso; resta un gap simbolico più che un rischio reale di regressione silenziosa.
**GA-blocker**: No
**Remediation**: Aggiungere uno step `run: pnpm --filter @heuresys/agent-gateway run build` in un workflow esistente (es. `typecheck.yml`). Effort: XS.
**Best-practice ref**: Parità dei gate CI fra i workspace di un monorepo.
**Confidence**: Alta

### T1-002 (persistente dal WS di giugno, peggiorato in valore assoluto)
**Titolo**: 121 subpath exports `@heuresys/shared` dichiarate, ~5% usate — drift-magnet cresciuto
**Severità**: Low
**Tipo**: tech-debt
**Evidenza**: `packages/shared/package.json` → 121 chiavi `"./…"` in `exports` (era 78 a giugno, +55%, proporzionale alla crescita dei moduli). Uso reale via subpath: 6 file su tutto il repo (`apps/web/src/lib/api/public-stats.ts`, `lead-form.tsx`, `whistleblowing/page.tsx`, `jobs/page.tsx`, `investors/page.tsx`, `whistleblowing-console/page.tsx`). Import da barrel: 478 file.
**Impatto**: 121 entry di `package.json` da mantenere allineate a ogni nuovo schema, senza beneficio runtime misurabile (nessun tree-shaking differenziale dimostrato, dato l'uso quasi nullo).
**GA-blocker**: No
**Remediation**: invariata da giugno — (a) ridurre a `.` + le 6 subpath realmente usate, oppure (b) dichiararle API pubblica intenzionale e chiudere il finding. Effort: S.
**Confidence**: Alta

### T1-003 (aggiornamento del T1-003 di giugno)
**Titolo**: CI SPOF mitigato con secondo runner off-prod, ma 6/12 workflow restano sulla VM PROD
**Severità**: Medium (era High a giugno)
**Tipo**: risk / ops
**Evidenza**: `docs/kb/SOT_STATE.md` riga 2884 (S1022, branch `d08-f5-offprod-runner`): secondo runner self-hosted `linux-pc-runner` (label `off-prod,linux-pc`) con DB proprio, provisioning idempotente (`scripts/provision-ci-runner-linuxpc.sh`); i 3 workflow più pesanti/DB-touching (`test-integration`, `build-web`, `playwright-smoke`+`playwright-integrale`) retargati su di esso, "PROD fuori dal loro path CI". Verificato oggi via `grep runs-on .github/workflows/*.yml`: **6** workflow (`lint`, `typecheck`, `atlas-freshness`, `i18n-parity`, `state-lint`, `shell-tests`) restano `[self-hosted, oci-vm]`. Fork-guard aggiunto (`SOT_STATE.md` riga 3350, `dfd664d`) su tutti i workflow self-hosted per bloccare PR da fork prima del checkout sul runner PROD.
**Impatto**: Il rischio principale di giugno (test di integrazione con side-effect su DB PROD, contesa runner/PROD sotto carico CI) è stato eliminato per i 3 workflow a rischio più alto. Rimane un rischio residuo minore: se la VM OCI è satura o giù, 6 gate CI (incluso lint/typecheck, non collegati al DB) diventano indisponibili insieme a PROD — un blocco di visibilità CI, non un rischio di corruzione dati come a giugno.
**GA-blocker**: No (era Sì a giugno; declassato dal fix parziale)
**Remediation**: Spostare anche `lint`/`typecheck` (i due gate senza dipendenza DB, quindi a costo di migrazione basso) sul runner `off-prod` o su un runner GitHub-hosted, per azzerare la dipendenza residua da PROD per la CI. Effort: S.
**Best-practice ref**: Bulkhead pattern, isolamento ambienti CI/PROD.
**Confidence**: Alta

### T1-004 — CHIUSO (era finding giugno)
**Titolo**: Pool PostgreSQL ora configurabile via env
**Severità**: N/A (risolto)
**Tipo**: strength
**Evidenza**: `apps/api/src/config/env.ts:90` (`POSTGRES_POOL_MAX` con validazione Zod, range 1-200, default 20), consumato in `apps/api/src/db/client.ts:60`.
**Impatto**: Il finding di giugno (pool size fisso, remediation richiesta "Pool sizing via env-var") è chiuso esattamente come raccomandato.
**GA-blocker**: N/A
**Confidence**: Alta

### T1-005 — CHIUSO (era finding giugno)
**Titolo**: `.nvmrc` allineato a Node 22
**Severità**: N/A (risolto)
**Tipo**: strength
**Evidenza**: `.nvmrc` → `22`; `package.json` `engines.node` → `>=22.0.0`.
**GA-blocker**: N/A
**Confidence**: Alta

### T1-006
**Titolo**: ASSET — Monorepo a boundary puliti confermati sotto crescita 2.5x (moduli e migrazioni)
**Severità**: Info
**Tipo**: strength
**Evidenza**: `grep -rl "@heuresys/api" apps/web/src` = 0; `grep -rl "@heuresys/ui" apps/api/src` = 0 (comandi live oggi). Nonostante la crescita da 75→111 moduli e 130→452 migrazioni nel periodo, zero import di boundary illeciti rilevati, zero policy RLS introdotte (I5 rispettato), PIP resta VIEW (I9 rispettato).
**Impatto**: La disciplina architetturale ha retto a una crescita significativa del sistema senza erosione dei confini.
**GA-blocker**: N/A
**Remediation**: Nessuna azione; mantenere enforcement (ESLint boundary rules, invarianti I1-I23 in CLAUDE.md).
**Confidence**: Alta

### T1-007
**Titolo**: Crescita 2.5x-3.5x del sistema (moduli +48%, migrazioni +248%) senza rivalidazione dell'idempotenza in questa sessione
**Severità**: Low
**Tipo**: risk (limite di questa rivalidazione, non un difetto rilevato)
**Evidenza**: `ls db/migrations/*.sql | wc -l` = 452 (era 130). La prova di idempotenza (`db/scripts/prova-idempotenza.sh`) gira per contratto di progetto sul gemello linux-pc, fuori dal perimetro sola-lettura-su-Windows di questa sessione avversariale.
**Impatto**: Questo WS non fornisce evidenza fresca sull'idempotenza delle 452 migrazioni; si appoggia alla CI (`migrate-idempotent`) come da `docs/kb/SOT_STATE.md`, che riporta il gate verde ma non è stato rieseguito qui.
**GA-blocker**: No
**Remediation**: Nessuna azione di codice; per una prossima rivalidazione, eseguire la prova di idempotenza dal gemello o citare l'ultimo run CI verde con timestamp.
**Confidence**: Media (limite di perimetro dichiarato, non un difetto misurato)

## Score del pilastro
Score: 78 / 100 | Confidence: Alta
Motivazione: Rispetto a giugno (72/100) lo score sale di 6 punti: i tre findings operativi più pesanti (pool non configurabile, `.nvmrc` disallineato, agent-gateway fuori CI) sono stati chiusi o quasi chiusi, e il finding High (CI SPOF) è stato mitigato con un secondo runner che toglie dal path della VM PROD i 3 workflow a rischio più alto — motivo per cui è stato declassato a Medium anziché rimosso del tutto (6/12 workflow restano comunque sulla VM PROD). Il debito residuo (subpath exports, gate `build` mancante su agent-gateway) è di severità Low e non blocca GA. L'architettura ha assorbito una crescita di sistema molto ampia (+48% moduli, +248% migrazioni) senza erosione dei boundary o violazione degli invarianti verificabili da codice (I5, I9, I13). Banda: Forte (75-89).