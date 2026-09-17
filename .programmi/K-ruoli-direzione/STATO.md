# STATO — Mandato K v2 (ruoli senza titolare e direzione del dato)

Mandato: `.programmi/mandati/K-mandato-v2.md` (copia CRLF del testo di Enzo/Cowork del 2026-09-14).
Come si legge e si riprende: sezione 3 del mandato. Questo file lo legge `tools/dove_siamo.py`.

Forma di una riga: `| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |`
Stati ammessi: `BLOCCATA(Dn)` · `BLOCCATA(fase)` · `PRONTA` · `IN CORSO` · `SOSPESA` · `ATTESA_ENZO(motivo)` · `CHIUSA` · `RITIRATA`.
`presa_da` = contenuto di `.handoff/session-id`. `ultimo_passo_chiuso` = numero univoco del passo nel mandato.
L'ORDINE DELLE RIGHE E' L'ORDINE DI ESECUZIONE: `dove_siamo.py` prende la prima `PRONTA` dall'alto.

## S1105 — Parte A: i due rimedi al guardiano (precede F0, mandato `MANDATO_S1105_guardiano-e-primi-ruoli.md`)

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| A0 | ATTESA_ENZO(margine: proposto 1 punto percentuale) | S1105 | 2026-09-17T02:20+02:00 | A0.3 |  |  | esiti/A0_margine_del_pavimento.md; evidenze/A0_output_202609170*.txt | 90° percentile aggregato dei salti su 4 transcript K reali (d6e7f53b/c8873c8b/218d2692/abbcdb70) = 2.880 tok = 0,29% → arrotondato per eccesso 1 punto. Non si applica da solo: si prosegue con A2 senza aspettare |
| A2 | CHIUSA | S1105 | 2026-09-17T02:35+02:00 | A2.3 |  |  | .programmi/mandati/K-mandato-v2.md, riga V4 emendata | terzo momento di misura aggiunto a V4 (prima di ogni operazione che si sa lunga: verify_gate/batteria prove, allineamento gemello, ciclo di correzioni, applicazione migrazione) + regola «se il guardiano dice di chiudere, la chiusura è l'ultimo atto»; nota che cita il caso del 17/9 (74,8%→87,3% in 48 min senza misura) |
| A3 | BLOCCATA(A1) | S1105 | 2026-09-17T02:45+02:00 | A3-censimento |  A3.1 |  | esiti/REGISTRO_SCOPERTE.md (riga 2026-09-17) | censimento fatto ORA: fonte e copia advanced identiche (46.195 byte, diff vuoto); copia heuresys-datastore diversa (41.758 byte, 30/08) e NON toccata, solo registrata. Resta A3.1 (copiare la fonte emendata) dopo A1 |
| A5 | CHIUSA | S1105 | 2026-09-17T04:22+02:00 | A5.3 |  |  | esiti/A5_costo_di_un_ruolo.md (~97.500 token / ~9,8 punti, misurato su R-9); .programmi/mandati/K-mandato-v2.md riga 17 corretta | UNA misura su UNA voce, dichiarata come tale nel file; non riscritte le altre stime (nessun dato per farlo) |
| A1 | ATTESA_ENZO(margine A0) | | | | A1.1 |  |  | il margine dentro guardiano.py, verdetto a tre stati; SOLO dopo risposta di Enzo su A0 |
| A4 | ATTESA_ENZO(margine A0) | | | | A4.1 |  |  | emendare la sezione IL GUARDIANO di ~/.claude/CLAUDE.md; SOLO dopo A1 e A2 |

