# Batch S1056 — #182 + tutto il P2 residuo

> **Mandato di Enzo (2026-08-13)**: «portare dentro tutti e due i rami, il documento subito
> e il codice dopo la prova generale. Poi le dieci voci P2 già misurate. Vorrei chiudere sia
> P1 che P2, ma decidi tu come procedere e fai il maggior numero di punti possibile.»
>
> Piano-file R24: una riga per deliverable, stato per riga, decomposizione fino al comando,
> simulazione a 5 domande **prima** di eseguire. La lista si accorcia, mai si allunga.

---

## Il criterio di capienza — non più a impressione

Enzo ha posto il problema per primo: *«la tua capacità di verificare quanto contesto rimane
non è solida e affidabile»*. Vero, ed è già una regola scritta
(`feedback_no_context_estimation`) che però vietava senza dare il sostituto.

**Il sostituto esiste ora**: `docs/kb/tools/guardiano.py`. Legge il transcript JSONL
della sessione e somma i tre campi `usage` **restituiti dall'API**
(`input_tokens + cache_read_input_tokens + cache_creation_input_tokens`). Non è una stima:
è il numero che l'API ha riportato.

- **Prova falsificabile**: `--selftest` costruisce transcript sintetici con numeri noti; 6
  casi su 13 sono negativi. Vista rossa con due difetti iniettati (guardia sullo zero
  rimossa → 12/13 exit 1; «corrente» letto come picco → 12/13 exit 1), verde sul sano
  (exit 0). I codici d'uscita verificati **senza pipe**, perché `| tail` li ingoia.
- **Limite dichiarato**: il transcript si scrive a fine turno, quindi la misura è indietro
  di un turno. Il numero è un **pavimento**, mai un soffitto — il verso giusto per decidere.
- **Misura d'apertura**: `122.344 / 1.000.000` = **12,2%**, giudizio LARGO.

### ⛔ IL GUARDIANO — regola d'arresto, vincolante (Enzo, 2026-08-13)

> **Se contesto ≥ 75% OPPURE finestra 5 ore ≥ 80% si INTERROMPONO le attività.** Non «si
> valuta», non «si propone»: si interrompe. Poi: registrare il progresso, committare **e
> pushare** tutto, chiusura completa della sessione.

Il ramo delle 5 ore è stato aggiunto in corsa, per non arrivare allo stop e restare fermi
ad aspettare il reset. La regola aggregata è ora **permanente e a livello utente**
(`~/.claude/CLAUDE.md` + memoria), non solo di progetto: vale in ogni sessione e in ogni
progetto. `python docs/kb/tools/guardiano.py --sorveglia` esce **3** quando scatta.

Sta scritta qui e non solo nella conversazione **apposta**: una regola che vive nel contesto
muore con il contesto. Questo file si rilegge.

- **Soglia**: `frazione >= 0.75` da `guardiano.py` (= 750.000 token sulla finestra da 1M), oppure `five_hour_pct >= 80`.
- **Quando si misura**: dopo **ogni** voce chiusa, e prima di aprirne una che si stima ≥60k.
- **Il numero è un pavimento** (il turno in corso non è ancora nel transcript): a 73-74% si
  considera già raggiunta, non si tira.
- **Prima di aprire una voce**: `guardiano.py --budget N` — se il residuo *fino al 75%*
  non copre N, quella voce non si apre, si passa alla successiva più economica.
- **Cosa comprende la chiusura**: piano-file aggiornato riga per riga · register e SoT
  allineati · commit di tutto · **push** · skill `handoff` · propagazione.
- **Riserva**: la chiusura stessa costa ~60k. Perciò l'ultima voce di lavoro si apre solo se
  finisce **sotto** il 75%, non «intorno».

---

## Confine di sessione — dichiarato adesso, non alla fine

**P1 non può chiudersi in questa sessione, e non è una scelta: è aritmetica.** Le voci P1
residue misurate valgono, sommate, **≥16 sessioni**:

| Voce P1 | Misura dichiarata nel register | In questa sessione? |
|---|---|---|
| **#124** mascheratura | il lavoro è **già in main** (`fc3d09c0`, 2026-08-12 + 8 commit D4). Il register è stantio | ✅ **sì — solo da dichiarare** |
| **#149** consegne del lab non verificate | continuativo, non ha un «fatto» | metodo, si applica: non si chiude |
| **#92** ciclo di valutazione | ~2-3 sessioni (passi 4-7) | no |
| **#142** cruscotti per utilizzatore | ~3-4 sessioni | no |
| **#143** una squadra è un progetto | ~4-6 sessioni | no |
| **#99** domini gerarchici e funzionali | ~6-8 sessioni | no |
| **#76** piano zero pendenze | ~895h senza input di Enzo | no |

