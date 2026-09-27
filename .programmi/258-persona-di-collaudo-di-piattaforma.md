# 258 — I test API entrano come Enzo, e dal 2026-09-14 Enzo ha il suo secondo fattore: contro produzione e gemello muoiono al login

> **item**: #258 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: DONE — chiuso ciclo3 (2026-09-26), esito in `.programmi/esiti-ciclo3/258.md`, register in
> `docs/archive/SOT_BACKLOG_CHIUSI.md`. Questo file era rimasto NON AVVIATO per un mancato
> aggiornamento a chiusura; corretto S1116 (2026-09-28), nessun lavoro nuovo.
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

- [x] **F1 — La persona** — commit `9dec9321`: persona `platform-test-admin@collaudo.invalid`, login MFA a due passi riuscito dal vivo.
- [x] **F2 — I test** — commit `43d3705c` (141 file, non 113) + fix `82dfb4be`. Grep di chiusura `enzo.spenuso@heuresys.com` in `apps/api/test apps/web/tests` → 0.
- [x] **F3 — La prova sul clone rinfrescato** — `bash db/scripts/prova-api-sul-gemello.sh` su HEAD `82dfb4be`, clone rinfrescato dopo F1: GREEN (typecheck 24.9s, test-api 1640.7s).

## Cronaca
