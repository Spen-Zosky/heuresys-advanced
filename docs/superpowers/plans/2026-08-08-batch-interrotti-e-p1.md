# Batch delegato — riprendere gli interrotti, poi i cinque P1

**Aperto**: 2026-08-08 · **Mandato**: Enzo, batch delegato con decisioni incluse
(«riprendi da dove avevi interrotto e poi continua con P1 #168, #99, #92, #142, #143 —
anche in questa sessione ti delego le decisioni sulle domande che dovresti chiedere a me»).

---

## Confine di sessione — dichiarato all'inizio (R24.4)

Questo batch **non si chiude in una sessione, e non è mai stato pensato per chiudersi in una**.
I numeri sono quelli del registro, non stime a memoria: `#99` ~6-8 sessioni, `#143` ~4-6,
`#142` ~3-4, `#92` ~2-3, più i quattro task residui di `#131` e il residuo di `#124`.
Totale dichiarato: **~18-25 sessioni**.

Quindi: **nessun messaggio di questa sessione dirà o lascerà intendere che il batch è finito.**
La chiusura sarà binaria e letta da questa tabella — `CICLO CHIUSO` solo se ogni riga è `FATTO`,
altrimenti `CICLO NON CHIUSO — manca la voce K`.

Ordine di esecuzione: gli interrotti per primi (sono in volo e il loro costo di ripresa cresce),
poi i P1 nell'ordine dato da Enzo. Ogni voce chiude con **commit** e **dimostrazione live su dati
reali** (ADR-0026): niente si chiude su test verde.

---

## Le voci

| id | cosa | chi | fatto significa | stato |
|---|---|---|---|---|
| **A0** | La mappa settore→famiglia di modelli (prerequisito emerso misurando: non esiste) | Claude | migrazione applicata + prova generale verde + `64.19` risale a `FIN_BANKING` sul vivo | **FATTO** |
| **A1** | `#131` T5 — il modulo API `tenant-blueprints` (15 rotte) | Claude | 9 test verdi, typecheck+lint, commit unico, 15 rotte vive in produzione | **FATTO** — 9/9 verdi, regressione API completa verde (2188s), commit `2d74377c` |
| **A2** | `#131` T6 — frontend: elenco, cascata, confronto | Claude | 3 pagine + i18n it/en in parità + voce di menu + Playwright verde con login reale | **FATTO** — 3 pagine, i18n in parità, voce di menu (`000302`), **98/98 prove di navigazione verdi** con login reale; 3 difetti trovati e corretti provando |
| **A3** | `#131` T7 — il fascicolo vero di RTL Bank (la prova che conta) | Claude | 23/23 processi esprimibili, 7/7 decisioni registrate, sul database di produzione | **FATTO** — `23/23 processi, 7/7 decisioni, 0 differenze`; poi sottomesso e firmato dal vivo via API con login reale → `APPROVED` con fotografia `ba19f72d…` |
| **A4** | `#131` T8 — controllo di scostamento sull'identità | Claude | la sentinella esiste, gira, e **si è vista rossa** almeno una volta | **FATTO** — `check_identita_azienda.py`; `--autoprova` costruisce un guasto in transazione annullata e lo vede (provato). Dopo A3: RTL **coerente**, Heuresys *non ancora descritta* |
| **B1** | `#124` strato 1 — spaccare `IDENTITY` in `IDENTITY_PRO` / `IDENTITY_PRIV` | Claude | 6 celle su 8 chiuse; prova HTTP live sulla stessa riga letta da due attori | da fare |
| **B2** | `#124` vincolo 5 — gli aggregati (`/v1/compensation/distribution`) | Claude | la media su classe mascherata non è più una fuga; prova live | da fare |
| **B3** | `#124` gli altri endpoint delle due classi (12 rotte) | Claude | ogni rotta elencata porta `masked`; prova live per famiglia | da fare |
| **B4** | `#124` frontend — rendere `masked` invece di una cella vuota | Claude | «nascosto per il tuo profilo» visibile a video con login reale | da fare |
| **C1** | `#168` censimento dei `CASCADE` verso `sys_users` + decisione per famiglia | Claude | ogni FK classificata, le famiglie che perdono storia riparate, prova che il ripristino regge | da fare |
| **D1** | `#99` domini gerarchici e funzionali — 8 fasi | Claude | fase per fase, ognuna con la sua prova live | non iniziata |
| **E1** | `#92` ciclo di valutazione completo (autovalutazione + calibrazione) | Claude | il ciclo si percorre end-to-end con persone vere | non iniziata |
| **F1** | `#142` cruscotti focalizzati per tipologia di utilizzatore | Claude | ogni tipologia ha il suo cruscotto, provato con il suo profilo | non iniziata |
| **G1** | `#143` una squadra è un progetto: il modello, non un puntatore al capo | Claude | il modello esiste e regge le squadre reali di RTL | non iniziata |

---

## A0 — simulazione a 5 domande (R24.3)

