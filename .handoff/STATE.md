# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-16 (S1019 — riallineamento post-batch-VM: flotta in parità, piano batch versionato nel repo).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md` (Delta S1019). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. **Ripartenza batch → `docs/kb/RESUME_S1018_BATCH.md`** (autoritativo) + piano **`docs/kb/PLAN_S1018_BATCH.md`** (ora versionato nel repo, con nota di adattamento local-first).

## Last session brief (S1019)

**Riallineamento** dopo la sessione S1018 eseguita direttamente sulla VM (in deroga a local-first, ora ripristinato): i 18 commit del batch sono confluiti in GitHub → locale → linux-pc (tutti su HEAD comune); suite API completa verde in locale (zero fail; conteggi nel granulare); DB già migrato (condiviso via tunnel); DB linux-pc ri-clonato 1:1 dalla VM; `.env` locale integrato (2 chiavi S1018, `COOKIE_SECURE=false` per topologia dev). Il piano autoritativo del batch (viveva solo in `~/.claude/plans/` sulla VM) è ora **versionato**: `docs/kb/PLAN_S1018_BATCH.md`. **Nessun deploy** (decisione Enzo: deploy solo a W13) → PROD www gira ancora la versione pre-batch.

## Top priorities (next session)

1. **Serie-A P2/P3 residua** — #29 talent-review (9-box), #32 comp-read, #33 time-off (ACTIVE, blueprint nel piano W2).
2. **W3 Serie B** — #34 approval-handlers, #37 reward-gate-engine, #36 viz-versioning, #38 inbox-SSE, #35 observability.
3. Poi W4-W13 in ordine (RESUME doc). Deploy PROD SOLO a W13 (`vm-deploy.sh` protetto da D-08).

## Open questions (autorità *cosa* = Enzo)

- **Pricing page** (#4): numeri prezzi/tier — non forniti (pagina resta in attesa).
- **#8 app-password Outlook** → sblocca #39 EMAIL (WAIT-INPUT). **#52 E2 SSO**: serve client-id/secret IdP.
- **#16 SuccessFactors**: sandbox esterno (WAIT-INPUT).
- **linux-pc**: `MATCHING_FREETEXT_ENABLED` resta OFF lì (denylist by-design di `env-key-merge.sh`) — accenderlo a mano se lo si vuole anche sul twin.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 (tutto pushato)
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000172 (DB già migrato)
python docs/kb/tools/session_start.py             # menu + salute (1 round)
```
