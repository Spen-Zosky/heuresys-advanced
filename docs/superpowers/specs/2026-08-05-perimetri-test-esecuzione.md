# #115 — I test di perimetro tornano a descrivere l'organigramma di oggi

**Sessione**: S1045 (2026-08-05) · **Consegna aperta da**: S1043 →
`docs/superpowers/specs/2026-08-04-perimetri-test-dopo-ricostruzione.md`
**Confine di sessione dichiarato**: l'obiettivo è chiudere #115 per intero in questa sessione.
Se la suite intera finale scoprisse una famiglia di rossi estranea all'organigramma e di natura
diversa, quella diventa una voce a sé e viene dichiarata, non nascosta dentro #115.

---

## Tabella delle voci

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| V1 | Inventario completo dei rossi, misurato sulla suite intera (il run di S1043 si fermò a metà) | Claude | elenco file+test rossi da un run completo, non stimato | ✅ **24 file · 81 test** su 232/1639 — identico a S1043: la lista NON cresce |
| V2 | File che derivano già gli attori ma nominano i tre a mano: conversione a `org-actors.ts` | Claude | zero occorrenze di `tommaso.fiore`/`antonio.parisi` come ruolo derivabile | ✅ 11 file uniformi + 7 mirati |
| V3 | Irrobustire `org-actors.ts`: stesso tenant, nessun mandato, universo vuoto = errore | Claude | il test misura l'isolamento fra pari (I19), non quello fra tenant (I5) | ✅ + 4 helper nuovi |
| V4 | Rossi NON causati dagli attori: diagnosi una per una | Claude | ogni rosso ha una causa nominata e una correzione, o è dichiarato fuori #115 | ✅ 6 cause distinte, tutte chiuse |
| V5 | Verifica per file (secondi l'uno, non 31 minuti) | Claude | ogni file convertito verde da solo | ✅ 24/24 + typecheck:test pulito |
| V6 | Suite intera, una volta sola, alla fine | Claude | `pnpm exec vitest run` verde | ✅ **1620/1620 verdi** (04:42, run del cancello): 232 file, 0 test rossi. Servirono **tre** run interi: il 1° inquinato da una suite concorrente sullo stesso DB, il 2° ha scoperto due rossi NON previsti da V1 (sotto), il 3° verde su tutte e 6 le suite |
| V7 | Commit atomico + #115 chiuso nel register | Claude | commit fatto, register aggiornato | ✅ commit fatto · register → all'`handoff`, che ne è il writer dichiarato |

## Cosa V1 non aveva visto (scoperto eseguendo V6)

L'inventario dei rossi era stato preso **prima** che il lavoro toccasse il tree, e due
famiglie non potevano comparirci:

| | cosa | causa reale | correzione |
|---|---|---|---|
| **W1** | `apps/web` non compilava | ADR-0032 ha reso l'importo un campo che può **mancare**; la pagina retributiva non era stata adeguata → `TS2345` | la cella dichiara «nascosto per il tuo profilo» invece di un `—` che si legge come «non c'è valore» (i18n IT+EN, parità 2919 chiavi) |
| **W2** | `organization-unit-processes-raci-demo` | **la stessa malattia di #115, su un file fuori dai 24**: pretendeva le 105 righe di giugno. La ricostruzione ha disattivato `DIR-CORP` e `DIV-RISK` e le loro 9 responsabilità sono sparite con loro (105→96); inoltre asseriva un ruolo su `DIV-RISK`, reparto chiuso | precondizione **strutturale** invece di un conteggio (ogni processo ha uno e un solo responsabile; nessuna responsabilità su unità spente) + l'unità sul KYC/AML derivata dal dato |
| **W3** | `gdpr` (1° run) e `user-career-plans-scope` (2° run) | **file diversi a ogni giro** = lentezza, non logica: limiti tarati sull'esecuzione isolata mentre la suite gira 38 minuti contro il DB remoto. `user-career-plans` da solo: 7/7 in 37s | `testTimeout` 20→40s, `hookTimeout` 30→60s, con la misura scritta accanto |

**Verifica di merito su W2** (poteva finire male): chiudere due reparti poteva lasciare
processi **senza responsabile**. Misurato: 23 processi, 23 responsabili, **zero orfani**.
Nessuna decisione di business pendente per Enzo.

---

## Simulazione a cinque domande

### V2 — conversione dei file che nominano i tre attori

- **Precondizioni** — il tunnel :5433 è su (verificato al boot); `org-actors.ts` esiste ed è già
  in uso su 9 file verdi; `.secrets/dev-access-master.key` è presente, altrimenti nessun login
  funziona (Z-262: password e TOTP si DERIVANO, non sono costanti).
- **Meccanismo** — `unSottopostoOrganizzativo` / `unEstraneoOrganizzativo` leggono l'albero delle
  **unità organizzative**, indipendente dall'albero delle **posizioni** che il resolver percorre.
  Verificato oggi sul vivo: paolo dirige 5 unità; il sottoposto derivato è
  `alessio.costa@rtl-bank.org`, l'estraneo `alberto.colombo@rtl-bank.org`, entrambi RTL_BANK.
  Non è tautologico: chiede a due strutture di concordare.
- **Propagazione** — solo file di test nel repo: `git pull` li porta ovunque. Nessun artefatto
  fuori dal repo, nessuna scrittura sul DB (l'isolamento transazionale rollbacka per file).
- **Chi** — Claude, per intero. Nessun input di Enzo.
- **Guardia** — gli helper **lanciano** se l'universo è vuoto (`verifica cieca`) invece di
  restituire `undefined`: un test che non trova un sottoposto si ferma, non passa a vuoto.

### V3 — filtro tenant sull'estraneo

- **Precondizioni** — nessuna: è una condizione in più su una query esistente.
- **Meccanismo** — oggi `unEstraneoOrganizzativo` non filtra per tenant. Ordina per email e
  prende il primo: se una persona del tenant Heuresys System avesse un incarico attivo e una
  email alfabeticamente più bassa, il test misurerebbe l'isolamento **fra tenant** (I5) credendo
  di misurare quello **fra pari** (I19). Oggi non succede — misurato — ma succede per fortuna,
  non per costruzione.
- **Propagazione** — file di test versionato.
- **Chi** — Claude.
- **Guardia** — il `throw` su universo vuoto resta: se il filtro svuotasse il risultato, il test
  si fermerebbe invece di diventare cieco.

### V4 — i rossi non causati dagli attori

- **Precondizioni** — l'inventario V1 completo.
- **Meccanismo** — già identificato con certezza un caso: `rbac-tenant-admin-allowlist` fallisce
  perché la migrazione `000256` ha concesso a TENANT_ADMIN quattro permessi nuovi
  (`performance-review:read/write`, `calibration:manage`, `review-cycle:manage`) derivando la
  platea da chi ha `talent:read` — che include TENANT_ADMIN — **senza** il marcatore esplicito
  `TENANT_ADMIN-ALLOWLIST-EXTEND` che la 000210 pretende. La guardia D-57 sta funzionando: ha
  intercettato esattamente l'assorbimento silenzioso per cui esiste. **Non è un test da
  adeguare**: è una decisione da dichiarare in una migrazione.
- **Propagazione** — se la correzione è una migrazione, va applicata al DB di PROD (unico
  ambiente, ADR-0026) e arriva sui cloni con l'allineamento.
- **Chi** — Claude decide la forma tecnica; nessun input di Enzo (è disciplina RBAC interna, non
  scelta di business: i quattro permessi sono già concessi live, si tratta di dichiararli).
- **Guardia** — la migrazione dev'essere idempotente e non deve concedere nulla di nuovo: solo
  rendere esplicito ciò che è già vero, altrimenti cambierebbe la superficie di autorizzazione
  mentre dichiara di descriverla.

### V6 — la suite intera

- **Precondizioni** — tutti i file convertiti e verdi singolarmente.
- **Meccanismo** — `pnpm exec vitest run` in `apps/api`, ~31 minuti, singleThread sul DB vivo.
- **Propagazione** — nessuna.
- **Chi** — Claude.
- **Guardia** — un run parziale non conta come verifica: la chiusura si legge dal run completo.

---

## Le sei cause, misurate una per una

Non erano 24 file con un unico difetto: erano **sei difetti diversi** che la ricostruzione
dell'organigramma ha reso visibili insieme.

| # | causa | file | come si chiude |
|---|---|---|---|
| 1 | I tre attori erano **nomi**, e i loro ruoli si sono invertiti | 17 file | derivati dall'albero delle unità |
| 2 | La coppia di **pari** non è più disgiunta (`claudia.serra` è finita dentro il sotto-albero di `paolo.caputo`, intersezione 10 persone) | `scope-peer-isolation` | coppia derivata, disgiunzione asserita su una struttura diversa da quella che la sceglie |
| 3 | Il profilo «**non manageriale ma con riporti**» non esiste più nel dato: misurato, **zero persone su 163** | `scope-resolver`, `users` | la fixture si **prepara** invece di cercarla (precedente: `actorWithoutMfaFactor`) |
| 4 | Il predicato di `semantic-matching-self-only` era una **fotografia di tre ruoli**: ogni responsabile di unità ha ricevuto `TEAM_LEADER`, che in quella lista non c'era | `semantic-matching-self-only` | predicato sostituito dalla proprietà durevole (manageriale per DATO, non per RUOLO), ruoli **importati** dal resolver |
| 5 | Conteggi **fotografati** (159/2) invalidati da una decisione legittima presa altrove (mig `000263`) | `sdbi-perf-feedback` | atteso derivato dal registro di provenienza; il `4` resta come **guardia di due decisioni**, entrambe nominate |
| 6 | Il parser della guardia RBAC **non ammetteva il trattino**, e i primi codici col trattino sono nati con la `000256` | `rbac-tenant-admin-allowlist` | classe di caratteri corretta + mig `000270` che dichiara i 4 permessi |

## Due reperti sul DATO, non sui test

Emersi misurando, **fuori** dal perimetro di #115 — nessuno dei due è stato «aggiustato»:

1. **La proprietà delle posizioni è quasi tutta su posizioni disattivate.** 161 posizioni attive
   hanno 11 proprietari; 153 disattivate ne hanno 27. `paolo.caputo` ne possiede 5, **tutte
   inattive**: il suo cruscotto è legittimamente vuoto. Un solo utente con ruolo `MANAGER`
   possiede almeno una posizione attiva. Il test ora sceglie quell'uno per caratteristica, ma la
   domanda «è giusto che un manager non possieda la propria posizione?» è di prodotto.
2. **La mig `000263` ha rimosso due valutazioni che I14 dichiarava da conservare.** Erano gusci
   vuoti (nessun soggetto, nessun valutatore, nessuna riga che li referenziasse) e la decisione è
   scritta e motivata; la **provenienza è intatta** — le loro righe di lineage esistono ancora con
   l'id legacy. Registrato nel test come guardia, non riaperto.

---

## Reperti da non riscoprire

- Il run di S1043 (`.zp/suite-parziale-S1043.txt`, 5.971 righe) elenca **24 file** e **81 test**
  rossi, ma il reporter di Vitest in output rediretto stampa la riga di riepilogo **solo per i
  file falliti**: da quel log non si può sapere quali file erano passati, quindi non si può
  dedurre quanta suite fosse stata percorsa.
- `--reporter=basic` **non esiste più** in Vitest 4: il run muore al caricamento del reporter con
  `ERR_LOAD_URL` ed esce 0. Un exit code 0 lì non significa suite verde.
- Le password e i segreti TOTP si **derivano** dalla chiave madre per QUALUNQUE utente
  (Z-262): non esiste più un elenco privilegiato di sette personas, quindi un attore derivato
  dall'organigramma può fare login davvero. Le tre persone fisiche in `REAL_PERSON_EMAILS` sono
  l'unica eccezione e non sono impersonabili.
