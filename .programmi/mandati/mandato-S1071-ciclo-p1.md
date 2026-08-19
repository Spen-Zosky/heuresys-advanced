# Mandato S1071 — due difetti subito, poi il consumo di tutto P1

> **mandato di ciclo**, non programma di voce → vive in `.programmi/mandati/`, fuori dal radar di
> `programmi.py`. **stato**: IN CORSO
> **aperto**: 2026-08-19, sessione canonica S1071
> **mandato di Enzo** (verbatim): «un controllo del boot potrebbe dare un verde falso (cerca un
> numero in una zona troppo larga del documento), e le prove automatiche scrivono nel registro delle
> chiusure vero, sporcandolo: correggi subito. Poi, continua in sequenza per consumare tutto
> l'elenco P1 … committa sempre quando una azione e' conclusa … lasciamo i push e la chiusura
> completa di sessione a quando tutto l'elenco P1 sara' stato consumato e risolto»

**Piano approvato**: `~/.claude/plans/un-controllo-del-boot-tranquil-hellman.md`

**Regole che valgono su tutto**: ⭐ **PUNTO FISSO** — ogni numero variabile si ri-misura in questa
sessione, incluse le affermazioni positive · `#149` — nulla di cio' che il lab ha consegnato e'
verificato · **DoD live** (ADR-0026) — nessuno step si chiude su green-test.

---

## Le quattro decisioni di Enzo su questo ciclo (2026-08-19, non si ri-chiedono)

1. **Push si', chiusura no.** `git push` a fine di ogni voce P1 conclusa. La chiusura completa
   (documenti di stato, propagazione cloni, verifica lunga) e' rinviata a fine ciclo.
2. **Ordine: prima cio' che protegge.** Le voci che rendono affidabile la verifica del resto vengono
   per prime, poi le corte, poi le lunghe.
3. **`#149` fuori dal conteggio** (presidio permanente, non ha termine) · **`#198` T9b si ferma a
   chiedere conferma** prima di scrivere in produzione.
4. **I due difetti extra si correggono entrambi**, incluso il cancello che li avrebbe fermati.

## Confine dichiarato all'inizio (R24 §4)

Le fasi residue di P1 dichiarano **~1.740k di budget**, e `#132` non ne dichiara affatto. Sono
**molte sessioni**. Non si chiude in questa, e non sara' presentato come se stesse per chiudersi.
Alla soglia del guardiano (contesto ≥ 75% **oppure** finestra 5h ≥ 80%) si interrompe, si registra
il punto di ripresa, si committa, **si pusha**, si scrive l'handover — e **non** si fa la chiusura
completa, che resta a fine ciclo.

Misura di apertura (2026-08-19): contesto **46,9%** (469.322 / 1.000.000) · finestra 5h **4,0%** ·
verdetto dello strumento **«si continua»**.

## Una segnalazione era mia e falsa — corretta prima di partire

Avevo riportato a Enzo che «le prove automatiche sporcano il registro delle chiusure». **E' falso.**
`run-shell-tests.sh` non invoca mai `align-clones.sh` (l'unica occorrenza e' dentro il pattern di un
`grep -qE`); ogni percorso verso `close-log.sh` devia `HEURESYS_CLOSE_LOG` o gira in una sandbox
fuori dal repo. Le righe `orfana-*` del 2026-08-18 le ho scritte **io a mano**, invocando
`align-clones.sh --deploy` mentre deployavo il fix di `#198` T9a: PID monotoni su 90 minuti, e una
riga a **15 secondi** dal commit `5f4f1560`.

Resta un difetto vero, trovato smentendo quello supposto → **C4**.

---

## Fasi

- [x] **C1+C2 Il falso verde del boot** — FATTO 2026-08-19 · la zona «§0» passa da **79.979 a
      12.886 caratteri** (20,9% → 3,4%) e ogni numero si cerca ATTACCATO alla parola che lo
      qualifica. `RBAC-map 980` e' diventato ROSSO, che era il punto. Provato: `tenants` 3/7/26 e
      `skills 14039` ora rossi, col vecchio criterio erano tutti verdi
- [x] **C3 La §0 torna vera** — FATTO 2026-08-19 · `959 map → 980`, `217 perm → 224`, ri-derivati
      dal DB in questa sessione; lo staleness self-check torna verde **per il motivo giusto**
