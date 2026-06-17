# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-17 (S994 — batch 13-item intervista-guidata: QW CLASS-A live + SEC6 + B-50 close + RACI demo + 14 dossier + 2 design-spec; full close push+align+deploy).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S994 — intervista preventiva + full close, ultracode multi-workflow)

Batch da 13 item scelti via **intervista preventiva** con scelte evidence-based (discovery 6-agenti). **Live shipped**: refactor backend (`ActorContext`/`withTransaction`→`db/client.ts`/pagination factory/teams N+1, −626 LOC) · QW-D1 chart code-split + **QW-E1 token rosso** (`text-destructive` non registrato → errori erano invisibili) + QW-E2/D2 · CI hardening (cache pnpm/.next + SHA-pin 26 action + showcase sister-checkout drop + agent-gateway in CI) · **QW-K3** dump archival→VM OCI (27 file/3.7G) · QW-A1 dead-deps + clean install · **QW-SEC6** AES-256-GCM TOTP encryption-at-rest (key-presence-gated, retro-compat) · **anti-drift docs** (de-hardcode counts→SOT_STATE + INDEX regen + handoff wired). **Reconciliation**: B-50 chiuso terminale; **#11 RACI demo live** su RTL_BANK (0 HEURESYS). **Design-spec consegnati**: 14 dossier Fase-C + BPM approval-flow + Surveys-UI. Gate verdi (vitest 1012/0, web build 76/76, typecheck 5/5). Full close: push + align Mac/VM + deploy PROD + handoff.

## Top priorities (next session)

1. **Implementare dai design-spec** (tuo go sul *cosa*): **#9 BPM approval-flow** (`docs/superpowers/specs/2026-06-17-bpm-approval-flow-design.md` — riusa notification center) · **#10 Surveys UI admin+ESS** (`docs/superpowers/specs/2026-06-17-surveys-engagement-ui-design.md`). ~1-2 sessioni ciascuno.
2. **14 dossier Fase-C** (`docs/kb/improvement/DOSSIERS/D-01..D-14`): tua decisione per-dossier go/defer/won't → poi S-100X-E esecuzione epic.
3. **QW residui CLASS-A**: QW-B4/B5/B3 (resto refactor backend — shared ActorContext/pagination factory/teams batch) · QW-E2-5 i18n · QW-G1/G5 verifica CI post-SHA-pin · **S-100X-A-L** (ecosistema Claude, design-only — unico audit Fase-A non fatto).

## Open questions

- **#12 `process_kpi_templates` import**: bloccato sul muro tassonomico (legacy BP-*/EN/SF vs v5 ordinal 00..22, code-overlap 0/25) → serve un **crosswalk processi autorato da te**, oppure resta EXCLUDE (B-50 chiuso terminale a parte questo).
- **#11 RACI di produzione**: quale OU è R/A/C/I reale (la demo su RTL_BANK è dimostrativa, autorata a mano).
- **#15 post-deploy**: i 6 secret TOTP sono **tutti e2e-fixture** → restano plaintext **by-design** (skip-guard); l'encryption-at-rest AES-256-GCM vale per future enrollment reali (non-fixture). **Nessun bulk-encrypt da eseguire.**

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -t -c "SELECT count(*) FILTER (WHERE auth_mfa_factor_secret LIKE 'enc:v1:%') enc, count(*) total FROM sys.sys_auth_mfa_factors"  # enc=0 total=6 (fixture plaintext, atteso)
ls docs/kb/improvement/DOSSIERS/D-*.md | wc -l   # 14
```
