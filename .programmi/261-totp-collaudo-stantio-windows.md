# 261 — Il deposito locale dei segreti TOTP di collaudo su Windows è stantio

> **item**: #261 · **priorità**: P2 · **stima**: da stimare (indagine breve + un comando, probabile <1h)
> **stato**: NON AVVIATO
> **nasce-da**: S1115 (2026-09-27), scoperta mentre si rinfrescava `verify_gate.py` a chiusura di sessione.

## Il fatto, misurato

`verify_gate.py run` da Windows è ROSSO su `test-api`: 145 fallimenti su 143 file elencati, quasi
tutti sulla stessa identità `platform-test-admin@collaudo.invalid`, sempre `login: 401`.

Login live isolato contro produzione (mai stampato il segreto):
- passo 1 (password derivata dalla chiave di collaudo) → `200 mfa_required` — **la password è corretta**
- passo 2 (TOTP dal deposito locale `apps/web/tests/.auth/totp-secrets.json`) → `401 MFA_TOTP_INVALID`

## Perché non è il lavoro di `#260`

`pnpm db:provision-collaudo --dry-run` e la corsa reale dicono entrambe `gia' a posto (invariati) 15`,
`di cui DISALLINEATE misurate 0`: il fattore MFA in produzione non è stato toccato. `pnpm
db:deposita-totp-e2e` non copre le identità `@collaudo.invalid` (solo le 6 persone reali RTL Bank),
quindi non rinfresca nulla per questo caso.

## Fasi

- [ ] **F1 — Trovare chi dovrebbe depositare il segreto TOTP delle identità di collaudo su una
  macchina** — cercare in `provision-collaudo-access.ts` se il deposito avviene solo quando crea un
  fattore NUOVO (non quando lo trova invariato), o se manca uno script dedicato mai eseguito su
  Windows. **fatto =** il meccanismo è nominato con file:riga.
- [ ] **F2 — Rideposita e verifica dal vivo** — `verify_gate.py run` (o solo la suite `test-api`)
  torna verde su Windows, oppure si decide di instradare `test-api` sul gemello anche in locale
  (coerente con «il lavoro sul DB si esegue dove il DB vive»).

## Chiuso quando

`verify_gate.py run` è verde su `test-api` da Windows, o la suite viene instradata sul gemello anche
in locale.
