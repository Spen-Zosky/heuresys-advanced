# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-27 (S1008 — #21 chiuso: @heuresys/ui 0.1.9 a11y shell + perf subpath split, live su PROD).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1008 — #21 a11y + perf, gate sciolto alla radice)

#21 (residuo tail audit S1006, era **GATED** su `ux-design-shared`) **chiuso end-to-end e live**. Il gate era anche parzialmente obsoleto (la 0.1.8 già consumata aveva 2 fix a11y dentro) → sciolto alla radice invece di assumerlo, misurando le violazioni reali dal report axe S1006. **`@heuresys/ui@0.1.9` pubblicato** (lib commit `c31e4c7`): **a11y shell** — `DashboardShell` `<main>`→`<div tabIndex=0>` (elimina i 3 landmark: no-duplicate-main / landmark-unique / main-is-top-level, perché ogni pagina rende già il proprio `<main>`); `sidebar-group-toggle` `min-h-6` (23→24px, WCAG 2.5.8 tap-target ×9); `AuditFeed`/`LogStream` scroll-region `tabIndex=0`+`aria-label` (scrollable-region-focusable, serious). **perf** — subpath exports `./charts` (echarts) + `./markdown` (mermaid) via tsup multi-entry, così un dynamic import non tira più l'intero barrel da ~1.68MB. Lato repo (`dd8deb8`): bump `^0.1.9` (root+web+showcase) + `_charts-client.tsx` rewire ai subpath. **Verifica LIVE www.heuresys.com** (login reale `admin@`): `/dashboard` axe **0 violazioni totali** (era 4 core + 9 tap-target), `<main>`=1, toggle=24px, feed focusabile; chunk barrel splittato (echarts 1.1MB / mermaid 3.9MB / cytoscape 420KB ora separati). CI **9/9 verde**, deploy VM verde, lib **116 test + 5 regression-guard nuovi** (`dashboard-a11y-21.test.tsx`).

## Top priorities (next session)

1. **#4 go-to-market — prossimo deliverable** (autorità *cosa* = Enzo): pricing page o altro. Keystone del programma, P1 sbloccato.
2. **#8 EMAIL dormiente** (WAIT-INPUT): app-password Outlook → EMAIL_OTP + digest live.
3. **#16 SuccessFactors** (WAIT-INPUT): sandbox esterno (costo).

## Open questions (autorità *cosa* = Enzo)

- **Forma del prossimo deliverable GTM**: pricing page (serve i suoi numeri) vs altro.
- **Strategia multi-industry (#17 L2/L3)**: onboarding tenant legacy non-banking vs single-industry reference (HOLD).

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                           # OK (0 fail)
npm view @heuresys/ui version                                  # 0.1.9
curl -sI https://www.heuresys.com/login | grep -i content-security-policy  # presente
```
