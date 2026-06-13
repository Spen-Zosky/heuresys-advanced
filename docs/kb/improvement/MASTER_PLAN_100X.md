# MASTER_PLAN_100X — heuresys-advanced "RELEASE 100X"

> **Programma**: audit forense QA E2E + miglioramento radicale ("100x") di heuresys-advanced (v1.0.0 GA, live in produzione). **Sessione di apertura**: S-100X-0 (2026-06-13, recon+intervista+piano). **Owner decisionale**: Enzo (PM). **Esecutore**: Claude Code CLI.
> **Fonti SoT vive** (leggere a ogni sessione): `.handoff/STATE.md` · `docs/kb/SOT_STATE.md` · `docs/kb/SOT_BACKLOG.md` · `docs/kb/DEBT_REGISTER.md` · `docs/architecture/adr/` · `docs/kb/POST_V1_ROADMAP_DOSSIER.md`. **Kickoff originale**: `docs/kb/improvement/2026-06-13_heuresys-advanced-100x-kickoff-prompt.md`.

## 1. Visione

Portare heuresys-advanced dalla baseline GA v1.0.0 a una release **radicalmente migliore, robusta-first**, senza rewrite gratuiti. Ogni cambiamento passa da un **decision dossier evidence-based deciso da Enzo**. Lo stack è già moderno (TS 6 / Next 16 / Fastify 5.8 / Zod 4): "modernità" non è il gap — la leva a maggior impatto misurato è **l'affidabilità operativa** (CI/deploy/observability/test).

## 2. Assi (ordine post-intervista S-100X-0)

1. **Robustezza & operability** (dominante) — CI-SPOF, rollback deploy, observability, backup/restore, resilienza test.
2. **Velocity & DX** — suite test 901 serial single-worker, CI ~13min, zero unit-layer.
3. **Semplicità & footprint** — 31G on-disk, dead deps, docs sprawl, script duplication.
4. **UX-IX & performance** — RSC/streaming, percezione, (D-26 fuori programma).
5. **Modernità** — non è un gap (stack già aggiornato); mantenimento.

## 3. Ciclo di vita a sessioni

| Fase | Sessioni | Natura | Output |
|---|---|---|---|
| Recon | **S-100X-0** ✅ | read-only code | questo piano + baseline + intervista + protocollo |
| Audit | **S-100X-A1..A11 + A-L** | read-only code (sub-agent fan-out) | FINDINGS classificati + baseline per-WS |
| Consolidamento | **S-100X-C** | sintesi | DOSSIERS finali D-01..D-14 → **decide Enzo** |
| Esecuzione | **S-100X-E1..Em** | branch dedicati, gate verdi | 1 epic/sessione, mai su main per cambi strutturali |

L'esecuzione (E) **non è pre-autorizzata** (scelta Enzo: "audit completo, poi decido"): ogni epic parte dal go esplicito sul relativo dossier.

## 4. Sequenza audit (robustness-first)

| Sess | WS | Focus | Dipende da |
|---|---|---|---|
| A1 | **WS-G** CI/CD & deploy | runner SPOF, rollback, caching, release strategy | — |
| A2 | **WS-H** Sicurezza & supply chain | auth review, secrets, OWASP, SBOM, env-doc | — |
| A3 | **WS-F** Test & QA | unit-layer, parallelism, isolation per-worker, flakiness | — |
| A4 | **WS-C** Dati & persistenza | migration squash, backup/restore, indici, dead schema | — |
| A5 | **WS-B** Backend/servizi | module-pattern cost, hot path, repo SQL | A1,A3 |
| A6 | **WS-A** Architettura & struttura | coupling, dead code, dep inutilizzate | A5 |
| A7 | **WS-D** Frontend | RSC/streaming, bundle, data-fetching | — |
| A8 | **WS-E** Design system / UX-IX | token, a11y tail, euristiche, i18n | A7 |
| A9 | **WS-J** Config & env | env contract, script .sh/.ps1, multi-host | aggregabile ad A2 |
| A10 | **WS-K** Repo hygiene & footprint | cleanup −31G, retention, LFS, dead files | aggregabile ad A9 |
| A11 | **WS-I** Documentazione | consolidamento, drift, index autoritativo | ultimo |
| A-L | **WS-L** Ecosistema Claude | skill `claude-ecosystem-optimizer` design-only + bug claude-mem hook | indipendente |

Low-coupling (A9/A10/A11) aggregabili in 1-2 sessioni. A-L indipendente: gli altri WS non vi dipendono (se Enzo lo skippa → DEFERRED in TODO).

## 5. Gate decisionali

Ogni A produce FINDINGS classificati (CRITICAL/HIGH/MEDIUM/LOW + QUICK-WIN/DOSSIER) + baseline misurata → **S-100X-C** sintetizza i dossier cross-WS → **Enzo decide per-dossier** → **E1..Em** esecuzione. Conflitto con invarianti CLAUDE.md (I1-I14) o contratti pubblici → ammesso SOLO come opzione esplicita dentro un dossier; default = fermarsi e chiedere.

## 6. Register dossier (sintesi; dettaglio in `DOSSIERS/`)

D-01 runtime · D-02 data-layer (lean: stay raw + drop drizzle) · D-03 validazione/contratti · D-04 frontend RSC/streaming · D-05 design-system · D-06 tooling/build · D-07 migration squash-to-baseline · **D-08 CI/CD SPOF+rollback (alta leva)** · D-09 observability · D-10 architettura applicativa · D-11 brownfield engine · D-12 AI/embedding · D-13 auth self-built vs lib vs managed · D-14 GTM/multi-tenant (aggancia `POST_V1_ROADMAP_DOSSIER §3.1`).

**Quick-wins misurati** (CLASS-A, esecuzione gated dal go): rimuovi `drizzle-orm`/`drizzle-kit` (dead) · `clean` script + retention `.next`/dumps (−31G) · 8 env var → `.env.example` (auto-gen dal zod `env.ts`) · estrai `withTransaction` → `src/db/` · fix `apps/api/package.json` desc stale (58/272 → 72/407).

## 7. KPI di fine programma (robustness-first)

(a) deploy con rollback ≤1 comando + 0 SPOF CI · (b) `/metrics` + auth-event counters live · (c) CI wall-clock −50% · (d) unit-layer reale + integration parallela · (e) footprint on-disk −90% · (f) 0 dead-dep / 0 env non documentate · (g) D-26 risolto (fuori programma, tracked).

## 8. Regole d'ingaggio

- **Niente pre-sacro**: i dossier possono sfidare contratti pubblici (`/v1/*`, schema `sys.*`, URL, Zod) e invarianti I1-I14 — ma solo come opzione esplicita, e **decide Enzo** (esito intervista #2 "aperto/radicale").
- **Postura default = evoluzione selettiva** (#4): no rewrite runtime/framework/data-layer/auth salvo leva enorme + rischio contenuto; ogni dossier presenta comunque l'opzione radicale costata.
- Live-env (PROD + twin) toccati **solo a gate verdi**; cambi strutturali su **branch dedicati**, mai su main.
- **No `git push` senza ask esplicito**; commit locali doc-only pre-autorizzati per questo programma.
- Lingua IT; chiusura sessione via skill `handoff`; ogni sessione riparte leggendo MASTER_PLAN + TODO + AUDIT_PROTOCOL.
- **D-26 fuori perimetro** (sessione di prodotto dedicata).

## 9. Stato corrente

S-100X-0 ✅ (recon + baseline + intervista + piano + protocollo). **Prossimo**: S-100X-A1 (WS-G CI/CD & deploy). Vedi `TODO_100X.md`.
