# Disegno di integrazione: llm_wiki + human-resources-plus dentro heuresys

- **Data:** 2026-06-19
- **Stato:** Disegno approvato da Enzo (in attesa di rilettura del documento). Prossimo passo: piano di implementazione a tappe.
- **Autore sessione:** Claude Code (sessione di analisi → design guidato)
- **Tipo:** Blueprint / specifica di alto livello (non piano operativo)

> Documento scritto in linguaggio comprensibile a un lettore non tecnico nel corpo principale; i dettagli tecnici verificati sono in appendice.

---

## 1. Obiettivo

Costruire **un unico sistema dentro heuresys** in cui l'assistente AI lavora insieme **ai documenti e ai dati del personale**, fondendo tre cose oggi separate:

- **heuresys** (il gestionale del personale, web, ospitato sulla VM OCI in produzione),
- **llm_wiki** (strumento per digerire documenti e cercarli "per significato", con mappa dei collegamenti),
- **human-resources-plus** (plugin con assistenti esperti e competenze HR).

L'obiettivo finale comprende **tutti e tre** i compiti richiesti, ed è **arricchibile nel tempo** con nuove capacità:
1. leggere/capire i documenti e collegarli alle persone;
2. far rispondere l'assistente AI alle domande (su documenti **e** dati);
3. mostrare i collegamenti su una mappa.

Include anche la capacità di **interagire con il database** di heuresys (i dati strutturati), non solo con i documenti.

---

## 2. Come si fondono i tre pezzi

| Pezzo | Ruolo nel sistema unito |
|---|---|
| **heuresys** | La "casa": dati delle persone, database, e componenti già esistenti riutilizzabili (motore di significato, ponte per assistenti, mappe) |
| **llm_wiki** | Porta il pezzo mancante: **digerire i documenti** (PDF/Word/Excel) e renderli cercabili per significato |
| **human-resources-plus** | Gli **assistenti esperti** che usano documenti e dati per i compiti HR |

Principio architetturale scelto: **"ampliare la casa"** — la nuova capacità vive *dentro* heuresys, riusando il più possibile ciò che già esiste, invece di affiancare un sistema separato.

---

## 3. Decisioni chiave prese in sessione

1. **Scopo**: l'AI è *fusa con i dati del personale*, non limitata a documenti sciolti (opzione più potente, scelta esplicitamente).
2. **Tutti e 3 i compiti** sono irrinunciabili e l'obiettivo è arricchibile nel tempo.
3. **Si procede a tappe**, partendo dalla **fondamenta**.
4. **Entrambe le modalità d'uso** (assistente conversazionale + funzioni nelle schermate), ma **prima l'assistente** (il plugin è già avanti → valore più rapido).
5. **Architettura**: ampliare heuresys, riusando il suo database e la sua intelligenza semantica già presente.
6. **Niente oscuramento dei dati** e niente impalcatura di conformità "per terzi": è un sistema personale, non un servizio rivenduto.
7. **Motore AI**: approccio flessibile (alla llm_wiki), con priorità all'uso **senza chiavi API**.
8. **Assistenti esperti su Claude tramite abbonamento** (Flessibilità A): basta *niente chiavi*; **non** serve renderli compatibili con motori diversi da Claude.
9. **Impronte di significato senza chiave**: modellino locale leggero, **tutto sulla VM**, niente cloni di documenti.
10. **Strada "zero chiavi ovunque", per gradi** (confermata): prima i documenti, poi anche i dati strutturati, con rete di sicurezza.

---

## 4. La fondamenta (Tappa 0)

Il pezzo che oggi manca a heuresys è la capacità di **digerire i documenti**. heuresys oggi "capisce il significato" dei suoi **dati** (competenze, ruoli, profili), ma non dei **documenti** caricati. La fondamenta colma questo, in 4 mosse:

| Mossa | Cosa succede | Da dove arriva |
|---|---|---|
| 1. **Digestione** | Carichi un documento → si estraggono testo, immagini e tabelle | logica di llm_wiki |
| 2. **Comprensione** | Il testo è spezzato in pezzi e se ne creano le **impronte di significato** | modellino locale (vedi §6) |
| 3. **Archiviazione** | Le impronte finiscono nel **magazzino di heuresys** (già esistente) | infrastruttura esistente |
| 4. **Collegamento** | Ogni documento è legato alla persona/cosa giusta (candidato, dipendente, posizione) | nuovo, sopra i dati di heuresys |

