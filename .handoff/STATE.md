# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-24 (S1006 — audit forense QA E2E 74 pagine + ~20 fix deployati live su PROD).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1006 — audit forense + fix + deploy, delega Enzo)

Audit forense QA E2E su **74 pagine autenticate** (PROD, dati reali, batch headless + ri-verifica anti-token-TTL + pass ESS persona reale + scansioni perf/a11y/security + **workflow visivo multi-agent 98 finding confermati**). Poi fase fix **end-to-end + deploy**: **~20 fix verificati live su PROD**. Bug 🔴 chiusi: **B-01** brownfield mis-wired al contratto (crash), **B-03** ESS lockout RBAC (dipendenti funzionali senza `USER` → 403 sul proprio ESS; fix additivo mig 000155, decisione Enzo), **B-04** gauge KPI (formato, non dato), **B-05** chart dark invisibili (CSS-var non risolte nel canvas echarts; wrapper unico), **B-06** brownfield/learning/positions (contract-drift + JOIN nomi), **B-07** org-chart label. 🟡: **B-02** login GET-creds, **G-03** toggle lingua duplicato (header no-op nascosto), **CSP+Permissions-Policy** (nginx). **G-01 i18n-dati** (decisione Enzo = tradurre nel DB, IT-canonical): KPI+processi+41 non-ESCO + **13.032 skill ESCO** via API ESCO `language=it` (mig 000156-159). **Clean**: 7846 junk-skills rimossi+archiviati (000160, catalogo 21939→14093); skill_code `OLDDB::`→`ESCO::`/`COMP::` (000161). **G-02** org PARENT + gaps user/position/skill (correlated-subquery joins). **DATA** dashboard/insights = **NON-BUG** (dati synthetic statici → trend piatto; flight-risk 120 LOW+39 MEDIUM no HIGH). Deploy: 3× `vm-deploy.sh` + CSP su nginx live + tutto ri-verificato su `www.heuresys.com`. MFA resta **OFF** (decisione Enzo). Artefatti audit: `audit/FINDINGS.md` + `FORENSIC-NOTES-S1006-cli.md` + `_visual-confirmed.json`. **Residuo #21 risolto in-repo**: career-succession G-02 + **817 stale-ESCO tradotti via workflow LLM** (ESCO 100% IT, mig 000162); a11y + perf = **lib-blocked** (`@heuresys/ui`/ux-design-shared) → backlog **#21 GATED**.

## Top priorities (next session)

1. **#4 go-to-market — prossimo deliverable** (autorità *cosa* = Enzo): pricing page o altro. Keystone del programma.
2. **#8 EMAIL dormiente** (WAIT-INPUT): app-password Outlook → EMAIL_OTP + digest live.
3. **#21 GATED** — a11y shell + perf chunk-split vivono in `ux-design-shared` (`@heuresys/ui`); unblock = sessione su quel repo → publish + bump qui.

## Open questions (autorità *cosa* = Enzo)

- **Forma del prossimo deliverable GTM**: pricing page (serve i suoi numeri) vs altro.
- **Strategia multi-industry (#17 L2/L3)**: onboarding tenant legacy non-banking vs single-industry reference (HOLD).

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                           # OK (0 fail)
# S1006: skill catalogo pulito + IT
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_skills WHERE skill_code LIKE 'OLDDB::%'"  # 0
curl -sI https://www.heuresys.com/login | grep -i content-security-policy  # presente
```