**Perché esiste questa voce.** Il piano di implementazione, al Passo 5 del Task 5, dice: *«dall'ATECO
si risale alla famiglia (`sys_blueprint_families.blueprint_family_code` corrisponde al codice di
settore del tenant)»*. Misurato sul vivo, **quel "si risale" non ha su cosa poggiare**:

```
sys.sys_activity_classification_mappings           → 0 righe
sys.sys_blueprint_families.blueprint_family_metadata → '{}'
sys.sys_tenancies.tenant_industry_code             → varchar senza CHECK né FK ('FIN_BANKING')
```

L'epica stessa lo dichiara in §3.4: **«Nessuna derivazione»**. Il codice di settore del tenant e il
codice della famiglia coincidono *per come sono stati scritti a mano*, non per una regola che un
programma possa applicare a un ATECO qualunque. Senza questa voce, il Passo 5 sarebbe costretto a
inventare una corrispondenza per stringa — che funziona su RTL e su nient'altro.

- **Precondizioni** — `sys_blueprint_families` esiste (1 riga, `FIN_BANKING`); gli ATECO sono
  gerarchici e la risalita funziona (verificato: `64.19 → 64.1 → 64 → L`, livelli 4→3→2→1);
  `sys_activity_classifications` ha 3.257 righe su 6 livelli.
- **Meccanismo** — tabella nuova `sys.sys_blueprint_family_activity_classes` (famiglia ×
  classificazione, con `kind`), più una funzione di risalita che dall'ATECO scelto sale di padre in
  padre e restituisce la **prima** famiglia mappata. Una riga sola per ora: `FIN_BANKING → 64`
  (*Attività dei servizi finanziari*). **Non `L`**: `L` include assicurazioni (65) e ausiliari (66),
  che quella famiglia non modella. È una **tassonomia**, quindi resta aperta a ogni settore (I21).
- **Propagazione** — è una migrazione: la porta la catena, come ogni altro oggetto. `close-propagate`
  arma il deploy, VM e linux-pc la applicano quando la CI passa.
- **Chi** — Claude, per intero.
- **Guardia** — non è distruttiva: crea una tabella e inserisce una riga con `ON CONFLICT DO
  NOTHING`. La post-condizione che conta è quella che protegge ciò che **non** doveva cambiare: le
  23 righe del registro processi e l'unica variante pubblicata restano intatte. Prova generale
  (`ci-rehearsal.sh`, due passate) prima del push, obbligatoria.

**Decisione presa (delegata)**: due commit invece di uno — prima lo schema (`feat(db)`), poi il
modulo (`feat(api)`). Il divieto di progetto è spezzare *un modulo* su più commit; la migrazione non
è il modulo, e tenerla dentro renderebbe il commit del modulo non riproducibile su un database
vergine senza applicare prima la catena.

---

## A1 — simulazione a 5 domande (R24.3)

- **Precondizioni** — verificate tutte sul vivo, non dedotte:
  - le 4 tabelle del fascicolo esistono (`sys_tenant_blueprints`, `_versions`,
    `_process_decisions`, `_snapshots`) con i vincoli attesi (indice unico parziale «una sola
    versione aperta», trigger di immutabilità sulla fotografia);
  - i 3 permessi esistono e sono concessi **al solo `PLATFORM_ADMIN`**
    (`tenant_blueprint:read|write|approve`);
  - l'effetto `TENANT_BLUEPRINT_APPROVAL` è registrato
    (`apps/api/src/modules/approvals/effects/index.ts:18`);
  - il catalogo offre esattamente ciò che i test presumono: variante
    `REGIONAL_RETAIL_BANK_MEDIUM`, fascia `M`, versione 1 `PUBLISHED`, **23 processi**.
- **Meccanismo** — pattern dei moduli in 7 passi (`.claude/rules/api-module-pattern.md`), letto:
  schemi Zod con subpath export → repository con SQL parametrizzato → service → routes con
  `requirePermission` + `verifyCsrf` → registrazione allo step 13 di `app.ts` → test di
  integrazione → commit atomico. `loginAs` **non esiste**: l'helper reale è `loginRaw(app, email)`
  in `test/helpers/login.ts` e restituisce la risposta di login, non gli header — le chiamate del
  piano vanno adattate all'helper, non l'helper alle chiamate.
- **Propagazione** — codice: `close-propagate` arma, gli host tirano.
- **Chi** — Claude, per intero.
- **Guardia** — non distruttiva. Il rischio vero è l'opposto: un permesso troppo largo. Il nono test
  è la guardia — tutti e 15 gli endpoint devono rispondere **403 e non 404** a un amministratore di
  tenant, perché un 404 rivelerebbe l'esistenza della risorsa.

---

## Registro delle scoperte — fuori da questo ciclo (R24.5)

Voci nuove emerse misurando. Presentate **una volta sola**, non entrano in «cosa resta», non
bloccano la chiusura.

