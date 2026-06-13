# PROMPT KICKOFF — heuresys-advanced "RELEASE 100X"
# Sessione S-100X-0: Recon + Intervista + Piano Master dell'audit forense QA E2E
# (da incollare in Claude Code CLI, working dir D:\heuresys-advanced)

> Generato 2026-06-13 dalla skill `forensic-100x-kickoff`. Ogni dato embedded è
> snapshot a quella data, àncora orientativa — NON autoritativo: fa fede SEMPRE
> la lettura live delle SoT al lancio (§1).

## 0. MANDATO E NATURA DELLA SESSIONE

Sei Claude Code CLI su `D:\heuresys-advanced`. Obiettivo del programma: far
evolvere heuresys-advanced (v1.0.0 GA, **live in produzione** su
`https://www.heuresys.com` — nginx TLS → web :3013, proxy `/api`→:8013 — su OCI
VM ARM64 con systemd e DB PG16 nativo, più twin PROD autonomo su linux-pc;
stack: pnpm monorepo `apps/api` + `apps/web` + `apps/showcase` +
`packages/shared` · TypeScript 6 / Node 22 · Fastify 5 + Zod 4 + ftpz6 ·
PostgreSQL 16 nativo via tunnel :5433 con ~110 migration idempotenti · Next.js
16 App Router ×2 · `@heuresys/ui` npm pubblicato dal repo upstream
`ux-design-shared` · vitest+supertest ~900 integration su DB reale + Playwright
E2E prod-config ~200 · GitHub Actions su runner self-hosted OCI) a una release
radicalmente migliore ("100x") su tutti gli assi: robustezza, modernità,
performance, semplicità, footprint, DX, UX/IX, processi.

Questa sessione (S-100X-0) è **READ-ONLY sul codice**: NESSUNA modifica a
src/db/config/deploy/CI. Produce SOLO documenti sotto `docs/kb/improvement/` +
aggiornamento del backlog di progetto. Commit locali ammessi (doc-only); push
secondo policy: commit locali su main pre-autorizzati, **mai `git push` senza
ask esplicito** (autorizzazione push = session-scoped), scope-discipline
cardinale, lingua italiana, chiusura sessione via skill `handoff`. Ambienti
live non si toccano. Invarianti del progetto (I1-I14: position-centric,
schema `sys.sys_*`, tenant-isolation senza RLS I5, auth separata I7, PIP come
VIEW I9, no-PII ADR-0023 I12, PG16 nativo NO-Docker I13, employee-centric
ADR-0024 I14; più RD-08/RD-09, module pattern 7-step, live-data E2E only,
design-system rules `@heuresys/ui` — mai primitive UI in-repo) valgono per
default e possono essere sfidate SOLO come opzione esplicita dentro un
decision dossier (§5).

**Nota perimetro**: il debito 🔴 **D-26** (silent-refresh rotto dietro `/api` →
hard-logout a 15 min per gli utenti PROD) è un fix di prodotto **FUORI dal
programma 100x** — viaggia sulla sua sessione dedicata già prioritizzata in
`.handoff/STATE.md`. Il programma non lo assorbe e non lo blocca; se al lancio
risulta ancora aperto, annotalo in baseline come fatto noto, non come finding.

Ciclo di vita a sessioni che TU definisci qui:
- **S-100X-0 (questa)**: recon + intervista + piano master + todo.
- **S-100X-A1..An (audit)**: una sessione forense per workstream (§4),
  ciascuna produce FINDINGS classificati + metriche baseline.
- **S-100X-C (consolidamento)**: sintesi cross-WS + dossier finali (§5) →
  decide l'utente.
- **S-100X-E1..Em (esecuzione)**: una sessione per epic chiusa, branch
  dedicati, gate verdi, mai su main per cambi strutturali.

## 1. STEP ZERO — GROUNDING OBBLIGATORIO (prima di qualsiasi output)

