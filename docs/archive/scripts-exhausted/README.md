# Script esauriti (archivio G5 — S1028, 2026-07-23)

Script one-shot il cui scopo è stato assolto, **spostati** qui (mai cancellati)
per igiene del piano operativo (`scripts/`, `db/scripts/`). Linea G5 di
`docs/product/DEVELOPMENT_LINES_G_PLATFORM_HYGIENE.md`; item **#63** dell'Action register.

| Script | Provenienza | Scopo assolto |
|---|---|---|
| `bisect-cw-b59-createctx.ps1` | `scripts/` | bisezione bug CW-B59 (createContext) — chiusa |
| `restore-showcase-routes.ps1` | `scripts/` | ripristino route showcase post-incident — chiuso |
| `s983-mfa-loginraw.mjs` | `scripts/codemods/` | codemod one-shot S983 (loginRaw MFA nei test) — applicato |
| `cowork-exchange/` (intera dir) | `scripts/` | tooling del protocollo Cowork↔CLI, **congelato S939** (CLI SoT takeover). Gli entry npm `cowork:*` sono stati rimossi da `package.json`; l'ignore ESLint dedicato è caduto (coperto da `docs/**`); la regola `.gitattributes eol=lf` è stata ripuntata qui |

**NON archiviato** (deviazione motivata dalla lista G5): `db/scripts/encrypt-totp-secrets.ts`
resta operativo — è il runbook citato dal warning di `apps/api/src/config/env.ts`
("set MFA_ENCRYPTION_KEY … then run db:encrypt-totp once") per abilitare
l'encryption-at-rest TOTP su qualunque box nuova; il suo entry npm resta.
