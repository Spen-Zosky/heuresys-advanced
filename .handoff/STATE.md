# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-16 (S992 — batch 1-4 + P3 3.5 reporting/export + P3 3.4 notification center; tutto live PROD + CI verde).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S992 — batch + P3 ondata-1: 3.5 + 3.4)

Sessione lunga, delega per fasi. **Batch 1-4**: #1 Dependabot (già chiuso da `c92c3a9`, verificato) · #3 AI-matching P1b (già fatto `664588e`, E2E ri-verde live) · **#2 reporting export** (nuovo: `GET /v1/analytics/:view/export?format=csv|json`) · **#4 D-36** (wrapper `e2e-node22.mjs` — Playwright 1.61 è latest stable, no bump → pin Node 22 riproducibile; RISOLTO). **P3 ondata-1** (ordine S987, design→ok→implementa): **3.5 reporting/export** = exporter generico `?format=csv|xlsx|pdf` su tutti gli ~85 endpoint list `{items,total}` (hook `onSend` zero-touch, RBAC-safe) · **3.4 notification center** = chassis (`sys_notification_preferences` mig 000126 + `emitNotification` + `/me/notification-preferences`) + **6 producer event-driven** (GAP_CLOSURE_DUE/ASSESSMENT_REQUEST/MANAGER_FEEDBACK_READY/TRAINING_DEADLINE/CAREER_TARGET_STATUS + SYSTEM broadcast `POST /v1/notifications`, mig 000127) + digest scheduler (mig 000128 registry + systemd timer). Tutto pushato (`03b46d3..93e5791`), deployato PROD (VM/Mac/linux-pc), CI 6/6 verde. **Lavoro VM divergente preservato** (assorbito in origin: playwright root pin `f278ede` + agent-sdk 0.3.178).

## Top priorities (next session)

1. **P3 ondata-1 prosegue → 3.2 security** (poi 3.3 BPM). ⚠ scope da chiarire con Enzo: report OWASP ASVS · hardening attuativo dei finding · oppure feature security/audit-log dashboard (si sovrappone in parte all'audit WS-H già fatto). `design→spec→ok`. Memoria `project_post_v1_program_s987`.
2. **3.4 digest email = `blocked-on-Enzo: SMTP creds`** — il chassis (digest scheduler + `IMailer.sendNotificationDigest` + systemd timer daily 02:45) è completo e testato (InMemoryMailer); l'invio email reale è no-op finché non fornisci le credenziali SMTP. Il notification center **in-app è pienamente live**.
3. **Altri P3** (decisione prodotto = tuo "cosa"): #5 m2b Surveys normalized (tabelle nuove vs JSONB) · T2.5 mapping RACI OU↔processi · #8 audit 100X A4..A11 (sospeso, sessione dedicata).

## Open questions

- **3.2 security**: quale forma vuoi (report ASVS / hardening / feature dashboard)? = tua autorità.
- **SMTP creds**: per attivare l'invio email del digest 3.4 (oggi gated, in-app funzionante).

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
curl -s -o /dev/null -w 'PROD export %{http_code}\n' https://www.heuresys.com/api/v1/users   # 401 (route live)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.v_reconciliation_status WHERE resolved_status='UNCLASSIFIED'"  # 0
```