- [x] **C4 `deploy=eseguito` non mente piu'** — FATTO 2026-08-19 · la riga si scrive DOPO i deploy;
      prima significava «deciso di deployare». 🔬 Trovato di conseguenza un test **diventato cieco**
      per una mia modifica di ieri: `eval "$(tail -8 align-clones.sh)"` non catturava piu' l'epilogo
      del marcatore. Ora si ancora al testo, e due sabotaggi lo fanno diventare rosso
- [x] **C5 Il piano di `#217` torna conforme** — FATTO 2026-08-19 · stato nudo `CHIUSO` (la regex
      pretende una riga di solo stato) + gli sha su `I4`/`I8`. `programmi.py --verifica` da 4 difetti
      a **0**
- [x] **C6 Un cancello controlla i piani** — FATTO 2026-08-19 · suite `programmi` in `verify_gate`,
      instradata da `.programmi/` **e** da `programmi.py` (un piano si rompe cambiando il piano o
      cambiando il parser). Provato togliendo l'evidenza a una spunta: cancello **ROSSO**
- [x] **P1.1 `#181`** drift-check — **CHIUSA 4/4** il 2026-08-19. Le 174 righe entrate senza verifica
      coprono tutti e sette i rilievi, provate per la prima volta (7/7 → 9/9). La prova del lucchetto
      esisteva da nove giorni e **non la eseguiva nessuno**: instradata come suite `drift-lock`. Il
      rimedio al falso-verde muto **non aveva prova**: estratta `esitoBaseline()`, ora ce l'ha. I
      sette esiti scritti accanto al codice, uno **accettato e dichiarato** invece che risolto
