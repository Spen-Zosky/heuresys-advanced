# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-20 (S1021 — batch P1 quasi completo + molti difetti pre-esistenti corretti; Enzo chiede review forense finance-readiness).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. **Kickoff forense → `docs/kb/NEXT_SESSION_FORENSIC_KICKOFF.md`**.

## Last session brief (S1021)

Batch "tutto P1" (9 item) eseguito in autonomia — **quasi tutti shipped DoD-complete** (uno solo resta WAIT-INPUT), 16 commit `bae0a7ef..6db1b250` (15 pushati, `6db1b250` D-58-diagnosi locale): **#42** C4 fondazioni frontend (FormData + paginazione server-side + search) · **#61** G2 RBAC hygiene (36 route + isolamento auto-riparante) · **#24** F4 asse funzionale (`sys_process_participants` + resolveActivityScope + approvazioni ACTIVITY) · **#34** B3 secondo apply-effect (BPM non più vuoto) · **#46** D1 skill possession (905 righe import + endpoint) · **#47** D2 engagement (flight-risk da 1 a 3 sorgenti) · **#55** F1 capability ranker (API + formula spiegabile) · **#51** E1 whistleblowing (canale anonimo + isolamento custodian). **#4 GTM** = solo pricing page, WAIT-INPUT (numeri solo Enzo). Lungo la strada **~10 difetti pre-esistenti corretti** (catalogo skill invisibile 99,6%, D-57 grant-a-tappeto, dato falso catalogo formativo, N+1 notifiche, db:validate rotto Windows, drift schema↔contratto). **CI**: API + typecheck + lint + i18n + state-lint VERDI; **Playwright-smoke ROSSO = D-58** (pre-esistente bae0a7ef, non dei commit S1021).

## Top priorities (next session)

1. **⚠ MANDATO ENZO — PRIMA DI TUTTO**: review forense INTERO progetto + gate adversarial (avvocato del diavolo) + verdetto finance-readiness (GO/CONDITIONAL/NO-GO). Solo soluzioni professionali/stabili/avanzate, zero workaround. Kickoff completo: `docs/kb/NEXT_SESSION_FORENSIC_KICKOFF.md`. NON aprire il menu azioni prima di questo.
2. **D-58** — CI web build (Turbopack barrel `.js`): diagnosi definitiva fatta, 3 opzioni A/B/C nel register; Enzo deve scegliere l'approccio (fix professionale, non tampone).
3. Remediation del debito trovato dall'audit, in batch con vincolo "solo soluzioni professionali".

## Open questions (autorità *cosa* = Enzo)

- **Approccio D-58** (A main→dist / B web→subpath / C webpack): non scelto.
- **Pricing page** (#4): numeri prezzi/tier — non forniti.
- **#8** app-password Outlook → sblocca #39 EMAIL · **#16** sandbox SuccessFactors · **#52** SSO client-id/secret (tutti WAIT-INPUT).
- **claude-mem** (D-56): disabilitato — riattivare a plugin riparato.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # atteso 0 dopo il push di handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000181
python docs/kb/tools/session_start.py             # menu + salute (1 round)
gh run list --branch main --limit 8               # Playwright-smoke rosso = D-58
```