Risultato: heuresys potrà **cercare nei documenti per significato e collegarli alle persone** — base su cui poggiano assistente, schermate e mappa.

---

## 5. Il motore AI

Tre tipi di lavoro AI, gestiti diversamente:

| Tipo di lavoro | Motore | Chiave API |
|---|---|---|
| **Assistenti esperti** (ragionano a più passi, usano strumenti) | **Claude via abbonamento** | No |
| **Risposte semplici** (chiedi → testo, riassunti) | A scelta (flessibile, alla llm_wiki) | No, dove possibile (binario Claude locale) |
| **Creare le impronte** (per la ricerca) | **Modellino locale dedicato** | No |

Punto importante: il binario Claude locale **non sa creare le impronte** (è un altro tipo di lavoro). Per le impronte serve un modellino specializzato e separato (§6).

---

## 6. Le impronte senza chiave — sistemazione tecnica

**Vincoli da rispettare insieme:** (a) niente chiavi a pagamento; (b) nessun "cervellone" AI sulla VM; (c) ricerca sempre disponibile, anche col PC spento.

**Soluzione (concilia tutti e tre):**
- Sulla VM vive un **piccolo "creatore di impronte"** (NON un modello generativo): occupa ~mezzo GB di memoria e impiega centesimi di secondo per una frase. Sulla VM (11 GB totali, ~9,5 liberi, 2 processori quasi a riposo) è un carico **trascurabile**.
- Il **lavoro pesante** (digerire molti documenti in blocco) può essere alleggerito sul **PC** solo quando serve; il caso normale (documenti caricati man mano) lo gestisce la VM da sola.
- **Nessun documento duplicato**: documenti, database e creatore di impronte stanno **tutti sulla VM**.

**Differenza di categoria (perché va bene, a differenza di Ollama con un LLM):**

| | "Cervellone" tipo LLM (escluso) | "Creatore di impronte" (adottato) |
|---|---|---|
| Memoria | Svariati GB | ~mezzo GB |
| Processore | Al massimo per secondi | Centesimi di secondo |
| Sulla VM | Insostenibile | Trascurabile |

**Strada "zero chiavi ovunque", per gradi:**
- **Sotto-fase A (subito, nella fondamenta):** le impronte dei **documenti** create dal modellino locale.
- **Sotto-fase B (dopo):** spostare anche le impronte dei **dati strutturati** di heuresys dal servizio a pagamento attuale (Voyage) al modellino locale, eliminando l'ultima chiave.
  - **Rete di sicurezza:** le nuove impronte si calcolano **accanto** alle vecchie; si verifica che l'abbinamento persone↔posizioni resti di buona qualità; **solo allora** si fa lo scambio. Reversibile.
  - **Vantaggio tecnico:** heuresys usa già impronte da **1024 numeri**; scegliendo un modello locale che produce lo stesso formato, **il magazzino non va rifatto** (cambia solo *chi* crea le impronte).
  - Il ricalcolo iniziale (migliaia di record) è un picco **una tantum**: di notte sulla VM, oppure sul PC.

---

## 7. Il percorso a tappe

| Tappa | Contenuto | Note |
|---|---|---|
| **0 — Fondamenta** | Digestione documenti + impronte locali + archiviazione + collegamento ai dati | Si parte da qui |
| **1 — Assistente** | Gli assistenti esperti (plugin) usano la fondamenta; in particolare l'assistente di "grounding" viene ricollegato al magazzino | Primo valore visibile |
| **2 — Schermate** | Le stesse capacità dentro l'interfaccia web di heuresys | Dopo |
| **3 — Mappa** | Vista visiva dei collegamenti (riusando le mappe già presenti in heuresys) | Dopo |
| **poi** | Sotto-fase B (dati su modellino locale) + arricchimenti continui | Nel tempo |

---

## 8. Vincoli e non-obiettivi (per chiarezza)

- **NO** oscuramento dei dati (né in sviluppo né in produzione).
- **NO** impalcatura di conformità da "servizio a terzi".
- **NO** modelli AI pesanti sulla VM.
- **NO** cloni di documenti tra PC e VM.
- **NO** assistenti esperti su motori diversi da Claude (basta Flessibilità A).

---

## 9. Punti aperti (da definire nel piano di implementazione)

