# Inventario del substrato AI/RAG — ricognizione Cowork del 2026-08-06

> **DOCUMENTO NON AUTORITATIVO.** Ricognizione preliminare prodotta da Cowork leggendo il
> codice e interrogando il database, **senza poter accendere i servizi**. Serve a spiegare
> l'origine dei mandati del 2026-08-06. Dove diverge dai referti in `../specs/`, vincono
> i referti. Vedi `README.md` di questa cartella per la gerarchia di autorita'.

**Mandati che ne sono nati**:
`../prompts/2026-08-06-substrato-semantico-verifica-e-correzioni.md`
`../prompts/2026-08-06-catalogo-generico-corpus-concetti.md`

## Punti superati dai referti — leggere PRIMA del testo

| Punto | Cosa diceva | Cosa e' risultato vero | Fonte |
|---|---|---|---|
| §1 conteggi embedding | ~17.450 skill, ~3.045 occupazioni | stime `pg_stat` gonfiate; esatti: 14.039 skill, 3.045 URI eleggibili su 7.714 righe grezze | referto 2026-08-06 |
| §11 S1 "7 utenti scoperti" | lacuna di copertura | **sbagliato**: fuori corpus, non scoperti. Copertura reale 100% | referto 2026-08-06 |
| §2 "17 strumenti su 90 moduli" | 90 moduli API | atlante rigenerato: **95 moduli, 569 route, 113 pagine** | referto 2026-08-07 |
| §9-§10 voce M1 | sorvegliare la copertura del catalogo agente | **decaduta**: con il catalogo generico non esiste piu' un rapporto 17-su-N da sorvegliare | decisione D1 |
| §12 precondizione bloccante | ricerca semantica da verificare | **soddisfatta**: 0,87 su domini pertinenti, 400-640 ms | referto 2026-08-06 |
| §12 architettura | ipotesi da provare | provata **in parte**: instrada bene, non risponde alle domande di calcolo | referto 2026-08-07 §5.5 |

Le correzioni ai numeri sono anche in coda al testo originale, al §13, scritte quando
sono emerse. Il testo dei paragrafi precedenti **non e' stato riscritto**: un'analisi
corretta a posteriori nasconderebbe l'errore invece di documentarlo.

---

# Imbracatura AI / RAG â€” inventario verificato e mappa dei vuoti

**Data**: 2026-08-06 Â· **Metodo**: ogni riga e' un fatto prodotto da un comando eseguito
oggi su questa macchina. Niente stime, niente memoria, niente "dovrebbe esserci".
Dove il numero e' approssimato lo dichiaro.

## 0. Perche' questo documento esiste

Enzo ha chiesto tre volte in una sessione come costruire qualcosa che era gia' costruito
(agent gateway, auth su abbonamento, substrato di embedding). Il problema non e' di
competenza tecnica: e' che manca una mappa verificata di cio' che la piattaforma possiede.
Questo file e' quella mappa. Il documento di implementazione viene DOPO, e si appoggia qui.

---

## 1. Substrato semantico (la base del RAG) â€” ESISTE ED E' POPOLATO

| Fatto | Valore | Come verificato |
|---|---|---|
| Database | PostgreSQL 16.14 aarch64 (VM), raggiungibile su localhost:5433 | `psql select version()` |
| Estensione vettoriale | **pgvector 0.8.5** installata | `select * from pg_extension` |
| Ricerca testuale fuzzy | pg_trgm 1.6 installata | idem |
| `sys_skill_embeddings` | ~17.450 righe | `pg_stat_user_tables` (stima) |
| `sys_esco_occupation_embeddings` | ~3.045 righe | idem |
| `sys_user_profile_embeddings` | ~156 righe | idem |
| `sys_job_role_embeddings` | ~137 righe | idem |
| **Totale embedding** | **~20.788** | somma |
| Chiave Voyage | `VOYAGE_API_KEY` valorizzata in `.env` | lettura nomi, mai valori |
| Interruttore | `MATCHING_FREETEXT_ENABLED` presente in `.env` | idem |
| Codice | modulo `semantic-matching` con `voyage-client.ts`, `backfill.ts`, rotta POST /reindex | lettura sorgenti |
| Consumatore | `insights/repository.ts` dichiara di costruire sopra il substrato embedding | lettura sorgente |

