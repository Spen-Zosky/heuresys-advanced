# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-21 (S1002 — Gap#1 follow-up + RACI + #13 + (c) + #4 go-to-market primo deliverable).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui. Menu generato da `docs/kb/tools/build_menu.py` (P2).

## Last session brief (S1002 — lunga, multi-blocco)

Sessione lunga e produttiva, partita dal menu (Gap#1 follow-up) e proseguita su richiesta di Enzo item dopo item, con consolidamento progressivo. **Blocchi**: (1) **Gap#1 follow-up CLASS-A chiuso 100%** — (a) grant `ORG_DIRECTOR` holder-of-record = Valentina Conti, (b) Porta-1 RACI drill-down, (d) radar maturità Org-Director, (c) rubrica Maturity estratta a registry config versionato `rubric.ts` (behavior-preserving). (2) **#5/#11 RACI di produzione** — Claude ha proposto e Enzo approvato il mapping completo OU↔processo: seed declarative SoT, 105 assegnazioni reali su 23 processi. (3) **#13 B-50 bridges chiuso** — i bridge erano già risolti (sys_branches + derivazioni); residuo doc-drift reconciliato (mig 000151, 28 registry NEEDS_DECISION→IMPORT, 0 residui). (4) **#4 GO-TO-MARKET — primo deliverable SHIPPED**: front-door landing pubblica su `www.heuresys.com/` + lead capture GDPR (modulo `/v1/leads`, migration `sys_leads`, pagina `/privacy`), brainstorming→spec→piano→esecuzione **subagent-driven** (11 task), final review opus. Il processo rigoroso ha intercettato 4 bug reali (RBAC re-grant leak, honeypot schema, GET authz codes, form select — l'ultimo scovato dall'E2E live). Tutto live-verified (lead reale salvato con consenso). Granulare → `SOT_STATE.md §Delta S1002-GTM`.

## Top priorities (next session)

1. **#4 go-to-market — prossimo deliverable** (autorità *cosa* = Enzo): il primo (front-door + lead form) è live; i candidati next dal brainstorming = investor one-pager · demo guidata · pricing. È il keystone del programma.
2. **#8 EMAIL dormiente** (WAIT-INPUT): app-password Outlook → attiva EMAIL_OTP + digest live (transport pronto). *(C1 rate-limit deploy-verify già RISOLTO live post-deploy — D-42: 429 sul burst, per-IP funziona.)*

## Open questions (autorità *cosa* = Enzo)

- **Go-to-market — forma dei prossimi deliverable**: investor one-pager vs demo guidata vs pricing (il primo, la front-door, è shipped).
- **Lead pipeline ops**: chi gestisce i lead in arrivo (oggi: GET admin + export CSV/XLSX; lead-management UI = follow-up deferito).

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                           # OK (0 fail)
curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/    # 200 (landing pubblica, non più redirect login)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\d sys.sys_leads"   # tabella lead esiste
```
