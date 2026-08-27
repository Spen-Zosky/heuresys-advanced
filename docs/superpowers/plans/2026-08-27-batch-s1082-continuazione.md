# Batch S1082-continuazione (2026-08-27) — #219 → #234 → #227 → il resto

> **Mandato di Enzo** (2026-08-27, in chat): *«procedi con #219 (i tre guasti E2E), #234 (i rossi
> di verifica_incrociata), #227 F2 (gli archi derivabili) e poi con tutto quello che resta fino a
> che c'è capienza.»*
> **Modo**: batch delegato — esecuzione end-to-end, commit a ogni voce conclusa, nessuna domanda
> per-passo. Si chiede solo ciò che **solo Enzo** può decidere.
> **Capienza all'apertura**: `guardiano.py --budget 400000` → **✓ si continua**, 435.540 token
> fino alla soglia 75% · finestra 5h **21%**. Si ri-misura a ogni voce chiusa.

## Le due misure di apertura, prese prima di pianificare

**① La VM è scarica, quindi le E2E sono attendibili adesso.** È l'unica precondizione che poteva
invalidare l'intero blocco #219: la memoria `vm_aide_night_job_slows_db` dice che fra le 02:00 e la
fine di `aide` nessuna misura E2E vale, e sono le **03:47 CEST** — dentro quella finestra.
Misurato invece:

```
Thu Aug 27 01:47:55 UTC 2026
0.01 0.09 0.15 1/810 147209      ← load su 2 core
aide: non in esecuzione
```

`aide` ha già finito. Se fosse stato in corso, l'ordine del batch andava rovesciato (#234 e #227
non dipendono dalle E2E). **Non è stato necessario.**

**② Nessun servizio locale è acceso**: `:8013`, `:3001`, `:3000` rispondono `000`, nessuna porta in
`LISTENING`. I `pnpm dev` visti nell'elenco processi sono di ieri e sono morti. L'API va accesa a
mano — nessuna config Playwright la avvia (F5a di #219).

## Il piano — una riga per deliverable

| id | voce | cosa | fatto quando | stato |
|---|---|---|---|---|
| **A0** | #219 | Accendere API + web, preflight `e2e-blocchi.mjs` | preflight verde, 6 setup passano | DA-FARE |
| **A1** | #219 F5d-bis | **Indagine**: perché `/privacy` e `/brownfield-adaptation` non renderizzano (21 e 40 nodi) | causa nominata con evidenza, non ipotizzata | DA-FARE |
| **A2** | #219 F5d-bis | Cura dei due guasti di rendering | le due rotte superano la soglia di nodi e axe misura davvero | DA-FARE |
| **A3** | #219 F5d-bis | **Indagine + cura**: il locator passkey (`login-mfa-enrollment.spec.ts`) | caso verde per la ragione giusta | DA-FARE |
| **A4** | #219 F5e | Corsa integrale: **0 falliti** | referto JSON allegato | DA-FARE |
| **A5** | #219 F5e | Passaggio della suite in CI secondo il criterio di `#211` F4 | workflow verde su main | DA-FARE |
| **B1** | #234 F2 | `X6a` — 5 OKR su reparto inesistente: 2 contaminazione + 3 nomi disallineati | conteggio a zero o eccezione dichiarata | DA-FARE |
| **B2** | #234 F2 | `X6c` — 2 colonne titolare mai valorizzate (2.189 + 17 righe) | backfill o dichiarazione, con rollback | DA-FARE |
| **B3** | #234 F2 | `X3c` — contratto attivo senza busta recente (2) | causa + cura | DA-FARE |
| **B4** | #234 F2 | `X5d` — posizione senza requisiti formativi (8) | causa + cura | DA-FARE |
| **B5** | #234 F2 | `X6b` — KPI non previsto dalla posizione (42) | ⚠ **serve una decisione di prodotto di Enzo** | WAIT-INPUT |
| **B6** | #234 F3 | La corsa che chiude: `verifica_incrociata` esce 0 o 4 | output allegato | DA-FARE |
| **C1** | #227 F2 | Derivare gli archi delle 4.332 dalla struttura già presente | isolate scese del numero previsto + post-condizione | DA-FARE |
| **C2** | #227 F5 | La sentinella (dichiarata **informativa**, o rende rossa la prova generale) | vista scattare | DA-FARE |
| **Z** | — | Il resto, finché c'è capienza — scelto dal register a A/B/C chiuse | — | DA-FARE |

## Confine dichiarato all'inizio

- **B5 non è mia da chiudere.** «Un obiettivo di KPI su una persona la cui posizione non elenca
  quel KPI»: distinguere l'assegnazione individuale legittima dall'incoerenza richiede di decidere
  *se il KPI segue la persona o l'incarico*. Non si deriva dal codice. La porto istruita, con i 42
  casi classificati, e la chiedo una volta sola.
- **#227 F3/F4** (ritiri e curatela delle 28 bancarie) restano fuori da questo giro salvo capienza:
  F4 è una **decisione di dominio** su come collocare il catalogo di RTL nella tassonomia.
- **#219 A5** dipende da A4: se la corsa non arriva a 0 falliti, il passaggio in CI non si fa —
  il criterio di `#211` lo vieta, e forzarlo sarebbe portare in CI un rosso noto.

## Le prove che devono poter fallire

- **A2** — la cura è giusta solo se i **nodi esaminati** salgono sopra la soglia. Un axe verde su
  una pagina che non renderizza è il falso verde che F4 ha già smascherato una volta: il numero di
  nodi è il giudice, non l'assenza di violazioni.
- **B1** — dopo la cura, `X6a` deve tornare rosso se si reintroduce un OKR con reparto inventato.
- **C1** — la post-condizione deve proteggere le **9.569 già collegate**: un'operazione che
  aggiunge archi non deve toccarne uno di quelli esistenti.

## Regole che valgono per tutto il batch

Ogni scrittura di massa porta le quattro cose (`db-migrations.md`): misura prima · guardia
ri-verificata all'esecuzione · post-condizione che protegge ciò che **non** doveva cambiare ·
rollback dichiarato. Ogni tocco a `db/**` passa da `ci-rehearsal.sh` prima del push.
