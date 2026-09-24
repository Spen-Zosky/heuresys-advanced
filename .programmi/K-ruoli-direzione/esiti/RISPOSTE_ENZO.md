# RISPOSTE DI ENZO — mandato K

Una riga per risposta, nella forma: `<voce> | <data> | <risposta>`
La CLI legge questo file per prima cosa a ogni ripresa (`tools/dove_siamo.py`) e sblocca la voce corrispondente.
Le sole voci che possono aspettare qui: D5 (alla chiusura di I-D), X-0 e K1-ADR (ratifica ADR), X-1 (righe dubbie), X-2 (mappa di sys_attendance), A0 (margine del pavimento del guardiano, mandato S1105), R-2 (come il DPO legge il dossier mascherato), D10+ se nasce.


D5 | 2026-09-15 | C

Risposta di Enzo, raccolta da Cowork il 2026-09-15 alle 03:50 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Opzione C: l'importazione non tocca i saldi che hanno un gesto nativo aperto; il disaccordo finisce nel registro dei conflitti e lo chiude una persona (il DATA_STEWARD, che nasce in R-6).
Ragione della scelta, da riportare nell'ADR di X-4: i conflitti fra una persona e un'importazione oggi sono ZERO (I-D: 681 righe su 682 modificate a blocchi da lavori automatici, una sola ambigua e dello stesso giorno dei blocchi), quindi il costo di C - un passaggio manuale per conflitto - oggi e' nullo e comincia solo quando il caso diventa reale, con un cliente vero davanti e piu' informazione di adesso. Ed e' l'unica delle tre coerente con la regola data da Enzo sulla direzione del dato: ne' il gestionale esterno ne' la piattaforma sovrascrivono l'altro in silenzio.
X-4 e X-5 si sbloccano.

A0 | 2026-09-17 | 1 punto percentuale

Risposta di Enzo, raccolta da Cowork il 2026-09-17 alle 02:40 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Il margine e' quello proposto da A0: 1 punto percentuale, cioe' il 90mo percentile aggregato dei salti (0,29 punti) arrotondato per eccesso al punto intero. La fascia «A RIDOSSO» e' quindi 74-75% per il contesto e 79-80% per la finestra 5 ore, e nella fascia si esce con lo stesso exit 3 della soglia piena.
Ragione della scelta, da riportare nel commento della costante in guardiano.py: il margine copre il ritardo di UNA misura, non un intervallo senza misure. Il caso del 16-17 settembre (74,8% -> 87,3% in 48 minuti) e' coperto da questo margine per la parte iniziale (a 74,8% si sarebbe fermata) e dal terzo momento di misura di A2 per il resto. Il turno pesante raro (massimo osservato 3,47 punti, uno su 1.295 misure) resta fuori dalla fascia: inseguirlo avrebbe portato la soglia effettiva a 71,5%, cioe' circa 40.000 token di capienza buttati a ogni sessione per un evento su mille. Enzo ha scelto di non pagarlo, sapendolo.
A1 e A4 si sbloccano.

R-2 | 2026-09-18 | C

Risposta di Enzo, raccolta da Cowork il 2026-09-18 alle 23:45 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Opzione C: R-2 si chiude sul NUCLEO GDPR — i 4 permessi (gdpr:read, gdpr:export, gdpr:erase, gdpr:retention), il ritiro di gdpr:erase a HRMS_MANAGER, il rollback scritto PRIMA. La lettura mascherata del dossier NON si fa adesso: diventa una voce D-nuova separata, con la sua decisione, e resta BLOCCATA finche' Enzo non la riprende.
Ragione della scelta, spiegata a Enzo in italiano semplice prima che scegliesse: oggi non esiste un cliente che stia chiedendo quella funzione, e l'opzione A avrebbe aperto un concetto architetturale nuovo — un terzo stato «tenant-wide ma mascherato» accanto a I18 e I20 — che una volta creato vive per sempre nel prodotto e che altri ruoli chiederanno. Rimandare non costa niente perche' il lavoro utile (il nucleo GDPR) e' comune a tutte e tre le opzioni e si fa comunque. Quando un cliente vero chiedera' il DPO si sapra' anche COME lo usa, e la decisione sara' migliore di adesso.
⚠ Condizione dichiarata da Cowork al momento della scelta, da non perdere: se l'obiettivo diventa chiudere la fase dei ruoli COMPLETA per una dimostrazione o una certificazione, l'opzione A e' l'unica che la chiude davvero. In quel caso la voce D-nuova torna in cima, non resta in fondo.
NON si tocca HR_MANDATED_ROLES, non si tocca mask.ts, non nasce nessun predicato nuovo: sono la fonte diretta di I18 e I20.
R-2 (nucleo) si sblocca ORA. La voce D-nuova nasce BLOCCATA(Enzo).

