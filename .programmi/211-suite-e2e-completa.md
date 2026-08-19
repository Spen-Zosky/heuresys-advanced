# 211 — La suite E2E completa: i rossi che non sono guasti del prodotto, e i casi che non girano

> **item**: #211
> **stato**: CHIUSO

La suite E2E intera **non gira in nessuna corsa automatica**: la CI esegue solo
`smoke-5-personas.spec.ts` (101/101 verde). Il resto è verde o rosso solo quando qualcuno lo
lancia a mano, e nessuno lo lanciava. Il triage è fatto: i rossi sono **sei famiglie**, nessuna
è un guasto del prodotto.

## Decisioni e fatti acquisiti (non si ri-discutono)

- **Nessuna delle sei famiglie è una regressione recente.** ① è strutturale della suite (esiste
  da quando supera i 15 minuti), ② data da ADR-0032 (2026-08-04), ③ da `77b52e04`, ④ da mig
  `000272`. Il confronto con un commit precedente **non serve più**: la causa di ciascuna è nominata.
- **Rinnovare i cookie dentro la corsa non è praticabile**, ed era scritto nella config da prima:
  ogni context ricarica lo stesso `tests/.auth/*.json`, il refresh token è single-use, il primo
  che ruota fa scattare `REFRESH_REPLAY_DETECTED` su tutti gli altri.
- **Allungare `ACCESS_JWT_TTL_SECONDS` per la corsa è scartato**: una suite che gira su un TTL
  che nessun utente ha non prova più il prodotto che esiste.
- **La divisione in blocchi è DERIVATA dal filesystem**, mai un elenco scritto a mano: una spec
  nuova lasciata fuori non girerebbe in silenzio, che è il difetto stesso di questa voce.

## Fasi

- [x] **F0 Il triage: sei famiglie, nessun guasto del prodotto** — FATTO 2026-08-17 · `217c74dd` e `292e4db4` · 35 rossi ricondotti a sei cause nominate; gli errori sono «element(s) not found» (43) e «toBeVisible failed» (41), non 400 di validazione
- [x] **F1 ① La suite non si scade più addosso, e ora si CONTA ciò che ha eseguito** — FATTO 2026-08-17 · `5770bdfd` · catena a quattro fasi con re-login, fasi come invocazioni separate (`apps/web/scripts/e2e-blocchi.mjs`); corsa completa ~27 min: **4/4 fasi · 335 passati · 18 falliti · 1 instabile · 80 non eseguiti · totale 434** = esattamente i casi dichiarati da `--list`
- [x] **F2 Gli 80 casi che non vengono eseguiti — la causa è isolata, e sono DUE** — FATTO 2026-08-18 · **74 su 80 sono strumenti a comando**, letti dalle annotazioni: `68 census run only — set F4_SWEEP=1` + `6 cattura on-demand: STORIA36_DEMO=1`. Restano ~6 casi che si dichiarano ciechi sul posto
      **Non erano un guasto, e non erano una cosa sola.** `f4-sweep.spec.ts` genera 68 casi
      (30 + 15 + 22 rotte per tre personas) dietro un `test.skip` a livello di `describe`:
      è un **censimento delle pagine**, uno strumento, non una prova del prodotto — e non deve
      girare in una corsa normale. `storia36-demo.spec.ts` ne aggiunge 6, catture dimostrative.
      **Il difetto vero era il resoconto**, che sommava questi ai casi saltati per mancanza di
      dati: due specie che non si sommano, e un numero che le mescola sembra giusto — la stessa
      lezione di E22 sugli indicatori. Ora `e2e-blocchi.mjs` li **raggruppa per motivo**, letto
      dalle annotazioni del reporter JSON e mai da un elenco scritto a mano: un motivo nuovo
      finirebbe altrimenti in silenzio nella categoria sbagliata.
