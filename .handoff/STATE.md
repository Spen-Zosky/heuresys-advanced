# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-07 (S975).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare** (versioni, DB/API/web/CI counts, architettura, migration, delta per-sessione) → `docs/kb/SOT_STATE.md` (§0-octies = S975). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero duplicato qui.

## Last session brief (S975 — ultracode, marathon)

Aggregato menu **#6+#8+#1+#3** chiusi + review adversarial, poi 3 decisioni Enzo evase: **#8** mailer lasciato com'è (ConsoleMailer, no SMTP reale — sviluppo/test senza email), **reference_sync RBAC** deciso strict PLATFORM_ADMIN-only (Claude, delegato), **cap④ CMS** greenlit → **P1 API shipped**. **8 commit pushati, CI verde, 2 deploy PROD + smoke-verificati.** Live in PROD: **#6** free-text matching · **#1** `/v1/insights` flight-risk · **#3** `/v1/reference-sync` ESCO (ora strict PLATFORM_ADMIN-only) · **cap④** `/v1/content` CMS (CRUD+categorie+versioni) · **#8** mailer-code (fallback ConsoleMailer). Review trovò 1 bug reale (jsonb guard) → fixato. Fix durevole deploy `vm-deploy.sh` (D-17, stale tsbuildinfo). Full suite **789 pass / 6 skip**. Granulare → `SOT_STATE.md` §0-octies.

## Top priorities (next session)

1. **Cap④ CMS frontend P1** — pagina admin `/content` (list/create/edit markdown-textarea + categorie), `@heuresys/ui`, i18n IT+EN, **Playwright E2E live** (author→re-read). API già live. `docs/superpowers/specs/2026-06-07-cms-design.md` §6. ~S-M.
2. **Cap④ CMS P2** — versioning UI (history/restore) + publish-workflow (`content:publish`, draft→published→archived) + ESS `/me/content` (published-only). Spec §7. ~M.
3. **Cap③ data-mining P1b + P2** — frontend `/insights` (admin) + slice B succession-readiness + C skill-gap. Spec §8. ~M.
4. **Cap⑤ scraping P2** — `brownfield.source_watermarks` + systemd timer + 2ª sorgente (ISTAT/ATECO, nuovo ToS). Spec §6. ~M-L.
5. **B-10b m2b** (surveys normalized ~6-8h) · **MVP-4 residuo** (Wave-2 / Mobile-WCAG / MFA multi-kind, multi-sessione).

## Open questions

- **Cap④ CMS frontend**: lo costruiamo subito (layer successivo P1) o lo scheduli a parte?
- **Cap⑤ P2 2ª sorgente**: sign-off ToS per ISTAT/ATECO quando ci arriviamo (ESCO già firmata).
- *(Risolte S975: #8 mailer → lasciato ConsoleMailer; reference_sync → strict PLATFORM_ADMIN-only; cap④ → greenlit, P1 API done.)*

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                          # main CI verde
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/content                # 401 = route live
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/insights/flight-risk   # 401 = route live
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT resolved_status,count(*) FROM sys.v_reconciliation_status GROUP BY 1"
```
