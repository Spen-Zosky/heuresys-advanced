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
| B0 | Repertorio, controllo a cricchetto, questo piano | `docs/kb/xtras/INTERFACCE_INTELLIGENTI.md`, `.claude/rules/interfacce-intelligenti.md`, spec e registro | unito con la PR #215 (23adfa40) |
| B1 | Utenti, primo esempio | `/users` (API `GET /v1/users` con ruolo, unità, sede, tenant, ordine per cognome, filtro tenant per la piattaforma; pagina con Cognome, Nome, Ruolo, Sede, Stato; «158 persone»; paginazione del server) | CI verde su 9496524; banco provato il 10/11 alle 14:09-14:21 Roma (§3.1); sì di Enzo al repertorio alle 14:36 Roma; unito con la PR #215 (23adfa40), nel rilascio unico con #213 e #216 |
| B2 | Organizzazione | `/positions` (titolare, unità, sede; criticità leggibile; numero coerente), `/organization`, `/organization/org-chart`, `/job-catalog`, `/admin/roles` (nomi dei ruoli al posto dei codici) | scritto nella PR #220, da provare dal vivo dopo il rilascio: `/positions` con Posizione, Titolare, Unità, Sede, Criticità in parole, Stato e «N posizioni attive»; `/organization` per nome con Nome, Tipo, Unità superiore, Stato e senza codice; `/job-catalog` per nome senza codice e con il totale del server («200 di N» se la tabella ne mostra meno); `/admin/roles` con il permesso in parole («Utenti · leggere») e il codice solo al passaggio del mouse; `/organization/org-chart` è un grafico senza tabella, si guarda solo dal vivo |
| B3 | Processi e approvazioni | `/processes`, `/process-owner`, `/approvals`, `/me/approvals`, `/dashboard/process` | provato dal vivo il 2026-11-11 (§3.3), PR #231: `/approvals` e `/me/approvals` con lo stato in coda; `/processes` e `/process-owner` senza colonne del codice, tipo «Essenziale»/«Facoltativo» con lo stesso termine nelle due pagine, ruoli RACI in italiano; `/dashboard/process` è generata dal server, si guarda dal vivo |
| B4 | Persone e presenze | `/time-off`, `/me/time-off`, `/engagement`, `/content`, `/me/documents`, `/me/certifications` | provato dal vivo il 2026-11-11 (§3.3), PR #231: `/time-off` persona «Cognome, Nome», tipi di movimento e riferimento in parole, «Stato» per le regole; `/engagement` e `/content` stato in coda; `/me/*` senza rilievi del cricchetto |
| B5 | Talento e competenze | `/skills`, `/skill-taxonomy`, `/learning`, `/learning/training-initiatives`, `/me/learning`, `/me/learning/catalogue`, `/career-succession`, `/performance`, `/talent-review`, `/me/positions`, `/me/kpis` | provato dal vivo il 2026-11-11 (§3.3), PR #231: `/performance` stati in parole e in coda, persona valutata per nome; `/learning/training-initiatives` stato in coda; `/career-succession` senza codici, difficoltà e prontezza in parole |
| B6 | Analisi e cruscotti | `/dashboard/*`, `/org-director/*`, `/analytics/*`, `/insights` | provato dal vivo il 2026-11-11 (§3.3), PR #231: `/org-director/health` stato in coda; le pagine `/dashboard/*` sono generate dal server, si guardano dal vivo |
| B7 | Configurazione e piattaforma | `/tenants`, `/blueprints`, `/tenant-blueprints`, `/visualizations`, `/seed-acquisition/runs`, `/provenance`, `/generated-origins`, `/consolidation`, `/admin/mfa-policy` | provato dal vivo il 2026-11-11 (§3.3), PR #231: `/tenants`, `/blueprints`, `/visualizations` senza codici e con stato in parole; `/provenance` e `/seed-acquisition/runs` stato in coda (la corsa tiene il suo codice come nome) |
| B8 | Caselle di scelta e selettori di persone in tutto il prodotto | `person-picker`, filtri di stato, selettori di ruolo: R1, R4, R6 | provato dal vivo il 2026-11-11 (§3.3), PR #231: `etichettaPersona` scrive «Cognome, Nome» in tutte le caselle di scelta di persone, con prova unitaria |

### 3.3 Dimostrazione dei blocchi B3-B8, 2026-11-11 18:14-19:29 Roma

Banco della #227 (`scripts/banco-verifica.sh su b3b8`) su una copia del database dalla copia di fase più recente, in un cluster privato. Produzione, `heuresys_advanced` e `heuresys_ci` non sono stati toccati. Accesso come Valentina Conti (hrManager) e come amministratore di piattaforma.

- Primo giro su f18ad7b8, alle 18:14-18:16: 29 verdi e 1 rosso. Il rosso era /time-off, dove la colonna Origine, aggiunta da EntityTable, veniva dopo lo Stato. In più, a vista: il titolo di /tenants diventava «intera azienda», e c'erano «1 persone», «16 run» e «Engagement & Sondaggi».
- Correzioni (74231c32, caeefeb4, 0bf9ecb3):
  - in EntityTable la colonna Origine ora entra prima dello Stato;
  - la rete di leggibilità non cerca più fra i codici le parole con la maiuscola iniziale (prova unitaria rossa prima e verde dopo);
  - testi corretti: «1 persona», «esecuzioni», «Clima e sondaggi», «Rilevazione rapida»;
  - il cricchetto R5 legge il totale solo dall'h1 e dalla riga `*-count`, perché le schede di sintesi davano falsi rossi su sette pagine.
