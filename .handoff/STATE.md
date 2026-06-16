# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-16 (S993 — workaround mail/MFA + agente MAX + **programma 100X FASE A COMPLETA (A1–A11)** + ~10 QW live).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S993 — batch + "via libera", decision-authority session-scoped)

Due aspetti sbloccati + audit forense completo + molti QW chiusi live. **(1) Mail/MFA senza SMTP RISOLTO** (EMAIL_OTP gated → MFA su TOTP+WebAuthn; digest 3.4 dormiente-opzionale; ricette gratuite). **(2) Agente #9 su MAX STABILIZZATO/CHIUSO** (no API key). **(3) Programma 100X — FASE A AUDIT COMPLETA (A1–A11)**: 7 nuovi audit forensi (WS-B/A/D/E/J/K/I) via fan-out read-only. Trovato + **fixato il CRITICAL B-1** (broadcast `POST /v1/notifications` N+1 → set-based, notifications 13/13). **QW chiusi live**: HSTS al TLS edge · 6 indici tenant-FK · pruning auth-audit (46k→37k + job daily) · drop dead idx · env footgun fail-open (`API_DOCS_ENABLED`) · clean script (`.next` 29G→0) · QW-1/3/5. Tutto pushato + align Mac/VM/linux-pc + deploy.

## Top priorities (next session)

1. **Programma 100X — FASE C (dossier → decide Enzo per-finding)**: la fase A (audit A1–A11) è chiusa; i finding confluiscono nei dossier `DOSSIERS/` per la tua decisione go/defer/won't. Resta **S-100X-A-L** (ecosistema Claude, design-only) come unico audit non fatto.
2. **QW residui CLASS-A (chiudibili da Claude su via libera)** — QW-B2 ✅ chiuso (S993). I prossimi di valore: **QW-D1** (chart code-split, bundle — gate next-build) · **QW-B4/B6** (shared ActorContext/withTransaction, =QW-4, refactor ampio) · **QW-I1/I2** (README/CLAUDE drift — ⚠ ri-drifterà senza il fix strutturale, vedi dossier anti-drift sotto) · **QW-E1** (token rosso) · **QW-A2** (agent-gateway in CI) · **QW-A1** (dead deps, gate clean-install). Lista completa + gate in `docs/kb/improvement/TODO_100X.md`.
3. **Item prodotto/dati (tuo "cosa" / multi-sessione)**: #5 BPM 3.3 · #6 m2b Surveys · #7 RACI · #8 B-50 · #10 Fasi 4-8.

## Open questions

- **Dossier anti-drift (WS-I)**: README/CLAUDE/INDEX driftano perché fuori dal flusso `handoff` — vuoi de-hardcode counts / CI drift-check / generazione da handoff?
- **QW-K3 archival dump** (3.7G off-disk) + **3.3 BPM / #7 RACI**: decisioni tue.
- **SMTP**: resta dormiente per tua scelta (riattivabile con una app-password).

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
curl -sI https://www.heuresys.com | grep -i strict-transport   # HSTS live
ls docs/kb/improvement/FINDINGS/WS-*.md | wc -l   # 9 (WS-A..K, fase A completa)
```
