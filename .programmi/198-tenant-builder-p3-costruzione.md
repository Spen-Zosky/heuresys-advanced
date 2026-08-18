# 198 — Tenant Builder P3: la costruzione tracciata, ogni riga marcata e riconducibile

> **item**: #198
> **stato**: IN CORSO

Dal fascicolo all'azienda: il motore costruisce, e ogni riga che nasce porta la sua origine.
Nove task, otto fatti con dimostrazione live ciascuno. **Resta solo T9**, che pretende il campo
di prova sul gemello (E27).

⚠ **PRIMA DI ESEGUIRE**: leggi `D:\heuresys-design-lab\2026-08-16--LEGGIMI-PRIMA-consegna-tenant-builder-p3.md`
— sequenza, errori già trovati, cosa è già verificato (voce #208).

## Decisioni vincolanti di Enzo (prese, non si ri-chiedono)

- **E17** segnaposto parlanti: nome = ruolo, cognome = collocazione.
- **E18** predisporre il tenant con dati da ricerche, RTL come riferimento strutturale, coprire
  **tutte** le relazioni.
- **E19** i dati iniziali sono i **parametri di controllo dell'importazione** (contratto P3→P4).
- **E20** una terza azienda vera, poi archiviata.
- **E21** prima il motore, la ricerca come sorgente dopo — per questo **non** dipende da `#132`.
- **E23** tante persone segnaposto quante le posizioni contemplate; la numerosità si esprime
  moltiplicando le posizioni, mai affollando la stessa.
- **E27** (2026-08-17) si sperimenta **prima sul gemello**, poi in produzione. Le aziende usa e
  getta nascono sul clone del linux-pc; la prova che chiude P3 si fa una volta sola sul dato vero.
  Non serve codice nuovo: il frontend sceglie l'API con `NEXT_PUBLIC_API_PROXY_BASE_URL`.
- **E28** (2026-08-17) a fine esperimento si sceglie fra **archivia** e **disfa la costruzione**.
  La seconda è possibile perché il registro sa *quali* righe una versione ha creato.

## Fasi (i nove task del piano di implementazione)

- [x] **T1 Il registro dell'origine e la sorgente di costruzione** — FATTO 2026-08-16 · `27da2ef2`, mig `000319`+`000320` · post-condizioni provate sabotandole: tolto l'indice unico, la prova torna rossa col messaggio giusto
- [x] **T2 L'archetipo dice chi presidia quale processo** — FATTO 2026-08-16 · `0c18dc3e` · 23 `OWNER`, uno per processo, coi codici letti dal database
- [x] **T3 I segnaposto dicono il posto, non un nome di fantasia (E17)** — FATTO 2026-08-16 · `67b0fae2` · la disambiguazione si prova su un archetipo costruito apposta, perché quello reale non ha gemelli; sabotato: 6 casi su 7 rossi
- [x] **T4 Il motore costruisce da un PIANO e non sa più da dove viene (E21)** — FATTO 2026-08-17 · `ac0034d1` · prova live `prova-live-198-t4.mts`, gli stessi numeri di prima (7 unità · 11 posizioni · 8 competenze · 4 indicatori · 11 titolari · 88+44 evidenze)
- [x] **T5 L'atto che applica un fascicolo, dentro una transazione sola** — FATTO 2026-08-17 · `4ddc4939` · sabotaggio dichiarato (`guasti.registro`): l'intera applicazione torna indietro, `applied_at` di nuovo vuoto
- [x] **T6 La superficie API, cioè l'interruttore che mancava** — FATTO 2026-08-17 · `6ccde457` · prova live `prova-live-198-t6.mts`; messa una costruzione vera in `applyVersion`, il caso fallisce con «apply ha creato unità»
- [x] **T7 Le due pagine nel prodotto, e il permesso che ne ha spostata una** — FATTO 2026-08-17 · `f39f300a`, mig `000322` · prova live `prova-live-198-t7.mts` con due attori reali; E2E 10/10 zero flaky
- [x] **T8 Il metro della completezza, nel repo** — FATTO 2026-08-16 · `docs/kb/tools/completezza_tenant.py`, autoprova 2/2 a esiti opposti (RTL contro sé stesso → 0 mancanze; Heuresys contro RTL → 107 tabelle e 239 relazioni mancanti)
- [x] **T9a La costruzione sul gemello, e i due difetti che ha fatto emergere** — FATTO 2026-08-18 · `prova-live-198-t9.mts` 11/11 verdi contro il gemello · `prova-live-198-t9-archivio.mts` 3/3 · due aziende costruite dallo stesso archetipo, 184 righe ciascuna, registro coincidente
      Referto completo nella sezione qui sotto. **Ha trovato due difetti veri**, entrambi
      invisibili ai test perché nessuno costruiva davvero, e nessuno costruiva **due volte**.
- [ ] **T9b La costruzione vera in produzione, una volta sola (E20)** — ⛔ **blocked-on-Enzo: autorizzazione al push**
      Il gemello gira ora il codice corretto, ma la produzione gira il bundle deployato, che
      porta ancora i due difetti. La prova su dati veri **non è eseguibile** finché le
      correzioni non sono in produzione, e il deploy passa dal push, che è di Enzo.
      Quando sarà armato: stessa catena, `--archivia`, e il referto si ripete sui numeri veri.

## Referto della costruzione sul gemello (2026-08-18, S1069)

Comandi, con l'esito incollato e non parafrasato:

```bash
cd apps/api && pnpm exec tsx scripts/prova-live-198-t9.mts http://192.168.1.11:8013 "<catalogo>"
#   11/11 verdi · PROVA VERDE
cd apps/api && pnpm exec tsx scripts/prova-live-198-t9-archivio.mts http://192.168.1.11:8013 <tenant>
#   3/3 verdi · PROVA VERDE
PGHOST=127.0.0.1 PGPORT=5432 python3 docs/kb/tools/completezza_tenant.py --contro <CODICE>
#   tabelle 11/144 (7,6%) · relazioni 29/329 (8,8%)
psql … -v codice=<CODICE> -f db/scripts/verifica-origine-vs-marchio.sql
```

| misura | valore | come si legge |
|---|---|---|
| righe costruite | **184** | e il piano ne aveva dichiarate 184: 7 unità · 11 posizioni · 11 persone · 11 assegnazioni · 8 competenze · 4 indicatori · 88+44 evidenze |
| righe nel registro | **184** | **PROVA A superata**: ogni riga creata ha la sua origine |
| copertura del metro | **11/144 tabelle (7,6%) · 29/329 relazioni (8,8%)** | bassa **come previsto**, perché la sorgente è l'archetipo e non la ricerca. È la prima misura di quanto serve P2, e **non va fatta salire** |
| segnaposto vs dichiarati (E23) | **11 contro 158** | 12 persone in tutto, di cui una è l'amministratore del provisioning, che non nasce dal fascicolo. La distanza di 147 è il secondo numero che misura P2 |
| registro vs marchio storico (#197) | **165 righe su 184 invisibili al marchio** | il marchio copre 3 tabelle (19 righe); il registro tutte e 8. È la differenza che `#197` chiedeva di far riportare al controllo incrociato |
| archiviazione | `ACTIVE → ARCHIVED`, registro 368→368, righe 59→59 | **PROVA C superata**: archiviare non cancella (ADR-0035) |

### I due difetti trovati costruendo, che nessun test vedeva

1. **Il fascicolo restava `APPROVED` dopo essere stato applicato.** L'effetto scriveva
   `applied_at` e **non** lo stato, mentre il suo stesso commento dichiarava «APPROVED →
   APPLIED» e `APPLIED` era da sempre nel vocabolario del `CHECK` (mig `000299`). Il test di
   T5 guardava la data e taceva sullo stato — metà di un criterio che l'intestazione del file
   dichiara duplice. La guardia contro la doppia costruzione reggeva per il **solo**
   `applied_at IS NULL`: chi avesse tolto quel predicato fidandosi dello stato avrebbe
   riaperto la ri-applicazione.
2. **Il motore era monouso, e non lo sapeva nessuno.** La seconda azienda costruita dallo
   stesso archetipo moriva con «Cannot read properties of undefined (reading 'skill_id')».
   Causa: `sys_skills` portava **due** indici unici che dicevano cose diverse —
   `sys_skills_code_uq` globale (mig `000239`) contro `sys_skills_tenant_code_uq` per azienda
   (mig `000013`). Vinceva il più stretto, e due aziende non potevano avere la stessa
   competenza. Ritirato il globale (mig `000324`, con la `000239` **emendata** perché la
   catena non lo ricreasse — ADR-0035), e reso parlante il ripiego del motore, che esplodeva
   senza nominare né la competenza né la causa.

## Limiti dichiarati, da non tentare di aggirare

- **La copertura del metro sarà MOLTO sotto il 100%**, perché la sorgente è l'archetipo
  (7 unità, 11 posizioni) e non la ricerca. Il numero va scritto qualunque sia: **è** la misura
  di quanto serve P2. Chi esegue **non deve farlo salire**.
- **Con l'archetipo attuale i due numeri non coincideranno** (11 posizioni contro 158 dipendenti
  dichiarati). La distanza va nel referto — è un dato, non un difetto da nascondere.
- **`apply` non costruisce**: apre una richiesta di approvazione. La risposta non porta conteggi
  *apposta*, e l'assenza è dichiarata. La costruzione la fa l'approvazione, in transazione (T5).

## Chiuso quando

Un'azienda nuova è stata creata da un fascicolo con login reale su produzione · ogni riga creata
ha la sua riga nel registro · il fascicolo è `APPLIED` con `applied_at` valorizzato · la copertura
del metro è scritta nel referto · l'azienda è stata archiviata verificando che le righe restino.

## Prove che devono poter fallire

Doppia riga di registro sullo stesso bersaglio → respinta dall'unique · applicazione senza
`build_source_key` → `BLUEPRINT_BUILD_SOURCE_MISSING`, mai ripiego sull'unico archetipo ·
sabotaggio del passo registro → rollback intero · segnaposto confrontati coi nomi propri reali.
