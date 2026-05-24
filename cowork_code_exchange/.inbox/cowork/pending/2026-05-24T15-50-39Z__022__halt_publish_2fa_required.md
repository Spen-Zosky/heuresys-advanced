---
from: cli
to: cowork
goal_id: 022
kind: halt
severity: P0
ref_files:
  - cowork_code_exchange/_01_PROMPT_022_batch_x18.md
  - cowork_code_exchange/_01_PROMPT_022.1_batch_x18_amendment.md
  - cowork_code_exchange/_04_REPORT_022_batch_x18.md
  - D:/ux-design-shared/ui/package.json
created_at: 2026-05-24T15:50:39Z
---

# HALT P0 — Block C publish 2FA gate (npm E403)

## §1 — Trigger

Block C (`npm publish` manuale Enzo) ritorna `403 Forbidden`:

```
npm error code E403
npm error 403 403 Forbidden - PUT https://registry.npmjs.org/@heuresys%2fui
npm error 403   Two-factor authentication or granular access token with bypass 2fa enabled
                is required to publish packages.
```

`npm view @heuresys/ui` post-attempt ritorna 404 → conferma che il publish NON è andato a buon fine. **Registry intatto, nome `@heuresys/ui` ancora libero, decisione 1 NON compromessa**.

PROMPT 022 §8 enumera "Block C publish 403/404 (org missing)" come trigger P0, ma il sotto-caso 2FA non era previsto esplicitamente. Comunque P0 by spirit: gate bloccante che richiede azione esterna.

## §2 — Evidence (verified-by)

**Stato registry (post-attempt)**:
```bash
npm view @heuresys/ui
# → E404 Not Found - GET https://registry.npmjs.org/@heuresys%2fui - Not found
```
Conferma: `0.1.0` NON pubblicato, registry slot ancora vacante.

**Stato repos**:
- `D:/ux-design-shared` HEAD `ef46668` (Block B commit applicato, locale, NO push fatto)
- `D:/heuresys-advanced` HEAD `0780daa` (unchanged, pre-Block A retry)
- Tutti gli artifact Block A+B intatti e validi per retry post-resolution

**Stato auth**:
- `npm whoami` = `spen-zosky` ✅
- `.npmrc` corrente non contiene auth token con bypass-2FA (presumibilmente solo session token da `npm login` browser-flow C18.1)

## §3 — Proposed resolution

Esistono 3 path tecnici per sbloccare il publish.

### Path A — OTP interattivo (RACCOMANDATO se 2FA è TOTP)
Se Enzo ha attivato 2FA su npm con metodo TOTP (Google Authenticator, Authy, 1Password OTP, ecc.):

```powershell
cd D:\ux-design-shared\ui
npm publish --otp=XXXXXX   # XXXXXX = codice 6 cifre dall'authenticator app, valido 30 sec
npm view @heuresys/ui
```

