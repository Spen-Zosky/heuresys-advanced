# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-18 (S996 — batch autonomo #4-#14 intervista-guidata: 8 item full-stack live, 13 commit pushati al close).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S996 — batch #4-#14, decision-authority session-scoped)

Enzo: "esegui tutti i punti da #4 a #14 in autonomia, intervista iniziale poi nessuna interruzione." Intervista (4 decisioni): **nessuna credenziale** abilitata (AI-backfill/SMTP/SMS/agent-serving restano dormienti) · Surveys = **costruisci mirror normalizzato** · RACI+process_kpi = **tieni demo+EXCLUDE** · MFA = **slice attuale**. Workflow di design-mapping (6 agenti Explore) → blueprint, poi implementazione in-loop con gate+commit atomico per item. **8 item SHIPPED full-stack live**: **D-37** fix hook-timeout+ESCO-seam (DEBT RISOLTO); **#4 WI-D2** position KPI rank (mig 000137, PIP view + write endpoints); **#7 B-10b** doc-truth (le 3 aree erano GIÀ shipped S970-S988 → CHIUSO; pulse_configs WON'T-DO); **#6/#10 Surveys-templates** (mig 000140 + seed 55, completa il cluster m2b normalized); **#5 BPM slice-2** ordered multi-level chains (mig 000138) + slice-3 design-spec; **#4 WI-C** modulo `tenant-materialization` generator slice-1 + MCP wiring. **test-fix** reconciliation-registry (A26→27 per 000140) + me-interfaces (+me-surveys = **regressione latente S995 catturata dal gate**, R3/R17). Gate: typecheck 5/5 ws, full API suite verde, i18n 1328×2×7, agent-gateway 47/47, migration idempotenti ×2 applicate live.

## Top priorities (next session)

> **#8 QW-E5 ✅ FATTO** (`@heuresys/ui@0.1.7` pubblicato su npm + deployato live su PROD — VM ui=0.1.7; ux-design-shared `a815421`, consumer `cdff66c`). + **fix deploy-blocker `000078`** (`ac4b723`, assert surveys-perm reso re-run-safe — break latente S995).

1. **#5 BPM slice-3** — effect-wiring registry (code seam) + SLA/escalation scheduler. Spec `docs/superpowers/specs/2026-06-18-bpm-approval-slice2-3-design.md`. Multi-sessione (SLA needs systemd deploy; effects needs natural target).
2. **#4 WI-C residuo** — users/assignments/skills/ranked-KPI materialization + demo agent live E2E (rate-limited MAX / no API key).
3. **QW follow-up** — `detail-panel.tsx` FieldGrid è il 2° primitive duplicato web+showcase (stessa de-dup di QW-E5).

## Open questions (autorità *cosa* = Enzo, invariate)

- Surveys mirror **full-fleet** (oltre RTL+HEU — tenant-mapping) · RACI **produzione** · process_kpi **crosswalk** · credenziali dormienti (VOYAGE/SMTP/SMS/API-key) · MFA **estensione ruoli**.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo il push S996
ls db/migrations/*.sql | tail -1                               # 000140 (gap 000035+000139)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_reconciliation_registry"  # 111
```
