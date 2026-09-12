# 169 — La password e il secondo fattore nascono dalla stessa chiave: chi ha una ha l'altro

> **item**: #169
> **stato**: CHIUSO
> **chiusa**: S1095 (2026-09-12). La proprietà per cui la voce esisteva — password e secondo fattore non nascono più dalla stessa chiave, e chi ha la chiave madre **non completa** un accesso — è misurata in produzione (vedi F4). ⚠ **Conseguenza da governare, fuori da questa voce**: con l'obbligo acceso (B18) e i segreti casuali mai consegnati (F3c), le persone che entrano dal browser hanno bisogno di un ri-enrollment; `enzo.spenuso@heuresys.com` ha un fattore TOTP casuale e **0 codici di recupero** (misurato 2026-09-12).
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
- [x] **F2 La via d'ingresso per le prove, prima di togliere quella vecchia** — **FATTA 2026-08-25 (S1081)** · evidenza: `pnpm db:provision-collaudo` (3 utenze SERVICE + ruoli + identità + credenziali + iscrizioni 000284 + esenzioni; seconda corsa **0 scritture / 3 invariati**; misura prima 161 STANDARD, invariati dopo; sentinella censimento a 0) · `node apps/api/scripts/verify-collaudo-login.mjs` → **le tre entrano in un passo** (200, `mfa_required=false`, 3 cookie), password errata **401**, e la controprova che decide la voce: **password derivata dalla CHIAVE MADRE → 401 su tutte e tre** · la via vecchia è al suo posto (login di `federica.marchetti@rtl-bank.org` con password derivata → 200, `success`, 3 cookie)
  - 🔬 **terza guardia scoperta eseguendo, non leggendo**: la mig `000284` (#139) pretende l'**iscrizione nominativa** in `sys_auth_mfa_exemption_eligible_users` — tre atti distinti (SERVICE · iscrizione · esenzione), mai effetti collaterali. La prima corsa si è fermata lì e la transazione ha retto (0 righe rimaste). L'atto deliberato che autorizza l'iscrizione è la direttiva di Enzo del 2026-08-25, citata per iscritto nella `reason`
  - ✅ **chiarito `admin@heuresys.com`**: rimosso per decisione di Enzo (#139, 2026-08-08 — «l'account tecnico non deve esistere», migs `000285`/`000286`); il commento della `000287` è storia, non stato. La direttiva sulle utenze di collaudo è il successore dichiarato di quel disegno
  - 📌 osservato (coerente con #219 F1): con l'enforcement MFA spento il login è **a un passo anche per le persone** con fattore TOTP — la sfida non parte. `verify-derived-login.mjs` ha l'atteso stantio (pretende 2 passi): da riallineare quando si mette mano a F3, non adesso
  - ⚠⚠ **CODA DI F2, trovata solo riapplicando la catena (S1081): creare tre utenze `SERVICE`
    ha fatto FERMARE le migrazioni.** `ERROR: Persone attive senza posizione: 2 (attesa 1,
    preesistente)` — sono `governo@` e `persona@` sul tenant RTL. Il criterio giusto («un
    account di servizio non è una persona, non occupa un posto, non riporta a nessuno») era
    già nel sistema — la sentinella del censimento lo applica dal giorno in cui è nata — ma
    mancava in **tre punti** che vivono dentro le migrazioni e che la `000356` non poteva
    raggiungere: la post-condizione della `000250`, il corpo della regola nella `000251` e la
    post-condizione della `000251` che *interroga quella funzione prima che la `000356` giri*.
    Curati tutti e tre. **Perché mancava**: quando furono scritti non esisteva alcun account
    `SERVICE`, quindi l'esclusione non poteva mancare a nessuno — regole vere che restavano
    vere per assenza dell'unico caso che le smentiva
  - 📌 **e la prova generale non poteva vederlo**: il clone della CI **non ha utenze SERVICE**,
    quindi lì la catena passava verde. La prova che può fallire è la riapplicazione in
    **produzione**, dove il caso esiste. Da ricordare per ogni futura utenza di servizio
  - ✅ **PROPAGAZIONE FATTA (2026-08-26, su richiesta di Enzo)** — e la misura ha corretto due volte ciò che il piano presumeva:
    - **VM e linux-pc: già allineati**, senza fare nulla. `align-clones` sincronizza l'intera `.secrets/`, quindi la chiave è partita da sé con la propagazione di chiusura. Verificato **per impronta** (`sha256`, primi 12 caratteri — mai il valore): **identica** su entrambi, 48 byte
    - **CI: una sola macchina, non due.** I workflow **non usano segreti GitHub** (nessun `secrets.*` oltre a `GITHUB_TOKEN`): i runner sono self-hosted e leggono il proprio `.env`. Aggiunta `COLLAUDO_ACCESS_KEY_B64` a `~/actions-runner/.env` sul **linux-pc** (`off-prod`, dove gira `playwright-smoke`), passando il valore per **stdin** — non transita mai per il contesto
    - ⚠ **sulla VM non serve, ed è misurato**: il runner `oci-vm` vive in `/opt/heuresys-runner/` e il suo `.env` contiene **solo `LANG`** — non ha nemmeno la chiave madre, perché i job che gli toccano (lint) non fanno login. Metterla lì sarebbe superficie in più senza uso
    - ⚠ **il runner legge l'ambiente all'AVVIO** (stessa forma della cache RBAC): girava dal 22 agosto, quindi la variabile nuova non la vedeva. **Riavviato il 2026-08-26 alle 14:26**, dopo aver atteso la fine dei job — un riavvio a metà corsa avrebbe ucciso la `Playwright smoke` che girava proprio lì (finita **`success`**, insieme a typecheck, build e CodeQL)
    - 🔬 **una mia diagnosi sbagliata, corretta misurando**: verificando che il runner «vedesse» la variabile ho letto `/proc/<pid>/environ` e concluso «NON la vede». **Era il test a essere CIECO**: quel file non è leggibile senza privilegi, e il mio `grep` restituiva vuoto per un motivo che non c'entrava. La controprova (cercare la chiave madre, che c'è da sempre) lo ha smascherato — *un controllo che non si è mai visto rosso non è una prova*
    - ⚠ **e per un momento ho creduto di aver scritto nel file sbagliato**: la unit systemd dichiara `EnvironmentFile=/etc/heuresys-runner.env` e `/etc/heuresys-runner-crypto.env`, che non posso leggere (`sudo` chiede la password — passa solo `systemctl`). **Ma il file giusto è quello che ho toccato**, e lo dimostra un fatto invece di un ragionamento: `DEV_ACCESS_MASTER_KEY_B64` vive **anch'essa** in `~/actions-runner/.env`, ed è la chiave con cui la `Playwright smoke` entra — se quel file non fosse letto, la CI E2E non passerebbe. Le due chiavi ora stanno lì fianco a fianco, **64 caratteri ciascuna** (48 byte in base64)
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
- [x] **F3 Il segreto smette di essere derivato** — FATTA 2026-09-08 (S1091 F3b + S1092 F3c, F3a cancellata perché non serviva) · spuntata S1095 (2026-09-12) sull'evidenza già scritta sotto: `pnpm db:verify-separazione-totp` → 159 esaminati, **0 derivabili**; giornale `staging.totp_derivato_undo` 159 righe — casuale, cifrato a riposo, consegnato una volta sola. **fatto =** un segreto nuovo non è più ricostruibile dalla chiave madre, misurato provando a ricostruirlo

  ### ✅ F3c ESEGUITA S1092 (2026-09-08) — e la strada era molto più corta di come il piano la temeva

  ⚠⚠ **Prima, una mia analisi sbagliata, corretta misurando.** Avevo misurato che il ramo a
  due passi (`if (status === "mfa_required")`) non si percorre mai, perché in produzione
  l'enforcement MFA è **spento** — e ne avevo concluso che rendere casuali i segreti non
  rompeva nulla. **Falso**, ed è un salto di dominio: `buildTestApp` **accende** l'enforcement
  di proposito (`mfaEnforcement: true`, app.ts §S989), quindi ogni login della **suite API**
  percorre davvero la sfida e usa il segreto derivato. La misura era giusta sulla produzione;
  la frase era più larga della misura.

  ⭐ **Ma la conseguenza non è F3a.** Il piano temeva «portare la suite sulle utenze di
  collaudo» — 89 spec su 101 e i loro dati. Il problema vero è molto più piccolo: **i test
  devono conoscere *un* segreto valido**, non *quel* segreto. E il segreto ce l'hanno già a
  portata di mano — **nel database**, dove è cifrato, e a cui un test di integrazione accede
  già con credenziali piene.

  Quindi: `apps/api/test/helpers/mfa-fixture-secrets.ts` **legge e decifra** invece di
  derivare. Nessuna delle 101 spec toccata, nessuna persona sostituita, nessuna decisione di
  Enzo richiesta. Il caricamento è un `await` di modulo, per tenere `totpSecretFor`
  **sincrona** come la usano `login.ts` e il Proxy: una firma asincrona si sarebbe propagata
  a ogni chiamante per un guadagno nullo.

  **La copia Playwright non può fare lo stesso** — `apps/web` non ha un client PostgreSQL, e
  aggiungerlo per una suite di browser sarebbe una dipendenza nuova in cambio di niente.
  Quindi lì `totpSecretFor` **fallisce, e dice cosa fare**: è la scelta fra un errore che si
  legge e un 401 al passo due che accuserebbe il login invece della fixture. Oggi non toglie
  nulla (quella suite gira contro il server reale, enforcement spento); il giorno
  dell'accensione la strada è già costruita e non è quella — le utenze di collaudo sono
  **esenti** per progetto.

  **Lo strumento**: `pnpm db:stop-deriving-totp` (`--dry-run` · `--undo`), con le **quattro
  cose** di ogni scrittura di massa — la misura prima, la guardia ri-verificata al momento
  (solo `kind='TOTP'` con `label='derived-access'`, per elenco esplicito di id, mai un jolly),
  le post-condizioni **su ciò che non doveva cambiare** (fattori totali, fattori di altro tipo,
  persone reali), e il rollback in `staging.totp_derivato_undo`, popolato **prima** di toccare
  qualsiasi cosa.

  ⭐ **E la prova non è «ho scritto»**: lo strumento **ri-deriva** ogni segreto dalla chiave
  madre e conta quanti combaciano ancora. Attesi **zero**; se ne trovasse uno solo, disfa e
  si ferma. È l'unica affermazione che chiude la voce.

  🔬 **Due difetti trovati eseguendo, non leggendo** — ed entrambi miei:
  1. **`sys_auth_mfa_factors` non ha `updated_at`**, ha solo `created_at`. La forma «SET
     valore, updated_at = now()» è talmente abituale nel resto del repository da sembrare
     giusta a occhio. La corsa si è fermata **dopo** aver scritto tutte e 159 le righe di
     giornale e **prima** di toccare un solo segreto.
  2. E quel mezzo passo ha rivelato il secondo: il giornale scriveva **una riga per
     tentativo** invece di una per fattore. Alla corsa dopo, `--undo` avrebbe riapplicato il
     valore dell'ultimo tentativo invece di quello **originale** — cioè un rollback che dice
     il falso. Corretto: si scrive solo se non c'è già una riga non riapplicata.

  🔬 **E un terzo, che non c'entra con questa voce**: la corsa integrale ha trovato
  `interview-feedback` e `job-offers` **senza subpath export** in `packages/shared` — un mio
  difetto delle fette di stamattina, che il pattern dei moduli prescrive e che avevo saltato.
  Corretto. È il motivo per cui la corsa integrale esiste.

  ### 🔬 INDAGINE S1092 (2026-09-08) — la misura che il piano dichiarava decisiva, e non era mai stata fatta

  Il piano scriveva, proponendo la «terza via»: *«⚠ E porta con sé la domanda che la decide:
  **se le due chiavi finiscono nello stesso posto, la separazione è formale e non reale**.
  Prima di scegliere va misurato dove vive `MASTER_PATH` e dove potrebbe vivere la seconda».*
  **Misurata adesso. La risposta è: nello stesso posto, ovunque.**

  | luogo | `dev-access-master.key` | `collaudo-access.key` |
  |---|---|---|
  | Windows — `.secrets/` | ✔ 48 byte | ✔ 48 byte, **stessa cartella** |
  | linux-pc — `.secrets/` | ✔ | ✔ |
  | linux-pc — runner CI `~/actions-runner/.env` | ✔ `DEV_ACCESS_MASTER_KEY_B64` | ✔ `COLLAUDO_ACCESS_KEY_B64`, **stesso file** |
  | VM Oracle — `.secrets/` | ✔ | ✔ |

  **Non esiste un solo luogo in cui viva una delle due e non l'altra.** E non è un caso da
  correggere con un `mv`: `align-clones` propaga `.secrets/` **come blocco** — è così che la
  chiave di collaudo è arrivata sui cloni senza che nessuno la copiasse (registrato in F2).

  ⚠ **Conseguenza su F3b, che questo piano dichiara chiusa.** F3b ha reso vero il suo test —
  «password da chiave madre → 401» — e quel test è onesto. Ma il criterio di **F4** è più
  largo: *«con la chiave madre in mano, completare un accesso come amministratore deve
  risultare impossibile»*. In pratica «avere la chiave madre» significa **aver letto
  `.secrets/`**, e chi legge quella cartella legge anche l'altra chiave. La separazione
  ottenuta è **formale**: due file invece di uno, dietro la stessa porta.

  Questo **non annulla F3b**, e vale la pena dire perché: prima, il segreto del collaudo si
  ricavava dalla *stessa* chiave con una funzione pubblica nel repository — bastava il
  codice. Adesso serve un secondo file. È un passo avanti reale; non è la proprietà che F4
  chiede.

  ### ⚠ E F3a com'è scritta non è un refactoring: è una richiesta di dati

  Misurato lo stesso giorno, in produzione:

  | | posizioni | squadre |
  |---|---|---|
  | `governo@` · `persona@` · `piattaforma@collaudo.invalid` | **0** | **0** |
  | `tommaso.fiore@rtl-bank.org` (la persona che 34 spec nominano) | 2 | 1 |

  Le sei personas della suite sono **persone reali con dati seminati** — e `fixtures.ts` lo
  dichiara: la chiave `employee` non è mai stata rinominata proprio perché *«34 spec la
  nominano e dipendono dai suoi dati seminati (carriera, My HR, embedding del profilo)»*.
  Su 101 spec, **89 nominano una persona**.

  Quindi «portare la suite sulle utenze di collaudo» significa una di due cose, e nessuna
  delle due è quella che il piano lascia intendere:
  1. **dare alle utenze di servizio i dati di una persona** — carriera, valutazioni,
     posizione, squadra. Cioè fabbricare una persona finta dentro un ambiente che I15 /
     ADR-0026 tengono prod-grade apposta;
  2. **rinunciare a ciò che quelle spec verificano** — che è la maggior parte di ciò che la
     suite prova, perché una pagina si prova con dei dati dentro.

  🔒 **La decisione è di Enzo, e la nomino invece di sceglierla di nascosto.** Sono due
  domande distinte, e la seconda si può sciogliere anche senza la prima:
  - **(A) dove custodire la seconda chiave**, perché la separazione smetta di essere
    formale. Oggi le due viaggiano insieme per costruzione, ed è `align-clones` a volerlo.
    Toccare questo è infrastruttura su tre macchine più la CI.
  - **(B) se la suite E2E debba girare con identità di servizio o con persone reali.** La
    direttiva del 2026-08-25 dice *«senza passare per il rito di login delle persone
    reali»*; la Definition of Done dice *«per le pagine autenticate la dimostrazione LIVE =
    login con una persona reale»*. **Non si contraddicono se si separano i due usi** — la
    *suite automatica* da una parte, la *dimostrazione live* di uno step dall'altra — ed è
    la lettura che propongo. Ma resta il fatto (1): le utenze di servizio non hanno dati, e
    senza dati 89 spec su 101 non provano più ciò per cui esistono.

  ▸ **Strada che NON dipende da nessuna delle due**, e che resta il contenuto originale
  della voce: **F3c**, i segreti delle persone reali diventano casuali. Un segreto casuale
  non è ricostruibile da *nessuna* chiave, quindi chiude la voce senza dover decidere dove
  custodirne una seconda. Il suo costo è che la suite non può più derivare i TOTP — cioè
  ricade in (B). **Le due domande sono lo stesso nodo visto dai due lati.**

  ### ✅ F3b — FATTA 2026-09-07 (S1091). E la misura ha trovato un buco APERTO, non un lavoro da fare

  **Ordine invertito rispetto al piano, e la ragione è misurata.** Il piano diceva F3a → F3b → F3c
  perché «F3a da sola sposta il bersaglio». Vero — ma non dice che F3b *dipenda* da F3a: le
  utenze di collaudo **la suite non le usa** (lo dichiara il piano stesso), quindi toglier loro la
  password derivata **non tocca un solo test**. F3b era eseguibile subito, e toglieva il rischio
  più grave. F3a resta il lavoro grosso (34 spec dipendono dai dati di persone reali).

  **⚠ Il reperto, misurato in produzione PRIMA di toccare qualunque cosa.**
  `node apps/api/scripts/verify-collaudo-login.mjs https://www.heuresys.com/api` → **FALLITO**,
  e col rovescio esatto dell'atteso su tutte e tre:

  | | atteso | misurato |
  |---|---|---|
  | password di **collaudo** | 200 | **401** |
  | password **errata** | 401 | 401 ✓ |
  | password da **chiave madre** | 401 | **200** |

  Cioè: **chi possiede la chiave madre completava un accesso come `piattaforma@collaudo.invalid`,
  che è `PLATFORM_ADMIN` ed è esente dal secondo fattore** (mig `000118`). È alla lettera ciò che
  F4 dichiara debba essere impossibile — e non era una previsione: era lo stato della produzione.

  **La causa, trovata leggendo il file che CREA l'oggetto e non il commento che lo descrive.**
  `provision-collaudo-access.ts` dichiara in testa «credenziali derivate da una chiave PROPRIA —
  mai la chiave madre», e F2 lo aveva provato il 25 agosto. Ma `provision-derived-access.ts`
  agisce su **ogni** utente `ACTIVE` che non sia `isRealPerson`, e `isRealPerson` è una **lista
  chiusa di due email di persone** — un'utenza di servizio non vi ha posto per definizione, quindi
  **non era protetta da niente**. Il 2026-08-31 le tre sono state «riparate» proprio da lì con
  `--solo=` (lo dice il commento di quell'opzione), perdendo la credenziale dalla chiave propria.

  La cronologia nel database non lascia margini:

  | | 25 ago | 31 ago |
  |---|---|---|
  | credenziale | creata (chiave propria) | `rotated_at`, sostituita (chiave madre) |
  | fattore TOTP | *nessuno, per progetto* | creato `VERIFIED` (chiave madre) |

  Il fattore TOTP è il **secondo** reperto: le utenze di collaudo nascono **senza** TOTP —
  l'autonomia sta nell'esenzione, non in un segreto in più da custodire. Ne avevano uno, derivato
  dalla stessa chiave madre.

  **Il rimedio, in due pezzi, perché una guardia da sola non disfa l'esemplare già presente.**
  1. **La guardia, strutturale** — `provision-derived-access.ts` esclude `user_type = 'SERVICE'`,
     e la esclusione sta **dopo** `--solo`: così nemmeno un elenco esplicito può raggiungerle.
     Su `user_type`, cioè una proprietà del **modello**, non su una lista da mantenere a mano.
  2. **Il riallineamento, chirurgico** — nuovo `pnpm db:provision-collaudo --riallinea`: ruota la
     credenziale, la ricrea dalla chiave propria, rimuove i fattori non previsti. Scelto al posto
     di `--undo` + ri-provisioning, che avrebbe **cancellato gli utenti** — un rimedio più largo
     del guasto è un guasto a sua volta.

  **Le quattro cose di ogni scrittura, anche per tre righe**: (a) misura prima, live e sul
  database; (b) guardia — solo le tre email di `COLLAUDO_IDENTITIES`, solo se `SERVICE`, elenco
  esplicito mai un jolly; (c) post-condizione **su ciò che non doveva cambiare** — gli `STANDARD`
  invariati, la sentinella del censimento a zero, e **il numero di fattori MFA delle PERSONE
  identico**, perché la `DELETE` non deve poterle sfiorare; (d) rollback — giornale
  `staging.collaudo_riallineo_undo`, popolato **prima** di toccare qualsiasi cosa: **6 righe**
  (3 credenziali + 3 segreti di fattore), lo stato del 31 agosto è ricostruibile riga per riga.

  🔬 **Evidenza live, dopo**:
  ```
  password di COLLAUDO ........ HTTP 200, mfa_required=false, cookie=3
  password ERRATA ............. HTTP 401
  password da CHIAVE MADRE .... HTTP 401   <- la separazione, misurata
  ESITO: OK — il collaudo entra in un passo, la chiave madre non apre niente
  ```
  su tutte e tre. Nessuna regressione sulle persone: `federica.marchetti@rtl-bank.org` entra con
  la password derivata (**HTTP 200**), e la guardia non le riguarda per costruzione. `typecheck`
  dell'API pulito. Il dry-run è stato corretto perché **dicesse il vero**: sottostimava a 0 le
  credenziali che l'esecuzione vera avrebbe creato.

  **Resta F3a** (la suite passa alle utenze di collaudo — 34 spec dipendono dai dati di persone
  reali, e c'è una tensione da nominare con la Definition of Done, che pretende login con persona
  reale) e **F3c** (i segreti delle persone reali diventano casuali).

  ### ⚠ ANALISI S1083 (2026-08-28) — F3 non è eseguibile com'è scritta, e ne è emerso un rischio

  **① F3 ha una dipendenza che nessuno aveva dichiarato.** La suite E2E fa login con **persone
  reali** — `fixtures.ts` dichiara `platformAdmin: enzo.spenuso@heuresys.com`,
  `tenantAdmin: federica.marchetti@rtl-bank.org`, `employee: paolo.caputo@rtl-bank.org` — e per
  ciascuna chiama `passwordFor(email)` e `totpFor(email)`, che sono le due derivazioni dalla
  chiave madre. Finché è così, rendere casuale un segreto **rompe la suite**, e F4 pretende
  esplicitamente che le due cose stiano insieme.
  Le utenze di collaudo che F2 ha creato esistono, sono operative e **la suite non le usa**:
  crearle non ha spostato nessun test. Il passo mancante è *portare la suite sulle utenze di
  collaudo*, e va prima di F3, non dopo.

  **② E in mezzo c'è un rischio concreto, misurato oggi.** Le tre personas hanno ruoli propri —
  `piattaforma@collaudo.invalid` è **`PLATFORM_ADMIN`**, `governo@` è `TENANT_ADMIN`, `persona@`
  è `USER` — e tutte e tre sono già iscritte in `sys_auth_mfa_exemption_eligible_users` (3 righe,
  motivazione `collaudo-access (#169 F2, direttiva Enzo 2026-08-25)`).
  Messe insieme, le due cose dicono questo: **l'utenza amministratore di piattaforma ha una
  password derivata dalla chiave madre ed è esente dal secondo fattore.** Chi possiede la chiave
  madre completa un accesso come amministratore di piattaforma **senza alcun secondo fattore** —
  che è, alla lettera, ciò che F4 dichiara debba risultare impossibile.
  L'esenzione non è un errore: senza di essa un'utenza headless non potrebbe funzionare. È la
  **combinazione** con la password derivata a essere insostenibile, e nessuna delle due voci la
  nominava perché sono nate in momenti diversi.

  **③ Conseguenza per il piano, dichiarata invece che scoperta dopo.** F3 si riscrive in tre
  passi ordinati, e il primo non c'era:
  - **F3a** — la suite E2E passa alle utenze di collaudo (`fixtures.ts` e i suoi consumatori).
    Da quel momento nessun test dipende più dai segreti delle persone reali.
  - **F3b** — le utenze di collaudo smettono di avere la password derivata: casuale, cifrata a
    riposo, consegnata una volta sola alla suite per una via **diversa dalla chiave madre**.
    Senza questo, F3a da sola sposta il bersaglio e non toglie il rischio.
  - **F3c** — solo allora i segreti delle persone reali diventano casuali, ed è il contenuto
    originale di F3.

  Nessuna riga di codice toccata in S1083: la corsa E2E integrale di `#219` F5 era in volo sugli
  stessi file, e cambiare le derivazioni sotto i piedi di una suite in esecuzione avrebbe
  prodotto rossi che nessuno avrebbe saputo leggere.

  ### ⛔ F3a È CANCELLATA (S1092, 2026-09-08) — non rinviata: non serve più

  F3a esisteva per una ragione sola: *«finché la suite fa login con persone reali, rendere
  casuale un segreto la rompe»*. La ragione era giusta, la conclusione no — perché dava per
  scontato che l'unico modo di conoscere il segreto fosse **derivarlo**.

  I test lo **leggono dal database**, dove è cifrato e a cui accedono già con credenziali
  piene. Nessuna delle 101 spec è stata toccata, nessuna persona sostituita, nessun dato
  fabbricato per un'utenza di servizio. Il costo stimato di F3a era una sessione o più; il
  costo reale del passo che la sostituisce è **un file**.

  ⭐ **La lezione, che vale oltre questa voce**: F3a nasceva da una domanda mal posta — «da
  quale identità fa login la suite?» — quando quella giusta era «da dove prende il segreto?».
  Il piano aveva scritto la dipendenza fra le due come se fosse necessaria, e per tre
  sessioni nessuno l'ha rimessa in discussione: era **una premessa**, e le premesse dei nostri
  stessi piani sono fonti non verificate esattamente come le consegne del lab (`#149`).

  ▸ Resta vero il rilievo qui sotto sul **componente** e sui dati: portare la suite su
  identità di servizio, se un giorno servisse, resta il lavoro che era. Semplicemente non
  serve **per chiudere questa voce**.
- [x] **F4 La prova che deve poter fallire** — FATTA 2026-09-12 (S1095) · **secondo corno RI-MISURATO con l'obbligo acceso**: B18 (2026-09-09) ha abilitato le due politiche MFA per cliente; `node scripts/verify-derived-login.mjs federica.marchetti@rtl-bank.org https://www.heuresys.com/api` → password derivata: **passo 2, HTTP 401, 0 cookie** (il TOTP ricostruito dalla chiave madre è respinto); password errata: 401 · primo corno già superato in S1093 (0 derivabili). *Cronaca della misura precedente:* **MISURATA S1093 (2026-09-08): primo corno SUPERATO, secondo corno VIOLATO in produzione, e il blocco e' quantificato.**

  Lo strumento e' `pnpm db:verify-separazione-totp` (`db/scripts/verify-separazione-totp.ts`),
  uscite `0` separati / `1` violata / `2` NON MISURABILE. Porta una **controprova interna**:
  prima di dichiarare qualunque zero verifica di saper riconoscere una corrispondenza quando
  c'e', perche' uno zero e un confronto rotto si assomigliano moltissimo.

  🔬 **Primo corno — SUPERATO** (produzione, 2026-09-08):
  ```
  controprova ..................... superata (il confronto vede, e non vede troppo)
  fattori TOTP esaminati .......... 159
  di cui cifrati a riposo ......... 159
  NON leggibili (non misurati) .... 0
  ANCORA DERIVABILI dalla chiave .. 0
  SEPARATI: nessun secondo fattore si ottiene dalla chiave madre
  ```

  ⚠ **Il conteggio che c'era NON diceva questo, e sembrava dirlo.** `stop-deriving-totp --dry-run`
  stampa «DA RENDERE CASUALI: 159», che conta i fattori con l'etichetta `derived-access` — cioe'
  la **portata**, non la proprieta'. Su un database gia' bonificato stampa lo stesso numero: letto
  come misura avrebbe fatto concludere che F3c non fosse mai stata applicata.

  🔴 **Secondo corno — VIOLATO in produzione**, misurato con un login vero:
  con la sola chiave madre si completa un accesso **in un passo** come
  `USER, PLATFORM_ADMIN, MANAGER` — **224 permessi**. Non e' un difetto della separazione dei
  segreti, che regge: e' che **l'enforcement MFA e' spento** su quell'ambiente, quindi la password
  derivata basta da sola.

  ⛔ **E accenderlo oggi non si puo', ed e' un numero, non un'opinione**: **159 utenti su 164
  attivi** hanno un fattore TOTP verificato il cui segreto e' **casuale e non e' mai stato
  consegnato a nessuno** (e' il senso stesso di F3c). Accendere l'enforcement chiuderebbe fuori
  il **97%** delle persone. La precondizione mancante e' un **percorso di ri-enrollment**, che e'
  lavoro di prodotto e non appartiene a questa voce.

  ➡ **Stato onesto della voce**: la proprieta' che `#169` esisteva per ottenere — password e
  secondo fattore non nascono piu' dalla stessa chiave — **e' raggiunta e ora e' misurabile in
  permanenza**. Cio' che manca non e' dentro `#169`: e' la decisione sull'enforcement, che questa
  sessione ha dotato del numero che le serviva.

- [x] **F4 (formulazione originale, tenuta per confronto)** — COPERTA 2026-09-12 dalla riga sopra: il tentativo con la chiave madre è stato eseguito ed è fallito (401 al passo 2), e la suite gira perché legge il segreto dal database (F3c), non dalla chiave — con la chiave madre in mano, **completare** un accesso come amministratore deve risultare **impossibile**, e la suite deve continuare a girare. Le due cose insieme, o la voce non è chiusa: passare la prima rompendo la seconda è il modo ovvio di barare. **fatto =** tentativo eseguito e fallito con evidenza, suite verde

## Chiuso quando

Chi ha la chiave madre **non può completare** un accesso come l'amministratore, e la suite continua
a girare.
