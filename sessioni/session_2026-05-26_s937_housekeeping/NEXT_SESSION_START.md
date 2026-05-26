# NEXT_SESSION_START — S937 Housekeeping closure + return to dev

**Created**: 2026-05-26 17:45 GMT+2 (post-S935+S936 + R23 cross-layer patch)
**Predecessors**: S933 pre-flight + S934 CW-B60-A + S935 B/C/E/F/D/Z + S936 6 follow-up
**Last tag pushed**: `v0.4.0-mvp4-ready` (post-S935-Z)
**Last HEAD pushed**: `9fa3e57` docs(cowork): S936-6 R23 AUTONOMIA OPERATIVA cross-layer
**Sync state**: origin/main 0/0
**Working tree**: clean

---

## §0 — Bootstrap obbligatorio prima del primo tool call

Stampa il MANDATORY BOOTSTRAP ACK come da user_preferences v5 + carica via ToolSearch i tool del MANDATORY TOOL PRELOAD. Riporta nel bootstrap ACK l'ultima riga "Tool preload: completato (15+ tool caricati)".

Letture obbligatorie pre-task (in ordine):

1. `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0bis (S934 outcome) + §0ter (S935 outcome) — i 2 doc principali di state.
2. `sessioni/session_2026-05-26_s935/S935_SESSION_REPORT.md` — full report S935 con findings critici R14 audit.
3. `qa_artifacts/s936_outcome_summary.md` — outcome dei 6 follow-up S936.
4. `cowork_reserved/bias_registry.md` §60 (CW-B60-A+B MITIGATED, CW-B59 partial-mitigation) + §61 (CW-B61 silent-skip observability).
5. **Questo file** (NEXT_SESSION_START.md) — piano + todo S937.

---

## §1 — Stato repo

| Item | Stato |
|---|---|
| HEAD locale | `9fa3e57` (post-S936-6) |
| Origin/main sync | 0/0 ahead/behind |
| Working tree | clean |
| Tag corrente | `v0.4.0-mvp4-ready` (post-S935-Z) |
| Tag intermedio | `v0.3.4-p0-closed` (post-S935-C, 3 P0 chiusi) |
| Bias registry | 60 catalogued / 42 mitigated / next CW-B62 |
| CI workflows | 6 shipped (typecheck/lint/i18n/test-integration/build-web/playwright-smoke) — runner OCI VM **non ancora registrato** |
| Filesystem MCP | ✅ FIXED S936-5 (allowed_directories: D:\, C:\, C:\Users\enzospenuso) |
| User preferences | ✅ v5 paste manuale fatto S936-6 (da verificare clean status in CK-5) |
| R23 AUTONOMIA OPERATIVA | ✅ injected in 3 layer (L1 user_preferences + L2 global CLAUDE.md + L3 project CLAUDE.md) |

---

## §2 — Carry-over da S935+S936 (housekeeping da chiudere)

Lista task pendenti in ordine raccomandato di esecuzione. Effort range ~5-8h cumulative.

### CK-1 (P0): SSH automation setup — sblocca CK-2 + CK-3 + CW-B60-A live validation

**Problema**: la chiave `oci_recovery_ed25519` ha passphrase che richiede prompt interattivo non bypassable da MCP `Start-Process -RedirectStandardInput`. Tutti i task che richiedono SSH a oracle-vm-default sono bloccati (vedi S936-2/S936-3).

**Soluzione candidata (scegliere 1)**:

| Opzione | Setup time | Sicurezza | Reusability |
|---|---|---|---|
| **A** ssh-agent persistent via registry Windows | ~15 min | Alta (passphrase decrypted in memory, persistente ai reboot) | Alta — funziona per tutti i task SSH futuri |
| **B** Service-account key dedicata no-passphrase | ~30 min | Media (key sui disco non protetta, ma scope-limited a CI/automation) | Alta — separation of concerns |
| **C** ssh-agent + AddKeysToAgent yes (current config) + manual `ssh-add` una volta per sessione Windows | 0 (esistente) | Alta | Bassa — richiede manual step ogni reboot |

**Raccomandazione**: A (persistent agent). Setup `HKCU:\Software\OpenSSH\Agent` autostart + StartupRun script che fa `ssh-add ~/.ssh/oci_recovery_ed25519` al boot (prompt 1 volta per machine power-cycle, poi cached).

**Acceptance**: `ssh oracle-vm-default "echo OK"` returns "OK" via Cowork PowerShell senza prompt + tunnel `ssh -fN -L 5433:localhost:5432 oracle-vm-default` rimane up + listener su :5433 verificato.

**Effort**: ~30-45 min.


### CK-2 (P0): OCI VM self-hosted runner registration

**Procedura**: `docs/ci/self-hosted-runners-setup.md` §3 (9 step procedurali).

Pre-req CK-1 done. Steps:

1. SSH a oracle-vm-default (un-interactive una volta agent attivo).
2. `cd /opt/heuresys-runner` (crear dir prima).
3. Download runner package: `curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-arm64-2.319.1.tar.gz`.
4. `tar xzf actions-runner.tar.gz`.
5. Ottieni token GitHub da `Settings → Actions → Runners → New self-hosted runner` (UI claude.ai aperta da Claude via Claude in Chrome navigate).
6. `./config.sh --url https://github.com/Spen-Zosky/heuresys-advanced --token <TOKEN> --name oracle-vm-default-runner --labels self-hosted,oci-vm,linux,ARM64 --work _work --unattended`.
7. `sudo ./svc.sh install ubuntu && sudo ./svc.sh start`.
8. Create `/etc/heuresys-runner.env` (mode 600 root-owned) con `POSTGRES_*` + `COOKIE_SECRET` + `JWT_PRIVATE_KEY/PUBLIC_KEY` (base64) + `MFA_ENCRYPTION_KEY`. Update systemd unit con `EnvironmentFile=/etc/heuresys-runner.env`.
9. `sudo systemctl daemon-reload && sudo systemctl restart actions.runner.*`.

