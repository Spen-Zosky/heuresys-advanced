# Piano: rendere intelligenti tabelle e dati di tutte le pagine (10 novembre 2026)

Mandato di Enzo del 2026-11-10 alle 04:36 ora di Roma, a partire dalla pagina Utenti vista come Valentina Conti: «questo è un esempio di dati poveri e inefficaci». Le sue indicazioni valgono come metodo per tutte le pagine attuali e future, e sono scritte come regole R1-R7 nel repertorio `docs/kb/xtras/INTERFACCE_INTELLIGENTI.md`. Questo file è il piano del ciclo e il registro del giro a campione.

Che cosa vuol dire «fatto» per il ciclo: ogni pagina del menu ha la sua riga chiusa in §3, con la dimostrazione dal vivo; il registro `apps/web/tests/e2e/interfacce-intelligenti.debiti.json` è vuoto; ogni blocco è una PR unita. Il rilascio in produzione resta una decisione di Enzo, blocco per blocco o tutti insieme.

Che cosa non si chiude in questo primo giro di lavoro: i blocchi B2-B8 (§3), che partono uno alla volta dopo il sì di Enzo al blocco B1 e al repertorio.

## 1. Giro a campione dal vivo, 2026-11-10 04:40-05:25 Roma

Come: il Chrome di Enzo, già entrato come Valentina Conti (RTL; ruoli USER, TEAM_LEADER, ORG_DIRECTOR, HRMS_MANAGER, TENANT_ADMIN, HIRING_MANAGER), produzione su 8ac24a6e. Lette tutte le 73 voci della barra laterale (intestazioni, prime righe, numeri, caselle di scelta) e misurate R3-R5 su 26 pagine con tabelle con la funzione del controllo automatico. Sola lettura.

### Rilievi trasversali

| n | rilievo | dove (misurato) | regola |
|---|---|---|---|
| T1 | Due numeri per la stessa popolazione: 167 utenze contro 158 persone. La differenza sono 9 utenze di servizio «Collaudo …» (tipo SERVICE) contate come persone | `/users` «167 totali», `/org-director/vrio` «167 persone», `/organization/org-chart` e `/me/org-chart` «158 posizioni». Misura: `GET /v1/users` dà 158 STANDARD/ACTIVE e 9 SERVICE/ACTIVE | R5 |
| T2 | Elenchi troncati a 50 righe sotto un totale più grande | `/users` «167 totali» e «1–25 di 50»; `/positions` «316 totali» e «1–25 di 50»; `/learning` e `/me/learning/catalogue` «di 50» | R5, Q3 |
| T3 | Codici di macchina a video | `/positions` MEDIUM; `/time-off` PENDING, APPROVED, REJECTED, CANCELLED; `/performance` DRAFT, COMPLETED; `/tenants` ACTIVE; `/blueprints` REGIONAL_RETAIL_BANK_MEDIUM; `/visualizations` RTL_ORG_CHART, ACTIVE; `/seed-acquisition/runs` RESEARCH_SOURCES; `/career-succession` LEGACY_CP; `/admin/roles` intestazioni BRANCH_MANAGER e simili; `/dashboard/tenant` RTL_BANK, FIN_BANKING; `/dashboard/hr` ACTIVE, IN_PROGRESS, PENDING; `/dashboard/process` SALARY_CHANGE; `/org-director/advisor` CAPABILITY_GAP; `/admin/mfa-policy` RTL_BANK; `/me` i codici dei ruoli | R4 |
| T4 | Lo stato non è l'ultima colonna | `/approvals`, `/time-off`, `/content`, `/learning/training-initiatives`, `/engagement`, `/provenance`, `/org-director/health`, `/seed-acquisition/runs`, `/performance`, `/me/learning`, `/me/approvals`, `/me/time-off`, `/me/positions` | R3 |
| T5 | Il codice tecnico è la prima colonna, prima del nome | `/positions` (POS-00000288), `/processes`, `/skills`, `/learning`, `/job-catalog`, `/organization`, `/skill-taxonomy`, `/career-succession`, `/me/kpis` | R2 |
| T6 | Persone scritte «Nome Cognome» e ordinate per nome | `/users` (ordine per email), `/time-off` colonna Dipendente | R1 |
| T7 | Colonne che non servono a chi guarda | `/users` email e «Tipo: Standard»; `/me/documents` URI e Tipo MIME; `/me/certifications` Credential ID; `/positions` senza titolare, unità e sede | R2 |
| T8 | Inglese e termini di lavoro mescolati all'italiano nei dati | `/time-off`: «bereavement Accrual Policy», «Year-end adjustment», «leave_request» | R4 |
| T9 | Termini diversi per la stessa cosa nella barra laterale e nei titoli | «Console», «Cruscotto», «Dashboard»: unificati dalla PR #213 (thread «Riordinare la sidebar di advanced») | R7 |

