# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-07 (S975).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare** (versioni, DB/API/web/CI counts, architettura, migration, delta per-sessione) → `docs/kb/SOT_STATE.md` (§0-octies = S975). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero duplicato qui.

## Last session brief (S975 — ultracode, "aggregato #1+#3+#6+#8")

Aggregato 4-item dal menu, tutti chiusi + review adversarial. **5 commit pushati su origin/main, CI 6/6 verde, deploy PROD fatto + smoke-verificato.** **#6** free-text matching **LIVE in PROD** (flag + VOYAGE_API_KEY su `.env` VM, `/v1/matching/search` 200 con risultati Voyage reali). **#8** mailer SMTP reale (nodemailer env-driven, fallback ConsoleMailer = no-regressione) — **solo codice**, attivazione PROD gated su creds. **#1 cap③ data-mining** = modulo `/v1/insights` + flight-risk slice A (tabella dedicata `sys_flight_risk_scores`, regola weighted-linear coi pesi confermati, recompute/CSRF/I5/D-6). **#3 cap⑤ scraping** = modulo `/v1/reference-sync` + connector ESCO P1 (upsert idempotente catalogo, lineage, no-delete). **Review adversarial 6-agenti** → 1 bug reale (jsonb_array_elements non-guardato sul flight-risk) fixato + regression-tested. **Fix deploy** `vm-deploy.sh` (clean shared build, root-cause stale tsbuildinfo). Full suite **780 pass / 6 skip**. Granulare → `SOT_STATE.md` §0-octies.

## Top priorities (next session)

1. **Cap③ data-mining P1b + P2** — frontend page `/insights` (admin-only, `@heuresys/ui`, E2E live) + slice B succession-readiness + slice C skill-gap (riusano ② embeddings). `docs/superpowers/specs/2026-06-07-data-mining-design.md` §8. ~M.
2. **Cap⑤ scraping P2** — `brownfield.source_watermarks` (delta/HWM) + systemd timer su VM + 2ª sorgente (ISTAT/ATECO, nuovo D-4 ToS). `docs/superpowers/specs/2026-06-07-scraping-design.md` §6. ~M-L.
3. **Cap④ CMS → plan→impl** — spec pronta (gate-Enzo, mai iniziata). `docs/superpowers/specs/2026-06-07-cms-design.md`. ~M.
4. **B-10b m2b** — cluster `survey_*`/`pulse_checks` normalizzato (~5600 righe legacy). ~6-8h MED.
5. **MVP-4 residuo** — Wave-2 (source-gated) · Mobile+WCAG tail (~37-62h) · MFA multi-kind (WEBAUTHN/SMS/recovery). Multi-sessione.

## Open questions

- **#8 mailer**: configuriamo creds SMTP reali nel `.env` VM per attivare l'invio email vero? (codice pronto; oggi ConsoleMailer fallback — nessuna email reale parte).
- **reference_sync RBAC**: oggi anche TENANT_ADMIN lo eredita (catch-all 000005). Vuoi **strict PLATFORM_ADMIN-only** come spec §3.5 (denylist 000005 + revoke migration), o ok com'è?
- **Cap④ CMS**: dai il greenlight per plan→impl? (è l'unica delle 5 capability mai iniziata.)
- **Cap⑤ P2 2ª sorgente**: sign-off ToS per ISTAT/ATECO quando ci arriviamo?

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                          # main CI verde
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/insights/flight-risk       # 401 = route live
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/reference-sync/sources      # 401 = route live
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT resolved_status,count(*) FROM sys.v_reconciliation_status GROUP BY 1"
```
