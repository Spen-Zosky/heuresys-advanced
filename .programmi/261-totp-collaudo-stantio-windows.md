# 261 — Il deposito locale dei segreti TOTP di collaudo su Windows è stantio

> **item**: #261 · **priorità**: P2 · **stima**: da stimare (indagine breve + un comando, probabile <1h)
> **stato**: SOSPESO
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

- [x] **F1 — Trovare chi dovrebbe depositare il segreto TOTP di collaudo** — FATTO 2026-09-28 · trovato con file:riga, e trovato PERCHÉ non deposita mai da qui (non era la domanda giusta). Dettaglio sotto: «La scoperta vera».
- [ ] **F2 — Rideposita e verifica dal vivo** — BLOCCATA (vedi sotto): non è un comando mancante,
  è una guardia di sicurezza che nega il deposito per costruzione su QUALUNQUE database chiamato
  `heuresys_advanced` — gemello incluso. Serve una decisione di design prima di poter chiudere,
  non un comando.
- [x] **F3 (nuova, non pianificata) — riparato un bug reale trovato per strada** — FATTO 2026-09-28 · `depositaSegretiDiCollaudo` in `seed-test-admin.ts` sovrascriveva il file invece di fonderlo col contenuto esistente, a differenza del suo gemello in `provision-collaudo-access.ts`: chi dei due girava per ultimo cancellava i segreti dell'altro. Ora fondono entrambi. Non chiude la voce (la guardia sotto blocca comunque), ma è un difetto vero, indipendente, e resta corretto.

## La scoperta vera (F1), file:riga

`provision-collaudo-access.ts:485-491` legge e decifra il segreto TOTP esistente per
`platform-test-admin@collaudo.invalid` a ogni corsa (confermato: la chiave `MFA_ENCRYPTION_KEY` è
IDENTICA su Windows e sulla VM, sha256 dei primi 12 char `5bd898583665` su entrambe — non è un
problema di chiave). Il deposito su file passa da `eDiCollaudo()` (`:54-58`, gemella in
`seed-test-admin.ts:198-213`), che pretende **due** condizioni: `NODE_ENV==='test'` **e** il nome
del database che si dichiara di collaudo (`heuresys_ci` o `*_ci`/`*_test`).

`POSTGRES_DB` è `heuresys_advanced` su **Windows** (produzione, via tunnel) **e sul gemello**
(`linux-pc`, verificato in questa sessione: stesso nome, perché è un CLONE fedele, non un database
ridenominato). La guardia nega il deposito **per nome**, e il nome non distingue «produzione vera»
da «clone del gemello»: distingue solo la MACCHINA (`sul-gemello.sh`: «il gemello ha un clone, la VM
ha la produzione»), cosa che questa guardia non guarda.

Il commento della guardia in `seed-test-admin.ts:189-190` è ESPLICITO e intenzionale: *«la
produzione è `heuresys_advanced` e non corrisponde mai»* — e in quel file la stessa guardia decide
anche se RIGENERARE fattori MFA di **persone vere** (`PERSONA_EMAILS`, non solo le identità di
collaudo), quindi allargarla ad accettare `heuresys_advanced` per nome aprirebbe la rigenerazione dei
secondi fattori delle persone RTL vere ogni volta che gira per sbaglio contro la produzione reale
sulla VM — esattamente il danno che l'autore della guardia voleva impedire. **Non l'ho toccata.**

`heuresys_ci` esiste come database SEPARATO anche sul gemello (visto da `ci-rehearsal.sh`: ne fa una
copia usa-e-getta per la prova generale) — è quello il posto dove la guardia si apre per davvero,
ed è quello che la CI usa nella sua sequenza fissa (`db:seed-test-admin` poi `db:provision-collaudo`,
`.github/workflows/test-integration.yml:125,134`).

## La decisione che resta (F2, non presa qui)

Per chiudere davvero questa voce serve UNA delle due:
1. **Instradare `test-api` sul `heuresys_ci` del gemello** (non sul suo `heuresys_advanced`), se
   esiste già un modo per farlo girare lì — coerente con «il lavoro sul DB si esegue dove il DB
   vive» E con la guardia com'è oggi, senza toccarla.
2. **Ridisegnare la guardia** perché distingua macchina (VM=pericolo, gemello=clone sicuro) invece
   che nome del database — tocca un meccanismo di sicurezza scritto apposta contro un errore reale
   già successo, quindi non è un tampone da fase F2, è la sua stessa voce di design.

Nessuna delle due è eseguita qui: è oltre lo <1h stimato e oltre lo scopo di un'indagine.

## Chiuso quando

`verify_gate.py run` è verde su `test-api` da Windows, o la suite viene instradata su un database
che la guardia S1093 riconosce come «di collaudo» per nome (`heuresys_ci`), o la guardia stessa
viene ridisegnata con una decisione esplicita su come distinguere VM da gemello.
