# 169 — La password e il secondo fattore nascono dalla stessa chiave: chi ha una ha l'altro

> **item**: #169
> **stato**: IN CORSO
> **sbloccata**: S1079 (2026-08-24) — era `GATED` su `#147`, che risulta `DONE`. Il gate era
> sciolto e nessuno se n'era accorto: il cancello locale guarda il **diff**, e la chiusura di
> un'altra voce non produce alcun diff sui file che instradano questa.

## Il difetto, misurato in S1050

La **stessa** chiave madre genera la password (`derivePassword`) **e** il segreto
dell'authenticator (`deriveTotpSecret`). Chi possiede la chiave possiede già entrambi: per quel
soggetto **l'MFA non è un secondo fattore**, è lo stesso fattore contato due volte. Vale per tutte
le 158 utenze.

**Non è una rotazione.** Il segreto è derivato in modo deterministico da chiave + email:
«rigenerarlo» restituisce lo stesso valore. Una rotazione vera passerebbe dalla chiave madre, che
cambierebbe tutte le 158 password — e il codice lo vieta esplicitamente.

## ⭐ DECISIONE DI ENZO (2026-08-25, S1080) — vincolante, non si ri-chiede

> *«Invece è fondamentale predisporre utenze di collaudo che hanno regole di accesso e permessi
> propri ed autonomi tali da permettere le verifiche sul progetto (compreso il frontend) senza
> passare per il rito di login delle persone reali».*

**Scioglie F2**, e lo fa nella direzione che avevo appena scartato per un errore mio.

**L'errore, dichiarato**: avevo scritto che creare utenze di collaudo «contraddirebbe ADR-0026
frontalmente». Sbagliavo il confine. ADR-0026 / I15 parlano di **tenant e dati** — nessun tenant di
TEST, i dati sono di produzione reale, RTL Bank e Heuresys System sono tenant correnti. **Non**
parlano di **identità tecniche**. Un'utenza di collaudo con permessi propri non crea un ambiente
finto e non introduce dati finti: crea un'identità di servizio che esercita i dati veri. Sono due
oggetti diversi, e li avevo confusi.

**Il modello è già pronto per questo, e non da oggi** (misurato 2026-08-25):
- `sys_users.user_type` ammette per vincolo `STANDARD` · `GENERATED_INCUMBENT` · **`SERVICE`**
- la migrazione **`000118`** stabilisce che **solo** `user_type='SERVICE'` può essere esente dal
  secondo fattore, con una guardia che **rifiuta** l'esenzione per chiunque altro (*«MFA exemption
  allowed ONLY for SERVICE accounts; user % is not a service account»*) — pensata apposta per
  impedire che un `PLATFORM_ADMIN` umano si esenti — più un registro di audit
- il meccanismo è **vivo nel flusso di login**: `isUserMfaExempt` (`service.ts:392`); le tabelle
  sono vuote, e tabella vuota = comportamento identico a prima

Quindi la strada non va inventata: va **percorsa**. Oggi in `sys_users` ci sono **161 utenti, tutti
`STANDARD`**: nessuna utenza `SERVICE` è mai stata creata.

## Il pezzo difficile, nominato subito

La forma proposta è: **password derivata** (i test devono poter entrare) + **segreto authenticator
non derivato**, casuale, cifrato, consegnato alla sola persona. Il costo vero non è scriverla: è
che **i test e le prove sul browser devono superare l'MFA in un altro modo**, e oggi ci passano
proprio perché il segreto è derivabile. Questa è la fase che decide se la voce è da un'ora o da
una sessione.

## Fasi

- [x] **F1 Censire chi deriva il segreto, e da dove** — FATTO 2026-08-25 · **dieci punti** chiamano `deriveTotpSecret`, più due che chiamano il solo `derivePassword`. Elenco e classificazione sotto. Il meccanismo: `derive-access.mjs:106-115` — un HMAC-SHA256 sulla stessa chiave madre, distinto solo dal prefisso (`pwd:v1:` contro `totp:v1:`). Chi ha la chiave ha entrambi, per costruzione

