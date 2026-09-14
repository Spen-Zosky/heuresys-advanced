# 258 — I test API entrano come Enzo, e dal 2026-09-14 Enzo ha il suo secondo fattore: contro produzione e gemello muoiono al login

> **item**: #258 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: NON AVVIATO
> **nasce-da**: S1101 (2026-09-14), misurando i test di `#V2` del mandato sul contratto condiviso: 8 file su 11 rossi al login. Conseguenza non prevista di `#250` (S1100), che ha reso il secondo fattore di Enzo suo e non più di collaudo.

## Il fatto

- 113 file di `apps/api/test` impersonano `enzo.spenuso@heuresys.com` (`platformAdmin()` in `test/helpers/actors.ts`), e il segreto TOTP si legge dal database cercando il fattore con label `derived-access` (`mfa-fixture-secrets.ts`, #169 F3c). Quel fattore non c'è più: Enzo ha il suo (label vuota, `auth_mfa_factor_verified = t`).
- `apps/web/tests/e2e/auth.setup.ts` entra come `platformAdmin` → tutta la suite Playwright locale è bloccata allo stesso modo.
- CI verde (fixture proprie su `heuresys_ci`); gemello verde **finché il clone non viene rinfrescato** (`clone-vm-db.sh` a chiusura sessione); poi `verify_gate` → `test-api` rossa su ogni tocco ad `apps/api/`.

## Decisioni già prese (non si ri-chiedono)

- **Non si rimette un fattore di collaudo a Enzo**: `#250` è chiusa così di proposito. La cura è una **persona di collaudo distinta** con mandato di piattaforma.
- Forma: utenza `user_type = 'SERVICE'` in Heuresys System, ruolo `PLATFORM_ADMIN`, password derivata e fattore `derived-access` come le cinque persone RTL (`paolo.caputo`, `tommaso.fiore`, `antonio.parisi`, `marco.rinaldi`, `andrea.martino`), creata dallo script che già esiste (`db/scripts/provision-collaudo-access.ts` / `provision-derived-access.ts`), **non** da una migrazione (è un dato di collaudo, non schema).
- Le sentinelle da censire prima (`chi_sorveglia.py`): `v_persona_senza_secondo_fattore`, il censimento delle utenze SERVICE (`#139`), `seed-test-admin.ts` per la CI.

## Fasi

- [ ] **F1 — La persona** — provisioning in produzione dell'utenza di servizio con `PLATFORM_ADMIN` + fattore `derived-access`; guardia: le sentinelle restano a zero; `db_health` verde. **fatto =** login via API con secondo fattore riuscito per la persona nuova.
- [ ] **F2 — I test** — `actors.ts::platformAdmin`, `fixtures.ts` (E2E) e ogni test che scrive l'email in chiaro puntano alla persona nuova; `seed-test-admin.ts` la crea anche in CI. **fatto =** `grep -rn "enzo.spenuso@heuresys.com" apps/api/test apps/web/tests` → 0.
- [ ] **F3 — La prova sul clone rinfrescato** — `clone-vm-db.sh`, poi `bash db/scripts/prova-api-sul-gemello.sh` e la Playwright integrale. **fatto =** entrambe verdi su un clone che NON ha più il fattore di collaudo di Enzo.

## Cronaca
