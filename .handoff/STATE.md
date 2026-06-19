# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-19 (S997 — batch autonomo 1-6+10: 5 item pieni + BPM slice-3b SLA live; push + align Mac/VM + deploy PROD verificato).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S997 — batch 1-6+10, decision-authority session-scoped)

Enzo: "da 1 a 6 e poi 10, tutto in autonomia" + sblocco item-3 ("adotta docs/product come SoT prodotto + ri-verifica latent-capability su schema advanced"). **5 item chiusi pieni + 1 slice live**: **#6** Dependabot (nodemailer→9.0.1 + dompurify→3.4.11, 3 alert); **#3** `docs/product/` adottata SoT del dominio prodotto (CLAUDE.md) + **Fase-0 LIVE** (MLCE/maturity/event-store *assenti* sul DB reale, catalogo latente sovrastima = legacy evo); **#4** de-dup FieldGrid → **`@heuresys/ui@0.1.8`** pubblicata npm; **#5** QW-SEC5 (audit `MFA_FAIL`, test 13/13) + QW-J3 (TRUST_PROXY governance) + tracker 100X riconciliato; **#1** BPM **slice-3b SLA/escalation SHIPPED** (mig 000141, runApprovalSla + sla-cli + systemd, test live 2/2 RTL). **#2/#10 = residui** (vedi sotto). Gate: typecheck 5/5 · suite-fix notification 7→9 (regressione catturata) · full-suite fail = **flaky D-20** (timeout tunnel sotto carico, file isolati 42/42 verdi). Full-close: 8 commit pushati (`8df493b`) + align Mac/VM/linux-pc + deploy PROD verificato (`/login` 200, `/api/readyz` ok, mig 000141 live).

## Top priorities (next session)

1. **#1 BPM slice-3a effect-wiring** — handler registry per mutare il subject su `apply`. Serve un *natural* apply-effect target (candidato = WI-C tenant-materialization activation, pending→active). Spec `docs/superpowers/specs/2026-06-18-bpm-approval-slice2-3-design.md` §3a. Multi-sessione.
2. **#2 WI-C residuo** — estensione generatore `tenant-materialization` a users/assignments (credential-less SYNTHETIC_REFERENCE, decisione keying I14) + skill/ranked-KPI = mini-modulo dedicato; demo agente live E2E = **gated** (MAX rate-limited / no API key).
3. **Gap #1 prodotto** — Porte Process/Org UI + MLCE + Maturity engine (~7.5-9 pw, additivo). Piano `docs/product/WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md`; Fase-0 fatta. Autorità *cosa* = Enzo.

## Open questions (autorità *cosa* = Enzo, decision-prep allegata nel backlog S997)

- **Surveys mirror full-fleet** → serve tenant-mapping legacy→v5 (i 2 tenant ACTIVE già coperti). · **RACI di produzione** → mapping reale OU↔processo (oggi 13 demo RTL). · **process_kpi crosswalk** → `sys_process_kpi_templates`=0 (muro B-42); serve crosswalk autorato o resta EXCLUDE. · (Credenziali dormienti + MFA estensione ruoli = già DECISI S996.)

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push S997
ls db/migrations/*.sql | tail -1                               # 000141 (139 file, gap 000035+000139)
curl -s https://www.heuresys.com/api/readyz                    # {"status":"ready",...}
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_approval_steps WHERE approval_step_due_at IS NOT NULL"  # SLA-tracked steps
```