**P2 è invece l'obiettivo raggiungibile**, ed è anche quello che risolve il problema vero di
Enzo — *«continuano ad aggiungersi punti e io perdo il filo»*: la lista si accorcia solo
chiudendo **voci**, non ore. Perciò l'ordine è a **costo crescente**, non a valore
decrescente: massimizza il numero di righe che spariscono.

---

## Stato — una riga per deliverable

| # | Voce | Fatto = | Costo | Stato |
|---|---|---|---|---|
| **F0** | Misuratore di contesto + prova falsificabile | selftest verde, 2 difetti visti rossi | fatto | ✅ **FATTO** |
| **F1a** | #182 — il documento Dependabot in main | `docs/github/dependabot-triage-*.md` aggiornato in main | ~10min | ✅ **FATTO** `c16dbbb6` — il ramo era **superato, non mancante**: main aveva già lo stesso triage in forma più completa (`b55dcabf`, `45cc6014`), inclusa la nota su `#68` che il ramo non poteva avere. `git cherry` confronta l'identità della modifica, non la sostanza. Innestati i 2 soli dettagli additivi, ri-verificati dal vivo. Archiviato in `archivio/gov-w1-recuperato` |
| **F1b** | #182 — il codice residui E2E in main | prova generale verde + suite | ~1h | ✅ **FATTO** `ca1bb3b6` — diagnosi del ramo **vera**, meccanismo **sbagliato**: portava un manifesto a mano di 19 marcatori, l'impostazione che `drift-check.ts` aveva già misurato e scartato — e infatti **non nomina `sys_content_versions`**, una delle 2 colonne che perdono righe davvero. Recepito col censimento esaustivo (697 colonne). Il difetto peggiore era un altro e taceva: **su CI il teardown è un no-op**. 7 casi, 2 sollevano. Archiviato in `archivio/gov-w2-recuperato` |
| **F2** | #186 — guardia lab: `psql -Atc` | selftest guardia verde + il caso raggruppato passa | ~20min | ✅ **FATTO** `d7d7dce8` — patch del lab applicata, **88 ok / 0 falliti** e gli 83 verdetti pre-esistenti invariati. In più la batteria ha imparato a controllare il **motivo**, non solo il sì/no: senza, il caso `-Atf` restava verde anche togliendo il ramo che lo riconosce. Falsificazione con **linea di base misurata** (una copia fuori dal repo parte da 83/5 per la trappola di `repo_root()`) — sabotaggi: **+4**, **+1**, **+2 varchi veri** |
| **F0b** | Il guardiano unico — contesto **e** finestra 5h | selftest verde, 4 difetti visti rossi, dato 5h reale | in corsa | ✅ **FATTO** — richiesta di Enzo arrivata durante F2. Fonte del dato 5h **trovata misurando**: non esiste in nessun file, Claude Code la passa allo stdin della riga di stato → ora persistita in `~/.claude/rate-limits.json`. Regola aggregata installata a **livello utente**. Live: contesto 30% · 5h 38% · 7 giorni **77%** |
| **F3** | #124 — dichiarare la chiusura nel register | evidenza dei commit + verifica live | ~15min | ✅ **FATTO** `989bd1b0` — il lavoro era in main dal 12 agosto, **il register era l'unica cosa rimasta indietro** e teneva una voce P1 nel menu con dentro zero lavoro. Verifica live prima di dichiarare: **47 test su 10 file, exit 0** |
| **F4** | #135 — vincoli su `tenant_industry_code` | FK/CHECK in migrazione + prova generale | ~45min | ✅ **FATTO** `27b16cab`, mig `000305` — catalogo `sys_industry_codes` (aperto per I21) + NOT NULL + FK + **sentinella** `v_tenant_industry_incoerente`, che `db_health.py` ha raccolto **da sola** (15 → 16). Guardia, sentinella, post-condizione e 7 vincoli **visti fallire** su copia usa-e-getta; live in produzione, sentinella a zero |
| **F5** | #147 — 138 email cablate in 20 file | zero email letterali, helper dal DB, test verdi | ~1-2h | ✅ **FATTO** `5d02df8f` — **due condizioni su tre erano già vere** (chiave madre con impronta identica sulle 3 macchine, suite auth 92 test verdi): il register era stantio. Il residuo vero erano 138 email in 20 file, ora **0**. `attori-di-scena.ts` deriva i 5 ruoli e li memoizza; `unCapoConSottoposti` **verifica** il sottoposto invece di sperarlo. **156 test di scope verdi**; sabotaggio → exit 1 col messaggio che dice cosa manca. Reperto: `paolo.caputo`, il capo di 14 file, ha **5 posizioni tutte inattive** |
| **F6** | #121 — guardia lab rifiuta letture | 6 casi di regressione verdi | ~2h | ✅ **FATTO** `e2c1e626` — parser consapevole delle virgolette + corpi heredoc esclusi + `cd` tracciato. **Terza causa trovata eseguendo**: `shlex` POSIX mangia la barra rovesciata, quindi `D:\…` smetteva di essere assoluto. Selftest **99/0** (erano 88), con **5 rovesci** accanto ai 6 casi. Falsificazione **dentro il repo** (fuori la trappola di `repo_root()` maschera tutto): 5 sabotaggi, ognuno preso dai casi giusti |
| **F7** | #128 — storia completa delle sessioni | `hook.sh storico` + selftest | ~2h | ✅ **FATTO** `1283969a` — `gc` non è più automatica, le sessioni senza comando **esistono** (sempre canonical, mai lab), il marcatore porta un segno di vita, `hook.sh storico` elenca 30 sessioni. Selftest **112/0**. **La prima stesura delle prove non poteva fallire**: simulava il gancio invece di chiamarlo, e 3 sabotaggi su 5 passavano |
| **F8** | #125 — 22 pagine orfane + 52 etichette | nessuna pagina senza voce né motivo | ~2-3h | ✅ **FATTO** `087db34e`, mig `000306` + cancello `check_pagine_orfane.py`. **Raggiungibilità misurata**: 9 erano già collegate, 13 no — e 10 erano pagine che **I17 garantisce a ogni persona**. Etichette da **1** a **64 su 64**. Cancello visto rosso (12) e verde (0); senza DB esce **2 = non misurabile**. Tre difetti miei colti dalla prova generale, incluso un `ON CONFLICT` che non proteggeva nulla e al secondo deploy avrebbe raddoppiato le etichette |
| **F9** | #126 — le 4 tabelle di L7 | login reale vede le proprie predizioni | ~3-4h | ⛔ **NON APERTA — dichiarato, non scoperto a fine ciclo**. È a piena pila (2 endpoint + schemi + test + superficie web con login reale): con 218k residui l'avrei lasciata a metà. **Il suo lavoro è però già schedato dentro il cancello di #117**, categoria «decisa, da costruire» |
| **F10** | #123 — organigramma-bis → correzioni | `verifica_incrociata.py` universi ≠ 0 | ~1 sess | ⛔ **NON APERTA**: la consegna è *leggere un documento intero e ricavarne le correzioni* — aperta per costruzione, non tagliabile a fette |
| **F11** | #117 — completezza portale personale | strumento ri-eseguibile, 3 categorie | ~1 sess | ✅ **FATTO** `3753ed93` — `check_completezza_self.py`, **cinque** esiti invece di tre. 109 tabelle → 71 raggiungibili · 3 tramite il padre · 5 escluse · 2 decise-da-costruire · **28 scoperte**. **Due falsi verdi miei**, colti provando: la regola sul padre era circolare (FK verso `sys_users`), e il portale compone 11 altri moduli. Senza i padri universali lo strumento esce **0 con 0 scoperte** |
| **F12** | #159 — ponte assistente, tutte le schede idonee | criterio di idoneità + scheda persona live | ~3h+ | ⛔ **NON APERTA**: il bersaglio è cresciuto (tutte le schede idonee, non una), e va prima definito cosa rende idonea una scheda |
| **F13** | #79 — cancello di esposizione ri-eseguito | `check_exposure.py` exit 0 | ~10min | ✅ **FATTO** — 73 tabelle scritte, 73 esposte, **0 scoperte**, exit 0. Insieme a lui: pagine orfane 0 · salute DB nei limiti · guardia sessione 112/0 · guardiano 29/29 · integrità stato 0 fail |

**Vincolo d'ordine**: **F6 e F7 toccano lo stesso file** (`scripts/hooks/session_mode.py`) —
in fila, mai in parallelo. Vincolo ereditato da S1055 e confermato.

---

## Registro delle scoperte — fuori da questo ciclo

*Presentate una volta sola. Non entrano in «cosa resta», non bloccano la chiusura.*

- **28 tabelle che descrivono una persona non sono raggiungibili dal suo portale, e nessuno
  aveva scritto perché.** Le ha trovate il cancello di #117 appena costruito. Alcune sono
  decisioni che spettano a Enzo — *i sondaggi di clima sono anonimi? il punteggio di
  aderenza alla posizione si mostra all'interessato?* — altre sono lavoro mio. Non entrano
  in «cosa resta» di questo ciclo: sono la misura che il ciclo ha prodotto.
- **`sys_industry_codes` (creata oggi) non compare nel cancello di esposizione**, che
  guarda 73 tabelle e non l'ha vista. Non è una lacuna del dato — è che l'universo del
  cancello non cresce da solo. Vale la pena guardarlo, una volta.