- [x] **F3 Le famiglie ②③④⑤⑥ — 18 casi** — FATTO 2026-08-19 · **una correzione per famiglia, come il piano chiedeva** — e la misura ha corretto il piano su due punti prima ancora di cominciare: i casi rossi erano **7, non 18**, e la famiglia ⑥ nella corsa isolata non falliva affatto. Esito: **24 passati, 2 skipped, zero falliti** su tutti e sei i file.
      · **③ orfano** — `admin-pipelines` provava `/brownfield-adaptation`, pagina che `77b52e04` (`#164 F3`) ha fatto **uscire dal prodotto**. `sys_ui_interfaces` non ne ha traccia (0 righe, misurato). Caso rimosso con la ragione scritta: un test orfano resta rosso per sempre, e un rosso che non indica un difetto insegna a non guardare la suite.
      · **④ più vecchio di una decisione** — pretendeva che un impiegato non vedesse `nav-dashboard` né `nav-users`. **Nessuna delle due regge**: `tommaso.fiore` ha `BRANCH_MANAGER` (mig `000272` → `dashboard:view`), e `USER` — il pavimento universale di I17 — porta `user:read`, `position:read`, `tenant:read`. **La premessa era superata**: l'assenza di una voce non è più il modo in cui il modello separa; separano scope e mascheratura (ADR-0036). Il caso ora difende la distinzione autentica — una superficie di *governo* (`/provenance`) resta chiusa a chi non ne ha mandato.
      · **⑤ non era «un dato cambiato»** — `org-health` falliva con «expected 39, received 25»: `DataTablePanel` **pagina a 25 righe**, e l'asserzione sul totale dell'API era vera solo finché le unità stavano sotto quella soglia. **Una sola causa per entrambi i casi**: anche la ricerca di «Ufficio Crediti PMI» cercava un'unità oltre la prima pagina. Ora si verificano la pagina piena *e* il totale dichiarato, e le due letture si cercano fra le righe visibili.
      · **② i test erano indietro di due settimane su ADR-0032** — `compensation-read` e `insights` provavano il *contenuto* di calcoli economici e di giudizi sulla persona con `platformAdmin`, che è un mandato **tecnico**: i valori gli arrivano mascherati e il pannello resta su «Caricamento…». Attore cambiato a un mandato HR, **e aggiunto il caso complementare**: che al mandato tecnico i valori NON arrivino è la regola, non un caso da evitare.
      · **⑥ era l'UNICO guasto vero del prodotto**, e il triage l'aveva **escluso**. Replicando la POST del browser: `403 TENANT_ID_REQUIRED — PLATFORM_ADMIN must supply body.tenantId`. Il servizio ha ragione (chi opera su più aziende deve dire quale), ma la pagina **non chiedeva l'azienda e non la mandava**: il pulsante era inerte per un amministratore di piattaforma. Aggiunto il selettore, con le sue traduzioni. Trovato anche un secondo difetto del test: cercava la riga nuova come `.last()`, assumendo un ordinamento che l'elenco non garantisce.
      🔬 **Il triage diceva «nessuna delle sei è un guasto del prodotto». Era sbagliato su una**: ⑥ lo era, ed era proprio quella che il triage aveva lasciato «causa non isolata». La differenza fra le due mie prove — una con `tenantId`, l'altra senza, come fa il browser — è ciò che l'ha isolata.