**Conclusione**: la meta' "recupero per somiglianza" del RAG non e' da costruire. C'e', ed e' piena.

---

## 2. Agente e strumenti â€” ESISTE, PARZIALMENTE COLLEGATO

| Fatto | Valore | Come verificato |
|---|---|---|
| Workspace | `apps/agent-gateway`, commit dal 2026-06-16 al 2026-07-25 | `git log` |
| SDK | `@anthropic-ai/claude-agent-sdk` in dipendenza | package.json |
| Auth abbonamento | `subscription-auth.ts`: neutralizza ANTHROPIC_API_KEY e ANTHROPIC_AUTH_TOKEN prima dell'import SDK | lettura sorgente |
| Prova live auth | `PONG`, `is_error=false`, senza API key | smoke-sdk-auth.ts, 2026-08-06 16:56:47 |
| Test unitari | 6 file, **51 test verdi** in 2,48s | vitest 4.1.10 |
| Gate scritture | `canUseTool` con approvazione umana; scritture NON in allowedTools (scelta deliberata, commentata nel codice) | lettura sorgente |
| Strumenti MCP collegati | **17 letture** su struttura/catalogo (unita', posizioni, ruoli, famiglie, competenze, livelli, KPI, profili, blueprint) | `mcp-tools.ts` |
| Moduli API esistenti | **oltre 90** | `ls apps/api/src/modules` |

**Il divario chiave**: l'agente raggiunge 17 cose su oltre 90. Non per limite tecnico â€”
collegare un modulo gia' esistente al catalogo MCP costa **una riga**.

Moduli esistenti e NON collegati, rilevanti per l'AI:
`succession-pools` Â· `successor-candidates` Â· `successor-readiness` Â·
`position-succession-relevance` Â· `talent-review` Â· `career-paths` Â· `career-path-steps` Â·
`learning-gaps` Â· `evidence` Â· `insights` Â· `predictions` Â· `semantic-matching` Â·
`org-health` Â· `capability-maturity` Â· `provenance` Â· `assessments` Â· `goals` Â· `okrs`

---

## 3. Dati per la demo â€” RTL BANK E' UTILIZZABILE

Tenant esistenti: `HEURESYS` (sistema) e `RTL_BANK` (RTL Bank). Solo due.

Successione su RTL_BANK, **conteggi esatti**:

| Misura | Valore |
|---|---|
| Punteggi di prontezza | **468** |
| Persone coperte | **156** |
| Posizioni coperte | **18** |
| Orizzonte 6 mesi | 432 punteggi |
| Orizzonte 1 anno | 36 punteggi |

Nota: le 156 persone con punteggio coincidono con i ~156 `sys_user_profile_embeddings`.
Ogni persona valutata ha anche un profilo vettoriale. Non e' un caso: e' la precondizione
di un confronto per somiglianza fra persona e posizione.

Contorno (stime `pg_stat_user_tables`): gap_closure_actions 440 Â· learning_gaps 258 Â·
position_career_paths 252 Â· talent_scores 154 Â· employee_position_fit_scores 146 Â·
gap_analysis_results 144 Â· readiness_scores 90 Â· succession_scores 90 Â·
successor_readiness 79 Â· gap_closure_plans 36 Â· career_path_steps 35 Â·
successor_candidates 28 Â· skill_gap_scores 28 Â· succession_pools 17 Â·
position_succession_relevance 17 Â· critical_positions 8 Â· critical_role_coverage_status 8 Â·
career_paths 7

---

## 4. Le tre cose che vengono chiamate "AI" e non sono la stessa

Tenerle separate e' la condizione perche' il documento di implementazione resti stabile.

**(A) Agente che ragiona e chiama strumenti.** Interpreta la domanda, sceglie quali API
interrogare, sintetizza. Lavora su dati STRUTTURATI. Stato: c'e', gli manca il ponte
verso le pagine web e 17 strumenti su 90.

**(B) Recupero per somiglianza.** Trova la competenza affine anche se scritta con parole
diverse. Lavora su VETTORI. Stato: c'e', popolato, 20.788 embedding.

**(C) RAG vero e proprio â€” la giuntura.** L'agente, prima di rispondere, recupera per
somiglianza i frammenti pertinenti e li usa per FONDARE la risposta, citando la fonte.
Stato: **e' questo che manca**. Non come infrastruttura, ma come percorso collegato.

Detto altrimenti: hai il motore e hai il serbatoio. Manca il tubo.

---

## 5. Mappa dei vuoti, in ordine di costo

| # | Vuoto | Costo | Sblocca |
|---|---|---|---|
| G1 | Ponte HTTP/SSE gateway â†’ webapp + giro di approvazione | il grosso del lavoro | qualunque demo |
| G2 | Collegare al catalogo MCP i moduli successione/gap/carriera | ~1 riga a modulo | la domanda sulla successione |
| G3 | Strumento MCP sopra `semantic-matching` | ~1 riga + verifica | il recupero per somiglianza dentro l'agente |
| G4 | Regola: l'agente cita SEMPRE la fonte di cio' che afferma | prompt + test | il claim di spiegabilita' |
| G5 | Fissare il modello usato in demo | 1 riga | prevedibilita' di tempi e consumi |
| G6 | Dati dormienti senza endpoint (dossier Serie A) | 0,5-3 sessioni CLI a linea | fuori dai tempi di una demo |

---

## 6. Cosa NON e' verificato (dichiarato, non nascosto)

1. **Le API non sono state interrogate live**: la porta 8012 era chiusa. So che i moduli
   esistono come codice, non che rispondano correttamente oggi.
2. **`semantic-matching` non e' stato provato**: non so se una ricerca per somiglianza
   restituisce risultati sensati, ne' quanto e' lenta.
3. **Freschezza degli embedding**: non ho controllato quando e' stato eseguito l'ultimo
   backfill. Embedding vecchi su competenze nuove darebbero risposte sbagliate.
4. **Il tunnel verso la 5433**: risultava aperto, ma non ho verificato chi lo tiene su.
   Se cade prima di una demo, cade tutto.

Queste quattro cose sono il primo ciclo di lavoro successivo, non un elenco di pendenze.

---

## 7. Confine di sessione

Questo documento e' l'INVENTARIO. Non e' il documento di implementazione.
Il documento di implementazione si scrive dopo aver chiuso i quattro punti del Â§6:
scriverlo adesso significherebbe fondarlo su supposizioni, che e' esattamente
l'errore commesso stamattina col piano V1-V8.

---

## 8. Manutenzione dell'imbracatura â€” cosa esiste (2026-08-06)

Verificato: NON serve costruire un sistema di manutenzione. Esiste, ed e' vivo.

`docs/kb/tools/` contiene 28 strumenti, molti modificati fra il 3 e il 5 agosto:
`build_atlas.py` Â· `db_health.py` Â· `dead_columns.py` Â· `exposure_columns.py` Â·
`check_exposure.py` Â· `check_tenant_contamination.py` Â· `check_module_test_coverage.py` Â·
`verifica_incrociata.py` Â· `verify_gate.py` Â· `status_dashboard.py` Â· `handoff_lint.py` Â·
famiglia `zp_*` Â· `session_start.py` Â· hook git opt-in.

**`build_atlas.py` e' esattamente lo strumento richiesto.** Ri-deriva a ogni esecuzione,
dal codice e dal DB live, la catena pagina -> endpoint -> permesso -> tabella -> dati.
Zero numeri hardcoded, idempotente, output `atlas.yaml` + `ATLAS.md` generati.
E' da questo che e' nato il dossier Serie A: "41 tabelle popolate non referenziate da
nessun modulo API" e' un suo risultato, non un'intuizione.

**`backfill.ts` gestisce gia' la freschezza.** Calcola l'hash del testo sorgente e
ri-embedda solo cio' che e' cambiato (`hash-skip`). Se cambia la descrizione di una
competenza, il ri-lancio aggiorna quel solo vettore.

CI: 10 workflow attivi (lint, typecheck, test-integration, i18n-parity, state-lint,
playwright-smoke, codeql, shell-tests, build-web, showcase).

## 9. I tre vuoti reali della manutenzione

### M1 â€” Nessuno sorveglia la copertura dell'agente
Ricerca su tutto il repo: `mcp-tools.ts` e' referenziato SOLO dentro `apps/agent-gateway`.
Nessuno strumento di `docs/kb/tools/`, nessun workflow CI verifica se un modulo API
nuovo sia esposto o meno all'agente. Oggi il rapporto e' 17 su oltre 90 e **nulla lo segnala**.
Quando aggiungerai il modulo 91, l'agente non lo sapra' e nessuno te lo dira'.

### M2 â€” La lista dei corpus da vettorizzare e' scritta a mano nel codice
`runBackfill()` cicla su tre corpus fissi: skills, job_roles, occupations (+ profili
derivati). Non c'e' un registro di "quali entita' meritano un embedding", quindi
un'entita' nuova che avrebbe i requisiti (identificatore stabile + testo leggibile +
appartenenza a un tenant) resta fuori senza che nessun controllo lo rilevi.
La freschezza e' risolta; **la copertura no**.

### M3 â€” Nessuna cadenza
Atlas e db_health si lanciano a mano. Gli hook git riallineano solo il grafo esplorativo.
Il backfill e' dichiarato "on-demand by an operator". Quindi la mappa invecchia
esattamente nel periodo in cui stai aggiungendo dati â€” cioe' adesso.

## 10. Proposta: estendere, non costruire

Tre aggiunte, nelle convenzioni gia' in uso (python in `docs/kb/tools/`, ri-derivazione,
zero numeri fissi, output datato). Nessun sistema nuovo.

