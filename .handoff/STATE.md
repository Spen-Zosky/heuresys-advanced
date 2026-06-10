# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-10 (S981).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S981 — batch 11 item, tutti consegnati)

Batch del menu (1+2+4+5+6+7+9+10+11+12+13) eseguito end-to-end in autonomia, 10 commit pushati, CI verde, full suite verde, review adversarial multi-agente sul keystone con tutti i finding confermati fixati in-commit. **#4 mandatory-MFA è SHIPPED** (era la keystone §2.5): policy per-tenant default-OFF, terzo stato login `mfa_enrollment_required` con sessione ristretta `enr` + allowlist guard, enrollment pre-sessione (TOTP/EMAIL_OTP/passkey) nella login page, e il **login via passkey è LIVE** (l'authentication ceremony completa la sessione). Chiusi anche: media object-store cap④, rich-text handbook, B-52 linuxpc, D-19/D-20/D-21, slice a11y (regola `list` azzerata ovunque), dossier decision-ready B-50+Wave-2.

## Top priorities (next session)

1. **Attivare la mandatory-MFA su un tenant reale** (1 PUT da PLATFORM_ADMIN — il meccanismo è live, default OFF) + comunicazione agli utenti; opzionale UI admin per `/v1/mfa-policy` (oggi solo API, ~S).
2. **Decisioni PM dai dossier** (`docs/kb/B50_DEFER_UNBLOCK_PACKAGE.md` + `WAVE2_UNBLOCK_PACKAGE.md`): la Decisione #1 (regola àncora-OU per branches / fonte succession_plans) sblocca 14-15 pool + 18-24 candidati + 6 branch — import eseguibile in ~1 sessione post-greenlight.
3. **Ciclo-2 residuo**: #10 SMS_OTP code-only (~2-3h, attivazione PROD ⛔ provider/costo PM) · ESS-media serve (`/v1/me/content` media, slice ~2h) · TOFU v2 hardening (conferma out-of-band al primo enrollment, ~M).

## Open questions

- **color-contrast a11y** (28 route / 179 nodi, unico serious residuo): è una taratura dei token palette del brand bundle, render-affecting → decisione Enzo/brand (censimento in `docs/a11y-tail-items.md` §S981).
- **#10 SMS_OTP**: provider + costo (PM) per l'attivazione PROD.
- **#11 cap⑤ 2ª sorgente** ISTAT/ATECO: sign-off ToS (legale) — unico item del batch NON selezionato insieme a #3.
- **Hook claude-mem rotto** (incidente S981): worker zombie + `printf Permission denied` nel PreToolUse → il tool Read è rimasto bloccato l'intera sessione (lavorato via Bash/cat). Mitigazione da fare lato setup: esclusione Defender della cache plugin / restart worker; se ricapita, `/mcp` Reconnect non basta per i HOOK.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
curl -s -o /dev/null -w 'VM %{http_code}\n' http://80.225.82.207:8013/readyz
PGPASSWORD="$(grep -m1 localhost:5433 ~/.pgpass|cut -d: -f5)" psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT to_regclass('sys.sys_auth_mfa_policies'); SELECT to_regclass('sys.sys_content_media')"
bash db/scripts/migrate.sh | tail -1   # OK: 105 migrations applied (idempotente)
```
