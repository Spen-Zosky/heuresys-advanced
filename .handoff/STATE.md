# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-05 (S1015 — D-51 + D-52 CHIUSI e live su main; fix hook claude-mem Windows).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1015)

Chiusi **entrambi i debiti residui dell'audit S1014** (batch "2+3" di Enzo). **D-51**: la tassonomia data-class (ADR-0027 F2) ora è **prescrittiva** — nuovo gate boot-time (`lib/scope/gate.ts`): una route read su risorsa sensibile senza dichiarazione `config.orgGate` **impedisce il boot**; tutte le route sensibili annotate con marker verificati; il gate ha scovato e fatto chiudere un residuo reale (mentorship sessions tenant-only vs pairing org-gated). **D-52**: suite integration ora **ermetica** — ogni file di test gira in UNA transazione reale rollbackata a fine file (zero residui sul DB condiviso, niente coupling inter-file), `withTransaction` dell'app mappato su savepoint, errori SQL intenzionali preservati via savepoint-di-scrittura serializzati; rollback **provato live** (0 login-events committati durante run con centinaia di login); escape hatch `TEST_TX_ISOLATION=0`. Suite completa verde sotto isolamento. Extra: risolto il blocco hook claude-mem su Windows (socket worker orfano → memoria `reference_claude_mem_mcp_flakiness`). **Registro debiti: 0 aperti.**

## Top priorities (next session)

1. **pricing page** GTM (#4, ACTIVE — autorità *cosa* = Enzo: servono numeri prezzi/tier).
2. **#8 EMAIL** dormiente (WAIT-INPUT: app-password Outlook) → attiva EMAIL_OTP + digest in una mossa.

## Open questions (autorità *cosa* = Enzo)

- **F4 activity entities**: task model generico vs riuso goals/approvals (sblocca F4).
- **pricing**: numeri prezzi/tier per la pricing page GTM.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline                                  # 0 (tutto pushato)
cd apps/api && pnpm exec vitest run test/org-gate.integration.test.ts   # D-51 gate 4/4 verde
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_auth_login_events WHERE created_at > now() - interval '1 hour';"   # dopo un run vitest: 0 = isolamento D-52 attivo
python docs/kb/tools/handoff_lint.py                                 # OK
```