## F0 — Fondazione

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| F0.1 | CHIUSA | S1102 | 2026-09-14T22:30 | 4 | | | evidenze/baseline_202609142237.txt (prova di misura_k.py); dove_siamo.py exit 0 | stato e strumenti; dove_siamo.py stampa una PRONTA (post-condizione passo 4) |
| F0.5 | CHIUSA | S1102 | 2026-09-14T22:39+02:00 | 5 |  |  | evidenze/F0.5_controprova.txt; esiti/F0.5_sola_lettura.md | q.py: sola lettura per costruzione (READ ONLY dal server), non per privilegio; heuresys senza CREATEROLE; heuresys_ro NOLOGIN e senza pay_slips |
| F0.6 | CHIUSA | S1102 | 2026-09-14T22:44+02:00 | 6 |  |  | esiti/F0.6_migrazioni.md | runner=catena intera in ordine lessicale, nessun rifiuto dei buchi; registro sys_schema_migrations (411=411); via: scp+prova-idempotenza sul gemello, pg_dump_pre_k.sh sulla VM, push, pnpm db:migrate:vm; nessuna vista sys.v_* con righe |
| F0.7 | CHIUSA | S1102 | 2026-09-14T22:47+02:00 | 11 |  |  | workflows/W0..W5 (6 file); sintassi provata come corpo async | W0-W4 estratti dal mandato byte per byte (tools/estrai_workflows.py); W5 = W1 con INDAGINI→3 ipotesi e critico→sommatore+verificatore; la prova vera e' il primo lancio di W0 |
| F0.2 | CHIUSA | S1102 | 2026-09-14T22:51+02:00 | 8 |  |  | evidenze/wf_F0.2_7_202609142251 (_VERIFICATO.txt); esiti/F0.2_censimento_C1.md | W0 12/12 agenti, 6/6 spie trovate (2 accettate su prova numerica), 5 discrepanze ri-misurate in linea; nessuna cella non cercata |
| F0.3 | CHIUSA | S1102 | 2026-09-14T23:18+02:00 | 9 |  |  | evidenze/baseline_202609142318.txt; evidenze/F0.3_controprova.txt (exit 2) | baseline ufficiale: 14/231/0/102/160/80/70959/000414/248 tabelle; guardia vista ROSSA (exit 2, nessun file scritto) e ripristinata |
| F0.4 | CHIUSA | S1103 | 2026-09-15T01:33+02:00 | 10 |  |  | esiti/F0.4_ripresa.md; evidenze/F0.4_ripresa_s2_202609150135.txt | meccanismo di ripresa PROVATO su 4 casi + effetto ritirato (S1102 a caldo, S1103 a freddo); session-id CAMBIA fra sessioni -> R3(a) non esiste, si riprende via R3(c); dove_siamo.py corretto sui file _rollback_di_ |
| K-PROVA | RITIRATA | S1103 | 2026-09-15T01:33+02:00 |  |  | 000415 000416 000417 | pg_dump_snapshots/pre-K-K-PROVA_08e1614_20260914_2325.dump (VM, 138 MB); prova generale verde (verify_gate migrate-idempotent 61s) | prova del meccanismo, passata il 2026-09-15; 000415 crea, 000416 ritira (rinomina), 000417 nata incompleta e completata vuota: i tre file restano (V5) |

