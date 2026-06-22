# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-22 (S1003 — #4 go-to-market deliverable 2+3: investor one-pager + demo guidata, live).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1003 — #4 GTM deliverable 2+3, subagent-driven)

Sessione mono-tema su **#4 go-to-market**: scelti da Enzo (ultracode + remote-control) i deliverable **investor one-pager** + **demo guidata interattiva**. Pattern rigoroso del primo deliverable: discovery (workflow 4 agenti) → spec → piano → build inline a tappe → gate verdi → deploy → verifica live. **Shipped LIVE su PROD**: (1) **fondazione** — `lead_source` enum WEBSITE/INVESTOR/DEMO (mig 000153, segmenta la pipeline lead) + endpoint pubblico `GET /v1/public/platform-stats` (count aggregati live, no-PII, rate-limited 30/min, TTL 5min); (2) **`/investors`** — one-pager con metriche **reali live** (da platform-stats) + 6 fatti codebase (provenance) + 3 wedge + traction onesta + roadmap qualitativa + soft-CTA; export PDF via print-CSS; **teaser senza cifre** (decisione Enzo) + tono **onesto/sotto-promessa** (decisione Enzo); (3) **`/demo`** — tour scriptato a 10 tappe con **screenshot reali** catturati dal vivo su RTL_BANK (capture-demo.gen.ts re-runnable), wow-moment = maturità organizzativa L0-L5; CTA `source=DEMO`. **Decisioni Enzo**: ask=teaser-no-numbers · tono=onesto-sotto-promessa. **Fix collaterale** (R3/R17c, debito pre-esistente NON di questa sessione): il test `organization-unit-processes-raci-demo` era stale dopo il refactor RACI demo→produzione di S1002 (cercava 12 demo, ne trovava 0 → già rosso pre-sessione) — ri-puntato al seed di produzione (tag S1002-#5/#11), assert ri-verificati live. Gate: typecheck 5ws + eslint + i18n + suite API + E2E investors/demo live + **CI tutta verde** + deploy exit 0 + **prova live PROD** (lead INVESTOR+DEMO reali creati e rimossi). Granulare → `SOT_STATE.md §Delta S1003`.

## Top priorities (next session)

1. **#4 go-to-market — prossimo deliverable** (autorità *cosa* = Enzo): la front-door (S1002) + one-pager + demo guidata (S1003) sono live. Candidato rimasto = **pricing page** (richiede la decisione business prezzi/tier = solo Enzo) o altro deliverable a sua scelta. È il keystone del programma.
2. **#8 EMAIL dormiente** (WAIT-INPUT): app-password Outlook → attiva EMAIL_OTP + digest live (transport pronto).

## Open questions (autorità *cosa* = Enzo)

- **Forma del prossimo deliverable GTM**: pricing page (serve i suoi numeri) vs altro.
- **Investor one-pager — l'ask**: è teaser senza cifre (deciso S1003); aggiungere importo/strumento/valutazione = cambio di solo testo i18n (`investors.json`), montabile in minuti quando Enzo fornisce i numeri.
- **Lead pipeline ops**: oggi GET admin + export CSV/XLSX, ora segmentato per `source` (website/investor/demo); lead-management UI = follow-up in HOLD.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                           # OK (0 fail)
curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/investors   # 200
curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/demo        # 200
curl -s https://www.heuresys.com/api/v1/public/platform-stats | head -c 80  # JSON live counts
```
