# BASELINE_METRICS — S-100X-0 (2026-06-13, HEAD `7e5b86d`)

> Misure di partenza con comandi riproducibili. Ogni epic d'esecuzione misura il delta contro questi numeri. Misurato live su host Windows (Git Bash), tunnel :5433 up. **Snapshot orientativo** — ri-misurare a ogni sessione che ne dipende.

## Stack / toolchain

| Componente | Versione | Note |
|---|---|---|
| node (dev host) | **v24.3.0** | target dichiarato Node 22 (engines ≥22) → drift dev-host, non un blocker |
| pnpm | 9.15.0 | |
| TypeScript | 6.0.3 (4 ws) | |
| Next.js | 16.2.7 (web+showcase) | |
| Fastify | 5.8.5 | |
| Zod | 4.4.3 | + fastify-type-provider-zod 6 |
| vitest | 4.1.8 | |

```bash
node -v; pnpm -v
grep -hE '"(typescript|next|fastify|zod|vitest)"' apps/*/package.json packages/*/package.json | sort -u
```

## Struttura (counts live)

| Unità | Live | Comando |
|---|---|---|
| moduli API (dir) | **72** | `ls -d apps/api/src/modules/*/ \| wc -l` |
| route.ts | 72 | `find apps/api/src -name routes.ts \| wc -l` |
| endpoint (app.<verb>) | **405** (~407) | `grep -rhoE "app\.(get\|post\|patch\|put\|delete)\(" apps/api/src/modules \| wc -l` |
| shared schema | 75 | `ls packages/shared/src/schemas/*.ts \| wc -l` |
| web page.tsx | 83 (64 "use client", 19 non = showcase route-group + redirect stub) | `find apps/web/src/app -name page.tsx \| wc -l` |
| showcase page.tsx | 19 | |
| migration .sql | **108** (`000001..000109`, gap 000035) | `ls db/migrations/*.sql \| wc -l` |
| ADR | 23 | `ls docs/architecture/adr/*.md \| wc -l` |
| TS/TSX src LOC | ~26.3k | `git ls-files 'apps/**/*.ts*' 'packages/**/*.ts' \| grep -vE '\.d\.ts$' \| xargs wc -l` |
| LOC module-pattern (repo+svc+routes+schema) | ~33.4k | repo 15.1k / svc 7.4k / routes 4.6k / schema 6.3k |
| SQL migration LOC | 12.4k | |

## Test

| Metrica | Live | Note |
|---|---|---|
| file integration API | **130** (129 su disco + variazioni) | `find apps/api/test -name '*.test.ts' \| wc -l` |
| `it()/test()` blocks | **901** | tutti su DB reale (tunnel) |
| modello esecuzione vitest | **single-worker serial** | `fileParallelism:false, maxWorkers:1` (`apps/api/vitest.config.ts`) — evita race refresh-rotation |
| unit-layer puro | ~10 file incidentali (pg-pool, rbac-cache-boot, esco-connector…) | piramide invertita |
| Playwright spec | 47 | serial (`workers:1, fullyParallel:false`), `retries:1`, 0 skip/fixme attivi |

## CI (ultime run su `main`, push S985)

| Workflow | Durata | Runner |
|---|---|---|
| Typecheck (all ws) | **14m0s** | self-hosted oci-vm |
| Test (api integration) | **12m42s** | self-hosted oci-vm |
| Lint (all ws) | 3m20s | self-hosted oci-vm |
| Playwright smoke | 6m15s | self-hosted oci-vm |
| Build (web) | 1m53s | self-hosted oci-vm |
| Deploy showcase (gh-pages) | 32s–1m56s | ubuntu-latest |

8 workflow totali; **7/8 sul runner self-hosted unico = la VM prod** (SPOF). `gh run list -L 8`.

## Footprint

| Voce | Dimensione | Tracked? |
|---|---|---|
| repo on-disk (no .git/node_modules) | **31G** | — |
| `apps/web/.next` | 24G | gitignored, rigenerabile |
| `apps/showcase/.next` | 3.0G | gitignored, rigenerabile |
| `pg_dump_snapshots/` | 3.7G | gitignored, 0 tracked |
| node_modules | 1.2G | gitignored |
| `.git` | 23M (size-pack 19.4MiB) | history sana |
| file tracked | 1791 | |

```bash
du -sh apps/web/.next apps/showcase/.next pg_dump_snapshots node_modules .git
git count-objects -vH; git ls-files | wc -l
```
**−~31G** reclaimabili a comando (`.next` + dumps rigenerabili).

## Drift osservati vs SoT dichiarata

- `apps/api/package.json` description: "58 modules, 272 endpoints" → reale **72 moduli / ~407 endpoint** (doc-drift cosmetico, QW-5).
- node dev-host **v24.3.0** vs target dichiarato Node 22.
- 8 env var referenziate in `apps/api/src/config/env.ts` ma assenti da `.env.example`: `WEBAUTHN_RP_ID/ORIGINS/RP_NAME`, `SMS_PROVIDER`, `SMS_FROM`, `MEDIA_STORAGE_DIR`, `MFA_ENROLL_CONFIRM`, `AUTH_LOGIN_RATELIMIT_MAX`.
- `drizzle-orm` (prod dep) + `drizzle-kit` (dev): **0 consumatori** del `db` export (tutti i 83 import sono `{ pool }`) → dead dependency.

## Note di provenienza
Counts coerenti con `docs/kb/SOT_STATE.md` §0-novodecies (S985). Differenze = drift fisiologico tra snapshot di handoff e misura live; questo file è la baseline ufficiale del programma 100X.
