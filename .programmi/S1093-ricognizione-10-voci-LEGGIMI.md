# S1093 — ricognizione misurata delle 10 voci P1/P2/P3/GATED

**Cos'è**: il risultato grezzo di una ricognizione delegata a 13 agenti in parallelo il
2026-09-08, che hanno misurato **sul campo** (codice, database di produzione via tunnel, git)
lo stato reale di `#149 #143 #169 #214 #159 #79 #54 #205 #198 #41`, più una verifica
indipendente dei tre gate dichiarati.

**Dove**: `S1093-ricognizione-10-voci.json` accanto a questo file — **318 KB**, non è materiale
da aprire per intero. Ogni voce porta: fase viva · stato misurato (con i comandi) · **smentite**
(dove la misura contraddice register o piano) · decomposizione fino al comando · precondizioni
verificate · chi la può completare · costo stimato · prova di chiusura secondo la DoD.

**Costo**: 2,27 milioni di token di subagent, 940 chiamate di strumento, ~2h30 di orologio.
Rileggerlo costa una frazione di ri-produrlo.

---

## ⚠ Il reperto che vale da solo il lavoro — e riguarda il presidio `#149`

**`#149` F4 è stato dichiarato «nessun bersaglio» CINQUE volte misurando metà del proprio
innesco.** L'innesco è *«la prossima consegna che arriva, **o la prossima ingerita che qualcuno
cita**»*. In S1077, S1083, S1087, S1091 e S1092 è stato misurato solo il primo ramo
(`lab_inbox.py` + `ls inbox/`, entrambi vuoti). Il secondo **non è mai stato misurato**.

Misurato adesso: **5 documenti del design-lab sono citati dal register come fonte eseguibile**
(`#205` riga 44 · `#206` riga 72 · `#198` righe 112, 159, 162) e **nessuno dei cinque** porta un
segno di verifica canonica.

È **DIF-4** — la frase più larga della misura — applicata *al presidio che esiste per
intercettare DIF-4*. Ed è la seconda volta oggi che quella famiglia si presenta.

## Le altre smentite, in ordine di gravità

1. **`#205` risulta «VERIFICATA-AVVERSARIALMENTE-S1066» ma il documento non lo sa.** S1066
   scrisse la ritrattazione nel *biglietto di consegna*, non nel **dossier** che la voce fa
   aprire: alla riga 87 di quel dossier l'affermazione respinta come falsa **sopravvive
   intatta**. La regola 3 del piano di `#149` lo prevedeva alla lettera.
2. **Due delle quattro conferme di S1066 oggi sono false**: `sys_research_sources` **esiste con
   5 righe** (fu confermato «non esiste, la dipendenza dura regge»), e le tabelle di `sys` non
   sono più 225 → **240**. ⚠ Il confronto va rifatto **con lo stesso strumento** che produsse il
   225 (`completezza_tenant.py`), non con una conta diversa: altrimenti si smentisce un numero
   con un numero che misura un'altra cosa.
3. **Il register di `#149` è indietro di due sessioni rispetto al proprio piano** (fermo a
   S1087). Chi avvia con `session_start.py` — che distilla il register, e il `CLAUDE.md` **vieta**
   di leggere il backlog grezzo al boot — vede un presidio fermo al 5 settembre.
4. **Numeri portanti di `#206` scaduti**: `sys_position_skill_requirements` 1.439 → **1.434**;
   `_learning_requirements` 1.733 → **1.886**. La conclusione che motivano regge, i numeri no.
5. **La conformità al presidio non è misurabile a macchina**: il marker di verifica esiste in due
   grafie diverse e nessuno strumento lo cerca. Su 64 consegne ingerite, **3** portano un marker
   inequivocabile.
6. **Il gate di `#198` è confermato vero**: `sys_blueprint_content_{units,positions,skills,kpis}`
   = 0 · 0 · 0 · 0.

## Fasi — perché questa ricognizione è lavoro, non un documento

> **stato**: CHIUSO
> **registro di sessione** — cronaca di cio' che si e' fatto, non il programma di una
> voce: non dichiara `item` di proposito. Rivendicarne uno faceva mostrare QUESTO file
> al posto del piano della voce, e su `#169` il menu e' arrivato a scrivere «il piano
> e' esaurito, la voce va chiusa» mentre restavano due fasi aperte (misurato S1094).

⚠ Queste fasi esistono anche perché un cancello le pretende (`programmi.py --verifica`), e il
fatto che il file l'abbia fatto **uscire rosso** è esso stesso una dimostrazione della regola C1:
ho creato tre file in `.programmi/` senza chiedermi chi li sorveglia. `chi_sorveglia.py .programmi`
avrebbe elencato `programmi.py` e altri **sei** cancelli.