R-0b | 2026-09-23 | Lasciala cosi', debito dichiarato

Risposta di Enzo, raccolta da Cowork il 2026-09-23 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Domanda posta a Enzo, con la misura di R0b-3 accanto: la porta `content-blueprint-links` (3 permessi) ha la sua condizione di riapertura avverata (BLUEPRINT_MANAGER, ruolo assegnato, ha sia `content:read` che `blueprint:read`), ma collegarla al perimetro clienti richiede estendere `ScopeFilter` — un tipo condiviso da 10 query di `content/repository.ts`, 3 service (`content/service.ts`, `content/media-service.ts`, `content-blueprint-links/service.ts`) e 5 suite di test di integrazione. Tre opzioni poste: estendere ora (costo condiviso pagato subito), rimandare senza dichiarazione, o lasciarla com'e' come debito dichiarato.
Scelta di Enzo: «Lasciala cosi', debito dichiarato». Non e' un rinvio silenzioso — e' una decisione, scritta qui perche' un rinvio dentro una riga chiusa e' invisibile a `dove_siamo.py` (e' cosi' che sono nati D11 e R-6b).
Condizione di riapertura (parole di Enzo per un caso identico, R-2 riga 27 sopra): la porta torna in cima il giorno in cui serve chiudere la fase dei ruoli COMPLETA per una dimostrazione o una certificazione, oppure il giorno in cui `ScopeFilter` va toccato per un altro motivo — allora si fa insieme e il costo condiviso si paga una volta sola.
`content-blueprint-links` resta con `haMandatoPiattaforma` (comportamento invariato, nessuna regressione): un `BLUEPRINT_MANAGER` assegnato a un solo cliente vede oggi i link del proprio tenant intero, non ancora ristretto al sotto-insieme assegnato.

X-1 | 2026-09-19 | le 103 righe dubbie, risolte in blocco con una regola

Risposta di Enzo, raccolta da Cowork il 2026-09-19 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Le 103 righe dubbie di I-E non sono state decise una per una: sono state raggruppate per CAUSA del dubbio e chiuse con quattro decisioni, che Enzo ha accettato tutte il 2026-09-19. Sotto ci sono comunque le 103 righe nella forma che il passo 59 richiede, generate applicando la regola.

LA REGOLA CHE LE PRODUCE, in una riga: **il secondo scrittore conta solo se continua a scrivere.**

