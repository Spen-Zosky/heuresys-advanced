# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-08 (S979).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S979 — dottrina full-alignment v1+v2 + /doctor MCP fix)

Spedita la **dottrina di allineamento totale** (Mac+VM = cloni effettivi del repo locale, inclusi i file gitignored). **v1**: `align-clones.sh` + `env-key-merge.sh` (.env key-merge additivo) + `sync-memory-tree.sh` + vm-deploy hardening (re-exec self-modify-buffer, clean-reinstall su cambio ABI, guard lockfile) — verificata **live** (PC=Mac=VM, PROD verde). **v2**: flusso **automatizzato nella chiusura** — `align-clones --delta/--resilient/--auto-deploy` (propaga solo il delta di sessione, deploy VM solo se cambia codice, skip host irraggiungibili), marker `session-boot.ps1`, e **`migrate-if-pending`** (migra solo se uno sha256 è fuori dal ledger — DB condiviso → normalmente skip, verificato live). Lo skill `handoff` ora ha lo **Step 4b** che lancia tutto da solo. Dottrina → memoria `feedback_full_alignment_doctrine`. In apertura: fix `/doctor` MCP (context7 disabilitato + chrome-devtools npx-bypass con hook self-healing → `reference_chrome_devtools_npx_bypass`). Priorità di prodotto invariate (sotto).

## Top priorities (next session)

1. **cap④ CMS P3 residuo** — BPM cross-link (content↔blueprint) + search-UI box su `/content` (API full-text già live). Media object-store ⛔ decisione infra/costo (PM). ~M.
2. **MFA §2.5 residuo** (WEBAUTHN `@simplewebauthn` + ceremony · session-enum UI `/me/security/sessions` · mandatory-MFA policy; SMS_OTP ⛔ provider+costo PM) · **WCAG §2.7 tail** (axe serious/moderate/minor per-route + mobile sweep, multi-sessione ~37-62h, critical=0 già gated) · **cap⑤ 2ª sorgente** ISTAT/ATECO (⛔ ToS). Multi-sessione.
3. **v2 delta close-flow — primo E2E live** al prossimo `/handoff` (il marker nasce all'avvio sessione → delta pulito). Se al close un host era irraggiungibile, catch-up con `bash scripts/align-clones.sh <host>`.

## Open questions

- **Media object-store** (cap④ P3): dove archiviare i media (S3/MinIO/disk) — decisione infra/costo PM.
- **SMS_OTP** (MFA §2.5): scelta provider + costo — decisione PM.
- **cap⑤ 2ª sorgente**: sign-off ToS ISTAT/ATECO.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
for h in oracle-vm-default mac-local; do MSYS_NO_PATHCONV=1 ssh $h 'cd ~/heuresys-advanced 2>/dev/null || cd /home/ubuntu/heuresys-advanced; git rev-parse --short HEAD'; done  # cloni == PC
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/readyz   # 200 = live PROD
gh run list --limit 6                                                       # main CI verde
```
