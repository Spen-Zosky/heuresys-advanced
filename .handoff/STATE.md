# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-07 (S972).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare** (versioni, DB/API/web/CI counts, architettura, migration, delta per-sessione) → `docs/kb/SOT_STATE.md` (§0-septies = S972). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero duplicato qui.

## Last session brief (S972 — ultracode, "chiudi tutte le 9 action")

Discovery 9-agenti evidence-based → chiuse **tutte e 9** le action del menu (6 implementazioni full + 1 chiusura terminale + 2 deliverable design). **10 commit pushati, CI 6/6 verde, deploy PROD fatto** (`vm-deploy.sh`; smoke nuovi endpoint 401-live). **Capability ② AI COMPLETA** (P1b ESS `/me/matching` + Fase3 person→positions opzione-C + P2 reindex/person-roles/similar-users/free-text-flag-OFF) · **BI ①·#8b** skills-by-category heatmap · **B-50** muri residui a stato terminale (4 NO_SOURCE / 3 DEFER) · **B-10b stream COMPLETO** (m2 Surveys 873 righe + m3 PredictionsML 472 righe) · **MVP-4 EMAIL_OTP** (2° fattore MFA hardened) · **cap ③④⑤** 3 design spec a gate-Enzo. Full suite 756/0-fail, embedding reali invariati. Granulare → `SOT_STATE.md` §0-septies.

## Top priorities (next session)

1. **Cap ③ data-mining → plan→impl** (spec implementation-ready, gate-Enzo): serve solo che Enzo confermi/tari i pesi della derivation-rule weighted-linear; P1 = flight-risk scoring. `docs/superpowers/specs/2026-06-07-data-mining-design.md`. ~M-L.
2. **B-10b m2b** — cluster `survey_*`/`pulse_checks` normalizzato (~4482+1145 righe legacy) come slice aggiuntiva al modulo surveys. ~6-8h MED.
3. **Cap ④ CMS / ⑤ scraping → plan→impl** (spec pronte; ⑤ richiede sign-off ToS per-source, ESCO first). ~M / ~M-L.
4. **MVP-4 residuo** — Brownfield Wave-2 (source-gated) · Mobile+WCAG tail (~37-62h). Multi-sessione.

## Open questions

- **Cap ③**: confermi la derivation-rule di default (KPI 0.25 / engagement 0.25 / attendance-OT 0.20 / tenure 0.15 / comp-band 0.10 / time-since-promo 0.05) o tari tu i pesi/soglie?
- **Cap ⑤**: parto da ESCO (open-data, low-legal-risk) — dai il sign-off ToS per quella sorgente?
- **Free-text matching** (`/v1/matching/search`): abilitare in PROD (`MATCHING_FREETEXT_ENABLED=true` + `VOYAGE_API_KEY` sulla VM, oggi solo locale) o tenere OFF?
- **EMAIL_OTP**: in PROD dietro enrollment opt-in; serve un mailer reale configurato per l'invio email vero — lo configuriamo?
- **D-16 hygiene** `analytics.d.ts` (stray tracked in `dist/` gitignored): la untracko (`git rm --cached`)?

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                         # main CI verde
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/surveys      # 401 = route live
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/predictions  # 401 = route live
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT resolved_status,count(*) FROM sys.v_reconciliation_status GROUP BY 1"
```
