# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-19 (S998 — batch menu 1/2/6/15 + #7 + WI-C slice-2b + Gap#1 design-spec; push + deploy PROD; chiusura su decisione Enzo con GATE riallineamento product docs attivo).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S998 — batch autonomo "chiudere tutto", decision-authority session-scoped)

Enzo: "esegui 1/2/6/15 in autonomia, poi affrontiamo i rimanenti; obiettivo chiudere tutto tranne audit 9/10/11". **Chiusi pieni + verificati live**: **#15** D-36 già risolto → bullet stale riconciliato (doc); **#6** R5/R7 già fatto → verificato LIVE su VM (timer attivi, backup 2026-06-19 7 dump, reindex embedda) + `.env.example` knobs R5; **#1** BPM **slice-3a effect-wiring SHIPPED** (`approvals/effects/` registry + handler reale `TENANT_ACTIVATION` che flippa il tenant subject PENDING_ACTIVATION→ACTIVE, dispatch atomico in `applyRequest` con `APPLY_EFFECT_FAILED`, unknown type → pure marker; approvals 19/19); **#2** WI-C **slice-2a+2b SHIPPED → WI-C COMPLETO** (incumbent SYNTHETIC_REFERENCE + PRIMARY ACTIVE assignment per posizione + catalogo skill/ranked-KPI tenant-scoped + evidence per-incumbent set-based; keying `SYN_` I14; tenant-mat 9/9); **#7** D-08 **pre-deploy `pg_dump` snapshot** in `vm-deploy.sh` (rollback net, dump 217M live). Gate: **full API suite 1063 pass / 6 skip / 0 fail** + typecheck 5/5 ws + typecheck:test. (slice-2b aggiunta a context-budget dopo il close: l'agente live E2E resta l'unico gated, MAX rate-limit.) **Rimanenti dispozionati (Enzo confermato in blocco)**: terminali #12(JSONB canonico, no normalized cluster)/#5c(process_kpi crosswalk EXCLUDE, muro B-42)/#14(PSR già S978)/#18(linux-pc refresh on-demand)/#19(B-30 WON'T-DO desktop); **programma-faro schedulato** #3+#4+#5RACI+#13+#17; **blocked-on-Enzo** #8(creds SMTP)/#16(sandbox SF). 7 commit (`4e85940`), push + align Mac/VM/linux-pc + deploy PROD verificato (`/api/readyz` ok, `/login` 200). **Extra post-close (context-budget)**: WI-C slice-2b shipped+deployato (`4e85940`/`576b095`) + **Gap#1 design-spec esecutivo** scritto+pushato (`f3faed0`, `docs/product/WORKITEM_GAP1_DESIGN_SPEC.md`). **Chiusura S998 (decisione Enzo)**: consolidamento product docs in corso → **GATE riallineamento attivo** (vedi priorità 0), Gap#1 sospeso fino al riallineamento.

## Top priorities (next session)

0. **🔴 GATE — Riallineamento analisi ai product docs consolidati** (decisione Enzo S998). È in corso il **consolidamento di `docs/product/`** → le analisi product-derived possono diventare obsolete. **Azione programmata (gated)**: a consolidamento concluso (segnale Enzo), riallineare tutte le analisi (Gap#1 spec/piano/Fase-0, latent-catalog, competitive scorecard, PRD) ai docs consolidati PRIMA di costruire. ⛔ **Sospende il programma-faro Gap#1 sotto** — non avviare il build (RBAC/Porta-1 inclusi) prima del riallineamento. Dettaglio: `SOT_BACKLOG.md` §"GATE ATTIVO". Effort ~0.5-1 sessione.
1. **(sospeso dal GATE) Programma-faro "rendi il prodotto dimostrabile → go-to-market"** — #3 **Gap#1** (porte Process/Org UI + MLCE + Maturity engine, ~7.5-9 pw additivo) è l'abilitatore del **#4 go-to-market**; **#5-RACI prod** (mapping reale OU↔processo) + **#13 B-50 bridges** (location↔OU, job→position) = suoi input; **#17 Wave-3** (multi-tenant-onboarding, ora con fondazione WI-C) dopo. Autorità *cosa*/scope = Enzo. **Design-spec esecutivo PRONTO** → `docs/product/WORKITEM_GAP1_DESIGN_SPEC.md` (data-model/algoritmi/endpoint/test/migration tutti verificati live + sequenza di build + 9 decisioni di scope D1-D5/D-grain/D-cap/D-mode/D-RACI per Enzo). Manca solo il tuo *go* + lo scioglimento delle decisioni; poi costruisco io (RBAC+Porta1 sono live-oggi, MLCE→Maturity→Porta2 a seguire). Piano `WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` + Fase-0 `WORKITEM_GAP1_PHASE0_VERIFICATION.md`.
2. **Blocked-on-Enzo (input solo tuo)** — **#8 EMAIL**: app-password Outlook (`enzo.spenuso@outlook.com`) → attivo EMAIL_OTP + digest live in 1 mossa; **#16 SuccessFactors**: serve un sandbox SF.
3. **WI-C demo agente live (gated)** — il modulo `tenant-materialization` è COMPLETO (slice-2a+2b); resta solo la dimostrazione E2E orchestrata dall'agente #9, gated dal rate-limit MAX. Il registry `effects/` di #1 permette di agganciare un handler `TENANT_MATERIALIZATION` apply-effect senza rework.

## Open questions (autorità *cosa* = Enzo)

- **Scope programma-faro**: Gap#1 Porta-2-first? Mapping RACI di produzione reale? — input necessari prima del build di #3. (Il batch S998 incl. WI-C slice-2a+2b è già pushato + deployato PROD verificato.)

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push S998
ls db/migrations/*.sql | tail -1                               # 000141 (139 file, gap 000035+000139 cosmetici)
cd apps/api && pnpm exec vitest run test/approvals-effects.integration.test.ts test/tenant-materialization.integration.test.ts  # 12/12 (slice-3a + slice-2a)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_users WHERE user_type='SYNTHETIC_REFERENCE'"  # WI-C incumbents (post-apply su tenant)
```