## 2. Il controllo automatico

`apps/web/tests/e2e/interfacce-intelligenti.spec.ts` con le regole in `interfacce-intelligenti.regole.ts` e il registro `interfacce-intelligenti.debiti.json`. Il registro di partenza è la misura del §1 (26 pagine, 16 con almeno un rilievo). Il controllo statico delle etichette (`pnpm i18n:check`) resta quello esistente.

## 3. I blocchi

Ogni blocco è una PR in bozza, provata su un banco usa-e-getta della VM con una persona vera di RTL, con il registro accorciato nella stessa PR e una riga di esito qui sotto.

| id | blocco | pagine | stato |
|---|---|---|---|
| B0 | Repertorio, controllo a cricchetto, questo piano | `docs/kb/xtras/INTERFACCE_INTELLIGENTI.md`, `.claude/rules/interfacce-intelligenti.md`, spec e registro | in revisione nella PR del blocco B1 |
| B1 | Utenti, primo esempio | `/users` (API `GET /v1/users` con ruolo, unità, sede, tenant, ordine per cognome, filtro tenant per la piattaforma; pagina con Cognome, Nome, Ruolo, Sede, Stato; «158 persone»; paginazione del server) | scritto; CI e banco da chiudere |
| B2 | Organizzazione | `/positions` (titolare, unità, sede; criticità leggibile; numero coerente), `/organization`, `/organization/org-chart`, `/job-catalog`, `/admin/roles` (nomi dei ruoli al posto dei codici) | da fare |
| B3 | Processi e approvazioni | `/processes`, `/process-owner`, `/approvals`, `/me/approvals`, `/dashboard/process` | da fare |
| B4 | Persone e presenze | `/time-off`, `/me/time-off`, `/engagement`, `/content`, `/me/documents`, `/me/certifications` | da fare |
| B5 | Talento e competenze | `/skills`, `/skill-taxonomy`, `/learning`, `/learning/training-initiatives`, `/me/learning`, `/me/learning/catalogue`, `/career-succession`, `/performance`, `/talent-review`, `/me/positions`, `/me/kpis` | da fare |
| B6 | Analisi e cruscotti | `/dashboard/*`, `/org-director/*`, `/analytics/*`, `/insights` | da fare |
| B7 | Configurazione e piattaforma | `/tenants`, `/blueprints`, `/tenant-blueprints`, `/visualizations`, `/seed-acquisition/runs`, `/provenance`, `/generated-origins`, `/consolidation`, `/admin/mfa-policy` | da fare |
| B8 | Caselle di scelta e selettori di persone in tutto il prodotto | `person-picker`, filtri di stato, selettori di ruolo: R1, R4, R6 | da fare |

## 4. Fuori da questo ciclo, da proporre una volta sola

- Le 9 utenze «Collaudo …» del tenant RTL sono visibili a chi amministra il tenant (già G-5 del giro forense del 6/11): dove devono vivere è una scelta di Enzo.
