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
| F0.1 | IN CORSO | S1102 | 2026-09-14T22:30 | 1 | 2 | | | stato e strumenti: cartella, STATO.md, LEGGIMI, copia del mandato, dove_siamo.py, misura_k.py |
| F0.5 | BLOCCATA(fase) | | | | 5 | | | q.py in sola lettura per gli agenti; controprova rossa obbligatoria |
| F0.6 | BLOCCATA(fase) | | | | 6 | | | indagine: come si applica UNA migrazione, registro, regola sui buchi |
| F0.7 | BLOCCATA(fase) | | | | 11 | | | i sei script .js dei workflow copiati e committati |
| F0.2 | BLOCCATA(fase) | | | | 7 | | | censimento C1 dei sei oggetti (WORKFLOW W0) |
| F0.3 | BLOCCATA(fase) | | | | 9 | | | baseline con misura_k.py; controprova exit 2 |
| F0.4 | BLOCCATA(fase) | | | | 10 | | | controprova della ripresa (3.5): chiude e riapre la sessione per costruzione |
| K-PROVA | BLOCCATA(fase) | | | | 10 | | | voce finta della simulazione 3.5; finira' RITIRATA |

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
