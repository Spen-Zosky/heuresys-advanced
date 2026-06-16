# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-16 (S993 — workaround mail/MFA senza SMTP + agente MAX stabilizzato + 100X A4/WS-C + 3.2 ASVS + QW live).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S993 — batch post-menu, decision-authority session-scoped)

Due aspetti sbloccati + batch di QW chiusi live, poi push+deploy+handoff. **(1) Mail/MFA senza provider SMTP RISOLTO**: EMAIL_OTP ora gated su un transport reale (`mailer.productionCapable`, anti-lockout, come SMS_OTP) → MFA gira pulito su **TOTP + WebAuthn senza email**; le notifiche restano in-app (primario); il **digest 3.4 è dormiente-opzionale** (si accende da solo con SMTP), non più "blocked-on-Enzo"; ricette SMTP **gratuite** (Outlook/Gmail app-password) in `.env.example`. Email reale lasciata dormiente per **scelta di Enzo**. **(2) Agente #9 su abbonamento Claude MAX STABILIZZATO/CHIUSO** (memoria `project_agent9_subscription_max` + `.env.example` `AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`) — niente API key, **non più da riportare come gated/decisione-PM**. **(3) 100X**: audit **A4/WS-C** (dati & persistenza, 0 CRIT/3 HIGH) + **3.2 ASVS mapping** prodotti; QW chiusi live — **HSTS** al TLS edge (verificato curl), **6 indici tenant-FK** (mig 000130), **pruning auth-audit** (mig 000129: 46.348→37k + job ricorrente daily 02:00) + drop indice dead (mig 000131, −10MB), + env-doc/package.json/QW-SEC1-verify. 6 commit pushati, align Mac/VM/linux-pc + deploy VM.

## Top priorities (next session)

1. **P3 ondata-1 prosegue → 3.3 BPM** (3.2 security audit-side coperto da A4/WS-C + 3.2 ASVS + HSTS; resta l'eventuale feature security-dashboard se la vuoi). 3.3/3.5 e le Fasi 4-8 = decisione di prodotto tua (`design→spec→ok`). Memoria `project_post_v1_program_s987`.
2. **Audit 100X A5–A11** (5 wave forensi read-only, multi-sessione) + **QW residui CLASS-A**: QW-C3 (dr-drill timer settimanale), QW-SEC5 (security-audit log authn-failure), B-30 (2° runner CI = riduce SPOF), QW-2 (clean script −31G), QW-G2 (SHA-pin Actions). Tutti chiudibili da me su tuo via libera.
3. **Item prodotto/dati** (tuo "cosa" / multi-sessione, NON inventabili): #6 m2b Surveys normalized · #7 RACI mapping OU↔processi · #8 B-50 reconciliation · #5 BPM scope · QW-SEC6 AES-at-rest TOTP (L2).

## Open questions

- **3.3 BPM + 3.2 dashboard**: quale forma/scope vuoi? = tua autorità di prodotto.
- **#7 RACI**: quale OU è R/A/C/I per quale processo (fatto di business, solo tu).
- **SMTP**: resta dormiente per tua scelta; se vorrai l'email reale basta una app-password Outlook/Gmail (la wiro io).

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
curl -sI https://www.heuresys.com | grep -i strict-transport   # HSTS live
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM pg_indexes WHERE schemaname='sys' AND indexname LIKE '%_tenant_idx'"  # >=6
```