| id | Cosa | Effetto |
|---|---|---|
| M1 | `check_agent_coverage.py`: confronta i moduli API con il catalogo MCP, con lista esplicita delle esclusioni volute | un modulo nuovo non esposto diventa un errore visibile, non un silenzio |
| M2 | Registro `embeddable.yaml` + `runBackfill` che cicla sul registro invece che su tre nomi fissi + `check_embedding_coverage.py` | un'entita' nuova che merita vettori viene segnalata invece di restare invisibile |
| M3 | Un comando unico che esegue la batteria e scrive un rapporto datato, agganciato a un workflow schedulato | la mappa non invecchia mentre lavori |

Da verificare prima di M2: `dead_columns.py` e `exposure_columns.py` (3 agosto) potrebbero
gia' coprire il caso "campo rinominato". Se si', il rischio rinomina e' gia' presidiato
e non serve aggiungere nulla su quel fronte.

---

## 11. Analisi valutativa: cosa vale la pena aggiungere alle istruzioni CLI

Metodo: ogni candidato giudicato su valore, costo e rischio-di-non-farlo.
Verdetto secco: INCLUDERE / ESCLUDERE / DOPO. La lista si accorcia, non si allunga.

### Correzione ai numeri del Â§1 (onesta')
I conteggi embedding del Â§1 venivano da `pg_stat_user_tables`, che sovrastima.
Conteggi ESATTI 2026-08-06: skills 14.039 Â· job_roles 137 Â· user_profiles 156 Â·
occupations da riverificare. Il Â§1 va letto con questa correzione.

