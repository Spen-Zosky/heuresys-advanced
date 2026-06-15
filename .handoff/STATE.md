# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-15 (S990 — batch menu 1→11 autonomo, pushato + deployato + PROD-verificato).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S990 — batch 1→11 con decision-authority session-scoped)

Eseguito l'intero menu di sessione in autonomia (discovery evidence-based 5-agenti → esecuzione → full gate → push → align → vm-deploy → **PROD verify multi-angolo**). 11 commit (`ce558d3`..`913a07e`). **DONE-LIVE**: #4 RBAC doc-fix (8/394→11/586/133) · #5/D-30 doc-fix · #7 audit **A3/WS-F** (19 finding) · #3 ESCO **T1.3** enterprise-typing (mig 000119) · **T2.4** skill_kind (000120) · **T2.5** modulo OU↔process (000121/122) · **T1.2** occupation→skill 126051 righe (000123) · **T1.1** connector skill-hierarchy code-slice (000124, backfill deferred). **CODE-slice (live blocked-on-Enzo)**: #1 M-2 (redaction+audit-sink+M-3 allowlist+approval bridge, 47/47) · #6 WI-B.3/B.4 (agent dev page + 3-skill harness). Gate verde: full API suite **963/0/6-skip**, migrate-chain 123 idempotenti, web build, i18n 1198×2×7. PROD: `/login` 200 · `/api/readyz` 200 · nuovo codice live · dati live. **Regressione catturata in PROD-verify**: enterprise-typing test cancellava il profilo reference RTL_BANK (classe D-23, smascherata da T1.3) → fix snapshot-restore (`5e3e56f`) + dato ripristinato; 5 PR dependabot etichettati `defer-major` per fermare il CI-race old-test sul DB condiviso (WS-G F-3). Spec ESCO + DEBT_REGISTER committati da Enzo (`913a07e`).

## Top priorities (next session)

1. **#8 Item #4 — Fasi 4-8** (post-v1.0): 4 design-doc producibili subito (3.5 reporting · 3.3 BPM runtime · 3.2 sec-audit · #6 provisioning) — autorità *cosa*=Enzo, `design→spec→ok→implementa`. Memoria `project_post_v1_program_s987`.
2. **#9 residuo agente** (⛔ blocked-on-Enzo = credenziale `ANTHROPIC_API_KEY`/Bedrock/Vertex, subscription `out_of_credits`): M-2 write-live gated su RTL_BANK + WI-B.3/B.4 demo live (code già pronto).
3. **ESCO downstream** (⛔ network): T1.1 backfill 14k (`POST /v1/reference-sync/runs {source:'ESCO_SKILL_HIERARCHY'}`, PLATFORM_ADMIN) → sblocca **T2.6** clustering + **T3.8** Skills-Group-Share.
4. **S-100X-A4..A11** audit forense (read-only doc-only). **#11 dependabot**: #32/#35 CLEAN (rimuovi `defer-major` + merge), #33/#34/#36 restano deferiti (test-integration fail).

## Open questions

- **#11**: i 5 PR dependabot sono `defer-major` (per fermare il CI-race che cancellava RTL). Vuoi che rimuova il label + mergi #32 (minor group) + #35 (cross-env) e lasci deferiti i 3 major rotti? (azione remota, attendo go).
- **WS-G F-3 strutturale**: la CI gira gli integration test contro il DB PROD condiviso → i test che mutano dati reference (enterprise-typing fixato) rischiano data-loss. Dossier 100X (DB hermetico) = decisione.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(enterprise_typing_industry_class_id) FROM sys.sys_enterprise_typing_profiles"  # 2
curl -s -o /dev/null -w 'PROD %{http_code}\n' https://www.heuresys.com/login   # 200
```