Reperisci le fonti di verità VIVE al momento del lancio — questo progetto ha
una convenzione SoT esplicita (dichiarata in `CLAUDE.md` root §"Source of
Truth"): `.handoff/STATE.md` (vista rapida) + `docs/kb/SOT_STATE.md`
(snapshot granulare) + `docs/kb/SOT_BACKLOG.md` (backlog) +
`docs/kb/DEBT_REGISTER.md` (debiti) + `docs/kb/INDEX_PATHS.md` (indice path) +
`docs/architecture/adr/` (decisioni) + `docs/kb/POST_V1_ROADMAP_DOSSIER.md`
(direzioni post-v1.0). Leggile PRIMA di ogni output.
Poi verifica live con comandi reali (niente assunzioni da memoria):
`git status`, `git log origin/main..HEAD`, stato CI (`gh run list`),
conteggi spot delle unità strutturali del progetto (moduli API in
`apps/api/src/modules/`, migration in `db/migrations/`, pagine
`apps/web/src/app/**/page.tsx`, test file) confrontati con quanto dichiarato
nelle SoT. Ogni drift osservato va annotato in `BASELINE_METRICS.md`.
NB: ogni dato citato in questo prompt è snapshot del 2026-06-13 usato come
àncora orientativa — NON è autoritativo; fa fede SEMPRE la lettura live.
Metodo vincolante: evidence > narrative diagnosis; time-box 60-90 min sui
rabbit hole; automazione non eseguita non è validata.

## 2. INTERVISTA INIZIALE ALL'UTENTE (gate bloccante)

Dopo il grounding e PRIMA del piano: UN solo batch di domande numerate
(max 15), raggruppate per tema, ognuna con risposta di default proposta.
STOP: non procedere al piano finché l'utente non risponde. Temi obbligatori
(adatta in base al recon):
1. Definizione di "100x": ranking tra performance, robustezza, semplicità,
   UX/IX, DX, footprint, velocità di evoluzione futura.
2. Tolleranza breaking change: API `/v1/*`, schema `sys.*`, URL, contratti
   Zod condivisi — cosa è intoccabile, cosa negoziabile.
3. Vincoli ambienti live: utenti reali sul dominio? finestre di freeze?
   branch release long-lived ammessi?
4. Appetite radicale: sostituzioni profonde (runtime, framework, data layer,
   design system) vs evoluzione conservativa.
5. Budget: sessioni/settimane dedicabili; budget token/costo.
6. Compliance: target normativi da assumere come requisiti della release
   (oggi ADR-0023 = no-PII by design; GDPR è gated dal primo tenant reale).
7. Dati: preservazione bit-perfect del DB OCI vs ricostruibilità da
   migration+seed (oggi: migration idempotenti + seed CI-reproducibili).
8. Storia git: rewrite/squash ammesso (con tag freeze) o intoccabile
   (NB: repo GitHub **pubblico**).
9. Workstream ecosistema Claude (WS-L): confermare inclusione (decisione di
   generazione: incluso, design da zero) o ridurre/skippare.
10. Criteri di successo misurabili (KPI di fine programma).

## 3. METODO FORENSE (vale per ogni workstream di audit)

- Evidence-based: ogni finding cita comando + output reale (o path:linea).
- Granularità E2E: per ogni WS percorri l'intera catena codice → config →
  test → CI → deploy → doc, non solo il codice.
- Classificazione: CRITICAL/HIGH/MEDIUM/LOW + flag QUICK-WIN (≤1h, zero
  rischio) + flag DOSSIER (richiede decisione dell'utente).
- Baseline misurate PRIMA di proporre: tempi build/lint/suite, dimensione
  repo e dipendenze, bundle/artefatti per route, latenze runtime, durata CI,
  copertura test per modulo.
- Sub-agent split: exploration in sub-agent read-only, sintesi nel main thread.

## 4. WORKSTREAM DI AUDIT (adattati allo stack — ognuno = sessione dedicata)

**WS-A Architettura & struttura**: boundary tra moduli/package (~60 moduli
API, shared contracts, 2 app Next), coupling, overengineering (astrazioni a
1 consumer, seam mai usati), duplicazioni, dead code, dipendenze inutilizzate.
**WS-B Backend/servizi**: il module pattern 7-step e il suo costo
(boilerplate riducibile?), error handling, hot path performance, N+1,
over-fetching nelle repository raw-SQL.
**WS-C Dati & persistenza**: migration (~110 file — opzione squash/baseline),
schema `sys.*` (oggetti morti eliminabili), indici mancanti/inutili, bloat,
backup/restore (oggi solo snapshot manuali), seed idempotenti.
**WS-D Frontend**: architettura rendering (App Router, 100% client pages),
bundle per route, data-fetching TanStack Query, code splitting, performance
percepita.
**WS-E Design system / UX-IX**: token, copertura `@heuresys/ui` vs uso reale,
a11y (gate serious=0 già attivo — verificare il tail manuale), heuristiche UX
(navigazione DB-driven, empty/error/loading state, i18n IT/EN), design
language e ipotesi di evoluzione.
**WS-F Test & QA**: durata e parallelismo suite (~900 integration
singleThread su DB reale; E2E prod-config ~10min), flakiness E2E, gap di
copertura, piramide test (oggi: zero unit-layer puro), contract/mutation
testing.
**WS-G CI/CD & GitHub**: workflow (durata, caching, runner self-hosted OCI =
single point of failure), release process, branch protection, dependency
policy (defer-major), strategia deploy (`vm-deploy.sh`/`align-clones.sh`) e
rollback, environments/secrets.
**WS-H Sicurezza & supply chain**: auth self-built (Argon2id, JWT RS256,
refresh-rotation, CSRF, MFA 4-kind), secret hygiene multi-host, OWASP sulle
superfici esposte (~407 endpoint), audit dipendenze, SBOM, gestione chiavi
SSH multi-macchina.
**WS-I Documentazione**: censimento completo (docs/kb, ADR, specs, archive,
superpowers), drift vs codice, duplicazioni, obsoleti da archiviare, indice
autoritativo unico, regola di manutenzione.
**WS-J Configurazioni & env**: inventario env var per app/host (PC/Mac/VM/
linux-pc, `.env` key-merge additivo), esempi completi, script morti/fragili,
riduzione superficie config.
**WS-K Repo hygiene & footprint**: file morti, archivi estraibili, dimensione
.git e history, gitignore, candidati LFS, misura prima/dopo.
**WS-L Ecosistema Claude**: incluso (decisione di generazione 2026-06-13),
skippabile su istruzione utente — metodo = skill `claude-ecosystem-optimizer`
(vedi §6); in caso di skip marca DEFERRED nella todo, gli altri WS non ne
dipendono.

## 5. DECISION DOSSIERS — OPZIONI DI GRANDE IMPATTO (obbligatori)

Per ogni oggetto di stack: dossier `DOSSIERS/D-NN_<slug>.md` con ALMENO una
opzione conservativa, una evolutiva, una radicale. Struttura fissa: contesto
misurato → opzioni → per ognuna impatto (perf/robustezza/DX/UX), costo
(sessioni/ore), rischio, reversibilità, prerequisiti → raccomandazione
motivata → "cosa decide l'utente". Categorie minime (adattate allo stack):
- D-01 Runtime/linguaggio (Node 22 + Fastify status quo vs alternative vs
  estrazione hot path, con benchmark reale su 2-3 percorsi caldi).
- D-02 Data layer / accesso dati (raw parameterized SQL status quo vs query
  builder vs ORM; il pool pg e il pattern `withTransaction`).
- D-03 Validazione / contratti (Zod 4 + ftpz6 + subpath exports condivisi).
- D-04 Architettura frontend (Next.js 16 client-only pages vs RSC/streaming
  vs alternative).
- D-05 Design system (`@heuresys/ui` npm-published in-house: evoluzione vs
  base headless vs rewrite; il ciclo release upstream ux-design-shared).
- D-06 Tooling repo/build (pnpm + tsup/tsc: cache, affected, task runner).
- D-07 Strategia migration/schema (squash a baseline vs storia integrale —
  ~110 migration idempotenti, twice-run proven).
- D-08 CI/CD (runner self-hosted unico, caching, CD con rollback, preview
  env; topologia deploy multi-host align-clones/vm-deploy).
- D-09 Observability (tracing/metrics/logs, error tracking, SLO; oggi: pino
  + redaction, nessun `/metrics` app-level).
- D-10 Architettura applicativa (monolite modulare vs estrazione servizi).

Dossier extra di dominio (decisi nell'intervista di generazione 2026-06-13):
- **D-11 Brownfield/ingestion engine**: il motore wave-executor /
  transform-compiler / staging a riconciliazione COMPLETA (registry a 0
  stati aperti) — keep-as-is vs freeze/archive vs estrazione in tool
  separato; cosa resta runtime-necessario per futuri onboarding (Wave-3).
- **D-12 AI/embedding strategy**: pgvector + dipendenza dal provider esterno
  Voyage API + roadmap LLM-deepening (dossier roadmap §3.8) — consolidare,
  astrarre il provider (seam), o congelare; costo/rischio del reindex.
- **D-13 Auth/session architecture**: stack auth interamente self-built
  (Argon2id, JWT RS256, refresh-rotation con replay detection, CSRF
  double-submit, MFA TOTP/EMAIL_OTP/WebAuthn/recovery + policy mandatory) +
  lezione D-26 — review architetturale: status quo hardened vs libreria
  (es. better-auth/lucia-class) vs managed (esterno). NB: qualunque opzione
  si misura contro ~80 file di test auth-sensibili.
- **D-14 GTM/multi-tenant readiness**: hardening per il primo tenant reale
  (signup/provisioning, retention, GDPR/PII, supporto) — **aggancia il
  dossier esistente `docs/kb/POST_V1_ROADMAP_DOSSIER.md` §3.1 senza
  duplicarlo**: il dossier 100x referenzia quello e aggiunge solo il delta
  tecnico-architetturale.
Aggiungi ogni altro dossier che il recon rende evidente.

## 6. WS-L — ECOSISTEMA CLAUDE (sessione separata)

Incluso per decisione utente (2026-06-13), modalità **design da zero**:
applica la skill `claude-ecosystem-optimizer` in modalità "design + piano"
(NON implementare qui) con analisi fresh dello status quo (CLAUDE.md global +
project, skills, hooks, settings, memoria, plugin). Esiste un design
precedente (`D:\claude-refactoring`, piano "Layered per doctrine" 6 wave
W0-W5, approvato ma mai eseguito): per decisione esplicita dell'utente NON va
riconciliato — è citabile solo come riferimento storico; il design WS-L
riparte da zero. Output: design datato + `docs/kb/improvement/WS-L_PLAN.md` +
`WS-L_TODO.md`.

## 7. DELIVERABLE DI QUESTA SESSIONE (S-100X-0)

Crea `docs/kb/improvement/` con: `MASTER_PLAN_100X.md` (visione, assi, ciclo
sessioni, sequenza WS con dipendenze, gate decisionali, criteri di successo
post-intervista) · `TODO_100X.md` (machine-checkable:
`[ ] S-100X-?? | WS | task | gate di verifica | stato`) ·
`INTERVIEW_LOG.md` (domande, default, risposte verbatim) ·
`BASELINE_METRICS.md` (misure con comandi riproducibili) ·
`AUDIT_PROTOCOL.md` (il §3 operativo: template FINDINGS/DOSSIER, time-box) ·
stub `FINDINGS/` e `DOSSIERS/`. Aggiorna il backlog di progetto
(`docs/kb/SOT_BACKLOG.md`) con l'epic 100X e chiudi con commit locale
doc-only; push secondo policy (mai senza ask esplicito).

## 8. GUARDRAIL FINALI

- Niente modifiche a codice, schema, config, CI, deploy in questa sessione;
  nessuna azione su ambienti live oltre a letture.
- Invarianti sfidabili solo via dossier; conflitti → fermati e chiedi.
- Stime sempre in sessioni/ore; ogni claim con evidenza.
- Context budget esaurito → handoff pulito marcando il residuo nella todo:
  il programma è multi-sessione by design.
- Le sessioni successive partono SEMPRE rileggendo MASTER_PLAN_100X.md +
  TODO_100X.md + AUDIT_PROTOCOL.md come primo atto.

## 9. SEQUENZA OPERATIVA

1. Step Zero (§1) → 2. Recon + baseline (§3, time-box 45-60 min) →
3. Intervista (§2) e STOP in attesa risposte → 4. Piano + todo + protocollo
(§7) → 5. WS-L se il budget lo consente, altrimenti prima voce della todo →
6. Commit doc-only + riepilogo con evidenze reali.
