# 92 — Ciclo di valutazione completo (autovalutazione + calibrazione)

> **item**: #92 · **priorità**: P1 · **stima register**: ~2-3 sessioni (restano i passi 4-7)
> **stato**: IN CORSO
> **fonti**: `D:\heuresys-design-lab\2026-08-03--decisioni-workflow-valutazione-e-presenze.md` righe 84-95 (i 7 passi INTEGRALI) · `docs/superpowers/specs/2026-08-03-consegna-lab-esecuzione.md` §V6 (solo la simulazione R24, **non** i passi)

## Decisioni vincolanti (non si ri-chiedono)

- **Enzo, 2026-08-03: SÌ, si costruisce.**
- Commit **atomici separati per fase**: un passo = un commit.
- Le transizioni di stato si validano **lato servizio, non lato UI**, con un test per ogni
  transizione illegale.
- I passi 1-3 chiudono su dati reali; dal passo 4 si introducono scritture, e la dimostrazione
  live è un ciclo di prova reale.
- Numeri corretti, già rettificati: le review sono **548** (470 ANNUAL + 78 MID_YEAR), **non**
  550/79 — mig `000263` ha tolto 2 gusci vuoti. Le calibrazioni RTL 35/20/40 sono il
  sottoinsieme di 86/30/60 totali (verificato sul legacy in VM).

## Fasi

- [x] **F1 — Migrazione DDL** — 4 tabelle + FK `review_cycle_id` + 4 permessi + mapping RBAC — FATTO (mig `000256`) · commit `8f5112c8` · verificato in produzione 2026-08-10 (S1053)
- [x] **F2 — Ingestione calibrazione** — 35/20/40 righe legacy con lineage e filtro tenant anti-contaminazione — FATTO (mig `000257`) · commit `421b5bc2` · verificato in produzione 2026-08-10 (S1053)
- [x] **F3 — API lettura** — moduli `review-cycles` + `performance-reviews` + `calibration-sessions`, 7 endpoint, `orgGate` service/catalog, mask ADR-0032 sui giudizi, 13 integration test — FATTO 2026-08-10 (S1053) · prova live: federica 548 review reali + 35 sessioni + empty-state reale sui cicli; capo di linea confinato al sotto-albero con oracolo unità; platform senza giudizio
- [x] **F4 — API scrittura + macchina a stati** — **FATTA 2026-08-14** (`9c312edc` perimetro RBAC · `8144fa5e` scritture). Macchina dichiarata nel contratto condiviso (`REVIEW_CYCLE_TRANSITIONS`), fatta rispettare nel servizio; POST crea sempre in DRAFT, POST `/:id/transition` fa avanzare. Stato di partenza letto dal DB e ricontrollato nella WHERE (409 su concorrenza). **33 transizioni illegali su 33 provate**, generate dalla dichiarazione invece che scritte a mano — 40/40 verdi
  - ✅ **Il rilievo che la bloccava è SCIOLTO** (2026-08-14, commit `9c312edc`). Non era «6 ruoli invece di 4» in astratto: la 000256 aveva **ricalcato la platea di `talent:read`**, che è una superficie di **catalogo** e comprende `BLUEPRINT_MANAGER` e `PROCESS_OWNER` — mandati sui cataloghi e sui processi, non sulle persone. Corretto alla fonte (ADR-0035) + mig **000309** con giornale di rollback; **live in produzione**: mapping 957→949, 0 grant ai mandati di catalogo, 16 alla platea dichiarata. Il perimetro su cui costruire le scritture è ora quello giusto: `HRMS_MANAGER` · `TENANT_ADMIN` · `PLATFORM_ADMIN` (legge mascherato) · `MANAGER` (confinato alla sua catena).
  - Presidiato da `apps/api/test/evaluation-rbac-perimeter.integration.test.ts` (5/5), che verifica il **perimetro**, non che una migrazione sia girata.
- [x] **F5 — ESS: le proprie valutazioni** — **FATTA 2026-08-14** (`a8fad6f4`, mig `000312`). L'avvertenza del piano era giusta e anche di più: la rotta `GET /v1/me/performance` **esisteva già** e mostrava *tutte* le valutazioni, comprese le **non comunicate**. Perdita riprodotta prima di correggere (una persona ne vedeva 4, doveva vederne 2), filtro `shared_at OR acknowledged_at` per ADR-0036 §5, permesso `performance-review:read:self` (I17: era l'unica famiglia di dati personali senza un self). 5/5 + 52/52 sulle superfici vicine
  - ⚠ **L'AUTOVALUTAZIONE NON È IN F5 e non è un dimenticanza**: misurato — 548 valutazioni tutte `COMPLETED`, `self_assessment_status` NOT_STARTED su tutte, **0 cicli esistenti**, 0 valutazioni agganciate a un ciclo. Scrivere quella funzione ora significherebbe costruirla senza un solo caso su cui dimostrarla. **Serve prima un ciclo APERTO** — ed è una decisione di Enzo (aprire il ciclo di valutazione dell'azienda), non una migrazione. Le API per aprirlo esistono già: sono quelle di F4
