# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-18 (S995 — batch P1: #1 BPM approval-flow + #2 Surveys-M2 entrambi COMPLETI full-stack live; #3 triage dossier consegnato. **4 commit LOCALI non pushati** per scelta Enzo).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S995 — #1 BPM approval-flow + #2 Surveys-M2, full-stack live E2E)

Batch P1 (Enzo: "procedi con i P1"; su #2 "parti ora ma chiudi anche UI"). **#1 BPM approval-flow 3.3 slice-D COMPLETO**: primo runtime BPM eseguibile — runtime approvazioni generico (2 tabelle state-machine varchar+CHECK, quorum ALL_OF/ANY_OF, riusa notification center 3.4), modulo `/v1/approvals` (5 endpoint, 10 integration test live RTL), web admin-track + decision-page + inbox-actions, E2E live verde. **#2 Surveys-M2 COMPLETO** (decisione Enzo **M2** su M0): tabella `sys_survey_assignments` (audience esplicita per-utente + completion) + perm `surveys:respond:self`, ESS write-path `/v1/me/surveys` (6 test live, dedup→409/type→422/not-assigned→404), web admin `/engagement` (pulse+results chart) + ESS `/me/surveys` form, E2E live verde. **#3 triage 14 dossier** consegnato (tabella decision-ready). Gate: typecheck 5/5 ws, i18n parity 1328×2×7, E2E live verdi (approvals + surveys). Tunnel jitter OCI risolto riavviando il task `HeuresysTunnel5433`. **Stop ai commit per scelta Enzo: NO push/align/deploy.**

## Top priorities (next session)

1. **Push + align Mac/VM + deploy PROD** dei commit S995 (gated su Enzo — questa sessione fermata ai commit locali: `c582109`/`90d03dc` #1 + `fc47eee`/`8e69a28` #2 + handoff). **Verificare l'esito della full suite API** (lanciata a fine S995 come verifica finale; gate mirati tutti verdi — 10 approvals + 6 me-surveys live + reconciliation D45 + E2E verdi; gli eventuali fail attesi = flaky infra D-20/D-37).
2. **#3 esecuzione dossier Fase-C** (sessione dedicata, scelta Enzo): decisioni per-riga go/defer/won't sui 14 dossier (triage pronto in conversazione/da rigenerare) → poi epic S-100X-E. Quick-win Tier-1: D-12/D-03/D-07/D-05/D-10/D-11; leva strutturale D-08 (pg_dump pre-deploy).
3. **#5 audit ecosistema Claude S-100X-A-L** (sessione dedicata, design-only — unico audit Fase-A mai fatto).

## Open questions

- **Surveys-M2**: M2 minimale shippato (audience = assignment esplicito; 8 assegnazioni seed RTL). OQ minori chiuse coi default (edit = strict one-shot, anonimato = display-only, ruoli respond = tutti, pulse-write ESS = deferito follow-up).
- **#1 approval** slice-2 (chain multi-livello ordinato, `ordinal`+`SKIPPED` già in schema) + slice-3 (effect-wiring per-subject + SLA/escalation) = roadmap BPM futura.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 4 commit + handoff = 5 non pushati
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_auth_role_permissions"  # 630
ls db/migrations/*.sql | tail -1                               # 000136
```
