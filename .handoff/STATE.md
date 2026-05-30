# heuresys-advanced — STATE

**Updated**: 2026-05-30 (S948). **Branch**: `main` HEAD `844a736` = origin. **CI**: 5/5 verde (F4 incl. Playwright; swap 8G ha risolto l'OOM).

## Last session brief

- **Brand-fidelity F4 charts COMPLETO** (4 fasi pushate `f13f472`→`804c3d0`): compensation/career/visualizations/org-chart con EChartsCard via boundary `(authenticated)/_charts-client.tsx` (`ssr:false`, gate CW-B59 ok) + bugfix interfacce stale viz. API-first, E2E prod verde ogni fase.
- **Cleanup VM** (~6G) + **swap 4→8G** → OOM CI risolto alla radice. VM+Mac allineati al codice.
- **Analisi inquinamento DB tenant/user**: 433 user/1 tenant da fasi diverse; 2 dataset RTL incoerenti (rtl-bank.org REALE ma non-wired vs rtl-bank-reference SINTETICO wired). **Discovery legacy** (workflow `wf_4445cc37-d22`) ha trovato dump PostgreSQL freschi (mar-mag 2026) con FK chain reali.

## Top priorities (next session)

1. **🔴 RTL TENANT REBUILD — #1.** SPEC completo: `docs/superpowers/specs/2026-05-30-rtl-tenant-rebuild.md`. Collassare a 2 tenant (rtl-bank.org reale + heuresys.com), wirare user reali a posizioni/org **importati dal legacy** (NON sintetico), ricablare personas E2E su utenti reali, portare logica RBAC→UI dal legacy, sanitizzare schemi. **Phase 0 = pg_dump backup.** Fonte ⭐ VM `/home/ubuntu/heuresys-evo` dump 7-mag (367MB, 270 empl/4 tenant) + DB Docker live. Memoria: `project-rtl-tenant-rebuild`.
2. **Brand-fidelity F5 ESS `/me/*`** (~6-8h) + **F6 admin** + **F7-refactor showcase** (ok Enzo). Dopo il rebuild (dati ESS reali).

## Open questions

- Snapshot legacy canonico: VM heuresys-evo 7-mag (freschissimo+ricco) vs heuresys.com.evo pre-ESCO (FK chain più pulita)? Confermare a inizio rebuild.
- ~20 tabelle sensibili legacy senza tenant_id/RLS → estrazione RTL con filtro esplicito (no cross-tenant leak).

## Stack snapshot

- HEAD `844a736`. VM **swap 8G**. EChartsCard SOLO via `_charts-client` (mai import diretto nelle pagine chart). E2E SEMPRE in prod build. Web dev prod-verify: `pnpm --filter @heuresys/web build` + `next start` (env `NEXT_PUBLIC_API_PROXY_BASE_URL=http://localhost:3001`); riavvio :3000 via `Stop-Process` PID.
- Web app VM live: `http://80.225.82.207:3013` (login persona seed `Admin#PassW0rd!`). Tunnel DB :5433 hands-off (ADR-0021).

## Verification (next session)
```bash
nc -z localhost 5433                                  # tunnel
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                 # CI verde
```
