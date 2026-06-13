# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-13 (S986 / S-100X-0).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S-100X-0 — apertura programma RELEASE 100X)

Avviato il programma **100X** (audit forense QA E2E + miglioramento radicale dalla baseline GA). Sessione **read-only sul codice**, deliverable doc-only in `docs/kb/improvement/` (MASTER_PLAN, TODO, BASELINE_METRICS, INTERVIEW_LOG, AUDIT_PROTOCOL, FINDINGS seed, DOSSIERS register) + epic nel backlog — commit `eb98acc` (non era pushato fino a questo handoff). Intervista: asse dominante **robustezza/operability**, breaking **aperto via dossier**, appetite **evoluzione selettiva**, **audit completo poi decido**. Scoperto durante il recon: una **WIP D-26 nel working tree** (fix parziale del silent-refresh, NON committata — vedi DEBT_REGISTER D-26). Incidente d'ambiente: hook `claude-mem` down tutta la sessione → plugin disabilitato in `~/.claude/settings.json` (reversibile, fuori repo); per riattivarlo serve risolvere il worker + `true` alla riga 156.

## Top priorities (next session)

1. **D-26 — fix silent-refresh / hard-logout 15min PROD** (🔴, ~2-4h, sessione dedicata). **NB: una WIP parziale è già nel working tree** (uncommitted: `auth/tokens.ts`, `web/lib/api/fetch.ts`, `web/proxy.ts`, `shared/schemas/auth.ts` + 2 nuovi test) — opzione (a) cookie path `/` + single-flight refresh + proxy resumable. Decidere se completarla o ripartire. Vedi DEBT_REGISTER D-26.
2. **S-100X-A1 — audit WS-G (CI/CD & deploy)**: primo audit del programma 100X (runner SPOF + 0 rollback, leva robustezza). Sequenza A1..A11+A-L poi consolidamento → decide Enzo per-dossier. SoT programma: `docs/kb/improvement/MASTER_PLAN_100X.md` + `TODO_100X.md`.
3. **Decisioni dossier roadmap post-v1.0** (PM) + quick-wins CLASSE A (R5 backup DB · R7 timer reindex · DR drill) — invariati, `docs/kb/POST_V1_ROADMAP_DOSSIER.md`.

## Open questions

- **D-26**: completare la WIP in tree o ripartire? quale opzione design (a/b/c/d in DEBT_REGISTER)? greenlight sessione dedicata?
- **100X**: confermare i 6 default d'intervista (budget/compliance/dati/git-history/WS-L/KPI in `INTERVIEW_LOG.md`)? quando lanciare S-100X-A1?
- **claude-mem**: riavviare Claude Code per riattivare il plugin dopo aver risolto il worker daemon (warmup non completa, DB 93MB)?
- Invariate: go-to-market (dossier §3.1) · SMS provider per SMS_OTP · creds SMTP per TOFU v2.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
ls docs/kb/improvement/                                        # deliverable 100X presenti
git status --short                                             # WIP D-26 ancora nel tree (11 M + 2 ??)
curl -s -o /dev/null -w 'PROD %{http_code}\n' https://www.heuresys.com/login   # 200
```
