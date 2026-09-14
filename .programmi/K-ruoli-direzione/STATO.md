# STATO — Mandato K v2 (ruoli senza titolare e direzione del dato)

Mandato: `.programmi/mandati/K-mandato-v2.md` (copia CRLF del testo di Enzo/Cowork del 2026-09-14).
Come si legge e si riprende: sezione 3 del mandato. Questo file lo legge `tools/dove_siamo.py`.

Forma di una riga: `| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |`
Stati ammessi: `BLOCCATA(Dn)` · `BLOCCATA(fase)` · `PRONTA` · `IN CORSO` · `SOSPESA` · `ATTESA_ENZO(motivo)` · `CHIUSA` · `RITIRATA`.
`presa_da` = contenuto di `.handoff/session-id`. `ultimo_passo_chiuso` = numero univoco del passo nel mandato.
L'ORDINE DELLE RIGHE E' L'ORDINE DI ESECUZIONE: `dove_siamo.py` prende la prima `PRONTA` dall'alto.

## F0 — Fondazione

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| F0.1 | CHIUSA | S1102 | 2026-09-14T22:30 | 4 | | | evidenze/baseline_202609142237.txt (prova di misura_k.py); dove_siamo.py exit 0 | stato e strumenti; dove_siamo.py stampa una PRONTA (post-condizione passo 4) |
| F0.5 | CHIUSA | S1102 | 2026-09-14T22:39+02:00 | 5 |  |  | evidenze/F0.5_controprova.txt; esiti/F0.5_sola_lettura.md | q.py: sola lettura per costruzione (READ ONLY dal server), non per privilegio; heuresys senza CREATEROLE; heuresys_ro NOLOGIN e senza pay_slips |
| F0.6 | CHIUSA | S1102 | 2026-09-14T22:44+02:00 | 6 |  |  | esiti/F0.6_migrazioni.md | runner=catena intera in ordine lessicale, nessun rifiuto dei buchi; registro sys_schema_migrations (411=411); via: scp+prova-idempotenza sul gemello, pg_dump_pre_k.sh sulla VM, push, pnpm db:migrate:vm; nessuna vista sys.v_* con righe |
| F0.7 | CHIUSA | S1102 | 2026-09-14T22:47+02:00 | 11 |  |  | workflows/W0..W5 (6 file); sintassi provata come corpo async | W0-W4 estratti dal mandato byte per byte (tools/estrai_workflows.py); W5 = W1 con INDAGINI→3 ipotesi e critico→sommatore+verificatore; la prova vera e' il primo lancio di W0 |
| F0.2 | CHIUSA | S1102 | 2026-09-14T22:51+02:00 | 8 |  |  | evidenze/wf_F0.2_7_202609142251 (_VERIFICATO.txt); esiti/F0.2_censimento_C1.md | W0 12/12 agenti, 6/6 spie trovate (2 accettate su prova numerica), 5 discrepanze ri-misurate in linea; nessuna cella non cercata |
| F0.3 | CHIUSA | S1102 | 2026-09-14T23:18+02:00 | 9 |  |  | evidenze/baseline_202609142318.txt; evidenze/F0.3_controprova.txt (exit 2) | baseline ufficiale: 14/231/0/102/160/80/70959/000414/248 tabelle; guardia vista ROSSA (exit 2, nessun file scritto) e ripristinata |
| F0.4 | SOSPESA | S1102 | 2026-09-14T23:20+02:00 |  | 10-ripresa |  |  | S1102 ha chiuso qui APPOSTA (3.5): 000415 applicata e riconosciuta a caldo. Sessione 2: R1-R2, annotare session-id, leggere caso (ii) a freddo, poi 000416 rollback (rinomina in _ritirata, effetto ASSENTE), poi 000417 senza -- FINE (FILE INCOMPLETO rosso) e completata vuota; K-PROVA -> RITIRATA |
| K-PROVA | SOSPESA | S1102 | 2026-09-14T23:20+02:00 |  | 10-ripresa | 000415 000416 000417 | pg_dump_snapshots/pre-K-K-PROVA_08e1614_20260914_2325.dump (VM, 138 MB); prova generale verde (verify_gate migrate-idempotent 61s) | voce finta della simulazione 3.5: 000415 crea sys.v_prova_ripresa_k; 000416 la ritira (rinomina in _ritirata); 000417 nasce incompleta e si completa vuota |