- Controllo a vista su caeefeb4, alle 18:51-18:52:
  - /time-off ha le colonne «… | Origine | Stato»;
  - /tenants ha il titolo «Tenant»;
  - «intera azienda» non compare in nessuna delle 22 pagine guardate;
  - /seed-acquisition/runs dice «16 esecuzioni»;
  - /engagement ha il titolo «Clima e sondaggi».
- Giro finale su 0bf9ecb3, alle 19:27-19:29: `interfacce-intelligenti.spec.ts` e `admin-org-bpm.spec.ts` 30/30 verdi, 0 rilievi. Il registro dei debiti è tutto vuoto.
- Restano dati in inglese o di collaudo (titoli dei sondaggi, sessioni di calibrazione, percorsi di carriera, varianti di impianto, residui E2E in /content). Sono stati passati al thread dell'agente bancario.

### 3.2 Dimostrazione del blocco B2, 2026-11-11 01:15-01:17 Roma

Banco: dump della copia di fase `20261110-prima-rilascio-18917d19` ripristinato in un cluster privato sulla VM (porta 5442, database `heuresys_prova_b2`), ramo della PR #220 a 55789c4b, API e web di produzione su porte di prova; niente creato nel cluster di produzione, copia eliminata a fine prova. Login reale come Valentina Conti e come utente di piattaforma.

- `/positions`: «158 posizioni attive» e «1–25 di 158»; colonne Posizione, Titolare, Unità, Sede, Criticità, Stato; prima riga «Addetto Amministrazione del Personale | Bruno, Marco | Ufficio Amministrazione del Personale | Sede Centrale Milano»; l'ordine per titolo continua in pagina 2; «Mostra» offre Tutte (316), Attive (158), Non attive (158), e parte da Attive. Per la piattaforma «161 posizioni attive», colonna Tenant e casella «Tutti, Heuresys System, RTL Bank».
- `/organization`: «42 unità», Nome, Tipo, Unità superiore, Stato, ordine per nome, nessun codice. Rilievo: «AREA» e «General management» nel tipo, corretti dopo la prova con le etichette italiane dei tipi mancanti.
- `/job-catalog`: 16 famiglie e 142 ruoli per nome, senza codice.
- `/admin/roles`: «24 ruoli · 250 permessi · 1317 abbinamenti», permessi in parole. Rilievo: «BRANCH_MANAGER» e «agent_conversation · use» in codice, corretti dopo la prova.
- `/users`: «158 persone», «Tutte le utenze» in testa alla casella.
- Cricchetto, `admin-lists` e `admin-org-bpm` contro il banco: 32 passati, 0 falliti.

Fuori da questo blocco, da guardare nei dati: 158 posizioni non attive accanto a 158 attive (possibili posizioni storiche doppie); criticità vuota sulle posizioni viste; ruoli del catalogo senza famiglia o livello e con nomi in minuscolo.

### 3.1 Dimostrazione del blocco B1, 2026-11-10 14:09-14:21 Roma

Banco: copia di prova sulla VM al commit 9496524, database ripristinato dal dump delle 03:42 del 10/11 (`~/backup-hr/copie-fase/20261110-prima-rilascio-20261110/database.dump`) in un cluster PostgreSQL privato, migrazioni del ramo applicate; API e web in build di produzione su porte libere. Il database usa-e-getta `heuresys_prova_utenti_b1`, creato con il sì di Enzo delle 11:44, è stato eliminato a fine prova; `heuresys_advanced` e `heuresys_ci` non sono stati toccati.

- Valentina Conti (TENANT_ADMIN, HRMS_MANAGER di RTL Bank), login reale: titolo «Utenti, 158 persone»; colonne Cognome, Nome | Ruolo nell'organizzazione | Sede | Stato; prime righe Amato, Gabriele | Gestore Piccole Imprese, Filiale Sesto San Giovanni | Sede Centrale Milano | Attivo, poi Barbieri, Paolo; Barbieri, Pietro; Barbieri, Riccardo; Bellini, Quintino; Benedetti, Roberta; Bernardi, Antonio; Bianchi, Luca (Centro Operativo Assago); Bianco, Valentina (Filiale Brescia Centro); Bruno, Ilaria. La seconda pagina continua l'ordine (Colombo, Filippo poi Colombo, Gabriele). «Mostra: Utenze di servizio» porta il titolo a «9 utenze di servizio» con «Nessuna posizione attiva». Nessuna casella Tenant per lei.
- platform-test-admin (PLATFORM_ADMIN): casella Tenant con «Tutti», «Heuresys System», «RTL Bank»; «Tutti» dà 161 persone con la colonna Tenant prima di Stato; «RTL Bank» dà 158, lo stesso numero di Valentina.
- Prove: `admin-lists.spec.ts` verde; il cricchetto con Valentina 27 verdi e 1 rosso su `/performance` (R3, «Stato» colonna 4 di 6: debito già presente, mancava nel registro, ora registrato). Debito pagato autentico: `/positions` R5, tolto dal registro.
- Correzioni nate dal banco (stessa PR): persona `hrManager` (Valentina Conti) per il cricchetto, perché `tenantAdmin` (federica.marchetti) dopo ADR-0050 è CEO senza TENANT_ADMIN e riceve «Non hai accesso» su 12 pagine su 27; il cricchetto ora è rosso su una pagina negata invece di passare senza misurare; l'unità sotto il ruolo non si ripete quando il titolo la contiene già.

## 4. Fuori da questo ciclo, da proporre una volta sola

- La persona `tenantAdmin` delle prove E2E (federica.marchetti) non ha più TENANT_ADMIN nei dati di produzione (ADR-0050): le spec che la usano come amministratrice del tenant vanno riviste contro un dump recente.
- Le 9 utenze «Collaudo …» del tenant RTL sono visibili a chi amministra il tenant (già G-5 del giro forense del 6/11): dove devono vivere è una scelta di Enzo.