- `BLUEPRINT_FIELD_LOCKED` (§4.8 dell'epica) non ha in P1 nessun attore che possa scatenarlo:
  va registrato come dipendenza dichiarata di P2 nel registro dei debiti, non implementato.
- `sys_activity_classification_mappings` esiste, è vuota da sempre e nessuna API la espone.
  Candidata al cancello di esposizione (`#79`).
- **`CLAUDE.md` cita `PERMISSION_DENIED` fra i «codici esistenti da imitare»**, ma sul codice reale
  non lo emette nessuno: `requirePermission` risponde `FORBIDDEN` su **520 rotte su 532**, e le 12
  eccezioni portano codici `*_ADMIN_ONLY`. La riga del CLAUDE.md induce in errore chi scrive un
  modulo nuovo — è successo qui. Correzione di una riga, ma tocca un file di regole che è di Enzo:
  la propongo invece di applicarla.
- ~~I permessi `blueprint:activate|override|delete` in mano a `TENANT_ADMIN`~~ — **falso allarme,
  già chiuso**: la decisione E9 è stata applicata dal Task 3 (mig. `000300`, che toglie i codici
  dalla `VALUES` dell'allowlist `000210` e poi verifica la revoca). Misurato live: quei tre permessi
  oggi li hanno solo `BLUEPRINT_MANAGER` e `PLATFORM_ADMIN`. Nessun lavoro da fare.

### Esito A0 — dimostrazione live (2026-08-08 15:18, DB di produzione via tunnel :5433)

| ATECO | descrizione | famiglia derivata |
|---|---|---|
| `20.11` | Fabbricazione di gas industriali | — |
| `64` | Attività dei servizi finanziari | `FIN_BANKING` |
| `64.1` | Intermediazione monetaria | `FIN_BANKING` |
| `64.19` | Altre intermediazioni monetarie (**l'ATECO di RTL Bank**) | `FIN_BANKING` |
| `65.11` | Assicurazioni sulla vita | — |
| `70.20` | Consulenza gestionale (**l'ATECO di Heuresys**) | — |

Le due righe che valgono la prova sono quelle **vuote**: `65.11` non risale, e per arrivarci è
bastato mappare `64` invece di `L`. Prova generale su linux-pc: verde in due passate; la guardia
nuova è stata fatta scattare di proposito prima di fidarsi.

---

## Scoperte che hanno cambiato il piano (misurate, non dedotte)

1. **La derivazione ATECO→famiglia non esisteva** — il T5 la dava per fatta. Ha prodotto la voce
   `A0` e la migrazione `000301`.
2. **`PERMISSION_DENIED` non è il codice della piattaforma**: `requirePermission` risponde
   `FORBIDDEN` su 520 rotte su 532. Il test è stato allineato alla piattaforma.
3. **`loginAs` non esiste** — l'helper reale è `loginRaw`, e restituisce la risposta di login, non
   gli header. Le chiamate del piano sono state adattate all'helper.
4. **`content-type: application/json` su richieste senza corpo** fa rispondere 400 a Fastify prima
   dei `preHandler`: il caso dei 15 endpoint stava misurando la validazione invece del permesso.
   Corretto, e rafforzato con la verifica che la POST negata non abbia scritto nulla.
5. **`RegulatoryIntensity` era già definito** in `enterprise-typing-profiles`: importato invece che
   ridichiarato, per non avere due scale della stessa cosa.
6. **Il caso noto del T8 non esiste più** — Heuresys ha ATECO `70.20`, coerente con
   `MGMT_CONSULTING`: riparato da `#144` (mig. `000282`). Il registro lo aveva previsto, e infatti
   la prova di falsificabilità è stata **costruita ad arte** (`--autoprova`), non attesa dal dato.
7. **La revoca E9 era già in produzione** dal T3: nessun lavoro da fare.

---

## A3 — dimostrazione live (ADR-0026)

**2026-08-08 17:19, database di produzione via tunnel :5433.**

```
  login .................. enzo.spenuso@heuresys.com
  fascicolo .............. Configurazione di RTL Bank (RTL-BANK-CONFIG), azienda legata
  versione ............... 1 in stato DRAFT
  processi ............... 23, di cui decisi 7
  sottomissione .......... OK, richiesta ccc21170-…, stato IN_APPROVAL
  passo di approvazione .. 92ee0f03-… (PENDING)
  decisione .............. APPROVED
  applicazione ........... 200 APPLIED
```

```
 tenant_blueprint_code | versione |  stato   | ha_fotografia |     impronta     |        firmata_da
-----------------------+----------+----------+---------------+------------------+---------------------------
 RTL-BANK-CONFIG       |        1 | APPROVED | t             | ba19f72d41278580 | enzo.spenuso@heuresys.com
```

Non è passato dal database: ogni passo è una chiamata HTTP reale sulle rotte del
modulo, con la sessione di una persona che ha fatto login con il proprio secondo
fattore.

**Un difetto trovato provando, e non era del prodotto**: lo script di prova
dichiarava `content-type: application/json` anche sulle POST senza corpo, e
Fastify rispondeva 400 prima di ogni altra cosa. Verificato che il client del
prodotto NON abbia lo stesso difetto — `apiFetch` imposta l'intestazione solo
quando un corpo esiste — quindi la pagina di sottomissione è corretta.