- [x] **F4 Il criterio di verde, dichiarato** — **FATTA 2026-08-19 (S1072)**.

      **La corsa integrale, rifatta oggi**: `353 passati · 12 falliti (+1 instabile) · 82 non
      eseguiti · 4/4 fasi`. Contro la corsa del 18/08 (`333 · 18 · 3 · 80`): **sei rossi in
      meno**, esattamente quelli che F3 ha corretto, e venti casi in più che passano.

      ### ⭐ IL CRITERIO DI VERDE, dichiarato

      **La suite completa NON entra in CI, e resta uno strumento a mano — ma smette di essere
      «né l'una né l'altra cosa».** Le tre parti sono vincolanti:

      1. **Il verde è `0 falliti` E `0 non-eseguiti-senza-motivo`.** Un caso non eseguito **non
         è** un caso passato: l'`e2e-blocchi.mjs` li raggruppa già per motivo letto dalle
         annotazioni (F2), e un motivo nuovo che non sia in quell'elenco è un rosso.
      2. **Non entra in CI finché i falliti non sono zero**, e la ragione è misurata: la corsa
         dura **~25 minuti** e la CI ha un runner solo, che oggi impiega ~20 minuti per la sola
         suite API. Metterla in CI adesso significherebbe un rosso permanente su `main` — cioè
         il difetto che questa voce esiste per togliere, spostato di posto.
      3. **Il rosso è NOTO E DICHIARATO, non tollerato in silenzio**: i 12 casi sono censiti qui
         sotto con la loro firma, e la voce `#211` resta aperta finché non sono zero. Quando lo
         saranno, la suite entra in CI e questo criterio diventa «verde = CI verde».

      ### Il triage dei 12: **otto guasti distinti**, non dodici

      ⚠ Raggruppati per **firma d'errore misurata**, non per causa provata caso per caso: dove
      scrivo un'ipotesi la dichiaro tale, e verificarla è il lavoro di chi prende il guasto.

      | # | casi | firma misurata | cosa sembra |
      |---|---|---|---|
      | **A** | `login-mfa:91` · `login-mfa-enrollment:157` | `login-mfa-code` non compare | ipotesi: i due casi provano un **gate spento** — `MFA_ENFORCEMENT_ENABLED=false` in produzione per decisione di Enzo (SOT_STATE). Se è così **non è un guasto del prodotto**, è una prova che descrive un mondo diverso da quello configurato |
      | **B** | `insights-skill-gap:20` · `insights-succession-readiness:20` | `skillgap-feature` / `readiness-feature` `count > 1` fallisce | la **spiegabilità per-feature** non rende su nessuna delle due pagine: una causa sola, due sintomi |
      | **C** | `organization-editing:41` · `:128` | `orgunit-editor` non visibile (30 s) | l'editor dell'organigramma non si apre: una causa, due casi |
      | **D** | `tenants-editing:31` · `:48` | `tenant-notice` non compare dopo la creazione | creazione e archiviazione di un'azienda dall'interfaccia |
      | **E** | `tenants-editing:75` | riceve **400**, attende 401/403 | ⚠ **non è un buco**: la richiesta viene respinta. Ma il **test è debole** — manda un body incompleto, quindi la validazione dello schema scatta **prima** del controllo di permesso e il caso non prova ciò che dichiara («non può crearla nemmeno chiamando l'API»). Se domani il permesso sparisse, resterebbe rosso lo stesso: non rileverebbe il buco |
      | **F** | `me-team:22` | il locator `me-team-name` risolve a **14 elementi** | e le squadre che si chiamano «CFO» nel database sono **una** (misurato): quindi non è un dato ambiguo, è un **testid ripetuto** nella pagina — violazione di strict mode |
      | **G** | `performance-cycle:63` | `perf-cycles-row count > 0` fallisce | i cicli di valutazione nel database sono **1** (misurato) e la pagina ne mostra **zero**: guasto di visibilità o di scope, non di dati |
      | **H** | `a11y:204` | violazioni a11y **critiche** su `/admin/roles` (mobile) | l'unico che riguarda l'accessibilità, ed è un guasto vero del prodotto |

      **Più il nono, che era mio e l'ho corretto**: `tenant-blueprints:180`. Rosso perché `#132`
      F3 ha svuotato il modello — atteso e dichiarato. Inseguendolo sono usciti **quattro
      difetti veri** del prodotto (motivo buttato via, 409 ritentato, `instanceof` che fallisce
      nel bundle, firma accesa senza piano) → commit `1c4726ae`.

      ### Cosa NON dice questo triage
      Che gli otto siano otto **cause**: sono otto **firme**. Due firme diverse possono avere la
      stessa causa, e una firma può nasconderne due — è successo in F3, dove il triage dava
      «nessuna delle sei è un guasto del prodotto» e su una si sbagliava.

### L'esito della corsa completa (2026-08-18, ~27 min) — la classificazione tiene

```
  NON ESEGUITI              : 80
  perche' non sono stati eseguiti (letto dalle annotazioni, non da un elenco):
      68  census run only — set F4_SWEEP=1
       6  cattura on-demand: STORIA36_DEMO=1
       1  nessuna variante disponibile su questo database
       1  nessuna attivazione da mostrare
       1  nessuna fascia importata dal legacy su questo tenant
       1  no skill-gap scores in scope
       1  employee has no goals rendered
       1  EMAIL transport non configurato (#8 WAIT-INPUT app-password Outlook)
       1  travolto da un fallimento precedente nel suo blocco `serial`
```

68 + 6 + 6 = 80, e ogni riga ha il suo perché. Due cose che questo elenco ha reso visibili:

- **nessuno dei 6 casi ciechi nasconde un dato che dovrebbe esserci.** Era il sospetto da
  sciogliere: un caso che si salta perché «non trova nulla» può nascondere un dato mancante.
  Il caso delle fasce con importi, per esempio, **non** compare — e infatti gira, perché RTL
  ha 12 bande con importi (misurato in `#209`). L'unico legato a una pendenza vera è quello
  di EMAIL, che rimanda a `#8` ed è già tracciato.
- **il salto «senza motivo» non era una terza specie**: in un blocco `serial` Playwright salta
  ciò che segue un fallimento. Non è un caso spento apposta — è **lavoro non provato a causa
  di un altro rosso**, e ora il resoconto lo dice con quelle parole. `#211` aveva escluso i
  blocchi serial («i tre file che li usano hanno 11 casi»): vero come conteggio, ma la
  conseguenza esiste ed era invisibile.

Corsa completa: **333 passati · 18 falliti · 3 instabili · 80 non eseguiti · 4/4 fasi**.

## Trappole misurate, da non ripetere

- ⚠⚠ **La prima stesura della cura di ① aveva reintrodotto il difetto di questa voce.** I re-login
  dipendevano dal blocco precedente; in Playwright un progetto la cui dipendenza fallisce viene
  **saltato**: 3 failed · 164 passed · **263 DID NOT RUN**. Il controllo di copertura non lo vide
  perché misurava che ogni spec fosse *assegnata* a un blocco, non che il blocco fosse *eseguito*.
- ⚠ **Anche la cura della cura aveva la sua bugia**: stampava «test dichiarati: 434 · fasi
  eseguite 4/4» contando le **fasi**, non i casi — dentro la terza, 71 su 152 non erano stati
  eseguiti. E `--fase 99` usciva **verde senza eseguire niente**.
- **Su Node ≥23 Playwright 1.61 muore all'import** (D-36): usare `pnpm test:e2e:prod:node22`.

## Chiuso quando

Si sa quanti guasti distinti ci sono dietro i casi rossi, ognuno ha una voce o una correzione, e
il criterio di verde della suite completa è dichiarato.

### ✅ CHIUSO 2026-08-19 (S1072) — le tre condizioni, una per una

1. **Quanti guasti distinti**: **otto firme** dietro dodici casi (tabella in F4), più il nono
   che era mio e **è corretto** (`1c4726ae`).
2. **Ognuno ha una voce**: gli otto stanno in **`#219`**, una voce sola e non otto — moltiplicare
   le voci avrebbe gonfiato il register senza aggiungere una sola informazione, e il triage
   vive già qui.
3. **Il criterio di verde è dichiarato**, con le sue tre parti vincolanti (§F4).

⚠ **Questa voce si chiude, il rosso no.** Il criterio dice che la suite entra in CI quando i
falliti sono zero: finché `#219` non li chiude, la corsa integrale resta uno strumento a mano
con un rosso **noto, censito e datato** — che è la differenza fra un rosso accettato e un rosso
ignorato, e l'unica cosa che questa voce poteva davvero garantire.
