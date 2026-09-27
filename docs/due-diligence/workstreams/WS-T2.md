# WS-T2 — Codebase quality & weighting
Agente: Engineering (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

> Rivalidazione della baseline 2026-06-17 (HEAD `ce26608`, score 74/100 Adeguato).

## Sintesi

Il codebase è quasi raddoppiato in dimensione (LOC `apps/api/src` 38.236→70.083, endpoint 424→~657-661, file di test 148→292 top-level/320 con sottocartelle) e la qualità strutturale non solo ha tenuto ma è migliorata su due dei tre debiti DX principali di giugno: il finding di punta (T2-002, ~150 dichiarazioni duplicate `ActorContext`/`actor()`/`isPlatform`, 613 occorrenze) è **risolto** — esiste oggi `apps/api/src/lib/actor.ts`, importato da 215+ file, esattamente come raccomandato dalla remediation di giugno; il cap di paginazione incoerente (T2-003) ha ora una factory unica (`packages/shared/src/schemas/_pagination.ts`, usata in 85 file) che elimina la duplicazione pur mantenendo cap diversi per endpoint (scelta ora dichiarata, non accidentale). `supertest` (dead dep, T2-006) è stato rimosso. Il gap sui test frontend (T2-004) è passato da 0 a 1 file di unit test, con perimetro esplicitamente dichiarato minimale nel proprio commento sorgente — quindi resta PARZIALE, non chiuso. Il gap sulla copertura HTTP end-to-end (T2-001) è cresciuto in valore assoluto (10→55 file senza `buildTestApp`/`inject`) ma la maggioranza sono test di logica interna (scope resolver, RBAC, reconciliation) legittimamente a livello unit/service, non un vuoto di copertura sulle route.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| "424 endpoint, 0 mock, integration test su DB reale" | PARZIALE (numero cambiato, principio confermato) | `grep -rhoE "app\.(get\|post\|patch\|put\|delete)\(" apps/api/src` → **661** (era 424); `docs/kb/SOT_STATE.md:219` riporta **657 rotte** misurate 2026-09-14 (differenza minima da metodo di conteggio, ordine di grandezza confermato). |
| "148 file test, 1012 `it()/test()` su DB reale" | PARZIALE (crescita) | `ls apps/api/test/*.test.ts` → **292** file top-level, **320** includendo sottocartelle; `grep -rhoE "\b(it\|test)\("` → **2281** blocchi (era 1012). |
| "0 IDOR / 0 SQL injection unsafe" | CONFERMATO | `apps/api/src/modules/users/service.ts:134-157,187,289-291` — pattern fetch-then-404 uniforme (`NotFoundError` invece di `403`, commento esplicito "prevent existence enumeration across tenant/team boundary"), letto oggi. `grep -rn "drizzle\|prisma\|typeorm\|knex" apps/api/src apps/api/package.json` → 0 hit. |
| "~150 dichiarazioni duplicate, 613 `ActorContext`" (finding T2-002 giugno) | SMENTITO oggi (finding RISOLTO) | `apps/api/src/lib/actor.ts` esiste: contiene `ActorContext`, `isPlatform()`, `actorFromRequest()`, `perimetroClienti()`; commento del file stesso: *"Previously ~73 service.ts files each declared an identical ActorContext interface... This module is the single source of truth."* Import: `grep -rln "lib/actor" apps/api/src` → **217** file. |
| "Cap paginazione incoerenti 200/500/1000/50" (finding T2-003 giugno) | PARZIALE (deduplicato, non uniformato) | `packages/shared/src/schemas/_pagination.ts` — factory `paginationFields(maxLimit, defaultLimit)`, commento: *"~65 list-query schemas duplicated the same {limit, offset} pair... This factory produces that exact pair so each schema declares its cap once"*. Usata in **85** file. I cap restano diversi per schema (dichiarato "preserved per-schema"), ma ora espressi con una sola funzione anziché duplicati a mano. |
| "0 unit test frontend, solo Playwright E2E (48 spec)" (finding T2-004 giugno) | PARZIALE (gap parzialmente colmato) | `apps/web/vitest.config.ts` esiste (commento: *"la prima suite unitaria del frontend (#159 F2, S1092)"*), con **1** file `apps/web/src/lib/use-agent-stream.test.ts`. Il commento del config dichiara esplicitamente il perimetro minimale: `environment:"node"`, "nessuna @testing-library, nessun DOM... Provare un hook React pretende un renderer... resta fuori finché non serve". E2E spec: `find apps/web -iname "*.spec.ts"` → **104** (era 48). |
| "`supertest`/`@types/supertest` dead dep" (finding T2-006 giugno) | SMENTITO oggi (finding RISOLTO) | `grep -n "supertest" apps/api/package.json` → 0 match, exit code 1. |
| "vitest singleThread (`fileParallelism:false`, `maxWorkers:1`)" | CONFERMATO | `apps/api/vitest.config.ts` — `fileParallelism: false`, `maxWorkers: 1`, `minWorkers: 1`, letto oggi, invariato. |
| "600 role×permission mappings" | PARZIALE (numero cambiato) | `docs/kb/SOT_STATE.md:219` (stessa sessione, 2026-09-28): RBAC **24 ruoli / 241 permessi / 1246 mappature** — non riverificato con query diretta in questa sessione di sola lettura codice, citato dalla SoT del giorno stesso. |
| "10 file test su 148 non usano buildTestApp/inject" (finding T2-001 giugno) | PARZIALE (crescita assoluta, natura diversa) | `grep -rL "buildTestApp\|inject" apps/api/test/*.test.ts` → **55** file oggi (era 10). Analisi dei nomi: la maggioranza sono test di logica interna esplicitamente non-HTTP per disegno (`scope-*.integration.test.ts` ×5, `reconciliation-*.integration.test.ts` ×8, `rbac-*` ×3, `csrf-origini-elenco.unit.test.ts`, `result-cap.test.ts`, `trust-proxy.test.ts`) — non necessariamente un buco di copertura route, ma test unit/service-level etichettati "integration" per il DB reale che usano, non per l'HTTP. |

## Finding

### T2-101 — CHIUSO (era T2-002 di giugno)
**Titolo**: Duplicazione `ActorContext`/`actor()`/`isPlatform` eliminata con `lib/actor.ts`
**Severità**: N/A (risolto)
**Tipo**: strength
**Evidenza**: `apps/api/src/lib/actor.ts:1-72`; 217 file importatori (`grep -rln "lib/actor" apps/api/src`).
**Impatto**: il costo DX di ~150 dichiarazioni duplicate segnalato a giugno è azzerato; un cambio al modello di `ActorContext` ora si fa in un punto solo.
**GA-blocker**: N/A
**Confidence**: Alta

### T2-102 — CHIUSO (era T2-003 di giugno)
**Titolo**: Cap di paginazione deduplicati via factory condivisa
**Severità**: N/A (risolto per la parte "duplicazione"; i cap restano volutamente diversi)
**Tipo**: strength
**Evidenza**: `packages/shared/src/schemas/_pagination.ts`, usato in 85 file.
**Impatto**: elimina il costo di manutenzione di ~65 dichiarazioni duplicate; i cap differenziati (200/500/1000) sono ora una scelta dichiarata nel codice, non un drift accidentale.
**GA-blocker**: N/A
**Confidence**: Alta

### T2-103 — CHIUSO (era T2-006 di giugno)
**Titolo**: `supertest`/`@types/supertest` rimossi
**Severità**: N/A (risolto)
**Tipo**: strength
**Evidenza**: `apps/api/package.json` non contiene più `supertest`.
**GA-blocker**: N/A
**Confidence**: Alta

### T2-104 (aggiornamento del T2-004 di giugno)
**Titolo**: Unit test frontend: da 0 a 1 file, perimetro dichiaratamente minimale (no DOM/componenti)
**Severità**: Medium (era Medium a giugno, non declassato: il gap sui componenti React resta aperto)
**Tipo**: tech-debt
**Evidenza**: `apps/web/vitest.config.ts` — commento sorgente: *"⚠ Deliberatamente minima... Provare un hook React pretende un renderer e quindi dipendenze nuove: è infrastruttura ulteriore, e resta fuori finché non serve a qualcosa di preciso"*. Un solo file di test, `use-agent-stream.test.ts`, su funzioni pure (`environment:"node"`).
**Impatto**: i componenti React e gli hook che toccano il DOM restano verificati solo da Playwright E2E (costoso, lento, 104 spec). Il rischio di regressione silenziosa su logica di componente resta quello di giugno, mitigato solo per la piccola superficie di funzioni pure ora coperta.
**GA-blocker**: No
**Remediation**: invariata da giugno — aggiungere Testing Library + `environment:"jsdom"` per gli hook/componenti a più alto traffico (form, tabelle dati). Effort: L.
**Best-practice ref**: Testing trophy.
**Confidence**: Alta

### T2-105 (aggiornamento del T2-001 di giugno)
**Titolo**: 55 file test su 320 non usano `buildTestApp`/`inject` — in prevalenza logica interna, non un vuoto di copertura route
**Severità**: Low (era Medium a giugno — declassato dopo revisione dei nomi file)
**Tipo**: tech-debt (classificazione) / quality
**Evidenza**: elenco completo ottenuto con `grep -rL "buildTestApp\|inject" apps/api/test/*.test.ts` (55 file). Categorie identificate per nome: scope/RBAC interni (8), reconciliation batch jobs (8), connettori esterni/CLI (4, stessa natura del finding di giugno), crypto/MFA (3), utility pure (`result-cap`, `trust-proxy`, `smtp-mailer`, `query-embedding-cache`, `capability-maturity-rubric`) (5+), il resto integration test su repository/service senza passare da Fastify.
**Impatto**: a differenza di giugno (dove il gap era percepito come "10 endpoint non testati via HTTP"), la maggior parte di questi 55 file sono test intenzionalmente a livello service/repository — un pattern di test valido, non un buco. Resta un residuo di incertezza (non ogni file è stato letto riga per riga in questa sessione) su quanti, dei 55, coprano un vero endpoint HTTP mai esercitato da un `inject()`.
**GA-blocker**: No
**Remediation**: cross-check automatico (script) tra le route registrate in `app.ts` e le route effettivamente colpite da `inject()` nei test, per individuare endpoint realmente scoperti (non stimabile dal solo nome-file). Effort: S.
**Confidence**: Media (classificazione per nome-file, non lettura esaustiva dei 55 file)

### T2-106
**Titolo**: ASSET — Crescita 2x del codebase (LOC, endpoint, test) senza introduzione di code smell classici
**Severità**: Info
**Tipo**: strength
**Evidenza**: LOC `apps/api/src`: 70.083 (era 38.236, +83%). `grep -rEn "TODO|FIXME|HACK" apps/api/src apps/web/src` → 0. `grep -rn "@ts-ignore\|@ts-expect-error"` → 0. `grep -rn "drizzle\|prisma\|typeorm\|knex"` → 0. `python docs/kb/tools/check_module_test_coverage.py` (eseguito live) → **"moduli: 111 · file di test: 292 · scoperti: 0 · verdetto: ogni modulo ha almeno un test che lo esercita"**. `pnpm typecheck` in `apps/api` eseguito live → **EXIT:0**.
**Impatto**: la disciplina di igiene del codice (niente TODO/FIXME residuo, niente escape-hatch di tipo, niente ORM introdotto) ha retto a un raddoppio della base di codice, e lo strumento di copertura del progetto conferma 0 moduli scoperti.
**GA-blocker**: N/A
**Confidence**: Alta

### T2-107
**Titolo**: `apps/api/src/modules/me/repository.ts` è un god-file: 2165 righe, 54 funzioni esportate, ~16 sotto-domini — non presente nella baseline di giugno
**Severità**: Medium
**Tipo**: antipattern
**Evidenza**: `wc -l apps/api/src/modules/me/repository.ts` = **2165** (il file più grande del repo API; il secondo, `analytics/repository.ts`, è 1177 — quasi la metà). `grep -c "^export async function" apps/api/src/modules/me/repository.ts` = **54**. Lettura dei nomi funzione: copre profile, contracts, payslips, performance, attendance, goals, risk, career-paths, analytics, approvals, positions, skills, surveys, learning, gaps, career-targets, inbox/notifiche, KPI, mentorship, process-participation, skill-gap-score — 16+ sotto-domini in un solo file. Churn: `git log --format= --name-only -n 500 -- apps/api/src apps/web/src | sort | uniq -c | sort -rn` mostra `modules/me/routes.ts` (30), `modules/me/service.ts` (28), `modules/me/repository.ts` (26) fra i file più toccati del repo dopo `app.ts` — un modulo grande E ancora in evoluzione attiva.
**Impatto**: alta probabilità di conflitti di merge su un singolo file da 2000+ righe, review più difficile (un PR sul modulo `/me` tocca inevitabilmente l'intero repository.ts), test di regressione più costosi da isolare per sotto-dominio. È esattamente il tipo di hotspot che le metriche di giugno (basate su conteggio di duplicazione, non su dimensione-per-file) non catturavano — non è una regressione dello score di giugno, è un rischio nuovo emerso con la crescita del modulo ESS.
**GA-blocker**: No
**Remediation**: split per sotto-dominio (`me/repository/{profile,career,payroll,surveys,...}.ts`) dietro un barrel file, senza toccare le firme pubbliche consumate da `service.ts`. Effort: M.
**Best-practice ref**: single-responsibility a livello di file; la mediana degli altri 110 moduli è molto più bassa (secondo posto a 1177 righe, quasi la metà).
**Confidence**: Alta

### T2-108
**Titolo**: Crescita suite test (153→292 file) non accompagnata da revisione preventiva del timeout CI — 6 CI rosse consecutive false-positive prima della diagnosi corretta
**Severità**: Medium
**Tipo**: functional-debt (capacity planning di processo, non difetto applicativo)
**Evidenza**: `docs/kb/SOT_STATE.md` §"Delta S1115 (2026-09-27)" (letto): *"il push di Z-123 ha fatto scadere `Test (api integration)` **6 volte di fila** allo stesso identico timeout (25m0s). Diagnosticato a fondo... prima di concludere: i 5 run sani precedenti vivevano già a 21-23 minuti contro un tetto di 25, perché la suite è cresciuta da 153 a 292 file di test senza che il tetto venisse mai rivisto."* Fix: `timeout-minutes: 25 → 35` in `.github/workflows/test-integration.yml`, commit `a72f3049`. La stessa lezione è registrata in memoria di progetto (`reference_ci_timeout_masquerades_as_network.md`).
**Impatto**: 6 cicli di CI rossa diagnosticati inizialmente come problema di rete (costo di tempo-macchina e tempo-diagnosi) prima di trovare la vera causa; il rischio si ripresenta ogni volta che la suite cresce sensibilmente senza revisione esplicita del budget CI — un sintomo di capacity-planning reattivo piuttosto che pianificato.
**GA-blocker**: No
**Remediation**: aggiungere un controllo che confronta la durata media dei run CI sani con una soglia di guardia (es. alert se durata > 70% del timeout configurato), invece di scoprirlo per accumulo di falsi rossi. Effort: S.
**Best-practice ref**: SRE — i timeout/budget di CI sono capacità dimensionata, non costanti statiche; vanno rivisti a ogni crescita significativa della suite.
**Confidence**: Alta (fonte primaria: SOT_STATE datato 2026-09-27, un giorno prima di questa rivalidazione)

## Score del pilastro
Score: 78 / 100 | Confidence: Alta
Motivazione: Sale da 74/100 (Adeguato) a 78/100 (Forte), ma meno del 81 che i soli findings T2-101/102/103/104/105/106 suggerirebbero. I due findings Medium più concreti di giugno sul debito DX (ActorContext duplicato, cap incoerenti) sono chiusi con remediation esattamente conforme a quanto raccomandato allora — un segnale forte di esecuzione tecnica disciplinata, non solo di crescita per accumulo. Il dead dep `supertest` è rimosso, il typecheck è verificato pulito live, e lo strumento di copertura del progetto conferma 0 moduli scoperti su 111. Il gap sui test frontend resta aperto (T2-104, Medium) con un primo passo onestamente delimitato. Contro questi progressi pesano due findings Medium nuovi non presenti nella baseline di giugno: un god-file emerso con la crescita del modulo ESS (`me/repository.ts`, 2165 righe/54 funzioni, T2-107) e un sintomo di capacity-planning reattivo sulla CI che ha prodotto 6 falsi rossi prima della diagnosi corretta (T2-108). Nessun elemento trovato è un GA-blocker.