## F1 — Indagini (nessuna scrittura)

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| I-A | CHIUSA | S1103 | 2026-09-15T01:48+02:00 | 13 |  |  | esiti/I-A.md; evidenze/I-A_passo13_202609150323.txt; test K I-A/13 in tenant-blueprint-application.integration.test.ts | le personalizzazioni SI CONSERVANO per assenza di tocco (0 occorrenze di override nella materializzazione; solo CASCADE puo' toglierle); registro generato a 0 righe; prova su copia verde 5/5 e rossa con sabotaggio; SBLOCCA K1-ADR |
| I-B | CHIUSA | S1103 | 2026-09-15T01:48+02:00 | 14 |  |  | esiti/I-B.md; evidenze/I-B_famiglie_202609150326.txt | 4 modi fisici su 13 tabelle; canonico = B (tenant_id nullable + is_global) realizzato solo da sys_skills (14.003/28); A 6 cataloghi, C 2 da completare, D 4 template gia' del tenant; registro generato vuoto; SBLOCCA K1-ADR |
| I-C | CHIUSA | S1103 | 2026-09-15T01:48+02:00 | 16 |  |  | esiti/I-C.md; evidenze/I-C_siti_202609150328.txt; esiti/controlli-per-nome.baseline.json | 81 siti (passo 15) + 12 (passo 16, moduli di PEOPLE_MANAGER/DATA_STEWARD da I-E) = 93; (b) ~21, copie locali 9, (c) ~63; baseline S-5 = 102 file / 327; SBLOCCA R-1 |
| I-D | CHIUSA | S1103 | 2026-09-15T01:48+02:00 | 17 |  |  | esiti/I-D.md; evidenze/I-D_rimisure_202609150300.txt; wf_F1_W1_202609150148(_b) | 682 righe importate poi modificate (tutte in blocco, 0 gesti individuali); divario presenze 3.045/5.199 SPIEGATO (2.154 id spariti); 11 tabelle con orfani (15.054); SBLOCCA S-3 e X-3; X-6 eredita 118.446 presenze senza provenienza |
| I-F | CHIUSA | S1103 | 2026-09-15T01:48+02:00 | 19 |  |  | esiti/I-F.md; evidenze/I-F_rimisure_202609150308.txt | ricetta 29 file (8 sempre + 4 persona + test); test di deriva NON scatta su role-codes.ts (provato) -> prima voce di F4 = ripararlo; nessuna colonna di ritiro (R-1 passo 0 confermato) e cache RBAC caricata all'avvio senza WHERE |
| I-G | CHIUSA | S1103 | 2026-09-15T01:48+02:00 | 20 |  |  | esiti/I-G.md; wf_F1_W1_202609150148_b | 24 porte GET in 10 moduli (<40: R-0 = 1 sessione); nessun asse utente-clienti (sys_users.tenant_id NOT NULL); nessun punto unico: 20 file + resolver 87/140/200 -> R-0 lo costruisce in actor.ts; tenant-blueprints 7 porte senza filtro |
| I-E | CHIUSA | S1103 | 2026-09-15T03:31+02:00 | 23 |  |  | esiti/I-E.md; evidenze/wf_I-E_22_202609150331_b (_VERIFICATO.txt); evidenze/I-E_rimisure_202609151627.txt | 245/245 tabelle: nativo 28, importato 88, ibrido 97, infrastruttura 32; 103 dubbie per X-1 (ATTESA_ENZO in F5); righe_con_provenienza ri-misurata in linea (i lettori davano 0); SBLOCCA X-0, X-1 |
| D5 | CHIUSA | S1103 | 2026-09-15T15:05+02:00 |  |  |  | esiti/RISPOSTE_ENZO.md (riga «D5 · 2026-09-15 · C»); esiti/I-D.md (in cima) | RISPOSTA DI ENZO: C - l'importazione non tocca i saldi con gesto nativo aperto, il conflitto va nel registro e lo chiude il DATA_STEWARD; ragione da riportare nell'ADR di X-4 (I-D: 0 conflitti persona/import oggi). Sblocca X-4 e X-5 |

## F2 — Sentinelle e cancelli che sanno fallire

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| S-1 | CHIUSA | S1103 | 2026-09-15T20:21+02:00 | 25 |  | 000418 | evidenze/S-1_202609152117.txt; db/migrations/000418 | vista nasce VERDE per allowlist (102 codici espliciti); vista ROSSA (1) con permesso finto in transazione e ROLLBACK; applicata in produzione 2026-09-15 21:13; snapshot pre-K-S-1-S-3 |
| S-2 | CHIUSA | S1103 | 2026-09-15T16:36+02:00 | 26 |  |  | evidenze/S-2_202609151636.txt; apps/api/test/permessi-senza-rotta.{integration.test.ts,allowlist.json} | 34 permessi senza rotta congelati con motivo (5 user_position_assignment:* in attesa di G-1); test visto ROSSO (riga tolta) e VERDE; d'integrazione perche' il catalogo e' il DB (deviazione dichiarata) |
| S-5 | CHIUSA | S1103 | 2026-09-15T16:40+02:00 | 29 |  |  | evidenze/S-5_202609151640.txt; apps/api/test/unit/controlli-per-nome.ratchet.unit.test.ts + baseline.json | baseline 102 file / 327 controlli; uguaglianza stretta per file (sopra = rosso, sotto = aggiorna baseline); visto ROSSO (controllo aggiunto in leads) e VERDE |
| S-3 | CHIUSA | S1103 | 2026-09-15T20:21+02:00 | 27 |  | 000419 | evidenze/S-3_202609152117.txt; db/migrations/000419 | nasce ROSSA con 11 tabelle (= I-D), INFORMATIVE in db_health con motivo X-6; controprova: riga finta verso sys_job_families 11->12 orfani; applicata in produzione con 000418 |
| S-4 | CHIUSA | S1103 | 2026-09-15T18:38+02:00 | 28 |  |  | evidenze/S-4_202609151838.txt; apps/api/test/skill-aliases-isolation.integration.test.ts | 6 prove verdi (404 anti-enumerazione su create/patch/delete/list, 403 GLOBAL_SKILL_ALIAS_ADMIN_ONLY, controllo positivo 201) + it.skip USER->403 attivo dopo R-3; rossa con tenant A sabotato; il buco annunciato non c'e' |

## F4.0 — Riparazione del test di deriva (eseguita fuori sequenza su istruzione di Enzo, 2026-09-16: prima di F3, perche' e' la rete di sicurezza su cui poggia F4)

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| F4.0 | CHIUSA | S1104 | 2026-09-16T02:15+02:00 | 0 |  |  | apps/api/test/unit/role-codes-drift.unit.test.ts; apps/api/test/role-codes-db-drift.integration.test.ts; evidenze/F4.0_controprova_*_{ROSSO,VERDE}.txt; evidenze/F4.0_verify_gate_run{,2,3}.txt (RED→RED→GREEN) | Due test nuovi (role-codes.ts ↔ role-precedence.ts+roles-editor.tsx, in linea; role-codes.ts ↔ sys_auth_roles, via q.py+pool). Controprova (ruolo finto RUOLO_FINTO_K_F40 solo in role-codes.ts): ROSSO su entrambi, VERDE dopo il ripristino. Trovata e riparata una deriva VERA preesistente: roles-editor.tsx non aveva BRANCH_MANAGER (mig. 000272) da settimane, nessun cancello se n'era accorto. Trovato e riparato un buco nel guardiano stesso: ne' verify_gate.py instradava test-api su un tocco ai soli due file web, ne' prova-api-sul-gemello.sh li propagava al gemello (PERCORSI), ne' la quotatura del comando remoto reggeva un path con `(` `)` `[` `]` (fix: printf '%q'). Batteria intera verify_gate.py: GREEN (test-api 1330.8s sul gemello, 8 suite instradate) |

## F3 — ADR e invariante

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| X-0 | CHIUSA | S1104 | 2026-09-16T22:55+02:00 | 32 |  |  | docs/architecture/adr/0041_direzione_del_dato.md (ACCETTATO); I23 in CLAUDE.md; wf_F3_32_202609160217, wf_F3_32b_202609160241, wf_F3_32c_202609162236 (tutte _VERIFICATO.txt); esiti/F3_terzo_giro_W3.md | 3 giri di W3 (13+9+11=33 confutazioni, tutte confermate e corrette, zero di sostanza). Terzo giro lanciato con guardiano sotto il 50% (16.8%/7.0%), per istruzione di Enzo del 2026-09-16. RATIFICATO |
| K1-ADR | CHIUSA | S1104 | 2026-09-16T22:55+02:00 | 32 |  |  | docs/architecture/adr/0042_catena_del_semilavorato.md (ACCETTATO); wf_F3_32_202609160217, wf_F3_32b_202609160241, wf_F3_32c_202609162236 (tutte _VERIFICATO.txt); esiti/F3_terzo_giro_W3.md | stessa nota di X-0: 3 giri W3, 33 confutazioni corrette, zero di sostanza. RATIFICATO |

## F4 — I ruoli, uno per migrazione

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| R-1 | CHIUSA | S1104 | 2026-09-16T14:16+02:00 | 34 |  | 000420 | migrazione 000420 (prod+gemello); mandati.ts (+ruoliHannoMandatoPiattaforma); cache-loader.ts filtrato; 15/15 siti (b) + copie locali sostituiti su 9 file (skills 2/6, gdpr 2, skill-categories 1, skill-families 1, tenant-materialization 1, delegations 1, auth 2, process-kpi-templates 2, content-blueprint-links 1); baseline S-5 102/327→94/306; esiti/R-1_passo34.md; verify_gate.py run GREEN (programmi/typecheck/test-api, test-api 1149.5s sul gemello) | Passo 0 e passo 34 CHIUSI. I ~63 siti (c) (perimetro multi-tenant, coincidenti con le 24 porte di I-G) restano isPlatform/idiomi locali per decisione tecnica di questa sessione: li porta al resolver R-0, che costruisce anche il punto unico — vedi esiti/R-1_passo34.md. Un flake non correlato (semantic-matching, dati-dipendente, verde in isolamento e nella corsa finale) registrato in REGISTRO_SCOPERTE, non ha bloccato la chiusura |
| R-0 | CHIUSA | S1104 | 2026-09-17T01:53+02:00 | 38 |  | 000421 (applicata in produzione E sul gemello) | migrazione 000421; esiti/R-0_porte.md, esiti/R-0.md; apps/api/src/lib/actor.ts (perimetroClienti/puoVedereCliente); test/unit/perimetro-clienti.unit.test.ts (6/6); modulo platform-tenant-assignments (3 rotte, 4 test); baseline S-5 aggiornata (93 file); TRE difetti trovati e corretti dalla prova generale stessa: z.coerce.boolean() → queryBoolean() (#209), permesso senza rotta (S-2), migrazione 000421 mancante sul DB persistente del gemello (applicata con db/scripts/migrate.sh); `verify_gate.py run` GREEN su HEAD 02a1215e (poi f8d7e560 = solo il fix #209, stesso contenuto testato), 1496s | 12/24 porte collegate + modulo di assegnazione completo; 9 chiuse per costruzione (tenant-materialization, observability, tenant-blueprints) rinviate a R-9/R-5; 3 (content-blueprint-links) fuori perimetro per ScopeFilter condiviso — dettagli in esiti/R-0.md. Nota per la prossima sessione: il DB del gemello e quello di CI (heuresys_ci) sono DUE database distinti sulla stessa macchina — una migrazione applicata all'uno non tocca l'altro; verificarli entrambi dopo ogni migrazione nuova |
| R-9 | CHIUSA | S1105 | 2026-09-17T04:20+02:00 | 53 |  | 000422 | esiti/R-9.md; apps/api/test/platform-operator-and-sales.integration.test.ts (8/8 verdi, incl. prova sul vivo R-0: 0 righe senza assegnazione, 70.959 dopo, 0 dopo revoca); controprova rossa-poi-verde su SALES/observability:read; test di deriva 3+2 verdi; verify_gate.py run GREEN (test-api 1476s, tutta la suite) | migrazione applicata su prod+gemello; persone di collaudo provisionate su prod+gemello; 2 regressioni RBAC storiche trovate dalla prova generale e corrette (TENANT_ADMIN-ALLOWLIST-EXTEND, PROXY_EXTENDED_AUDIENCE) — dettaglio in esiti/R-9.md |
| R-2 | BLOCCATA(fase) | | | | 39 | | | DPO; UNICO ritiro ammesso: HRMS_MANAGER / gdpr:erase (D3=A); rollback scritto PRIMA |
| R-3 | BLOCCATA(fase) | | | | 45 | | | TAXONOMY_STEWARD lato cliente + skill_alias:manage (D1=B; dopo K1-ADR) |
| R-7 | BLOCCATA(fase) | | | | 54 | | | SECURITY_ADMIN (ruolo di cliente; non usa l'asse di R-0) |
| R-10 | BLOCCATA(fase) | | | | 49 | | | spezzare job-requisition:manage in sei permessi |
| R-4 | BLOCCATA(fase) | | | | 50 | | | RECRUITER + HIRING_MANAGER con perimetro organigramma (D8=A) |
| R-5 | BLOCCATA(fase) | | | | 51 | | | BLUEPRINT_MANAGER completato, PROCESS_OWNER separato (dopo K1-ADR, R-0, R-9) |
| R-8 | BLOCCATA(fase) | | | | 55 | | | IMPLEMENTATION_CONSULTANT (dopo R-0, R-9, K1-ADR) |
| R-6 | BLOCCATA(fase) | | | | 56 | | | PEOPLE_MANAGER e DATA_STEWARD: SOLO creare i due ruoli nuovi (dopo X-1 ratificata) |
| R-6-separazione | RITIRATA | | 2026-09-14 | | | | | D2=A: HRMS_MANAGER resta plenipotenziario, I22 invariato |
| R-11 | BLOCCATA(fase) | | | | 58 | | | prove negative trasversali (matrice ruolo x modulo) |

## F5 — Direzione del dato

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| X-1 | BLOCCATA(fase) | | | | 59 | | | classificazione ratificata (D6=A); righe dubbie → ATTESA_ENZO |
| X-2 | BLOCCATA(fase) | | | | 61 | | | colonna origine_dato sulle 11 tabelle; sys_attendance → ATTESA_ENZO |
| X-3 | BLOCCATA(fase) | | | | 63 | | | registro riconciliato PER VISTA (dopo I-D, S-3) |
| X-4 | BLOCCATA(fase) |  |  |  | 64 |  |  | regola degli ibridi: D5=C (Enzo 2026-09-15). Dopo X-1, X-2 |
| X-5 | BLOCCATA(fase) |  |  |  | 65 |  |  | sentinella della direzione (dopo X-2, X-4); D5=C recepita |
| X-6 | BLOCCATA(fase) | | | | 66 | | | indagine presenze senza provenienza (W5) |

## F6 — Il gesto

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| G-1 | BLOCCATA(fase) | | | | 67 | | | assegnazione persona↔posizione via approvazioni (D4=B; dopo R-6, X-2) |

## Perimetro di sessione dichiarato

- S1102 (2026-09-14): mandato = da F0 a F2 compresa; NON entra in F3-F6. Fermate obbligatorie: (a) chiusura di I-D → rapporto a Enzo per D5; (b) chiusura di F2.
- F0.4 chiude e riapre la sessione per costruzione (sezione 3.5): la sessione che la prende termina con la voce IN CORSO e la successiva la completa.
- D5 non si decide mai dalla CLI, nemmeno con zero conflitti.
- S1103 (2026-09-15): stesso perimetro F0-F2, stesse fermate. F0 CHIUSA. Deroga registrata (REGISTRO_SCOPERTE, su istruzione di Enzo): il controllo `spiaTrovata` di W1/W2/W5 accetta anche il NUMERO alterato, oltre alla stringa del comando.
- S1103 (2026-09-15, chiusura): F0, F1, F2 CHIUSE; D5 = C recepita. FERMATA (b) raggiunta: il mandato prosegue da F3 (X-0, K1-ADR) in una sessione nuova. Fuori mandato ma aperto: il cancello test-api e' ROSSO sul gemello per il fattore TOTP di enzo.spenuso (REGISTRO_SCOPERTE, decisione di Enzo).
- S1104 (2026-09-16): mandato = F4.0 (fuori sequenza, ordine di Enzo) → F3 (X-0, K1-ADR) → R-1. F4.0 CHIUSA e verificata. X-0/K1-ADR: due giri di confutazione W3 (22 confutazioni, tutte confermate e corrette), in ATTESA_ENZO con nota onesta sul terzo giro non lanciato. R-1: passo 0 CHIUSO e verificato (migrazione 000420, mandati.ts, cache-loader.ts, prova rossa-verde); passo 34 iniziato (2/~21 siti) ma non finito — SOSPESA, non CHIUSA. Chiusura per guardiano ~68% contesto (sotto il 75%, ma il margine residuo non basta per altri siti verificati con rigore). Trovati e corretti in sessione, non del mandato: bug di quotatura shell in prova-api-sul-gemello.sh (percorsi con parentesi/parentesi quadre), lock stantio di verify_gate.py su PID riassegnato da Windows, migrazione applicata alla copia di prova del gemello ma non al suo DB persistente, tuple morte + tabella mai analizzata dopo il lavoro di stanotte.
- S1104 (2026-09-16, ripresa nella stessa giornata): perimetro dichiarato = riparazione I-F (già chiusa, verificata) → Fase 3 (già in ATTESA_ENZO, non ri-toccata) → chiusura di R-1. Ripresa R-1 come voce orfana (SOSPESA, R3(c) del meccanismo di ripresa) da `ultimo_passo_chiuso=33, prossimo_passo=34`. Sostituiti i restanti 17 siti (b)/copie locali su 9 file (`skills`, `gdpr`, `skill-categories`, `skill-families`, `tenant-materialization`, `delegations`, `auth`, `process-kpi-templates`, `content-blueprint-links`); i ~63 siti (c) restano a `R-0` per decisione tecnica motivata in `esiti/R-1_passo34.md`. Baseline S-5 aggiornata (94/306) con controprova rosso→verde. `verify_gate.py run`: **GREEN** (programmi/typecheck/test-api). **R-1 CHIUSA.** Un flake non correlato di `semantic-matching.integration.test.ts` (verde isolato, verde nella corsa finale di `verify_gate`) è in `REGISTRO_SCOPERTE`, non ha bloccato nulla. Trovato durante il pull sul gemello: 206 file segnati "modificati" per rumore CRLF/permessi pre-esistente (byte-identici a `origin/main`), messo da parte con `git stash` (non cancellato) accanto a uno stash analogo già lasciato da S1091 — vedi `REGISTRO_SCOPERTE`. Perimetro della sessione esaurito qui, come da mandato: non si apre R-0.
- S1104 (2026-09-17, guardiano): perimetro esaurito a R-0. Terzo giro W3 CHIUSO (X-0/K1-ADR RATIFICATI, 33 confutazioni in 3 giri, zero di sostanza). R-0: migrazione 000421 applicata in produzione, 12/24 porte collegate, modulo platform-tenant-assignments costruito per completare il meccanismo (S-2 lo pretendeva). Due difetti reali trovati DALLA prova generale e corretti nello stesso ciclo (non ignorati): z.coerce.boolean() e permesso senza rotta. SOSPESA non su un rosso: la prova generale finale (commit f8d7e560) girava ancora in background sul gemello quando il guardiano ha imposto lo stop al 74.8% di contesto; il processo remoto e indipendente dalla sessione e continua da solo. Tutto committato e pushato. La sessione che riprende legge .zp/verify-verdict.json PRIMA di ogni altra cosa.
- S1105 (2026-09-17): mandato = Parte A del mandato S1105 (guardiano) → Parte B (ruoli, ordine R-9/R-2/R-7/R-3/R-8/R-5/R-10+R-4). A0 (margine proposto 1 punto, in ATTESA_ENZO), A2 (CHIUSA: terzo momento di misura + regola "chiusura è ultimo atto" in V4), A3 (censimento fatto; propagazione vera resta dopo A1). **R-9 CHIUSA** (PLATFORM_OPERATOR+SALES, mig. 000422; prova sul vivo di R-0 passata: 70.959 righe di RTL viste solo dopo assegnazione; 2 regressioni RBAC storiche trovate dalla prova generale e corrette — vedi esiti/R-9.md). **A5 CHIUSA** (costo misurato ~97.500 token/9,8 punti su R-9; riga 17 del mandato K corretta). A1/A4 restano ATTESA_ENZO(margine).