### Scoperte che cambiano il quadro

**S1 â€” Copertura incompleta, quantificata.**
| Corpus | Sorgenti | Vettori | Scoperti |
|---|---|---|---|
| skills | 14.039 | 14.039 | **0** |
| job_roles | **176** | **137** | **39 (22%)** |
| utenti | **163** | **156** | **7** |

Nessuno strumento lo segnala. M2 non e' teorico: ha gia' morso.

**S2 â€” Tutti gli embedding sono del 2026-06-06.** Due mesi. Nel frattempo sono stati
importati dati (timeline il 2 agosto, fasce salariali il 3). Il backfill non e' mai
stato rilanciato dopo quegli import.

**S3 â€” Il salto-per-hash ignora il modello.** `backfillCorpus` salta un elemento se
`source_text_hash` coincide. Non confronta `model_id`. Conseguenza: **cambiando modello
di embedding, tutto viene saltato** e resti con vettori del modello vecchio mescolati a
quelli nuovi delle righe aggiunte. Spazio vettoriale misto = somiglianze sbagliate,
silenziosamente. Oggi c'e' un solo modello (`voyage-4-lite`), quindi il difetto e' latente.

**S4 â€” Buona notizia: gli indici ci sono.** Tutte e quattro le tabelle hanno indice HNSW.
Su questo fronte non c'e' niente da aggiungere.

