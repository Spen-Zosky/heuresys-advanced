# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-15 (S991 — batch delega: #1 agente live + fix sicurezza · #2 Skills-Group-Share full-stack live · convergenza).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S991 — batch end-to-end delegato, decisione scope mia)

Delega batch ("backup DBMS poi esegui tutto in autonomia, decidi tu quante feature"). Backup PROD fatto (`/home/ubuntu/pre-s991-batch.dump`, rollback point). **Consegnato + pushato (HEAD `088cccb`)**: **#1 agente #9 LIVE** — le 3 skill `/hr` girano live su dati reali (subscription MAX viva, NIENTE out_of_credits) + **M-2 write-gate dimostrato live** su RTL_BANK (ALLOW→write 201 persistito · DENY→fail-closed · rollback) + audit M-4. **La DoD live ha scoperto un difetto di sicurezza reale e l'ho corretto**: `sdk-agent.ts` aveva `allowedTools:["mcp__heuresys__*"]` che **auto-approvava i write bypassando il gate HITL** → ora ogni tool MCP passa per `canUseTool` (`ce7e2bd`). **#2 Skills-Group-Share (T3.8) + clustering (T2.6)** full-stack live (`088cccb`): endpoint `/v1/analytics/skills-group-share` + 4 test (analytics 32/32) + pagina + nav (mig 000125) + i18n + **E2E Playwright verde**. **#3** verificato già-fatto (modulo OU↔processi + demo S990; mapping RACI reale = tua decisione). **Convergenza**: il resto del menu (m2b, reporting, mapping RACI) richiede una tua decisione di prodotto/modellazione → lasciato residuo, non inventato.

## Top priorities (next session)

1. **2 alert Dependabot nuovi** (1 high, 1 moderate, comparsi al push S991 — non dai miei commit): verificare e chiudere (`gh api .../dependabot/alerts`). Effort ~1h.
2. **Feature che richiedono il tuo "cosa"**: #5 **m2b Surveys normalized** (decisione semantica: tabelle nuove normalizzate vs unificare col cluster `engagement_*` JSONB — sorgenti legacy su VM `heuresys_platform`) · #4 **reporting/export** (quale reporting?) · **T2.5 mapping RACI reale** OU↔processi (quale OU è R/A/C/I per quale processo). Memoria `project_post_v1_program_s987`.
3. **#8 Fasi 4-8 post-v1.0** (sec-audit 3.2 / BPM 3.3 / notif 3.4 / reporting 3.5) + **Audit 100X A4..A11** (read-only). `design→spec→ok`.

## Open questions

- **m2b**: come modellare il cluster Surveys normalizzato legacy (4482 response + 1145 pulse + 31 question)? Tabelle `sys_survey_*` nuove (mirror del legacy, separate da `engagement_*`) o unificazione semantica col JSONB esistente? = tua autorità.
- **Agente #9 in PROD**: per esporre l'agente a una webapp servita ai clienti serve una API key Anthropic reale (o Bedrock/Vertex). In dev gira sulla tua subscription MAX (gratis, verificato). Vuoi pianificare il serving PROD?

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_ui_interfaces WHERE ui_interface_code='analytics-skills-group-share'"  # 1
curl -s -o /dev/null -w 'PROD %{http_code}\n' https://www.heuresys.com/login   # 200
```