- [x] **F6 — Frontend** — **FATTA 2026-08-15 (S1061)**. Due pagine, **zero componenti nuovi** (si compongono `@heuresys/ui` + i pannelli già in repo) e **zero UI deps** aggiunte. `/performance` (manageriale, tre sezioni: cicli · valutazioni · calibrazioni) e `/me/performance` (ESS). Mig. **`000313`** per le due voci di sidebar — una pagina senza voce è irraggiungibile (`#125`), e il menu vive nel DB, non nel frontend. **Nessun permesso nuovo**: riusa `performance-review:read` (platea corretta dalla 000309) e `performance-review:read:self` (000312, che il ruolo base `USER` detiene).
  - **prova generale della catena VERDE** prima di applicare (`ci-rehearsal.sh` su linux-pc, due passate): `000313 ok — 2 voci di menu, 2 traduzioni EN, 64 altre voci attive intatte`, sentinelle **17/17 a zero**. Applicata poi in produzione.
  - **dimostrazione LIVE su `https://www.heuresys.com/api`** (`apps/api/scripts/prova-live-92-f6.mts`, due login reali): mandato HR `federica.marchetti` → **0 cicli · 548 valutazioni · 35 calibrazioni**; persona **senza alcun mandato** `alberto.colombo` → **4 valutazioni, esattamente le 4 comunicate** che il database le attribuisce. La prima valutazione che l'HR vede risulta **non comunicata**: il filtro di ADR-0036 §5 morde davvero, non è teorico.
  - ⚠ **la sezione dei cicli nasce su un empty-state REALE** (0 righe in `sys_review_cycles`): non è un difetto né un dato finto, è l'unico vuoto che la dottrina live-data ammette. Comparirà da sé quando Enzo aprirà un ciclo.
  - **i giudizi mascherati si dichiarano**, non si mostrano vuoti: `MaskedCell` + `isMasked` su entrambe le pagine — «non c'è» e «non te lo mostro» restano distinti (la stessa lezione di `#188`).
  - verifiche: `i18n:check` **parity OK 3049 × 2 × 10** (+50 chiavi) · typecheck monorepo · lint **0 errori 0 warning** · `next build` verde con **entrambe** le rotte negli artefatti.
- [ ] **F7 — Playwright E2E con login reale** — `federica.marchetti@rtl-bank.org` per il ramo manager; **una persona senza deleghe** per l'ESS · budget ~120k

## Da dove si riprende

**F7 — Playwright E2E con login reale** (~120k), l'ultima fase. F5 e F6 sono chiuse.

Due cose che F6 lascia a F7 e che le risparmiano una ricerca:
- **le persone dei due rami sono già misurate**: `federica.marchetti@rtl-bank.org` per il ramo
  manageriale, e per l'ESS **una persona senza alcun mandato** — la si deriva con la query in
  `apps/api/scripts/prova-live-92-f6.mts`, che è la stessa domanda a cui la pagina risponde
  (in produzione ha scelto `alberto.colombo@rtl-bank.org`, 4 valutazioni comunicate).
- **i `data-testid` esistono già**: `perf-kpi-*`, `perf-cycles-*`, `perf-reviews-*`,
  `perf-calib-*` sulla pagina manageriale, `me-performance-*` su quella ESS.

⚠ Attenzione per F7: la sezione dei cicli è un **empty-state reale** (0 cicli). Un test che
pretendesse righe lì sarebbe rosso per il motivo sbagliato — si asserisce l'empty-state, o si
apre prima un ciclo con le API di F4.

*(Restano fuori da F4, e vanno dette: le scritture coprono il CICLO. Le sessioni di
calibrazione e le singole valutazioni hanno i loro stati — misurati: `SCHEDULED·IN_PROGRESS·
COMPLETED·CANCELLED` e `DRAFT·IN_PROGRESS·SUBMITTED·CALIBRATED·FINALIZED·COMPLETED·CANCELLED` —
e le loro macchine si dichiarano allo stesso modo quando servirà scriverle.)*
