# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-08 (S977).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md` (§0-undecies = S977). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S977 — ultracode, aggregato 4 item)

Aggregato **#1+#2+#4+#3**, tutti shippati + **live in PROD** (3 commit nuovi, CI verde ciascuno, deploy + Mac/VM allineati a `d320246`). **#1** deploy PROD S976 (CMS + data-mining live). **#2** cap③ insights P2 frontend `/insights/{succession-readiness,skill-gap}` (`5bf046d`, sidebar mig 000093, E2E live). **#4** D-18 **RISOLTO** — score-table insights bounded via delete-then-insert atomico + collapse mig 000094 (`f7d5fb3`). **#3** cap⑤ scraping P2 — `brownfield.source_watermarks` + conditional-fetch ESCO + lock FETCHING + systemd **weekly timer** (`d320246`, mig 000095), hardened da review adversarial 4-lente; one-shot ESCO verificato live (run-1 STAGED → run-2 UNCHANGED). 2ª sorgente ISTAT/ATECO differita (⛔ ToS). Full API suite **805/6**. Granulare → `SOT_STATE.md` §0-undecies.

## Top priorities (next session)

1. **cap⑤ P1 — ESCO full-catalogue fetch** — il refresh reale tira solo **100** occupazioni (endpoint *search* ritorna `total=100`), non ~3040. Serve bulk CSV/RDF o paginazione corretta (spec `2026-06-07-scraping-design.md` §6.2, rischio P1 noto). Catalogo già 7645 dal rebuild → refresh parziale, non urgente. ~M.
2. **#6 B-10b m2b** — cluster Surveys normalizzato (`survey_*`/`pulse_checks`): milestone modellazione `design→spec→ok→implementa` (autorità semantica Enzo: modello A/B/C + scope feedback/pulse). ~6-8h.
3. **cap④ CMS P3** (rich-text primitive upstream + media object-store + BPM cross-link + full-text) · **② Fase 3 PSR-population** (gated crosswalk) · **MVP-4 residuo** (Wave-2 / Mobile-WCAG / MFA multi-kind, multi-sessione).

## Open questions

- **cap⑤ 2ª sorgente**: sign-off ToS ISTAT/ATECO (ESCO già sanzionata D-4).
- **cap⑤ P1 ESCO-100**: quando perseguire il full-catalogue fetch (priorità prodotto Enzo).
- **#6 m2b**: modello dati A unify-JSONB / B normalizzato / C bridge + scope `engagement_feedback`/`pulse_checks` → autorità Enzo, da sciogliere a inizio #6 con lo spec.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                          # main CI verde
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT source_watermark_source_key,source_watermark_status FROM brownfield.source_watermarks"  # ESCO presente
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/insights/succession-readiness  # 401 = live PROD
MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'systemctl list-timers heuresys-advanced-scraping.timer --no-pager'  # weekly timer schedulato
```