1. **Quale modello locale di impronte** scegliere (preferibilmente a 1024 numeri, per riusare il magazzino): valutare qualità vs leggerezza su processore ARM.
2. **Come far girare il modellino su ARM** (runtime di esecuzione compatibile aarch64).
3. **Dettagli di digestione**: formati supportati, come spezzare i testi, gestione di immagini/tabelle dai PDF.
4. **Collegamento documento↔entità heuresys**: a quali dati legare i documenti (utenti, posizioni, candidati, ecc.).
5. **Schema del magazzino** per le impronte dei documenti (riuso del formato 1024).
6. **Come gli assistenti interrogano la fondamenta** (ricablare l'assistente di grounding del plugin).
7. **(Opzionale)** modalità "lavoro pesante sul PC": come il PC consegna i risultati alla VM.
8. **Tappe 2 (schermate) e 3 (mappa)**: design di dettaglio successivo.

---

## Appendice tecnica (fatti verificati in sessione)

> Verificati il 2026-06-19 su VM `oracle-vm-default` e sui repository. Da riverificare prima dell'implementazione.

**heuresys-advanced** (monorepo pnpm su `/home/ubuntu/heuresys-advanced`):
- App: `apps/api` (Node), `apps/web` (Next.js), **`apps/agent-gateway`**, `apps/showcase`; libreria `packages/shared`; `db/` con migrations/scripts/seeds.
- **agent-gateway** usa `@anthropic-ai/claude-agent-sdk@^0.3.178`; contiene già: client heuresys, strumenti MCP, gate sulle scritture, ponte di approvazione, audit. È il "ponte assistenti↔dati" già costruito.
- **pgvector** disponibile (v0.8.2). Migrations creano un "pgvector substrate" (mig 000060) con tabelle embedding sidecar: `sys_skill_embeddings`, `sys_esco_occupation_embeddings`, `sys_job_role_embeddings`, `sys_user_profile_embeddings`, tutte `vector(1024)`, popolate dal backfill **Voyage** (gated `VOYAGE_API_KEY`). Esisteva un `content_embedding vector(1536)` legacy, poi rimosso.
- Modulo **`apps/api/src/modules/semantic-matching/`** (`voyage-client.ts`, `backfill.ts`, `service.ts`): è il "motore di significato" esistente sui dati strutturati.
- Moduli di **visualizzazione/grafo** già presenti (`visualization-graphs/nodes/edges/layouts/...`) → base per la Tappa 3 (mappa).
- Database presenti: `heuresys_advanced`, `heuresys_platform`, `lalibraiascalza`. PostgreSQL 16.14.
- **Risorse VM:** 2 processori, 11 GB RAM (~9,5 liberi), 8 GB swap, carico basso. Disco 96 GB, ~29 GB liberi dopo pulizia.

**human-resources-plus** (plugin Claude, v2.6.0, su `D:\enzospenuso\Documents\GitHub\human-resources-plus`):
- 48 skill (33 `hr-*` + 14 `recruit-*`) + 6 agent (`compliance-guard`, `hr-grounding`, `hr-research`, `hr-verifier`, `prompt-optimizer`, `resume-parser`).
- Prevalentemente prompt/guida; integrazione con heuresys **progettata ma non ancora attiva** (REST `/v1/*` via Agent SDK, base URL da env `HEURESYS_API`, auth a cookie utente, scritture con approvazione umana). Nessun accesso diretto al DB.
- **Nessuna pipeline RAG/embedding propria**: `hr-grounding` fa retrieval lessicale (grep/read/webfetch) + consuma il `semantic-matching` nativo di heuresys. → È il punto naturale da ricollegare alla fondamenta, senza duplicare.

**llm_wiki** (`D:\enzospenuso\Documents\GitHub\llm_wiki_fork`, fork pubblico `Spen-Zosky/llm_wiki_fork`):
- App desktop Tauri 2 (Rust) + frontend React 19/Vite (~65k righe TS/TSX) + `mcp-server` Node.
- Backend Rust (~11k righe): ingestion documenti, LanceDB, estrazione immagini PDF (pdfium), parser Office, server HTTP locale, spawn CLI.
- Layer LLM flessibile in TS (`src/lib/embedding.ts`, `llm-providers.ts`): supporta provider locali **senza chiave** (Ollama/LM Studio/llama.cpp/LocalAI) per le impronte, e transport via **binario Claude/Codex locale** per la generazione.
- Nell'integrazione si **scarta il guscio Tauri**; si riusa la logica (ingestion, layer LLM, viste).
- CI GitHub Actions (`build.yml`) produce installer multi-piattaforma (Windows, Linux x86_64, Linux ARM64, macOS ARM) — non più rilevante per l'integrazione server, ma utile come riferimento.