- [x] **F1 Depositare la ricognizione dove non si perda** — 2,27 milioni di token di subagent non possono vivere in una cartella temporanea. **fatto =** file nel repo + guida di lettura — FATTO 2026-09-08
- [x] **F2 Verificare le smentite prima di agirvi** — **FATTA 2026-09-09 (S1094)**. Sei su sei
  ri-misurate sul vivo: **cinque CONFERMATE, una da correggere nel suo enunciato.**

  | # | esito | la misura di oggi |
  |---|---|---|
  | ① `#205` ritrattata sul biglietto, non sul dossier | ✅ CONFERMATA | il marker `VERIFICATA-AVVERSARIALMENTE-S1066` sta a `SOT_BACKLOG.md:54`, cioe' nel register; il dossier non lo porta |
  | ② due conferme di S1066 oggi false | ✅ CONFERMATA, **e sono tre** | `sys_research_sources` **esiste con 5 righe** (era «NON esiste, la dipendenza dura regge») · tabelle di `sys` **240** (era «225 confermato») · e la terza che nessuno aveva contato: `completezza_tenant.py` oggi da' **160 / 147 / 334** dove la riga dichiara **150 / 144 / 329** |
  | ③ register di `#149` indietro rispetto al piano | ✅ CONFERMATA | l'ultima sessione citata nel blocco e' **S1087** |
  | ④ numeri di `#206` scaduti | ✅ CONFERMATA | `sys_position_skill_requirements` **1.434** (doc: 1.439) · `_learning_requirements` **1.886** (doc: 1.733) |
  | ⑤ conformita' non misurabile a macchina | ✅ CONFERMATA, **e peggio** | cercando le due grafie canoniche su 64 consegne ingerite: **zero riscontri**. Le forme reali sono prosa (`VERIFICATO-leggendo-il-file`, `voci-VERIFICATE-PULITE`, `verificate-una-SECONDA-volta`): non esiste un marker, esistono frasi |
  | ⑥ gate di `#198` vero | ✅ CONFERMATA | `sys_blueprint_content_{units,positions,skills,kpis}` = **0 · 0 · 0 · 0** |

  ⚠ **L'avvertenza sulla n.2 era giusta, e ho scoperto perche'.** Il piano diceva di rifare il
  confronto «con lo stesso strumento che produsse il 225». Misurato: `completezza_tenant.py`
  **non produce quel numero** — da' 160 tabelle di tenant, mentre 225/240 e' la conta delle
  tabelle di `sys`. Sono **due grandezze diverse**, e la riga 54 del register le tiene sulla
  stessa riga come se fossero un unico rilievo. Le ho misurate **entrambe** invece di sceglierne
  una: 225 → **240** sulla propria grandezza, 150 → **160** sulla sua.

  🔬 **E questa fase e' servita a evitare la sesta occorrenza dello stesso errore.** Aprendo
  `#149` ho eseguito `ls inbox/` — vuota — e stavo per dichiarare «F4 non ha bersagli», che e'
  **esattamente** cio' che cinque sessioni hanno fatto misurando meta' dell'innesco. Me ne sono
  accorto solo leggendo questo file. Il reperto in cima non e' un avviso storico: e' una trappola
  che scatta ancora
- [x] **F3 Portare i marker di verifica sui documenti citati** — **FATTA 2026-09-09 (S1094)**.
  I documenti citati dal register sono **sei**, non cinque: `check_verifica_consegne.py` li censisce
  da sé invece di fidarsi di un elenco scritto a mano. Ognuno porta ora il proprio esito:
  · `2026-08-16-tenant-builder-p2b-p2c` → **SMENTITO**, con la misura di oggi accanto (tre delle
    quattro conferme di S1066 sono cadute) — è il documento di `#205`, l'unico che ho ri-misurato;
  · gli altri cinque → **NON-VERIFICATO**, dichiarato. Non è un giudizio sul contenuto: è la
    dichiarazione che nessuno li ha verificati dopo l'ingestione, e che l'ingestione non è una
    verifica. Un documento muto sembra verificato; uno che dichiara di non esserlo no.
  ⚠ I file del lab vivono **fuori dal repository** (`heuresys-design-lab/`), quindi i marker non
  entrano in un commit: stanno sui documenti, che è dove `#149` regola 3 dice di scriverli.
- [x] **F4 Rendere il presidio misurabile a macchina** — **FATTA 2026-09-09 (S1094)**:
  `docs/kb/tools/check_verifica_consegne.py`. Definisce **una grafia sola** e la cerca:

      > **#149 verifica avversariale** · esito: CONFERMATO · sessione: S1094 · data: 2026-09-09

  ⭐ **Data e sessione sono obbligatorie, e il selftest lo prova rifiutando un marker che non le
  porta.** Nasce dal difetto misurato oggi sulla riga 54 del register: «`sys` ha 225 tabelle
  (confermato)» era vero a S1066 e falso adesso, e chi lo rileggeva non aveva modo di
  accorgersene. Un marker deve dire **quando** si è guardato, non che si è guardato per sempre.

  ⭐ **E chiude il buco strutturale del secondo ramo**: lo strumento non guarda l'inbox, guarda
  **chi il register cita**. È il ramo che cinque sessioni non hanno mai misurato perché nessuno
  strumento lo misurava — un innesco che dipende da chi si ricorda di guardare non è un presidio.

  **Sa uscire rosso, e sa distinguere tre stati**: `0` verde · `1` una consegna citata non porta
  il marker · `2` **NON MISURATO** (lab irraggiungibile, o consegne citate che nel lab non
  esistono). Misurato adesso: exit **1** prima dei marker, exit **2** dopo — restano 5 consegne
  che il register nomina e che nel lab non ci sono, ed è un buco dichiarato invece che nascosto.
  `--selftest` verde su **9 casi**, dei quali cinque negativi (marker senza data, senza sessione,
  in prosa libera, con grafia vicina ma diversa, con esito fuori vocabolario).

## Come si usa

Non è una lista di cose da fare: è la **base misurata** su cui costruire il prossimo piano. Le
decomposizioni dentro il JSON sono scritte per una sessione che **non ha questo contesto**.
⭐ Ma vale la regola di `#149` **anche su questo file**: è una consegna, ed è **non verificata**
finché qualcuno non la misura. Le smentite qui sopra sono affermazioni di 13 agenti, non fatti
acquisiti — vanno ri-misurate prima di agire, esattamente come si sarebbe fatto con un documento
del lab.
