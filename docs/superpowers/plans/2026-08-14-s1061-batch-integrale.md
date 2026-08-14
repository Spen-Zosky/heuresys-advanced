# S1061 — Ciclo batch integrale: tutto P1 + P2 + P3 + i debiti aperti

> **mandato di Enzo, 2026-08-14 23:26**: *«processa tutti i punti elencati in P1, P2 e P3 ed
> anche i debiti aperti. Fai tutto in autonomia e senza il mio presidio. […] Gestisci eventuali
> azioni che dovessero richiedere più di una sessione, programmandoli in modo che se vengono
> interrotte possono essere riprese in sessioni successive.»*
>
> **avviso di Enzo**: la finestra 5h si resetta intorno alle **00:46** → misurare **sempre**
> con `guardiano.py`, mai stimare.

## Confine di sessione — dichiarato all'inizio (R24 §4)

Il menu contiene **12 voci** più **2 debiti**. Sommando i budget già dichiarati nei file
`.programmi/`, il lavoro residuo del menu vale **~2,8M token** — contro **918k di contesto
misurato** all'avvio (`guardiano.py`, 8,1% consumato). **Non sta in questa sessione, e non è un
giudizio: è la somma dei budget che i programmi si sono dati da soli.**

Quindi il ciclo è diviso in due, e **entrambe le metà sono un deliverable**:

- **Blocco A + B — si esegue adesso**: tutto ciò che è chiudibile o è la fase successiva di un
  programma, finché il guardiano non dice stop.
- **Blocco C — si programma adesso**: ogni voce che resta deve avere, **prima della chiusura**,
  un file `.programmi/` con la fase successiva e il «da dove si riprende». Una voce che resta
  aperta senza ripresa scritta è un difetto di questo ciclo, non un residuo.

## Le voci — una riga per deliverable (R24 §1)

| id | cosa | chi | fatto significa | stato |
|---|---|---|---|---|
| **A1** | **D-81** — riclassificare: non è un fix, è una dipendenza di fase su #132 GATED | io | il register non lo conta più fra i debiti da correggere; `session_start` non lo stampa come rosso a riposo | ✅ **FATTO** `8c259612` — `status_dashboard`: **0 debiti aperti** (erano 2), rimando inverso in #132 |
| **A2** | **#188 + D-84** — le lacune formative e la posizione assente | io | la superficie non mostra più una colonna vuota per sempre; decisione dichiarata nel codice; test che sa fallire | ✅ **FATTO** `8c259612` — 4/4 nuovi + 14/14 modulo, **falsificabilità provata**, i18n in parità |
| **A3** | **#123 (a)** — la decisione sulle squadre trasversali | io | risposta derivata dalla direzione di Enzo del 2026-08-05 (già presa, non si ri-chiede); #123 chiusa | ✅ **FATTO** — 142/172 trasversali ri-misurate; **3 squadre** hanno già un capo più in basso di un membro: il caso di Enzo è nel dato |
| **A4** | **#79** — cancello di esposizione | io | applicato ai lavori di questo ciclo che toccano dati | ✅ **FATTO** — applicato dentro F5: `sys_process_participants`, 845 righe invisibili a **tutta** l'API, trovate e ora esposte |
| **A5** | **#149** — ogni consegna del lab è non verificata | io | applicato per costruzione: ogni numero di questo piano ri-misurato oggi | ✅ **FATTO** — 4 numeri del register smentiti ri-misurando (22 non 28 scoperte · 142/172 non 142/174 · 2 non 3 KPI · 0 debiti non 2) |
| **B1** | **#99 F5** — completezza di `self` (~200k) | io | ogni tabella che referenzia una persona è raggiungibile self-scope, o l'esclusione è dichiarata **una per una** con motivo | ✅ **FATTO** `0116cf48`+`03d31799` — **SCOPERTE 0** (erano 22), 4 superfici costruite, 18 escluse motivate |
| **B2** | **#92 F6** — frontend del ciclo di valutazione (~200k) | io | pagina manageriale + pagina ESS, i18n in parità, live su dati reali | ⬜ da fare |
| **B3** | **#92 F7** — E2E Playwright con login reale (~120k) | io | due rami provati (manager + ESS senza deleghe) | ⬜ da fare |
| **C1** | **#99 F6/F7/F8** (~750k) | io | file `.programmi/99` aggiornato con la ripresa | ✅ **FATTO** — ora **[5/8]**, riprende da F6, con due misure di F5 regalate a F6 |
| **C2** | **#142 F2/F3/F4** (~680k) | io | file `.programmi/142` — F2/F3 restano GATED su #99 F7 | ✅ **verificato** — riprende da F4, gate su #99 F7 tuttora valido |
| **C3** | **#143 F1..F5** (~1,1M) | io | file `.programmi/143` — la validazione del modello è di Enzo | ✅ **FATTO** — riprende da F1, col reperto di #123 già dentro (3 squadre col capo più in basso) |
| **C4** | **#159 F1..F4** (~770k) | io | file `.programmi/159` — F1 dipende da #156 (WAIT-INPUT) | ✅ **F1 ESEGUITA** `4256bd45` — 83 idonee su 115, criterio ri-eseguibile; il ponte esiste già dentro `/dev/agent`. Riprende da **F2** |
| **C5** | **#54 F2..F4** (~750k) | io | file `.programmi/54` — nessun import dal legacy (I12) | ✅ **verificato** — riprende da F2 |