### Il censimento (2026-08-25) — chi ha bisogno del *valore*, e chi solo di *entrare*

**La sorgente — serve il valore, ed è il punto da cambiare in F3**
- `db/scripts/provision-derived-access.ts:88-89` — deriva password **e** segreto e li scrive nel database per tutte le utenze. È qui che il segreto nasce

**Le prove — serve solo un accesso riuscito** (usano il valore perché oggi è l'unica via)
- `apps/web/tests/e2e/mfa-fixture-secrets.ts:29` — prove sul browser
- `apps/api/test/helpers/mfa-fixture-secrets.ts:37` — test dell'API
- `apps/api/scripts/verify-derived-login.mjs:23` — verifica di un accesso
- `apps/api/scripts/prova-live-99-f7.mts:27` · `prova-live-142-f2.mts:44` · `prova-live-142-f3a.mts:34` · `prova-live-142-f3b.mts:38` — quattro prove live

**La consegna all'operatore — serve il valore, ed è ciò che F3 vuole rendere «una volta sola»**
- `apps/api/scripts/export-accessi-csv.mjs:88-95` — esporta password e segreto in un CSV
- `apps/api/scripts/dev-whoami.mjs:137-138` — diagnostica, li mostra a schermo

**Solo password** (non toccati da questa voce): `db/scripts/seed-test-admin.ts:214` · `apps/api/test/helpers/personas.ts:39`

**Il numero che conta**: **sette punti su dieci** hanno bisogno di *entrare*, non del valore. Se F2
dà loro una via d'ingresso, la derivazione del segreto resta necessaria in **tre** punti soli — la
sorgente e le due consegne — e tutti e tre sono lavoro di F3.
- [ ] **F2 La via d'ingresso per le prove, prima di togliere quella vecchia** — le prove hanno bisogno di superare l'MFA senza conoscere il segreto della persona. Le strade sono almeno due (un fattore di prova dedicato per le sole utenze di collaudo; oppure un'esenzione dichiarata e circoscritta) e **la scelta va fatta qui**, non scoperta a metà di F3. ⚠ Se questa fase non chiude, F3 non si apre: togliere la derivazione senza una via per le prove rende rossa l'intera suite. **fatto =** una via che funziona, provata su un accesso reale, con la vecchia ancora al suo posto
  - ⚠⚠ **INDAGINE FATTA 2026-08-25, e ha smentito il piano: le due strade proposte non sono applicabili come scritte.** Entrambe presuppongono una separazione fra «utenze di collaudo» e «persone vere» che **in questo sistema non esiste, per decisione architetturale** (I15 / ADR-0026: un solo ambiente prod-grade, nessun tenant di test, «le frasi *tenant di TEST* / *mai produzione* sono ritirate»). Misurato: `sys_users` → **161 utenti, tutti `STANDARD`**, zero `SERVICE`, zero utenze di collaudo; `sys_auth_mfa_factors` → **158 fattori, tutti etichettati `derived-access`**, nessun fattore di prova. Le persone che le prove usano (`federica.marchetti@rtl-bank.org`, `paolo.caputo@rtl-bank.org`) **sono persone reali del tenant RTL Bank**
  - **conseguenza sulla strada (b)**: il meccanismo di esenzione **esiste già ed è vivo** — `isUserMfaExempt` è nel flusso di login (`service.ts:392`), le tre tabelle ci sono (`sys_auth_mfa_exemptions` e sorelle, mig `000116`), e sono **vuote**: tabella vuota = comportamento identico a prima. Ma usarlo qui significherebbe **esentare persone reali dall'MFA per far girare i test**, cioè peggiorare la sicurezza in nome di una voce che esiste per migliorarla. E il register lo dichiara già materia di decisione di Enzo (`#139`: *«`user_type='SERVICE'` è il criterio di esenzione dal secondo fattore»* → spostata a WAIT-INPUT proprio per questo)
  - **conseguenza sulla strada (a)**: un «fattore di prova dedicato per le sole utenze di collaudo» non ha utenze a cui applicarsi. Creare utenze di collaudo apposta contraddirebbe ADR-0026 frontalmente
  - **la terza via, da valutare in F2 e non qui**: non «il segreto smette di essere derivato», ma **il segreto è derivato da una chiave diversa, custodita altrove**. Chi ha la sola chiave madre ottiene la password e **non completa** l'accesso — che è letteralmente il criterio di chiusura di questa voce. ⚠ E porta con sé la domanda che la decide: **se le due chiavi finiscono nello stesso posto, la separazione è formale e non reale**. Prima di scegliere va misurato dove vive `MASTER_PATH` e dove potrebbe vivere la seconda (macchina? CI? entrambe?) — senza quella misura è una soluzione che sembra funzionare
  - ⛔ **non proseguibile mentre la suite E2E è in volo**: `F3` cambia i segreti TOTP delle 158 utenze in produzione, e la corsa integrale di `#219` li sta usando adesso. Le due cose si romperebbero a vicenda

### ⭐ Il progetto, deciso 2026-08-25 dopo la direttiva di Enzo

**Cosa c'è già, misurato oggi e non ricordato** — la strada è quasi tutta posata:

| pezzo | stato | prova |
|---|---|---|
| il tipo `SERVICE` | **esiste** nel vincolo di `sys_users.user_type` | `pg_constraint` |
| esenzione MFA solo per `SERVICE` | **esiste**, con guardia che rifiuta gli altri | mig `000118` §1 |
| esenzione viva nel login | **sì**, `isUserMfaExempt` | `service.ts:392` |
| censimento delle persone | **esclude i `SERVICE`** — le utenze nuove non lo fanno scattare | `v_user_census_deviation`: `count(*) FILTER (WHERE user_type IS DISTINCT FROM 'SERVICE')` |
| distinzione persona / impersonabile | **esiste già**, ma è un elenco di **due** email | `derive-access.mjs:53` — `REAL_PERSON_EMAILS` |

**⚠ E una cosa che *non* c'è, contro quanto dice la mig `000287`**: `admin@heuresys.com` — che
quella migrazione descrive come «l'account con cui accedono gli E2E e 119 file di test», tipizzato
`SERVICE` — **non esiste più in `sys_users`** (misurato: zero righe con `admin` nell'email, zero
righe non-`STANDARD`). Da verificare **prima** di costruire: qualcosa l'ha rimosso dopo la `000287`.

**Le tre identità** (`user_type='SERVICE'`, dominio `.invalid` — RFC 2606, non instradabile, e a
colpo d'occhio non è una persona):

| email | tenant | ruolo dedicato | copre |
|---|---|---|---|
| `piattaforma@collaudo.invalid` | Heuresys System | `COLLAUDO_PLATFORM` | superfici tecniche, cross-tenant |
| `governo@collaudo.invalid` | RTL Bank | `COLLAUDO_TENANT` | amministrazione del tenant cliente |
| `persona@collaudo.invalid` | RTL Bank | `COLLAUDO_ESS` | portale personale `/me/*` |

**Permessi propri e autonomi**, come chiede la direttiva: **tre ruoli nuovi**, non il riuso di
`PLATFORM_ADMIN` / `TENANT_ADMIN` / `USER`. Ruolo distinto significa che negli audit si vede chi ha
fatto cosa, e che i permessi del collaudo possono divergere senza toccare quelli veri. I permessi
di partenza si allineano al mandato equivalente, **dichiarati per elenco** e non ereditati.

**⚠⚠ La verifica che poteva far saltare il progetto — FATTA 2026-08-25, e ha cambiato la
decisione.** Domanda: la maschera di `PLATFORM_ADMIN` (ADR-0032 / I20) riconosce il mandato per
codice di ruolo o per permesso? **Per codice di ruolo**, in insiemi chiusi e tipizzati:

```
resolver.ts:27   HR_MANDATED_ROLES        = {TENANT_ADMIN, HRMS_MANAGER}
resolver.ts:60   TENANT_WIDE_MANDATE_ROLES = {PLATFORM_ADMIN, ...HR_MANDATED_ROLES}
resolver.ts:49   MANAGERIAL_ROLES          = {MANAGER, CEO}
resolver.ts:65   ORG_BROWSE_ROLES          = {...TENANT_WIDE, ...MANAGERIAL}
mask.ts:92       masksUnderPlatformMandate → HR_MANDATED_ROLES.has(r) + isPlatform(actor)
```

E lo stesso file dichiara il principio (ADR-0036, `#99` F3): **«nessuna lista di ruoli locale decide
una vista»** — *«esistono perché i moduli se le riscrivevano in casa: `positions` aveva la sua
lista, `teams` la sua, e nessuna sapeva delle altre»*.

**Conseguenza: i ruoli `COLLAUDO_*` sono da scartare, e la ragione è la stessa che ha prodotto quel
principio.** Un `COLLAUDO_PLATFORM` accanto a `PLATFORM_ADMIN` sarebbe un **mandato ombra**: per
comportarsi come il mandato vero andrebbe iscritto a *ognuno* di quegli insiemi, e dimenticarne uno
non darebbe errore — darebbe un collaudo che vede **più** o **meno** del mandato che imita. Le prove
resterebbero verdi verificando un mondo che non esiste. È esattamente il difetto che gli insiemi
canonici sono nati per chiudere.

### La decisione: identità proprie, mandati veri

Le tre utenze sono **dedicate, autonome e separate dalle persone** — che è ciò che la direttiva
chiede — ma portano i **mandati esistenti**, non copie:

| email | tenant | mandato assegnato | copre |
|---|---|---|---|
| `piattaforma@collaudo.invalid` | Heuresys System | `PLATFORM_ADMIN` | superfici tecniche, cross-tenant |
| `governo@collaudo.invalid` | RTL Bank | `TENANT_ADMIN` | amministrazione del tenant cliente |
| `persona@collaudo.invalid` | RTL Bank | `USER` | portale personale `/me/*` |

**In che senso i permessi sono «propri e autonomi»**, come la direttiva pretende: l'assegnazione è
**decisa per il collaudo** e non ereditata da un dipendente; l'identità è propria (`SERVICE`, non
una persona); le credenziali sono proprie (chiave separata); l'accesso è autonomo (esente dal
secondo fattore per il meccanismo già esistente). L'autonomia è **rispetto alle persone reali** —
che è il fine dichiarato dalla direttiva — non rispetto al modello di autorizzazione, dove
inventare un quarto mandato peggiorerebbe proprio ciò che il collaudo deve misurare.

**Il guadagno che (B) porta e (A) toglieva**: una prova che gira col mandato vero misura il
comportamento vero. Un ruolo di collaudo che imita misura sé stesso.

**Credenziali autonome**: chiave separata (`.secrets/collaudo-access.key`), funzione di derivazione
propria. Non la chiave madre delle persone — è questo che chiude anche il difetto d'origine di
questa voce, perché chi ha la chiave madre non ottiene nulla sulle utenze di collaudo e viceversa.

**Il confine, dichiarato**: le utenze di collaudo servono alle verifiche **funzionali e di
frontend** — entrare, navigare, guardare. **Non** sostituiscono l'impersonazione degli utenti del
tenant nei test di **autorizzazione**, dove il punto *è* il ruolo di quella persona: là una
popolazione fissa nasconde difetti, e il commento di `personas.ts` documenta un caso reale (un test
verde solo perché girava su `tommaso.fiore`, che per combinazione aveva zero righe del tipo che
perdeva). Chi userà quale via è parte del lavoro.
- [ ] **F3 Il segreto smette di essere derivato** — casuale, cifrato a riposo, consegnato una volta sola. **fatto =** un segreto nuovo non è più ricostruibile dalla chiave madre, misurato provando a ricostruirlo
- [ ] **F4 La prova che deve poter fallire** — con la chiave madre in mano, **completare** un accesso come amministratore deve risultare **impossibile**, e la suite deve continuare a girare. Le due cose insieme, o la voce non è chiusa: passare la prima rompendo la seconda è il modo ovvio di barare. **fatto =** tentativo eseguito e fallito con evidenza, suite verde

## Chiuso quando

Chi ha la chiave madre **non può completare** un accesso come l'amministratore, e la suite continua
a girare.