### Verdetti

| # | Candidato | Costo | Verdetto | Perche' |
|---|---|---|---|---|
| A1 | Controllo copertura embedding | basso | **INCLUDERE** | 39 ruoli e 7 utenti gia' scoperti, nessuno lo dice |
| A2 | Confrontare anche `model_id` nel salto-per-hash | ~3 righe | **INCLUDERE** | miglior rapporto valore/costo dell'elenco: evita corruzione silenziosa |
| A3 | Controllo copertura catalogo agente | basso | **INCLUDERE** | 17 su 90, nessuno lo sorveglia |
| A4 | Registrare costo e consumo di ogni chiamata agente | basso | **INCLUDERE** | il sink di audit esiste gia'; evita di restare a secco in demo |
| A5 | Cadenza programmata della batteria | medio | **INCLUDERE** | senza, la mappa invecchia mentre lavori |
| A6 | Tracce di riferimento delle risposte agente | medio | **INCLUDERE (ridotto)** | registrare le tracce dagli script `live-*-acceptance` gia' esistenti; NON un sistema di punteggio |
| A7 | Tipi generati dallo schema DB | alto | **DOPO** | typecheck + test integrazione + dead_columns coprono gia' molto |
| A8 | Punteggio di fondatezza delle risposte RAG | alto | **DOPO** | non esiste ancora un percorso RAG da misurare |
| A9 | Rate limit e test avversariali multi-tenant | medio | **NON AGGIUNGERE** | gia' censiti in WI-B.2: referenziare, non duplicare |
| A10 | Indici vettoriali | â€” | **NIENTE DA FARE** | HNSW gia' presente su tutte e quattro |

### Nota di merito
Sei candidati su dieci vengono scartati o rinviati. Un elenco che accetta tutto non e'
un'analisi: e' un desiderio. Le cinque voci incluse costano poco perche' si innestano
su strumenti gia' tuoi, non perche' siano marginali.

---

## 12. Decisione architetturale â€” catalogo generico invece di strumenti per tabella

Data: 2026-08-06. Origine: obiezione di Enzo, accolta.

### L'obiezione
Definire a priori quali domande l'agente puo' ricevere e' un anti-pattern: nessuno sa
in anticipo cosa chiedera' un cliente, e qualunque dato del dominio funzionale puo'
essere oggetto di domanda. Corretta.

