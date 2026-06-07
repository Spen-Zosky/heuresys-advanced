# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-07 (S976).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare** (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md` (§0-decies = S976). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero duplicato qui.

## Last session brief (S976 — ultracode, marathon domain-complete)

Aggregato menu **#1+#3+#2+#4** eseguito in ordine **domain-complete**: **2 domini chiusi**. **CMS** (#1 frontend `/content` P1 + #3 P2: API restore/publish-workflow **catena in_review**/ESS + UI workflow-bar/`/me/handbook` "Manuale del dipendente"). **Data-mining** (#2 pagina `/insights` flight-risk + #4 slice **B succession-readiness** + **C skill-gap** API, regole tune-delegate a Claude). + **bugfix** `resolveWriteTenant` (content create PLATFORM_ADMIN 500→403, gap non testato da S975) + fix test me-interfaces. **7 commit pushati** (`a8c247b`→`8852ee0`). Gate verde: **full API suite 802/6**, web typecheck/lint/i18n/build, **4 E2E live** (content P1, CMS workflow in_review cross-persona, insights, me-interfaces). Migrazioni `000088→000092` applicate al DB centrale via tunnel. **DEPLOY PROD differito** (VM su codice pre-sessione, DB già migrato — nessuna rottura). Decisioni Enzo: catena in_review · ESS "Manuale" · pesi B/C delegati (seniority-gap droppata). Granulare → `SOT_STATE.md` §0-decies.

## Top priorities (next session)

1. **Deploy PROD S976** — `vm-deploy.sh` su `oracle-vm-default` (CI già verde post-push); allineare Mac. Porta in PROD CMS (#1/#3) + insights (#2/#4). DB centrale già migrato. ~30min.
2. **#5 Cap⑤ scraping P2** — `brownfield.source_watermarks` (HWM delta) + conditional-fetch ESCO + **systemd timer** (CLI-bypass in-process, **verifica solo su VM**). 2ª sorgente ISTAT/ATECO ⛔ ToS. Spec `2026-06-07-scraping-design.md` §6. ~M-L.
3. **#6 B-10b m2b** — cluster Surveys normalizzato (`survey_*`/`pulse_checks`): **milestone modellazione** `design→spec→ok→implementa` (autorità semantica Enzo: JSONB vs normalized; scope feedback/pulse). ~6-8h.
4. **#4 frontend opzionale** — pagine `/insights/succession-readiness` + `/skill-gap` (riusano explainability pattern di #2). API già live. ~M.
5. **B-10b m2b** · **MVP-4 residuo** (Wave-2 / Mobile-WCAG / MFA multi-kind, multi-sessione).

## Open questions

- **Deploy PROD**: quando schedularlo (prossima sessione, opzione 1 sopra).
- **#6 m2b**: scelta modello dati (A unify-JSONB / B nuove tabelle normalizzate / C bridge) + scope `engagement_feedback`/`pulse_checks` → autorità Enzo, da sciogliere a inizio #6 con lo spec.
- **#5 P2 2ª sorgente**: sign-off ToS ISTAT/ATECO (ESCO già firmata).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                          # main CI verde post-S976
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/content                # PROD pre-deploy: 404 (route non ancora deployata) → dopo deploy 401
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_succession_readiness_scores"   # >0 (slice B live)
```
