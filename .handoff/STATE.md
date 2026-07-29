# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-29 (S1035 — la storia RTL arriva in fondo, e il database torna ricostruibile).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1035)

Chiusa la **coda dei rilievi C5** (#78) e sei cluster di seguito (**C6→C11**). Ogni cluster è
entrato con almeno un controllo **nato rosso** e ne è uscito verde.

Il filo della sessione è uno: **il dato che nessuno può leggere non è nel prodotto, e il numero che
fotografa uno stato non è un invariante**. Il cancello ha trovato cinque tabelle scritte e mai
lette; undici test e **sei asserzioni dentro le migration** misuravano fotografie — le migration
sono tornate **rieseguibili**, cosa che non erano da mesi. Tre pezzi di piano **non** eseguiti, con
motivo scritto (dettaglio nel Delta S1035 del granulare).

## ✅ Chiusura S1035 completa

**CI verde su tutti i controlli** (`d8a45832`) e **deploy verificato** su entrambe le macchine (`/api/readyz` ready,
`/login` 200 in 0,20 s, `LAST_GOOD` registrato). Il gate si era **giustamente rifiutato** di
deployare su CI rossa: due test di questa sessione valevano solo dove c'è la storia (in produzione
sì, nella copia congelata della CI no) — corretti sul contratto dell'API. Il cancello ha pescato
l'errore di chi lo aveva appena installato.

**Database della CI** (domanda di Enzo): è una copia perché i test non tocchino la produzione, ed è
ferma perché nessuno la rinfresca — lo strumento c'è (`db/scripts/setup-ci-database.sh`), manca la
schedulazione (annotata da S1023, ora in coda a C12). La risposta strutturale però resta scrivere
test che valgono in entrambi i mondi, non rinfrescare la copia.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial per ogni task; le decisioni tecniche sono di Claude.

## Stato dei piani

- **Storia RTL** (#77): `docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md` — stato vivo
  in `.storia36/PROGRESS.md`. **C0→C11 chiusi**; resta **C12** (audit finale), iniziato.
- Zero-pendenze (#76): `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (`zp_state.py piano`).

## ⚠ Top priorities (next session)

1. **#77 storia36 — completare il C12** (audit finale). Fatto in S1035: batteria intera verde con i
   119 selftest, dossier per-entità, `pnpm db:validate` **riportato a verde**. Restano: audit
   semantico su tutte le tabelle, E2E Playwright (`test:e2e:prod:node22`), demo live con screenshot, e
   la coda infrastrutturale — rigenerare `heuresys_ci` sul linux-pc, `close-propagate`, CI verde,
   timer di custodia settimanale, skill `storia36-custodia`. Effort: 1-2 sessioni.
2. **#79 cancello di esposizione** — continuo, a ogni lavoro che popola tabelle. In S1035 ha pescato
   5 lacune vere: è lo strumento che ha reso la sessione onesta, va tenuto in esecuzione.
3. **`Z-259` da riprendere** con i rilievi in `.zp/prove/Z-259-verdetti-adversarial.json`.

## Open questions (autorità *cosa* = Enzo)

- **`admin@heuresys.com`**: account di servizio, derivato, senza posizione. Le sue funzioni dovevano
  passare a `enzo.spenuso@heuresys.com`, che però **non ha alcun accesso**: da decidere se e quando.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors ·
  **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/check_exposure.py            # 0 tabelle scoperte atteso
pnpm db:validate                                  # "twice-run idempotency proven" atteso
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -X -v selftest=1 \
  -f db/scripts/verify-storia36.sql | tail -1     # "batteria globale tutta VERDE"
cat .storia36/PROGRESS.md                         # C12 = unico cluster non spuntato
```