### Perche' NON si risponde collegando gli altri 73 moduli
Un catalogo con 90 strumenti si degrada: il modello deve leggere nomi e descrizioni di
tutti a ogni turno per sceglierne uno. La selezione peggiora, il contesto si riempie
prima ancora della domanda, il costo per chiamata sale. E' strutturale, non un limite
di versione. Chi ha scritto il gateway si e' fermato a 17: la scelta era sensata.

### La forma che si adotta
Pochi strumenti generici che sanno NAVIGARE il dominio, invece di uno per entita':
1. trova quali entita' del dominio riguardano un dato concetto
2. descrivi la struttura di questa entita' (campi, relazioni, permessi)
3. interroga questa entita' con filtri

Il punto 1 e' RAG applicato ai METADATI, non ai contenuti: l'agente cerca per
somiglianza nel dizionario del dominio, poi si fa descrivere solo cio' che serve,
poi interroga. Il contesto resta piccolo qualunque sia la dimensione del dominio.

### La scoperta che rende la cosa realizzabile
`docs/kb/atlas/atlas.yaml` (131 KB, generato il 2026-07-05 da `build_atlas.py`) E' GIA'
la mappa leggibile a macchina del dominio: moduli API, endpoint, permessi, tabelle,
pagine. Il corpus dei concetti non va scritto a mano: **si deriva dall'atlas**.

Conseguenza importante: l'atlas si rigenera dal codice e dal DB vivo. Quindi
schema cambia -> atlas rigenerato -> corpus concetti ri-embeddato -> l'agente
raggiunge le entita' nuove **senza che nessuno colleghi uno strumento**.
E' la risposta alla domanda originale di Enzo sulla manutenzione: il ciclo si chiude.

### Cosa questo cambia nelle voci gia' decise
- La voce "controllo copertura catalogo agente" (M1) DECADE nella forma prevista:
  con un catalogo generico non c'e' piu' un rapporto 17-su-90 da sorvegliare.
  Va sostituita da: l'atlas copre tutti i moduli? il corpus concetti e' allineato all'atlas?
- La voce "registro entita' vettorizzabili" (M2) si PROMUOVE: da igiene di manutenzione
  a componente portante dell'architettura.
- La voce "cadenza" (M3) si PROMUOVE per lo stesso motivo: se l'atlas non si rigenera,
  l'agente smette di vedere le entita' nuove. Non e' piu' pulizia, e' funzionamento.

### Limiti dichiarati
- `atlas.yaml` e' fermo al commit 115d7983 del 2026-07-05: un mese. Va rigenerato.
- L'atlas dichiara i propri limiti (estrazione endpoint per regex, nessuna risoluzione
  transitiva dei componenti condivisi). Il corpus concetti eredita quei limiti.
- Un agente che puo' arrivare ovunque e' piu' difficile da garantire di uno con 17
  strumenti elencati a mano. Il contrappeso esiste gia': permessi applicati dal server,
  gate sulle scritture, tracciabilita'. Non sono ornamenti: sono la condizione.

### Precondizione bloccante
Tutto questo poggia sull'ipotesi che la ricerca semantica funzioni e restituisca
risultati sensati. NON e' ancora verificato: e' il TASK 1 del prompt in esecuzione.
Se la ricerca semantica non regge, questa architettura non regge. Il prompt 02
si scrive DOPO quel rapporto, non prima.

---

## 13. Correzioni ai miei numeri, dopo il rapporto CLI del 2026-08-06

CLI ha eseguito il mandato e ha corretto due affermazioni **mie**. Le registro qui
perche' il documento non deve restare piu' sbagliato del rapporto che lo verifica.

**C1 â€” "7 utenti scoperti" era sbagliato (Â§11, S1).** I numeri `163 | 156` erano
giusti, l'interpretazione no. Il profilo persona si deriva solo da chi ha almeno una
competenza con evidenza: quelle 7 persone sono **fuori corpus**, non scoperte.
Copertura reale: 100%. Avevo dedotto una lacuna da una differenza fra due conteggi
senza leggere la regola di eleggibilita'.