- [~] **P1.2 `Z-251`** contesa DB — **1/3** · F1 FATTA 2026-08-19: la contesa **non si riproduce**
      col carico di connessioni (70 concorrenti, zero fallimenti), e cercandola e' emerso che ogni
      query costa **86 ms** attraverso il tunnel contro ~1 ms su un DB locale. 🔬 Da quel numero
      avevo tratto la conclusione sbagliata («la latenza domina, si esegua dove il DB e' locale») e
      **la misura successiva l'ha smentita**: in CI, senza tunnel, la stessa suite dura **2065-2187
      s** contro i 1834 in locale. **F2 si fa come scritta**, non e' sospesa
- [ ] **P1.3 `#198`** T9b — ~60k · ⚠ si ferma a chiedere conferma a Enzo
- [ ] **P1.4 `#142`** cruscotti, F3b+F4 — ~390k
- [ ] **P1.5 `#143`** squadre, F2→F5 — ~1000k
- [ ] **P1.6 `#132`** P2a, F1→F7 — budget non dichiarato
- [ ] **P1.Z chiusura del ciclo** — riconciliazione register, chiusura completa, push finale

## Due cose da nominare prima di arrivarci, non dopo

- **`#198` e `#132` si contraddicono per iscritto.** `#198` nega di dipendere da `#132` (decisione
  **E21**: «prima il motore, la ricerca dopo»); `#132` afferma che T9 ha senso solo dopo F6.
  Eseguire T9b ora produrra' una terza banca con copertura del metro ~7,6%. E21 lo copre, e il piano
  di `#198` ordina: «il numero va scritto qualunque sia; chi esegue non deve farlo salire».
- **Il register e' stantio su 5 voci su 7.** Prima di eseguire una voce si riconcilia il suo blocco.

## Da dove riprende la prossima sessione (handover, aggiornato di continuo)

> Questa sezione si riscrive a ogni fase chiusa. Chi apre una sessione nuova legge **solo** questo
> blocco piu' il piano della voce in corso: non serve rileggere la conversazione.

**Stato al 2026-08-19, 03:1x** · ultimo commit del ciclo: vedi `git log --oneline -1`.

- **Fase 0 (C1-C6): CHIUSA** (`df9abd80`), pushata.
- **P1.1 `#181`: CHIUSA 4/4**, pushata in due tempi (`d526bed3` + il commit di F3/F4).
- **Un rosso di CI corretto alla radice**: `Shell tests` era rosso dopo il primo push perche' un
  test cercava un commit nella STORIA e in CI il checkout e' `fetch-depth: 1`. Ora si costruisce
  un repo-fixture. Diagnosticato con `ci-rosso-di-chi.sh`, lo strumento nato ieri da `#217` I7,
  che ha risposto **PROGETTO** — prima risposta utile che dava.
- **CI verificata, zero rossi**: `Shell tests` era `failure` su `df9abd80` ed e' `success` su
  `d526bed3` — il rosso e' corretto alla radice, non aggirato.
- **📌 LEZIONE OPERATIVA DI QUESTA SESSIONE, da applicare subito** (domanda di Enzo, 2026-08-19):
  `Test (api integration)` risultava **gia' verde in CI** su `df9abd80` mentre in locale la stessa
  suite girava per ~30 minuti contro il database di produzione via tunnel. Il workflow gira su
  `runs-on: [self-hosted, off-prod]` (`test-integration.yml:45`), cioe' **fuori dalla produzione**.
  Conseguenze pratiche: (a) rieseguire `test-api` in locale e' lavoro duplicato; (b) contende il DB
  di produzione, ed e' un sospetto serio per la contesa che `Z-251` insegue; (c) il cancello locale
  resta il guardiano di fine turno, ma per `test-api` conviene leggere la CI invece di rifarla.
  ⚠ Non e' ancora una regola scritta nel `CLAUDE.md`: e' una misura di oggi, da confermare.

- **⏭ PROSSIMA: `Z-251` F2** — sessioni condivise fra file, ~80k. **Non si e' aperta in S1071 con
  i tre numeri**: residuo misurato 59.866 · costo 80.000 · `guardiano --budget 80000` → **NON CI STA**.
  - **F2 si fa COME SCRITTA.** La conclusione contraria che avevo tratto da F1 e' stata smentita da
    una misura fatta subito dopo (in CI, senza tunnel, la suite dura **di piu'**). Non c'e' niente
    da decidere con Enzo: c'era una mia conclusione sbagliata, ritirata.
  - Perimetro: `apps/api/test/**` + `apps/api/vitest.config.ts`. `#181` e' chiusa, quindi non c'e'
    piu' sovrapposizione.
  - Il lavoro: togliere i login ripetuti. Non alzare i limiti — «e' la terza volta che si sposta la
    soglia invece di togliere la causa» (decisione vincolante della voce).
  - Poi **F3**: riabbassare i limiti alzati due volte. E' la prova che la causa e' andata via; se
    devono restare alti, la cura non ha funzionato e va detto.
- **Poi `#198` T9b** (~60k): ⚠ crea un'azienda vera in produzione, **una volta sola** → ci si ferma
  a chiedere conferma a Enzo prima di scrivere. Il `blocked-on-Enzo` che il register portava e'
  stato **sciolto il 2026-08-18** e riconciliato in S1071.
- ✅ **Register riconciliati in S1071 — TUTTI E CINQUE quelli che l'indagine dava stantii**:
  `#181` (chiusa) · `#198` (il `blocked-on-Enzo` sciolto il 18/08 e una riga che contraddiceva il
  proprio blocco) · `Z-251` (effort «~2h» incompatibile col proprio corpo → ~140k + ore-macchina,
  piu' l'esito di F1) · `#132` (il register non registrava **F0**, fatta in S1068 con la
  migrazione `000323`: chi leggeva il register senza il piano credeva la voce non avviata) ·
  `#142` (il piano conservava «F2 e F3 sono GATED su #99 F7», gate caduto il 15/08 e fasi gia'
  fatte). **Nessuna voce P1 ha piu' un register che mente su cio' che e' stato fatto.**

**Regole di questo ciclo, da non ri-derivare**: push a fine voce si', chiusura completa no (fine
ciclo) · alla soglia del guardiano si committa, **si pusha**, si aggiorna questo blocco, e si chiude
la sessione senza il rito completo · `#149` e' fuori dal conteggio · `#198` T9b si ferma a chiedere
conferma a Enzo prima di scrivere in produzione.

## Chiuso quando

`session_start.py` non mostra piu' voci P1 ACTIVE oltre `#149`, ogni voce ha la prova che il suo
piano dichiara — eseguita e vista fallire almeno una volta — e la chiusura completa e' stata fatta.