**Acceptance**: push no-op commit + GitHub Actions UI mostra runner come "Idle"; primo workflow `typecheck.yml` parte e completa green.

**Effort**: ~1-2h interactive.

### CK-3 (P1): CW-B60-A live re-run validation

**Procedura**: con tunnel SSH 5433 up (CK-1 done) + DB live attivo, eseguire Wave-1 sample run su 1 dei 3 target affetti + verificare audit count.

Steps:

1. `ssh -fN -L 5433:localhost:5432 oracle-vm-default`.
2. `cd D:\heuresys-advanced\apps\api`.
3. `$env:WAVE1_DEBUG_LIMIT="10"`.
4. Trigger Wave-1 run via API endpoint `POST /v1/brownfield/import-runs` con scope = solo `sys_skill_categories` (smallest target affetto). Oppure via tsx script integration test pattern.
5. Verifica via psql:

```sql
SELECT count(*) AS silent_skip_rows
  FROM audit.import_validation_results
 WHERE import_validation_result_rule_code = 'SILENT_UPSERT_ZERO_ROWS_V1'
   AND created_at > now() - interval '1 hour';
```

Se `silent_skip_rows > 0` → CW-B61 fix validated live, mark MITIGATED-VERIFIED-LIVE in bias_registry.

**Acceptance**: ≥ 1 audit row emessa con `rule_code='SILENT_UPSERT_ZERO_ROWS_V1'` per il target affetto in re-run.

**Effort**: ~30 min.


### CK-4 (P1): CW-B59 next step — Path A revised v2 OR Path F split

**Problema**: S936-1 Path G ha eliminato `d.createContext` error ma exposed `Class extends value undefined` su `/showcase/footer`. Build admin GREEN, /showcase still blocked.

**Opzioni** (vedi `qa_artifacts/s936_outcome_summary.md` §1):

| Opzione | Effort | Probability of success |
|---|---|---|
| **Path A revised v2** | 1-2h | Medium — message-grep bisect su `Class extends\|createContext` regex (update `scripts/bisect-cw-b59-createctx.ps1` con nuovo pattern). Se converge → fix mirato. Se inconclusive → fall to F. |
| **Path F split** | 4-6h | High — split @heuresys/ui in 3 sub-packages (ui-core + ui-charts + ui-3d) deterministicamente elimina la classe di problema. Richiede 3 npm publish dal repo `ux-design-shared`. |

**Raccomandazione**: A prima (cheaper), F come fallback se inconclusive dopo max 60-90 min bisect (R14 anti-bias time-box).

**Acceptance**: `pnpm --filter @heuresys/web build` GREEN con `apps/web/src/app/showcase/` restored, no `Class extends value undefined` error nei log build.

**Effort**: 1-2h (Path A) o 4-6h (Path F).

### CK-5 (P2): Verify Layer 1 user_preferences cleanup

**Problema**: in S936-6 ho generato `cowork_reserved/PREFERENCES_v5_FINAL.txt` 9236B clean (no duplicates, v5 bumped). Utente ha pasted manualmente con possibili residui duplicati dal precedente paste S936-4.

**Step**:

1. Apri https://claude.ai/settings/profile via Claude in Chrome.
2. Read textarea `id="conversation-preferences"` value via JS.
3. Confronta length: deve essere ~9236 char + no duplicati `MANDATORY TOOL PRELOAD` (search regex `(MANDATORY TOOL PRELOAD).*\1`).
4. Se duplicati ancora presenti: ri-applicare paste full (Select All + paste PREFERENCES_v5_FINAL.txt).
5. Se OK: confermare in bias_registry / handoff.

**Effort**: ~10 min.

### CK-6 (P2): Verify CI workflows primo run dopo runner registration

**Problema**: i 6 workflow shipped in S935-F restano "queued no runner" finché OCI VM runner non è registrato (CK-2).

**Step**: post-CK-2, push un no-op commit (`git commit --allow-empty -m "ci: smoke test post-runner-registration"`) + verifica via `gh run list --limit 6` che tutti 6 workflow girino + completino green. Se rosso → fix iterativo prima di tornare a sviluppo.