**C2 â€” Le occupazioni.** Il conteggio grezzo e' 7714, gli URI distinti eleggibili
3045. Il mio Â§1 riportava 3045 come totale: giusto per caso, non per metodo.

**C3 â€” Il buco era cronico, non un dimenticanza.** CLI riporta che i vettori
`job_roles` avevano DUE date, 2026-06-06 e 2026-07-26. Quindi un backfill era gia'
stato rilanciato a fine luglio, e **aveva comunque lasciato 39 ruoli scoperti**: sono
ruoli creati dopo. Non e' "nessuno l'ha piu' lanciato": e' che senza cadenza il
divario si riapre a ogni import. Rafforza M3, che passa da igiene a necessita'.

### Esito della precondizione bloccante (Â§12)

**SODDISFATTA.** La ricerca semantica risponde e risponde bene: 0,87 fra
antiriciclaggio e prevenzione frodi, 0,87 fra "gestione del personale" e "gestire le
risorse umane", 400-640 ms a regime. L'architettura del catalogo generico regge.

### Fatto nuovo che vincola il progetto del catalogo generico

Le interrogazioni in **testo libero** passano da `/v1/matching/search`, che sta dietro
`MATCHING_FREETEXT_ENABLED` (default `false`, assente dal `.env`) e costruisce un
embedder **a ogni richiesta**: una chiamata Voyage a pagamento per ogni domanda posta.
Nessuna cache visibile in `service.ts`.

Conseguenza per il prompt 02: nel catalogo generico OGNI domanda dell'utente inizia
con un embedding a pagamento. Va progettata una cache delle query (chiave = hash del
testo + model_id, come gia' fatto per i corpus). Non e' un'ottimizzazione: e' la
differenza fra una demo sostenibile e una che costa a ogni frase.

### Rilievo di revisione su `check_embedding_coverage.py`

Lo strumento **copia** le definizioni di eleggibilita' da `repository.ts` e dichiara
che vanno tenute allineate a mano. E' il difetto classico del controllore che
replica la logica del controllato: divergeranno. Da valutare nel prossimo ciclo se
le definizioni possano essere importate invece che duplicate. Non blocca nulla oggi.

---

## 14. Vincolo di progetto del ponte: deve valere per le pagine future

Domanda di Enzo (2026-08-06): il ponte fra gateway e pagine web funzionera' anche
sulle pagine che aggiungero' in futuro? Risposta: si', ma solo se progettato cosi'.

**Il ponte non deve sapere niente delle pagine.** Un solo endpoint in streaming e un
solo componente frontend riusabile. Aggiungere una pagina = usare il componente.
Zero lavoro sul ponte. Se invece il primo prototipo viene scritto dentro una pagina
specifica, ogni pagina nuova richiedera' di rifarlo: e' l'errore che rende costoso
il decimo caso d'uso e che si evita solo prima di scrivere il primo.

**Il contesto di pagina va passato come dato generico, non come codice.** Una pagina
vuole che l'agente sappia "sto guardando l'unita' X". Deve essere un parametro
libero passato al componente, non un ramo condizionale per tipo di pagina.

**I permessi sono automatici e restano tali**: li applica il server sulla sessione
inoltrata. Nessun lavoro per pagina, ne' oggi ne' mai. E' il motivo per cui questa
architettura scala senza moltiplicare le superfici di rischio.

**Cosa NON e' automatico**: che l'agente sappia rispondere sui dati NUOVI di quella
pagina. Quello non dipende dal ponte ma dal catalogo generico e dalla rigenerazione
dell'atlante (Â§12). Le due meta' vanno tenute distinte: il ponte porta a schermo,
l'atlante decide cosa l'agente riesce a vedere.

Da inserire come vincolo esplicito nel prompt che progettera' il ponte (03).

