# TRIAGE DOSSIER D-01..D-14 — esiti registrati (S1022, 2026-07-20)

> **Fase-C del programma 100X**: esito decision-ready per ogni dossier, **verificato sullo stato reale del repo** (grep/psql/commit), non sulla raccomandazione datata. I dossier datano S993 (2026-06-17); il repo è avanzato di ~50 migration (000132→000183) e molte raccomandazioni sono già state shippate via commit verificati. Vocabolario esito: `DONE` (già implementato, verificato) · `GO-INLINE` (fix piccola conservativa, batch inline) · `GO-BRANCH` (epica strutturale, branch dedicato + gate) · `DEFER` (valido, dipende da altro) · `WON'T-DO` (valutato e respinto).

## Esiti (sintesi)

| Dossier | Titolo | Esito | Debito residuo reale |
|---|---|---|---|
| D-01 | Runtime Node+Fastify + module codegen | **DONE** | solo scaffold `gen:module` opzionale (DEFER); migrazione runtime = WON'T |
| D-02 | Data layer raw SQL + boilerplate | **DONE** | coda inline: `paginationSchema(max)` factory (QW-B5); Kysely = WON'T |
| D-03 | Validazione/contratti Zod4 | **GO-INLINE** | drop subpath exports inutilizzate (regredite a 94) + paginationSchema factory |
| D-04 | Frontend client-only vs RSC | **GO-INLINE** | boundary `loading.tsx`/`error.tsx`/Suspense per-route (~1 sessione, rischio nullo) |
| D-05 | Design system @heuresys/ui | **DONE** | primitive promosse a `@heuresys/ui@0.1.8`; residuo cosmetico (mock file tracked) |
| D-06 | Tooling/build (pnpm+tsup) | **DEFER** | turbo affected-only, accoppiato a D-08 (2° runner off-prod) |
| D-07 | Migration squash-to-baseline | **WON'T-DO** | squash valutato e respinto (sha-ledger = asset audit); status quo O(pending) sano |
| D-08 | CI/CD SPOF + rollback + fork-ACE | **GO-BRANCH** | ⚠ **runner unico == PROD** + DB-CI su DB prod + `main` non protetto + gating advisory |
| D-09 | Observability /metrics | **GO-BRANCH** | ⚠ 0 prom-client, 0 `/metrics` scrapabile, ring in-RAM volatile (azzera a restart) |
| D-10 | Architettura monolite vs servizi | **DONE** | monolite = asset; agent-gateway sotto build/lint; split = WON'T |
| D-11 | Brownfield engine freeze | **GO-INLINE** | flag `BROWNFIELD_ENGINE_ENABLED` + `ENGINE_STATUS.md` (~0.5-1 sessione, ≥15 test) |
| D-12 | AI/embedding pgvector+Voyage | **DONE** | solo `VOYAGE_API_KEY` in denylist env-key-merge (~15min); vector-store esterno = WON'T |
| D-13 | Auth self-built vs managed | **DONE** | TOTP AES-256-GCM at-rest live (`secret-crypto.ts`); OIDC/SCIM = DEFER; IdP managed = WON'T |
| D-14 | GTM / multi-tenant readiness | **GO-BRANCH** | ⚠ provisioning self-service + GDPR-tooling (§3.1 IBRIDO PM-approvata, 0 live) |

## I 3 fronti strutturali genuini (GO-BRANCH)

1. **D-08 — CI/CD topologia**: l'item ad alto valore (pg_dump pre-deploy + `vm-rollback.sh` + probe-as-gate + fork-PR gate) è **shippato**, ma il cuore SPOF è intatto: il runner self-hosted **è** il PROD host, la CI gira sul **DB prod condiviso** (no `heuresys_ci` isolato), `main` non è branch-protected (0 required-checks), gating advisory. Cluster su branch: DB/schema-CI separato + ephemeral/cgroup + required-checks + runner off-prod (linux-pc twin già pronto) + deploy atomico.
2. **D-14 — provisioning + GDPR**: la Conservativa (indici tenant + governance TRUST_PROXY) è shippata; la direzione PM-approvata S987 (§3.1 IBRIDO: provision-engine transazionale + GDPR-tooling minimo DSR/retention) è a **zero live**. Epic ~3-5 sessioni, riusa il pattern 7-step, base tenant-isolation pulita. Fase-5 (PII vera / signup pubblico) = DEFER esplicito.
3. **D-09 — observability**: la Evolutiva (`/metrics` Prometheus loopback + collector pull + counter auth-event) è **tutta da fare**; oggi solo ring in-RAM volatile via `/v1/observability/system-health`. Additivo ~1-1.5 sessione, +1 dep API + collector systemd → scala branch. Non urgente (0 incidenti), ma è un GO raccomandato aperto.

## Coda inline low-risk (GO-INLINE, batch conservativo)

- **D-03**: drop subpath exports non usate (verify-first, gate typecheck) + `paginationSchema(max)` factory.
- **D-04**: boundary `loading.tsx`/`error.tsx` co-locati + Suspense per-route (path auth invariato).
- **D-11**: flag `BROWNFIELD_ENGINE_ENABLED` (default false in PROD) sui 4 route-plugin ETL + `ENGINE_STATUS.md`.
- **micro** (da DONE): `VOYAGE_API_KEY` in denylist `env-key-merge.sh` (D-12); riga WON'T-DO squash in `DEBT_REGISTER` (D-07).

## Verdetto del triage

Il debito strutturale residuo è **molto più piccolo** di quanto i dossier (S993) suggeriscano: 6 dossier di fatto DONE, 2 terminali (D-06 DEFER-coupled, D-07 WON'T), 3 inline-minori, e **3 sole epiche genuine su branch** (D-08, D-09, D-14). **Nessun debito di correttezza o sicurezza aperto**: tenant-isolation, auth ASVS, boundary monolite, sha-ledger migration sono asset confermati da non regredire. Coerente con la scorecard finance-readiness S1022 (CONDITIONAL-GO): le condizioni sono dimensionabili, non strutturali.
