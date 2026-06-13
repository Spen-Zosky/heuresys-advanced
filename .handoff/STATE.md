# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-14 (S988).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S988 — batch autonomo item 1-6, decision-authority session-scoped)

Eseguito il batch del menu post-v1.0 (Enzo: "esegui 1-6, decidi tu su tecnica/gate/guardrail, push+handoff+align+deploy a fine"). **8 commit** + lib `@heuresys/ui@0.1.6` pubblicata. **Item 1 D-08 CRITICAL ✅** (fork-guard job-level sui 7 workflow self-hosted → fork-PR skippato pre-checkout). **Item 2 Fase 3 dati COMPLETA ✅**: #8b chiara.spenuso (mig 000111), R2 crosswalk ATECO↔NACE bidirezionale 5730 (000112), R1 modulo `engagement-feedback` + import RTL 400+6 (000113/114 + seed 51, 13 endpoint, 11 test), R3 cleanup 91 OLDDB + family-wiring 25 RTL + ESCO enrich (000115). **Item 3 D-27 a11y ✅** (lib fix 0.1.6, mobile-a11y prod gate 42/42). **Item 5 A2 audit ✅** (WS-H, doc-only, 5 sub-agent). Gate: full API suite **925/0**, typecheck 4/4. **Items 4 (Fasi 4-8) e 6 (B-10b m2b) NON eseguiti** — feature major multi-sessione con regola `design→spec→ok→implementa` (checkpoint PM sul *cosa*): deferiti onestamente, non auto-implementati. **Coda post-handoff (richiesta Enzo)**: 🔴 **D-28 RISOLTO+deployato** (`79b7a97`: footgun `z.coerce.boolean` scoperto — VM girava effettivo `trustProxy=true`/spoofabile; fix `parseTrustProxy` hop-count + VM `.env TRUST_PROXY=1`, linuxpc/local `false` ora corretto); **linuxpc DB ri-clonato dalla VM** (`clone-vm-db.sh` → 5730/chiara/400 = VM, esce dal drift). Tutte le macchine allineate a `79b7a97`, VM+linuxpc deployate, PROD live.

## Top priorities (next session)

1. **Item #4 — Fasi 4-8** (sequenza decisa): 3.5 reporting/export → 3.4 notifications → #6 provisioning+3.9 GDPR → 3.2 security audit → 3.3 BPM runtime → 3.6 PWA+3.8 AI. Ognuna `design→spec→ok→implementa` (autorità *cosa* = Enzo). Multi-sessione. Memoria `project_post_v1_program_s987`.
2. **Item #6 — B-10b m2b** Surveys cluster normalizzato (~6-8h, `design→spec→ok`). `SOT_BACKLOG §B-10b m2b`.
3. **A2 follow-up** (decide Enzo per-finding, `FINDINGS/WS-H.md`; D-28 ✅ già risolto): 6 quick-win QW-H1..6 (QW-H1 drizzle dead-dep→chiude alert Dependabot esbuild · QW-H2 media magic-byte sniff · QW-H3 rate-limit keyGen dead [F-WS-H-2] · QW-H4 requirePermission skill-taxonomy · QW-H5 mailer redaction · QW-H6 matching/reindex per-route limit). + **S-100X-A3** (audit successivo).

## Open questions

- **R3 deviazione (CLASS-A, veto Enzo)**: la decisione diceva "crea `sys_job_role_families`", ma il catalogo canonico esiste già (`sys_job_families`) → ho wirato quello (no tabella duplicata). OK o vuoi un catalogo separato? (mig 000115).
- **R2 ~5.5k**: ho popolato bidirezionale (NARROWER 2865 + BROADER 2865 = 5730); la decisione diceva "kind=NARROWER ~5.5k". OK o solo NARROWER (2865)?
- **ESCO low-confidence**: 11/25 RTL roles hanno mapping ESCO `low_confidence=true` (flag review); rivedere i match deboli (es. Head-of-Commercial-Banking→commercial pilot)?

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_engagement_feedback"  # 400
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_activity_classification_mappings"  # 5730
curl -s -o /dev/null -w 'PROD %{http_code}\n' https://www.heuresys.com/login   # 200
```
