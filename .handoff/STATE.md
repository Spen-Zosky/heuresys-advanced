# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-15 (#9 Agent SDK integration — continuazione live E2E, da riprendere in sessione fresca).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## ⭐ RIPRESA #9 — Agent SDK + MCP integration (continuazione in sessione fresca, 2026-06-15)

Dettaglio completo: `docs/kb/SOT_BACKLOG.md §🔌 Integrazione #9` + `docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md`. **DoD live vincolante** (CLAUDE.md §Definition of Done).

**✅ DONE-LIVE**: §0 DoD persistita · WI-A esenzione MFA (mig `000116/000117`) · M-8/M-8b (mig `000118` SERVICE-only + audit) · WI-B mock-first (`apps/agent-gateway`) · **WI-B.2 READ+AGENTE live** (gateway SSE → SDK **subscription-auth** → tool MCP `hrx_org_units_list` → /v1 → **26 org-unit RTL_BANK reali**) · §0.5 safety verde (tenant test = **RTL_BANK `86ba7a65`**; DB = OCI VM reale via tunnel :5433; mai scrivere su HEURESYS `8bc5bc59`).

**🛑 BLOCKER (blocked-on-Enzo) — WI-C/WI-D**: sovrapposti alla spec parallela **non committata** `docs/integrations/tenant_onboarding_esco_04_tenant_onboarding_spec_2026-06-15.md` (Cowork/Enzo) + **conflitto numerazione**: il #04 dichiara "Migration next = 000118" ma è già **M-8b**. Decisioni: (1) WI-C secondo spec #04 (riconciliare) o Cowork-owned? (2) spec parallele rinumerano `000119+`? (3) i 4 file `tenant_onboarding_esco_*` + `DEBT_REGISTER.md` (M) sono nel working tree **non committati** — lasciati intatti (non-CLI).

**Residuo non-bloccato**: **M-2** (write-gate completo + 1 write-live gated su RTL_BANK: approval+rollback+audit) · **WI-B.3** (3 skill /hr live) + **WI-B.4** (pagina dev Next) — **agente, vincolati dal rate-limit subscription** `out_of_credits`; porta PROD agente = API key reale/Bedrock/Vertex.

**Auth agente DEV**: gateway con `AGENT_GATEWAY_SUBSCRIPTION_AUTH=1` (unset ANTHROPIC_API_KEY → subscription Claude). **Nessun push** (commit locali #9, da `20fac45` a `5996d1c`). Migration su disco `000001..000118`.

## Last session brief (S989 — chiusura pending + tech debt, autonomo)

Batch "chiusura completa pending + tech debt" (decision-authority session-scoped). **MFA/SMTP neutralization** (la sola implementazione richiesta da Enzo): nuovo kill-switch `MFA_ENFORCEMENT_ENABLED` (default true → PROD invariato; `=false` nel `.env` dev locale; gate login `§3b` bypassato; DI seam + **denylist `env-key-merge` anti-propagazione PROD** + test dedicato) — SMTP/email-OTP/SMS-OTP/TOFU erano **già** neutrali by-design (factory Console fallback, mai throw). **Tutti e 6 i QW-H** (S-100X-A2 WS-H) chiusi: H1 drizzle dead-dep + esbuild≥0.28.1 (**alert Dependabot chiuso, `pnpm audit`=0**), H2 media magic-byte sniff, H3 rate-limit keyGen dead, H4 skill-taxonomy requirePermission, H5 ConsoleMailer OTP redaction, H6 matching/reindex rate-limit. **D-29** cert E2E teardown RISOLTO (Playwright globalTeardown psql). **3 open-question S988 risolte** (CLASS-A, veto Enzo): R3 KEEP `sys_job_families`, R2 KEEP crosswalk bidirezionale 5730, ESCO 11 low-conf già flaggati (design corretto). Gate verde: full API suite 918/0 + 21-skip, typecheck 4/4, web build, i18n 1177×2×7, lint, shell 43/43, audit 0. Push + align Mac/VM/linuxpc + vm-deploy PROD.

## Top priorities (next session)

1. **Item #4 — Fasi 4-8** (programma post-v1.0): 3.5 reporting/export → 3.4 notifications → #6 provisioning+3.9 GDPR → 3.2 sec-audit → 3.3 BPM runtime → 3.6 PWA+3.8 AI. Ognuna `design→spec→ok→implementa` (autorità *cosa* = Enzo). Multi-sessione. Memoria `project_post_v1_program_s987`.
2. **S-100X-A3** (+ A4..A11) — prossimi workstream audit forense 100X (read-only, doc-only). `SOT_BACKLOG §100X`.
3. **A2 residuo**: i 6 QW-H ✅ DONE; resta solo il doc-fix RBAC baseline (CLAUDE.md stale "8 ruoli/394" → reale **11/586/133**, WS-H §104).

## Open questions

- (nessuna bloccante) Le 3 deviazioni S988 sono risolte CLASS-A con veto tuo: vuoi R2 solo-NARROWER? → `DELETE … kind='BROADER'` (2865). Vuoi rivedere i 6/11 match ESCO low-conf deboli (commercial pilot, fight director…)? → data-task opzionale (sono già flaggati, non usati come verità).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_activity_classification_mappings"  # 5730
curl -s -o /dev/null -w 'PROD %{http_code}\n' https://www.heuresys.com/login   # 200
```