## F1 — Indagini (nessuna scrittura)

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| I-A | BLOCCATA(fase) | | | | 12 | | | rigenerazione del semilavorato (W1); coda passo 13 in linea su copia |
| I-B | BLOCCATA(fase) | | | | 14 | | | fisica delle famiglie di semilavorato (W1, haiku) |
| I-C | BLOCCATA(fase) | | | | 15 | | | impronta dei controlli per nome (W1); seconda passata passo 16 dopo I-E |
| I-D | BLOCCATA(fase) | | | | 17 | | | registro di provenienza normalizzato + CONTEGGIO CONFLITTI PER D5 (W1, due lettori) |
| I-F | BLOCCATA(fase) | | | | 18 | | | ricetta del custode (W1); controprova rossa passo 19 in linea |
| I-G | BLOCCATA(fase) | | | | 20 | | | porte di piattaforma verso i clienti (W1); serve a R-0 |
| I-E | BLOCCATA(fase) | | | | 21 | | | classificazione delle tabelle sys.sys_* (W2 a lotti) |
| D5 | BLOCCATA(fase) | | | | | | | decisione RINVIATA da Enzo: si riapre come ATTESA_ENZO(D5: N conflitti) alla chiusura di I-D; la CLI NON decide |

## F2 — Sentinelle e cancelli che sanno fallire

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| S-1 | BLOCCATA(fase) | | | | 24 | | | vista permessi solo-plenipotenziari + allowlist (migrazione) |
| S-2 | BLOCCATA(fase) | | | | 26 | | | test unitario permessi senza rotta + allowlist dei 34 |
| S-5 | BLOCCATA(fase) | | | | 29 | | | cricchetto sui controlli per nome (dopo I-C) |
| S-3 | BLOCCATA(fase) | | | | 27 | | | vista registro provenienza orfano (dopo I-D); nasce ROSSA, INFORMATIVE |
| S-4 | BLOCCATA(fase) | | | | 28 | | | prova cross-tenant sui sinonimi; it.skip «attivo dopo R-3» |

## F3 — ADR e invariante

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| X-0 | BLOCCATA(fase) | | | | 30 | | | ADR direzione del dato + I23 (D7=A); confutazione W3; poi ATTESA_ENZO |
| K1-ADR | BLOCCATA(fase) | | | | 31 | | | ADR catena del semilavorato (dopo I-A, I-B); confutazione W3; poi ATTESA_ENZO |

## F4 — I ruoli, uno per migrazione

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| R-1 | BLOCCATA(fase) | | | | 33 | | | tratti di mandato + passo 0 (revoked_at/retired_at, G-D2) |
| R-0 | BLOCCATA(fase) | | | | 35 | | | asse «utente di piattaforma assegnato a certi clienti» (D9=B; dopo R-1, I-G) |
| R-9 | BLOCCATA(fase) | | | | 53 | | | PLATFORM_OPERATOR e SALES: prima prova sul vivo di R-0 |
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
| X-4 | BLOCCATA(D5) | | | | 64 | | | regola degli ibridi: aspetta la risposta di Enzo a D5 |
| X-5 | BLOCCATA(D5) | | | | 65 | | | sentinella della direzione (dopo X-2, X-4) |
| X-6 | BLOCCATA(fase) | | | | 66 | | | indagine presenze senza provenienza (W5) |

## F6 — Il gesto

| K-codice | stato | presa_da | presa_il | ultimo_passo_chiuso | prossimo_passo | migrazione_prenotata | evidenza | nota |
|---|---|---|---|---|---|---|---|---|
| G-1 | BLOCCATA(fase) | | | | 67 | | | assegnazione persona↔posizione via approvazioni (D4=B; dopo R-6, X-2) |

## Perimetro di sessione dichiarato

- S1102 (2026-09-14): mandato = da F0 a F2 compresa; NON entra in F3-F6. Fermate obbligatorie: (a) chiusura di I-D → rapporto a Enzo per D5; (b) chiusura di F2.
- F0.4 chiude e riapre la sessione per costruzione (sezione 3.5): la sessione che la prende termina con la voce IN CORSO e la successiva la completa.
- D5 non si decide mai dalla CLI, nemmeno con zero conflitti.