**Verifica del Blocco C, letta dallo strumento e non dichiarata**: `python docs/kb/tools/programmi.py --verifica` → **`programmi OK — 7 programma/i, nessun difetto`**. Ogni voce non chiusa del menu ha un file con la fase successiva e il «da dove si riprende»: **nessuna voce resta aperta senza ripresa scritta**, che era la condizione posta da Enzo.

## Simulazione (R24 §3) — le cinque domande, per le voci che si eseguono

### A1 — D-81
- **Precondizioni**: la riga esiste in `DEBT_REGISTER.md` (verificato: riga 209) e porta già la
  riclassificazione scritta in S1058. Manca solo l'effetto sul **conteggio**.
- **Meccanismo**: chi conta i debiti aperti? **Da verificare nel codice di `status_dashboard.py`**,
  non a memoria: se conta per stato testuale, cambiare lo stato basta; se conta per presenza in
  una sezione, va spostata la riga.
- **Propagazione**: nessun artefatto, solo un file versionato → `git`.
- **Chi**: io.
- **Guardia**: non è distruttiva. Post-condizione: `session_start.py` deve stampare **1** debito
  aperto invece di 2, e D-81 deve restare **leggibile** (riclassificare ≠ cancellare, ADR-0035).

### A2 — #188 + D-84
- **Precondizioni**: `learning_gap_position_id` NULL su tutte e 270 le righe. **Da ri-misurare
  adesso** (#149, punto fisso): il numero è del 2026-08-14 ma la storia RTL avanza da sola.
- **Meccanismo**: `learning-gaps/repository.ts` + `packages/shared/src/schemas/learning-gaps.ts`
  + le due pagine web. La competenza è già stata risolta ieri (`e247ad72`, `d3f497da`): **da
  verificare che sia davvero in produzione**, non assumerlo.
- **Propagazione**: contratto Zod condiviso → API **e** web insieme, o il typecheck si rompe.
- **Chi**: io. La decisione «inferenza dichiarata vs ritiro» è mia per mandato.
- **Guardia**: il test deve poter **fallire** — se rimetto la colonna, deve diventare rosso.

### A3 — #123 (a)
- **Precondizioni**: la direzione di Enzo del 2026-08-05 su #143 esiste ed è vincolante
  (verificato: `.programmi/143` righe 9-12).
- **Meccanismo**: nessun codice. È una **registrazione**: la domanda «le 26 squadre seguono il
  nuovo organigramma o restano?» ha già risposta nella definizione che Enzo ha dato di squadra.
- **Propagazione**: `SOT_BACKLOG.md`. Il documento del lab (`organigramma-bis.html`) **non si
  tocca**: sta fuori dal repo, va segnalato al lab.
- **Chi**: io — non sto decidendo al posto di Enzo, sto **applicando** una sua decisione.
- **Guardia**: se la derivazione non regge, la voce resta aperta invece di chiudersi a forza.

### B1 — #99 F5
- **Precondizioni**: F3 e F4 chiuse (verificato). **#117 risulta `DONE`** (riga 546 del register)
  mentre `.programmi/99` lo dà come «voce gemella da chiudere con F5»: **contraddizione da
  misurare prima di partire**, non da risolvere a intuito.
- **Meccanismo**: il vaglio va fatto **meccanicamente sul DBMS** (elenco delle tabelle con FK
  verso una persona), non sui nomi dei moduli — è la lezione pagata in F4.
- **Propagazione**: se nascono migrazioni → `ci-rehearsal.sh` prima del push.
- **Chi**: io.
- **Guardia**: la prova va scritta **contro la porta HTTP**, non contro la funzione.

## Regole di condotta del ciclo

1. **Il guardiano si misura dopo ogni voce chiusa**, e il verdetto si **incolla**, non si parafrasa.
2. **Un commit per voce**, atomico.
3. **La lista si accorcia, mai si allunga** (R24 §5): le scoperte nuove vanno in fondo a questo
   file, sotto «fuori da questo ciclo», e non entrano in «cosa resta».
4. **Chiusura binaria** letta da questa tabella.

## Fuori da questo ciclo (registro separato — R24 §5)

- **#188 metà competenza** era già chiusa ieri: qui si chiude solo la metà posizione.
- `learning_gap_position_id` resterà una colonna popolabile: il ritiro è **della superficie**,
  non della colonna. Se un giorno una rilevazione nascerà agganciata a una posizione, la
  superficie si riapre senza migrazione.
- **#123**: l'allineamento di `organigramma-bis.html` è **lavoro del lab**, non della canonica.
- **#99 F5**: la contraddizione #117-`DONE` vs «gemella di F5» va sciolta misurando, e l'esito
  vale anche per il register.

---

## Diario di esecuzione

*(si riempie mentre si esegue — una riga per voce, con l'evidenza)*