**Acceptance**: 6 workflow status `success`, runner uptime documentato.

**Effort**: ~30 min (incluso fix flaky tests primo run).

---

## §3 — Pendings di sviluppo (MVP-4 stream selection)

Post-housekeeping closure, return to dev cycle. `docs/MVP_4_ROADMAP.md` ha 9 streams parallelizable. Suggested entry-points in ordine:

| Stream | Effort | Razionale |
|---|---|---|
| **2.4 SDBI Phase 2** | 3-6 settimane | Continua filone brownfield maturity (post-CW-B61+ADR-0020). Goals/OKRs + Time/Leave già shipped come pilot in X2; ora Phase 2 = produzione integrale. Massima continuità tecnica. |
| **2.7 Mobile + WCAG tail** | 2-4 settimane | UX completion. MVP-2a/b solidi; rimane responsive mobile-first delle 47 routes + tail items a11y manual checklist. Buona base per shipping cliente. |
| **2.5 MFA multi-kind hardening** | 2-3 settimane | Consolida auth post-Tappa E TOTP. Aggiungi WebAuthn/FIDO2 + backup codes + admin lifecycle (force re-MFA, audit dashboard). |
| **2.1 Wave 2 brownfield** | 1.5-3 settimane (37-75h) | Operating model deep import per RTL_BANK_REFERENCE. Pre-req: CW-B60-A live validation (CK-3) + Wave 2 runner doc già scritto. |

**Decision authority Enzo**: scegliere lo stream basato su priorità business / pressione cliente. Cowork prepara PROMPT/PLAN per CLI esecutore una volta scelto.

---

## §4 — Todo list S937 (formato actionable per task tracking)

```
S937-1  [P0] SSH agent persistent setup Windows (registry HKCU OpenSSH Agent + ssh-add startup) — ~30min
S937-2  [P0] OCI VM runner registration via SSH + ./config.sh + systemd EnvironmentFile — ~1-2h
S937-3  [P1] CW-B60-A live re-run validation (Wave-1 sample + audit count check) — ~30min
S937-4  [P1] CW-B59 Path A revised v2 bisect (regex Class extends|createContext) — 1-2h
        SE inconclusive → S937-4b [P1] CW-B59 Path F split @heuresys/ui in 3 sub-packages — 4-6h
S937-5  [P2] Verify Layer 1 user_preferences clean (length ~9236 + no MANDATORY duplicates) — ~10min
S937-6  [P2] CI primo run smoke test post-runner-registration — ~30min (incluso fix flaky)
S937-7  [P0 closure] Update HANDOFF.md + bias_registry + STATE.md + tag v0.4.1-housekeeping-closed — ~30min
S937-8  [P0 next] MVP-4 stream selection (Enzo decide via AskUserQuestion) — ~5min (ask) + start cycle
```

Effort cumulativo housekeeping (S937-1 → S937-7): ~4-7h.
Plus MVP-4 stream selection + ramp up: 30 min - 2h depending on stream.

---

## §5 — Pre-condizioni / blockers noti

- ⚠️ **SSH passphrase** — blocker CK-1 finché non si applica una delle 3 opzioni (A/B/C).
- ⚠️ **GitHub runner token** — issuance UI claude.ai → repo settings, no automation (token one-time use, 1h expiry).
- ⚠️ **ux-design-shared repo** — se si va con Path F (split @heuresys/ui), serve push lì + npm publish workflow. Repo `D:\ux-design-shared` in working state, last HEAD `dfa2e81`.
- ⚠️ **MVP-4 stream**: decisione utente non automatizzabile — Cowork prepara opzioni evidence-based ma non sceglie.

---

## §6 — Riferimenti rapidi

- `docs/MVP_4_ROADMAP.md` — 9 streams MVP-4 con effort + acceptance
- `docs/ci/self-hosted-runners-setup.md` §3 — runner registration procedure
- `docs/cw-b59-true-root-cause-2026-05-26.md` — Path G/A/F strategy + analisi forensic
- `cowork_reserved/bias_registry.md` §60-61 — CW-B60/B61 status
- `cowork_reserved/HANDOFF_FRESH_SESSION.md` — §0bis (S934) + §0ter (S935) outcomes
- `qa_artifacts/s936_outcome_summary.md` — 6 follow-up outcomes detail
- `sessioni/session_2026-05-26_s935/S935_SESSION_REPORT.md` — S935 full report
- `cowork_reserved/PREFERENCES_v5_FINAL.txt` — versione clean preferences claude.ai (paste manuale richiesto in S936-6, ricontrollare in CK-5)
- `scripts/restore-showcase-routes.ps1` + `scripts/bisect-cw-b59-createctx.ps1` — CW-B59 Path G/A helpers
- `.handoff/STATE.md` — machine-readable state + S935 closure section
- `HANDOFF.md` — top-level reverse-chrono section, prepended S934+S935+S936 in S937

---

*Created S937 priming — autonomia piena ereditata da S935+S936. R23 in vigore: zero delega evitabile + proactive tool loading + self-diagnose + evidence not suggestion.*