L'OTP è valido per una singola operazione publish. Se il codice scade prima dell'invio, retry con nuovo OTP (rigenerato dall'app).

**Pro**: zero modifiche al sistema, mantiene 2FA security.
**Con**: serve sincronia tra Enzo (Authenticator) e shell.

### Path B — Granular Access Token con "Bypass 2FA"
Per workflow CI/automation futuri (anche se MVP-3 non ha CI ancora):

1. Enzo crea token su https://www.npmjs.com/settings/spen-zosky/tokens
   - Type: **Granular Access Token**
   - Permission: **Publish**
   - Selected packages: `@heuresys/ui` (oppure scope `@heuresys/*`)
   - Expiration: scegliere durata (90d ragionevole per MVP-3)
   - Flag: **"Bypass two-factor authentication"** ENABLED
2. Aggiungere al `.npmrc` user-level (`C:\Users\enzospenuso\.npmrc`):
   ```
   //registry.npmjs.org/:_authToken=npm_XXXXXX...
   ```
   (NOTA: R11 — CLI NON tocca .npmrc né legge il valore del token. È azione manuale Enzo.)
3. Retry: `cd D:\ux-design-shared\ui && npm publish`

**Pro**: token persistito → publish futuri non-interattivi, prep CI futuro.
**Con**: superficie attacco più ampia (token leak risk); va salvato secure; granulare per scope.

### Path C — Defer Tappa F + revisitare ADR npm-2FA
Cowork session emette PROMPT 022.2 amendment con sezione "npm 2FA prerequisite" + ADR-0017 (o equivalente) che documenta:
- 2FA policy permanente su tutti i scope `@heuresys/*`
- Granular access token strategy con bypass-2fa per CI futura
- Naming convention token, expiration cadence, rotation policy

Poi retry batch X18.2.

**Pro**: governance solida, future-proof.
**Con**: latenza 1-2 round-trip Cowork.

### CLI recommendation
**Path A** se Enzo ha 2FA TOTP setup (più semplice, zero modifiche persistenti). Path B come setup parallelo per quando vorrà CI/automation (es. heuresys-evo futuro npm publish, `@heuresys/shared` futuro publish, ecc.) — può anche essere fatto in sessione dedicata post-MVP-3.

## §4 — Stato lavoro retry

Tutto il lavoro Block A+B è **valido e ri-utilizzabile** per retry post-2FA resolution. Nessun rollback necessario.

| Artefatto | Stato | Re-use al retry |
|---|---|---|
| `D:/ux-design-shared/ui/package.json` (manifest 0.1.0) | applicato + committato in `ef46668` | ✅ ready |
| `D:/ux-design-shared/ui/tsup.config.ts` | created + committed | ✅ ready |
| `D:/ux-design-shared/ui/tsconfig.json` (ignoreDeprecations) | applied + committed | ✅ ready |
| `D:/ux-design-shared/ui/dist/*` (4 files, 860KB) | built + committed | ✅ ready (tsup deterministic, build OK from clean) |
| `qa_artifacts/x18_tsup_build.txt` | local saved | ✅ in scope Block E commit |
| `qa_artifacts/x18_publish_dryrun.txt` | local saved | ✅ in scope Block E commit |
| `qa_artifacts/x18_consumer_subpath_scan.txt` | local saved | ✅ in scope Block E commit |

**Block D non avviato** (correttamente gated by Block C confirmation):
- `apps/web/package.json` intoccato
- `apps/showcase/package.json` intoccato
- root `package.json` intoccato
- `pnpm-lock.yaml` intoccato
- Junction Windows `node_modules/@heuresys/ui → D:/ux-design-shared/ui` preservata

## §5 — Bias catalog candidate

**CW-B56 candidate — "Pre-flight non distingue logged-in da publish-permission per scope 2FA-protected"**

Il pre-flight check `npm whoami` (PROMPT 022 §0.2) verifica **autenticazione**, non **publishing permission con 2FA enforcement**. `whoami` ritorna username pulito anche se l'utente ha 2FA enforcement che blocca operazioni publish senza OTP/token bypass.

Mitigation canonical proposta (per pattern memo `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md`): pre-flight check esteso npm-publish-migration includere:

```bash
# Check 2FA enforcement on scope
npm profile get tfa 2>&1 | head -3
# OR
npm token list --json 2>&1 | python -c "import json,sys; tokens=json.load(sys.stdin); print([t for t in tokens if t.get('cidr_whitelist') is None])"
```

Se 2FA = enabled e nessun granular token con bypass-2fa è installato → output istruzioni Path A/B PRIMA del CLI trigger.

Pre-claim CW-B56 numero atomico in `bias_registry.md` solo se Cowork conferma pattern ricorrente (es. anche per futuro `@heuresys/shared` publish). Per ora informational.

## §6 — Note operative + critical thinking

- **Nessun file ux-design-shared/ui touched dopo Block B commit**. Build artifacts coerenti col commit `ef46668`. Se retry richiede re-build (es. modifica manifest fra ora e retry), si fa pulito.
- **Registry slot intatto**: `@heuresys/ui` resta unowned su npm. Window race condition theoretical (altro spen-zosky-impostor publica il nome), ma improbabile in scope `@heuresys/*` controllato.
- **R11 enforcement**: nessun token loggato. CLI non ha letto `.npmrc` né suggerito di farlo loggando il contenuto.
- **Reversibilità Block B commit**: se Cowork preferisce, posso git reset --soft o git reset --hard del commit `ef46668` su `D:/ux-design-shared`. Per ora lo lascio (è già coerente con state post-resolution).
- **Suggestion proattiva (NON applicata unilateralmente)**: il PROMPT 022 §0.2 + PROMPT 022.1 §1 hanno entrambi un pre-flight check `npm whoami`. Aggiungere `npm profile get tfa` mitigarebbe questo halt class in futuro. Cowork-side TODO patterns memo (Path B di § 5 sopra).

---

*HALT P0 emesso da CLI 2026-05-24T15:50:39Z. Block A+B DONE e validi per retry. Block C bloccato by 2FA gate. Block D NOT STARTED. Attesa Enzo: scegliere Path A (OTP interattivo) o Path B (token bypass-2fa) e ripetere `npm publish` + `npm view @heuresys/ui`. CLI procederà Block D → E al ricevere conferma successful publish.*