- **76 -> ibrido**: hanno scrittori API E un flusso di importazione vero dall'esterno. Due padroni che scrivono davvero: e' la definizione di ibrido.
- **21 -> nativo**: il secondo scrittore NON e' un'importazione, e' un popolamento fatto da noi una volta sola (seed demo, migrazione di ricostruzione, backfill, purge). Un seed e' storia, non una direzione del dato. ⚠ La conseguenza pratica che ha motivato la scelta: ogni tabella marcata ibrida si porta dietro una sorveglianza permanente (il registro dei conflitti di X-4 piu' la sentinella di X-5). Marcarle ibride avrebbe costruito 21 sorveglianze per un conflitto che non puo' accadere, perche' quel seed non tornera' mai a scrivere.
- **4 -> importato**: sys_user_contracts, sys_user_identity_documents, sys_user_pay_slips, sys_position_compensation_profiles. NON erano dubbie: erano gia' decise da D6=A il 2026-09-14. Qui si ratifica soltanto.
- **2 -> nativo, con una scoperta da registrare**: sys_okr_check_ins e sys_okr_key_results hanno righe (25 e 20) ma NESSUNO scrittore nell'applicazione, solo SELECT. Enzo ha scelto la lettura «la funzione OKR non e' finita», non «i dati arrivano da fuori». Poiche' «da costruire» non e' fra i quattro valori ammessi dal passo 59, si classificano nativo — la direzione attesa e' l'applicazione — e la mancanza dello scrittore va registrata in esiti/REGISTRO_SCOPERTE.md come difetto di prodotto, non come classificazione.

⚠ CONTROLLO DA RIFARE, non da ereditare: rigenerare le 103 righe applicando la regola a esiti/I-E.md e confrontarle con l'elenco qui sotto. Se il conto non torna 76 ibrido / 23 nativo / 4 importato, vince il file e si segnala la differenza PRIMA di migrare. Cowork ha generato questo elenco meccanicamente, non a mano, ma resta una derivazione: va verificata.

X-1 si sblocca.

--- le 103 righe, nella forma del passo 59 ---

X-1 | sys_activity_classification_mappings | ibrido
X-1 | sys_activity_classifications | ibrido
X-1 | sys_approval_requests | nativo
X-1 | sys_approval_steps | nativo
X-1 | sys_assessment_results | nativo
X-1 | sys_assessments | nativo
X-1 | sys_blueprint_activations | nativo
X-1 | sys_blueprint_content_kpis | nativo
X-1 | sys_blueprint_families | nativo
X-1 | sys_blueprint_overrides | nativo
X-1 | sys_blueprint_process_registry | nativo
X-1 | sys_blueprint_variants | nativo
X-1 | sys_career_path_steps | ibrido
X-1 | sys_career_paths | ibrido
X-1 | sys_compensation_recommendations | ibrido
X-1 | sys_content_categories | ibrido
X-1 | sys_content_documents | ibrido
X-1 | sys_content_versions | ibrido
X-1 | sys_engagement_action_plans | ibrido
X-1 | sys_engagement_feedback | ibrido
X-1 | sys_engagement_survey_templates | ibrido
X-1 | sys_engagement_surveys | ibrido
X-1 | sys_enterprise_size_bands | ibrido
X-1 | sys_enterprise_typing_profiles | ibrido
X-1 | sys_esco_occupation_mappings | ibrido
X-1 | sys_gdpr_requests | ibrido
X-1 | sys_goals | ibrido
X-1 | sys_job_families | ibrido
X-1 | sys_job_roles | nativo
X-1 | sys_kpi_definitions | nativo
X-1 | sys_leads | ibrido
X-1 | sys_learning_gaps | ibrido
X-1 | sys_learning_modules | ibrido
X-1 | sys_learning_path_steps | ibrido
X-1 | sys_learning_paths | nativo
X-1 | sys_mentorship_programs | ibrido
X-1 | sys_mentorship_sessions | ibrido
X-1 | sys_mentorships | ibrido
X-1 | sys_occupation_classifications | ibrido
X-1 | sys_okr_check_ins | nativo
X-1 | sys_okr_key_results | nativo
X-1 | sys_okrs | nativo
X-1 | sys_operating_model_catalog | ibrido
X-1 | sys_organization_unit_history | ibrido
X-1 | sys_organization_unit_kpi_templates | ibrido
X-1 | sys_organization_unit_processes | ibrido
X-1 | sys_organization_units | ibrido
X-1 | sys_payroll_handoff_records | ibrido
X-1 | sys_position_career_paths | ibrido
X-1 | sys_position_compensation_profiles | importato
X-1 | sys_position_kpi_requirements | ibrido
X-1 | sys_position_skill_requirements | ibrido
X-1 | sys_position_succession_relevance | ibrido
X-1 | sys_positions | ibrido
X-1 | sys_project_members | ibrido
X-1 | sys_projects | ibrido
X-1 | sys_seed_acquisition_runs | ibrido
X-1 | sys_seed_approval_decisions | ibrido
X-1 | sys_seed_candidate_records | ibrido
X-1 | sys_seed_source_evidence | ibrido
X-1 | sys_seed_validation_results | ibrido
X-1 | sys_skill_aliases | ibrido
X-1 | sys_skill_categories | ibrido
X-1 | sys_skill_embeddings | ibrido
X-1 | sys_skill_families | ibrido
X-1 | sys_skill_gap_scores | ibrido
X-1 | sys_skill_taxonomy_edges | ibrido
X-1 | sys_skills | ibrido
X-1 | sys_succession_pools | ibrido
X-1 | sys_succession_readiness_scores | ibrido
X-1 | sys_successor_candidates | ibrido
X-1 | sys_successor_readiness | ibrido
X-1 | sys_survey_assignments | ibrido
X-1 | sys_survey_responses | ibrido
X-1 | sys_team_members | ibrido
X-1 | sys_teams | ibrido
X-1 | sys_tenancies | ibrido
X-1 | sys_tenant_blueprint_process_decisions | ibrido
X-1 | sys_tenant_blueprint_versions | ibrido
X-1 | sys_tenant_blueprints | ibrido
X-1 | sys_time_off_balances | ibrido
X-1 | sys_time_off_requests | ibrido
X-1 | sys_training_initiatives | ibrido
X-1 | sys_user_auth_roles | ibrido
X-1 | sys_user_career_plans | ibrido
X-1 | sys_user_certifications | ibrido
X-1 | sys_user_consents | ibrido
X-1 | sys_user_contracts | importato
X-1 | sys_user_identity_documents | importato
X-1 | sys_user_learning_assignments | ibrido
X-1 | sys_user_pay_slips | importato
X-1 | sys_user_profiles | ibrido
X-1 | sys_user_skill_evidence | ibrido
X-1 | sys_user_target_positions | ibrido
X-1 | sys_users | ibrido
X-1 | sys_visualization_edges | nativo
X-1 | sys_visualization_exports | nativo
X-1 | sys_visualization_graphs | nativo
X-1 | sys_visualization_layouts | nativo
X-1 | sys_visualization_node_layouts | nativo
X-1 | sys_visualization_nodes | nativo
X-1 | sys_visualization_styles | nativo
X-1 | sys_whistleblowing_reports | ibrido

D11 | 2026-09-24 | A

Risposta di Enzo, raccolta da Cowork il 2026-09-24 alle 21:58 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Opzione A di `esiti/R-2_domanda_masking.md`: si costruisce il terzo stato «tenant-wide ma mascherato» per il DPO — una QUINTA eccezione dichiarata ad ADR-0036 §5, con un predicato nuovo in `lib/scope/mask.ts` / `lib/scope/resolver.ts`, SENZA aggiungere DPO a `HR_MANDATED_ROLES` (che gli darebbe accesso in chiaro). Il DPO apre il dossier di qualunque persona del proprio tenant; COMPENSATION ed EVALUATION restano mascherati e dichiarati via `masked`, come per PLATFORM_ADMIN (I20, ADR-0032). Prova attesa, dal passo 44 del mandato: «DPO su profilo di una persona -> campi retributivi mascherati», con la controprova che HRMS_MANAGER continua a leggere in chiaro e che un ruolo senza mandato continua a vedere solo la propria catena.
La scelta del 2026-09-18 (C, rimandare) e' superata: la condizione di riapertura scritta allora e' stata esercitata da Enzo.
D11 si sblocca.

D12 | 2026-09-24 | A

Risposta di Enzo, raccolta da Cowork il 2026-09-24 alle 21:58 e depositata qui senza commit (l'unico committer resta la CLI, V7).
Opzione A: la provenienza delle presenze si dichiara per SCRITTORE, non riga per riga — una riga di classificazione «MATERIALIZZAZIONE senza tracciamento riga-per-riga» per ciascuno degli scrittori vivi di `sys_attendance` misurati da X-6, coerente con il linguaggio di D6/X-2. Le righe storiche non si toccano; il numero delle presenze senza provenienza smette di essere una lacuna perche' diventa una dichiarazione.
D12 si sblocca.

D11-permesso | 2026-09-25 | 1

Risposta di Enzo, raccolta da Cowork il 2026-09-25 alle 00:3x e depositata qui senza commit (l'unico committer resta la CLI, V7).
Strada 1 delle due poste in `esiti/D11.md`: al DPO si concede **`user:read`**, cioe' il permesso che gia' protegge la rotta del dossier — la raccomandazione della CLI. Le tre letture in piu' che quel permesso porta con se' (l'elenco degli utenti del tenant, la scheda anagrafica di una persona, i ruoli di una persona) sono state descritte a Enzo in italiano semplice PRIMA che scegliesse: sono tutte letture, tutte filtrate dallo stesso perimetro organizzativo che D11 ha appena definito per il DPO, e l'unica informazione davvero nuova rispetto al dossier e' quale ruolo porta una persona.
Ragione della scelta: l'alternativa (un permesso dedicato `user:dossier:read`) comprava zero effetti collaterali al prezzo di insegnare a `requirePermission` ad accettare piu' codici — il che tocca l'asserzione di boot che mappa ogni rotta a UN permesso (D-51) — e lasciava per sempre un debito di manutenzione: da quel giorno chiunque conceda `user:read` a un ruolo dovrebbe ricordarsi del gemello. Un debito su RBAC non si vede finche' non fa danni.
Cio' che NON cambia, ed e' la ragione per cui la strada 1 e' sicura: `user:read` e' una LETTURA (nessuna scrittura sulle persone per il DPO), e sui dati sensibili di un'altra persona il DPO legge MASCHERATO — e' il terzo stato di D11, quinta eccezione di ADR-0036 §5. Le quattro eccezioni preesistenti restano tutte vere anche per lui.
D11 si chiude con questa riga: la migrazione e' `000451`.
