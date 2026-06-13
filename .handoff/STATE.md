# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-13 (S987).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S987 — programma post-v1.0 avviato)

Avviato il **programma post-v1.0 8-fasi** (piano `~/.claude/plans/superpowers-prima-di-tutto-serialized-wolf.md`, direttiva Enzo "esegui tutto tranne #7 SF + #10 dormienti"). **Decisioni intervista P3 + Fase 3 tutte prese e registrate** (memoria `project_post_v1_program_s987` + dossier roadmap §5 + sotto). **Fasi 0-2 ✅** (D-26 silent-refresh fix `fa564fe`; audit 100X-A1 WS-G `0ba0eb4` → 30 finding **1 CRITICAL**; quick-wins R5 backup + R7 reindex + 3.7 DR drill `fdd412b` + R6 OpenAPI `a279f5c`). **Fase 3 iniziata**: #8a mapping HS stale corretto live (`a589a6e`, mig 000110). Backup pre-op sulla VM `pre-fase3-s987.dump`. 2 scoperte gated: 🔴 D-08 CRITICAL (fork-PR su prod) + 🟡 D-27 (a11y mobile).

## Top priorities (next session)

1. **Fase 3 residua** (decisioni prese, backup pronto): **#8b** import chiara.spenuso (user-pipeline HEURESYS) · **R1** modulo `engagement-feedback` + import 400+6 RTL · **R2** popola crosswalk ATECO↔NACE ~5.5k · **R3** cleanup 91 `OLDDB::` + catalogo `sys_job_role_families` + ESCO enrichment 25 RTL-ROLE. Dettaglio: `memory/project_post_v1_program_s987`.
2. **Fasi 4-8** (bet, sequenza decisa): 3.5 reporting/export → 3.4 notifications → #6 provisioning + 3.9 GDPR → 3.2 security audit → 3.3 BPM runtime → 3.6 PWA + 3.8 AI. Ognuna `design→spec→ok→implementa`.
3. **🔴 D-08 CRITICAL** (audit A1): repo PUBBLICO + runner CI su host PROD + trigger pull_request → fork-PR ACE su prod. Mitigazione conservativa = togliere `pull_request` dai workflow self-hosted. Decisione Enzo (fase E 100X o quick-fix). `FINDINGS/WS-G.md`.

## Open questions

- **D-08**: mitigare il fork-PR subito (quick-fix ~minuti) o gated nel dossier D-08 (fase E)?
- **D-27** a11y: affrontare prima del prossimo gate full-suite web (Fase 4)? È data-drift (8 cert E2E residue) o strutturale (tabIndex)?
- **#8b**: `spen.zosky@heuresys.com` è identità distinta o omonimia con lo `spen.zosky@gmail` legacy escluso (README rtl-rebuild:37)? (Enzo ha scelto "solo chiara" → spen.zosky da verificare.)
- **100X**: dopo Fase 3, riprendere gli audit A2..A11 (sequenza programma 100X) in parallelo ai bet 4-8?

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT canonical_tenant_id FROM brownfield.tenant_id_mappings WHERE legacy_id LIKE 'd5855519%'"  # = 8bc5bc59 (HEURESYS, #8a)
curl -s -o /dev/null -w 'PROD %{http_code}\n' https://www.heuresys.com/login   # 200
```
