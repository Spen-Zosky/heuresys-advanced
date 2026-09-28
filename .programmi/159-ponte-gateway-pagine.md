# 159 — Il ponte gateway↔pagine web deve valere per le pagine future

> **item**: #159 · **priorità**: P2 · **stima register**: era «da stimare» → **ri-stimata qui**
> **stato**: IN CORSO
> **fonti**: `docs/kb/COWORK_INBOX.md` decisione **D3** (2026-08-07) · direzione di Enzo 2026-08-13

## Decisioni vincolanti (non si ri-chiedono)

- È un **vincolo dichiarato PRIMA di costruire**, non una correzione dopo. Il ponte non esiste
  ancora.
- (1) un solo canale in streaming e **un solo componente riusabile** — il ponte non sa nulla
  delle pagine; aggiungere una pagina = usare il componente, **zero lavoro sul ponte**.
- (2) il contesto di pagina («sto guardando l'unità X») è un **parametro libero**, mai un ramo
  condizionale per tipo di pagina.
- (3) i permessi restano automatici: li applica il server sulla sessione inoltrata.
- **Rischio nominato**: scrivere il primo prototipo DENTRO una pagina. Funziona subito e rende
  costosa ogni pagina successiva.
- **NON è automatico** che l'agente sappia rispondere sui dati nuovi: quello dipende da **#156**
  e dalla rigenerazione dell'atlante, **non** dal ponte. Sono due metà distinte e confonderle
  porta a promettere ciò che il ponte non dà.
- ✅ **Direzione di Enzo 2026-08-13 — il bersaglio è cresciuto**: l'assistente va in **TUTTE le
  schede che hanno i requisiti per eseguirlo**, non in una seconda pagina scelta a mano. La
  scelta della pagina-dimostrazione è **delegata a Claude**. La seconda pagina serve a
  **provare** la riusabilità, non è il traguardo.

## Ri-stima (era «da stimare»)

Il lavoro non è più «ponte + un secondo consumatore» ma **ponte + criterio di idoneità +
adozione su tutte le pagine idonee**. Stima: **~3-4 sessioni**, così ripartite.

## Fasi

- [x] **F1 — INDAGINE: cosa rende una scheda «idonea»** — **FATTA 2026-08-15 (S1061)**. Il criterio non è un testo: è `docs/kb/tools/check_idoneita_agente.py`, quattro prove meccaniche lette dal codice, ri-eseguibile. Esito su 115 pagine: **83 IDONEE** (16 parametriche + 67 d'insieme) · **32 no** — 25 non autenticate (`P1`), 7 di presidio (`P4`, elencate una per una col motivo), **`P2` a zero**. Dettaglio in §F1
  - 🔎 **IL REPERTO CHE CAMBIA F2: il ponte esiste già, e sta esattamente dove questo file temeva.** Le decisioni vincolanti dicevano *«il ponte non esiste ancora»* e nominavano il rischio *«scrivere il primo prototipo DENTRO una pagina»*. Misurato: **`apps/web/src/app/(authenticated)/dev/agent/page.tsx`, 300 righe**, che aprono il canale SSE verso il gateway, ne consumano lo stream, gestiscono l'approvazione umana e il rendering. **Il rischio non è da evitare: è già avvenuto.** F2 non è quindi «costruire da zero» ma **estrarre**, ed è un lavoro diverso — con un consumatore reale già in mano che serve da collaudo.
  - **le quattro prove**, in ordine: `P1` autenticata (fuori vetrina e login: senza sessione i permessi non si applicano) · `P2` interroga almeno un endpoint `/v1/*` **direttamente o tramite i componenti che importa** · `P3` il contesto è **un valore** (segmento dinamico o vista d'insieme), mai un ramo per tipo di pagina · `P4` non è superficie di servizio né a isolamento assoluto.
  - ⚠ **`P2` è nato con tre falsi negativi, ed è stato il correttivo a valere più del numero**: `/job-catalog` (37 righe), `/skill-taxonomy` (42) e `/me/career` risultavano «pagine mute» perché la chiamata sta nei loro pannelli. Cercare `/v1/` nel solo file della pagina **dichiara muta una pagina che parla per bocca d'altri** — e le pagine sottili sono la forma normale, non l'eccezione. Seguendo un livello di import (`@/…` e relativi `./…`), `P2` passa da 3 a **0**: nessuna pagina autenticata è senza dati.
  - ⚠ **il primo giro dava «0 pagine totali» e non protestava** — un falso verde perfetto, causato dall'esecuzione fuori dalla radice. Lo strumento ora **esce `NON MISURABILE`** invece di stampare zeri sereni.
  - **resta di F1 la sola dimostrazione**: quale delle 83 aprire per prima dipende da **#156** (WAIT-INPUT su Enzo). Il criterio non ne dipende — la lista è già prodotta.
- [x] **F2 — Il ponte** — **FATTA 2026-09-13 (S1099)**: canale in `apps/web/src/lib/use-agent-stream.ts` (S1091), componente `AgentPanel` in `@heuresys/ui` 1.2.0 (S1099), console `dev/agent` primo consumatore, E2E live verde · budget ~250k

  ### ✅ S1099 (2026-09-13) — la METÀ DI LÀ è fatta: `AgentPanel` in `@heuresys/ui` 1.2.0

  La sessione parallela su `ux-design-shared` risultava «viva» nel registro ma il suo pid era
  stato riciclato da un altro programma (misurato: PowerToys) e non compariva fra i peer: il
  repo era libero, e il suo albero pulito.

  **Il componente**: `ui/src/components/ai/agent-panel.tsx` (ux-design-shared `ac6445c`,
  pubblicato come **`@heuresys/ui@1.2.0`** su npm, `+ @heuresys/ui@1.2.0`). È una **vista
  pura** — non apre canali, non traduce, non sa su quale pagina sta: `labels` arrivano già
  tradotte dal consumatore (ogni pagina il suo namespace: la decisione (2) di questo piano),
  il `context` di pagina è un **valore libero** che si mostra e si passa (mai un ramo per tipo
  di pagina), `testIdPrefix` lascia i `data-testid` a chi ha già prove. Storia con quattro
  stati, **9 prove unitarie** (tra cui il contesto assente come controprova e **axe** sui tre
  stati), typecheck e lint verdi, `dist` rigenerato, CHANGELOG 1.2.0 — che porta anche le
  correzioni a11y e reduced-motion del 5-7 settembre, mai uscite prima.

  **Il consumatore**: `dev/agent/page.tsx` scende a **113 righe** (`60aa0824`) e fa una cosa
  sola — traduce nel proprio namespace, monta `useAgentStream`, passa stato e callback ad
  `AgentPanel`. Dipendenza `^1.2.0` su root, web e showcase; il lockfile collassa a UNA
  versione della libreria (prima 1.0.0 e 1.1.0 convivevano — la web risolveva ancora la
  1.0.0). Typecheck, lint, vitest verdi su web; typecheck verde su showcase.

  ⚠ **La prova live ha trovato che il ponte non era mai stato intero dal browser**: la prima
  E2E di questa pagina (non ne esisteva nessuna) ha mostrato «Esecuzione fallita: Failed to
  fetch» — il web su `:3000` e il gateway su `:8790` sono origini diverse e il gateway **non
  aveva CORS**: il browser non consegnava nemmeno la richiesta. Il commento della pagina lo
  diceva a modo suo («renders without a live agent»). Corretto in `server.ts`: una sola
  origine ammessa (`AGENT_GATEWAY_WEB_ORIGIN`, default `http://localhost:3000`), credenziali
  sì, preflight 204 — provato a esiti opposti con `curl` (origine del web: intestazioni
  presenti; `evil.example`: nessuna).

  ⭐ **Dimostrazione live — `tests/e2e/agent-dev-console.spec.ts`, VERDE** (`7 passed`, la
  prova 32,9 s): login reale come platform admin, `/dev/agent` resa dal componente condiviso
  (`agentdev-page`, `-title`, `-stream-empty`), una domanda vera al gateway vivo — «quante
  unità organizzative esistono?» — e lo stream che arriva: 85 righe alla prima corsa, nel
  diario del gate `hrx_concepts_search` → `hrx_org_units_list` consentiti. La prova ha anche
  corretto sé stessa: una corsa riuscita **non** produce un avviso (l'hook lo emette solo su
  errore o approvazione), la fine si legge dal pulsante «Ferma» che sparisce. Prima di questa
  sessione la pagina non aveva nessuna prova E2E.

  **Cosa resta di F2**: niente. La prossima pagina idonea (F3) monta `AgentPanel` con il
  proprio namespace e il proprio `context`, e la prova che il ponte è riusabile è che non
  tocca né `use-agent-stream` né il componente.

  ### ✅ S1092 (2026-09-08) — il buco dichiarato da S1091 è chiuso per la parte provabile

  S1091 aveva lasciato il canale coperto dai soli cancelli **statici**, e lo aveva scritto
  apertamente: *«due cancelli statici verdi non sono una prova che il canale si comporti come
  prima, e chiamarli tali sarebbe il falso verde di questa fase»*. Quella frase era la
  descrizione di un buco, non una scusa — quindi si chiude.

  **Nasce la prima suite unitaria del frontend**: `apps/web/vitest.config.ts` + script `test`.
  ⚠ **Nessuna dipendenza nuova**: `vitest@4.1.11` era già fra le devDependencies di
  `apps/web`, mancavano solo config e script. E la config è **deliberatamente minima** —
  `environment: "node"`, nessun DOM, nessuna `@testing-library` — perché provare un hook React
  pretende un renderer, cioè dipendenze nuove: un ambiente che si allarga «per ogni evenienza»
  è superficie che nessuno usa e tutti mantengono. Esclude `tests/e2e/**`, che ha il suo runner.

  **7 casi su `parseSseBlock`**, scritti dal **protocollo** e non dall'implementazione — è il
  modo in cui una prova può ancora fallire quando l'implementazione cambia in silenzio. I due
  che contano davvero sono quelli che un interprete ingenuo sbaglia: le righe `data:` multiple
  si uniscono con un **a-capo** (un payload lungo arriva spezzato, e concatenarlo produce un
  JSON incollato che nessuno legge più), e i due punti **dentro** al valore non si tagliano
  (uno `split(":")` distruggerebbe ogni JSON). Più i commenti di keep-alive, il `\r` di
  Windows, il blocco vuoto e il tipo di default.

  **Sondato**: sostituito `join("\n")` con `join("")` → **1 fallito su 7**, ed è esattamente
  «⭐ unisce le righe `data:` multiple con un a-capo». Ripristinato, 7/7, e il file è tornato
  identico byte per byte (`git diff` vuoto). `typecheck` web pulito, `lint` 4/4.

  ⏳ **Il perimetro resta dichiarato, o il verde mentirebbe**: qui si prova una funzione
  **pura**. Un verde significa «l'interprete dei blocchi si comporta come deve», **non** «il
  canale funziona»: `useAgentStream` è un hook e non ha ancora prova automatica. E il
  **componente** resta di `ux-design-shared`, che è un altro repository (vedi il rilievo
  S1083 qui sotto).

  ### 🟡 S1091 (2026-09-07) — la METÀ DI QUI è fatta. L'altra è di un altro repo, e resta

  Eseguita seguendo alla lettera il rilievo S1083 qui sotto, che spezza F2 in due metà in repo
  diversi. **Questa sessione ha fatto la prima**, e non ha toccato la seconda.

  **Il canale** vive ora in `apps/web/src/lib/use-agent-stream.ts` — accanto a
  `use-inbox-stream.ts`, che era già il precedente per uno stream applicativo. Porta lo stream
  SSE, l'interprete dei blocchi, lo stato della corsa e la risoluzione delle approvazioni. È
  logica applicativa, **non design system**: sta qui per costruzione, non per comodità.

  ⭐ **La cosa che lo rende davvero riusabile, e che nella pagina non c'era: l'hook NON traduce.**
  Restituisce `notice: { kind, code, params }` — una chiave i18n **senza namespace** — e chi lo
  monta la prefissa col proprio. Nella console di sviluppo i messaggi erano costruiti con
  `t("agentDev.…")` **dentro la logica**: un secondo consumatore avrebbe ereditato le stringhe
  della *prima* pagina, ed è alla lettera il difetto che questa voce è venuta a togliere — «il
  ponte deve valere per le pagine future, non per la prima». Estrarre senza accorgersene avrebbe
  prodotto un ponte che serve una pagina sola, cioè nessun ponte.

  **La pagina resta il primo consumatore e ora fa una cosa sola: rendere.** Misura:
  **300 → 183 righe**, il canale 227 (commento incluso). L'unico stato rimasto nella vista è il
  `prompt`, che è ciò che l'utente scrive.

  ⏳ **Cosa NON è stato fatto, dichiarato invece che lasciato intendere:**
  - **il componente** — la superficie visiva riusabile va in **`ux-design-shared`** e torna come
    `@heuresys/ui`. È un **altro repository**, con il suo ciclo (pubblicazione, bump, allineamento)
    e la sua pubblicazione npm. Non è stato aperto: il budget «~250k» della fase copre la sola
    metà di qui, come il rilievo S1083 dice espressamente;
  - **una prova dinamica del canale** — `apps/web` ha `vitest` fra le dipendenze ma **nessuna
    config e nessuno script `test`**: non esiste una suite unitaria del frontend, e crearne una è
    infrastruttura nuova, fuori da questa fase. Esercitare lo stream end-to-end pretende il
    gateway vivo. L'estrazione è quindi verificata dai soli cancelli **statici**: `typecheck` web
    pulito e `lint` pulito. **Dirlo è il punto**: due cancelli statici verdi non sono una prova
    che il canale si comporti come prima, e chiamarli tali sarebbe il falso verde di questa fase.

  ### ⚠ RILIEVO S1083 (2026-08-28) — «fuori da una pagina» non basta: c'è un divieto permanente

  Questa fase dice *«un componente riusabile, scritto fuori da qualunque pagina»*, e in nessun
  punto di questo file compare il vincolo che la governa. Il CLAUDE.md è categorico:
  > **NEVER** create reusable UI components in `apps/web`, `apps/showcase` o `packages/*` di
  > questo repo. Vanno nel repo `ux-design-shared` (→ `@heuresys/ui`).

  «Fuori da una pagina» ≠ «fuori dal repo». Estraendo le 300 righe di
  `apps/web/src/app/(authenticated)/dev/agent/page.tsx` in un `apps/web/src/components/…`, F2
  produrrebbe **esattamente ciò che il divieto vieta** — e se ne accorgerebbe a lavoro fatto,
  dopo un budget da ~250k.

  **Il ponte va quindi spezzato in due, e le due metà vivono in repo diversi:**
  - **il canale in streaming** — logica applicativa (client del gateway, gestione dello stream,
    stato della conversazione). Non è design system: **resta in questo repo**, in `apps/web/src/lib`
    o come hook, dove sta già la logica non-UI.
  - **il componente** — la superficie visiva riusabile su ogni pagina idonea. Va in
    **`ux-design-shared`** e arriva qui come `@heuresys/ui`, insieme a ogni dipendenza UI che
    dovesse servire (il secondo divieto: nessuna dep UI runtime nei `package.json` di questo repo).

  **Conseguenza di pianificazione**: F2 non è una fase di un solo repo, quindi il budget «~250k»
  è la sola metà di qui. La metà di là ha il suo ciclo — pubblicazione del pacchetto, bump della
  versione, allineamento — e va dichiarata prima di cominciare, non scoperta a metà.
- [ ] **F3 — Adozione su tutte le pagine idonee** — la prova che il ponte è riusabile è che la seconda pagina non lo tocca · budget ~250k

  ### 🟡 S1116 (2026-09-28) — prima pagina parametrica dopo la console: `/approvals/[id]`

  Ri-misurato `check_idoneita_agente.py` prima di scegliere: **96 IDONEE oggi** (20
  parametriche + 76 d'insieme, non più 83 — la lista cresce con le pagine nuove del
  progetto), 26 `P1`, 0 `P2`, 7 `P4`. Fra le sei parametriche candidate indicate
  (`/approvals/[id]`, `/blueprints/[variantId]`, `/content/[id]`, `/engagement/[surveyId]`,
  `/dashboard/[famiglia]`, `/me/handbook/[id]`) la scelta è **`/approvals/[id]`**: è la
  pagina dove «sto guardando l'approvazione X» è un contesto che un umano formulerebbe
  davvero, e la pagina ha già un test E2E gemello (`approvals.spec.ts`) che sapeva già
  creare una richiesta vera con un titolo e un id reali — nessuna scelta di prodotto
  ambigua, non è stato necessario fermarsi a chiedere.

  **Cosa è stato montato**: `AgentPanel` (`@heuresys/ui` 1.2.0) e `useAgentStream`
  (`apps/web/src/lib/use-agent-stream.ts`) — **esattamente gli stessi** della console,
  non toccati. Il `context` è `t("approvals.detail.agent.context", { title: d.title, id })`
  — titolo e id VERI della richiesta di approvazione aperta, presi da `useParams<{ id
  }>()` e dalla query already in pagina, mai un placeholder. Namespace i18n proprio:
  `approvals.detail.agent.*` in `admin.json` (IT+EN, 24 chiavi), così questa pagina non
  eredita le stringhe `agentDev.*` della console. Il pannello resta dietro lo stesso
  flag `NEXT_PUBLIC_ENABLE_AGENT_DEV` della console (l'agente è ancora uno strumento di
  sviluppo, non una funzione servita ai clienti — nessun ADR l'ha cambiato in questa
  sessione) e si monta solo quando la richiesta è caricata (`d` esiste), sotto lo step
  ledger esistente.

  **Non toccato, verificato leggendo il diff**: `apps/web/src/lib/use-agent-stream.ts` e
  il componente `AgentPanel` in `ux-design-shared` — zero modifiche in nessuno dei due.
  Il criterio di riuscita della fase regge.

  **Prova live — `apps/web/tests/e2e/approvals-agent-detail.spec.ts`, VERDE** (7/7,
  1m 24s, nessun residuo aggiunto): login reale come `federica.marchetti@rtl-bank.org`
  (tenantAdmin), crea una richiesta di approvazione vera (`E2E Approval Agent
  <timestamp>`), apre `/approvals/[id]`, verifica che `approval-agent-context` contenga
  **sia il titolo sia l'id reali** (la prova fallirebbe con un placeholder), poi una
  domanda vera al gateway vivo («Quante unità organizzative esistono?») produce lo
  stream — stesso esito della console. Ambiente acceso a mano per la corsa: API dev
  su :3001, agent-gateway su :8790 (`AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`,
  `AGENT_GATEWAY_WEB_ORIGIN=http://localhost:3000` — confermato: è per **origine**, non
  per pagina, nessun cambiamento richiesto rispetto a F2), web su :3000 con
  `NEXT_PUBLIC_ENABLE_AGENT_DEV=1`; tutti fermati a fine prova. `pnpm typecheck` e
  `pnpm lint` di `apps/web` verdi; `i18n:check` verde (parity IT/EN).

  **Cosa NON è stato fatto, dichiarato invece che lasciato intendere**: questa è **una**
  pagina su 96 idonee misurate oggi (95 restano, la console esclusa per costruzione).
  F3 resta aperta.

- [ ] **F4 — Dimostrazione live** — login reale, agente attivo su almeno due schede idonee di natura diversa · budget ~120k

## Da dove si riprende

**F3 — l'adozione, prossimo incremento**: la prossima pagina idonea fra le **95 rimanenti**
di `check_idoneita_agente.py` (`/approvals/[id]` è la prima fatta, S1116). Le altre cinque
parametriche già scelte come candidate dalla sessione precedente e non ancora prese
(`/blueprints/[variantId]`, `/content/[id]`, `/engagement/[surveyId]`,
`/dashboard/[famiglia]`, `/me/handbook/[id]`) restano un punto di partenza naturale, ma
non un obbligo: qualunque pagina idonea va bene, l'importante è **non ripetere sempre lo
stesso tipo** (F4 vuole due schede di natura diversa). Stesso schema: monta `AgentPanel`
col proprio namespace e il proprio `context`; il criterio di riuscita resta che **non
tocca** né `use-agent-stream` né il componente.

**#156** resta la dipendenza per la *dimostrazione*, non per il ponte: decide quale superficie
l'agente sa leggere, cioè su quale delle pagine idonee la si mostra per prima in F4.
