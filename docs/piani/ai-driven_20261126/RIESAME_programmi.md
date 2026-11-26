# Riesame dei programmi e dei piani sul metro di ADR-0063 (voce Z4, 26/11/2026)

Voce Z4 del [piano Heuresys AI-driven](../PIANO_heuresys-ai-driven_20261126.md), in attuazione di [ADR-0063](../../architecture/adr/0063_heuresys_ai_driven_l_organizzazione_ghost.md) D10: ogni programma aperto si rilegge con il metro dei dodici assi (sezione 3 del piano) e dei sette criteri (ADR-0063 D1). Per ciascuno: l'asse e il criterio che serve, e se **si tiene**, **si assorbe** in una voce del piano AI-driven (la sua tabella resta la fonte delle sue voci) o **si ferma**. Questa tabella è una proposta: niente si ferma né si chiude finché Enzo non risponde, una volta sola, alla scheda del thread «Rileggere i programmi sul metro di ADR-0063».

Metro ADR-0063: asse 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; criterio 1, 2, 3, 4, 5, 6, 7

## 1. Come è stato fatto, e i suoi limiti

- Letti su `main` di heuresys-advanced al commit `fecb24a` e di heuresys-datastore al commit `5e27b48`, il 26/11/2026 fra le 04:05 e le 05:00 ora di Roma.
- Perimetro, come la voce Z4 lo dichiara: i programmi aperti di `python3 docs/kb/tools/programmi.py` (12), tutti i piani in `docs/piani/` (25 file), i programmi del datastore `esecuzione/programmi/` (21) e, per il datastore, i fronti aperti di `esecuzione/STATO_CORRENTE.md` e dei piani ancora segnati in corso in `esecuzione/piani/`. In più le PR in bozza che portano un piano (#217, #272, #370), perché il piano AI-driven le cita.
- Lo stato di ogni voce è quello che il file dichiara. Dove il codice lo smentisce l'ho controllato sul codice e lo scrivo nella colonna «nota» (per esempio un modulo o una migrazione che esistono già): sono i casi «stato da riallineare». Il repository è un clone superficiale, quindi la storia dei commit non è stata usata come prova.
- I programmi del datastore `esecuzione/programmi/001-021` sono tutti `CHIUSO` (misura: `grep -m1 '^> \*\*stato' esecuzione/programmi/*.md`): non hanno niente da rileggere.

Legenda degli assi: 1 governo e sicurezza, 2 profondità di lettura, 3 capacità di agire, 4 autonomia e proattività, 5 fatti sommersi, 6 decisioni sofisticate, 7 organizzazione e risorse, 8 change management, 9 ridisegno dei processi, 10 assistenza in ogni funzione, 11 qualità e apprendimento, 12 generazione di modelli. Criteri: 1 ogni funzione è anche dell'agente, 2 agenti che lavorano da soli e segnalano, 3 lavoro in più passi, 4 decisioni su scenari, 5 il cambiamento è un oggetto, 6 processi ridisegnati con prove, 7 qualità e valore misurati. «Fuori dal metro» vuol dire che il lavoro non sposta nessun asse ed è infrastruttura, qualità dell'interfaccia o igiene: si tiene se serve, ma non conta per il livello.

## 2. La sintesi

| esito proposto | quanti (righe delle tabelle sotto, per esito principale) | che cosa vuol dire |
|---|---|---|
| si tiene | 19 | prosegue com'è, con l'asse dichiarato; dove serve, una regola in più di ADR-0063 (P1, D3, D9) |
| si assorbe | 9 | le voci passano sotto una voce del piano AI-driven; il file d'origine resta la fonte del dettaglio, senza doppioni |
| si ferma | 2 voci | contrastano ADR-0063 D4 (il modo LIBERA resta spento) |
| in attesa | 5 | dipendono da un'azienda vera o da una decisione di Enzo già pendente; non si lavorano ora |
| chiuso, stato da riallineare | 9 | il lavoro risulta fatto (nel codice o nei file di stato) ma la tabella del piano dice ancora «da fare» o «in corso» |
| già chiusi | 8 | nessuna voce aperta: si citano solo per completezza |

Le due voci da fermare sono le sole che il metro respinge: tutto il resto o serve già un asse o è neutro. Le cinque in attesa non aspettano niente di nuovo da Enzo: aspettano un cliente vero o una sua risposta già chiesta altrove.

## 3. heuresys-advanced, i piani in `docs/piani/`

| piano | assi | criteri | esito proposto | che cosa cambia con ADR-0063 | nota |
|---|---|---|---|---|---|
| [PIANO_allineamento-consolidamento_20261116](../PIANO_allineamento-consolidamento_20261116.md) (25 voci aperte) | 7, 12, 3 | 4, 5 | si tiene, con due assorbimenti | il giudice delle voci C1-C3 e le regole D1-D3 diventano lo specialista «organizzazione e cambiamento» della squadra del Capo ghost delle risorse umane (G3, dominio D5); le viste «com'è e come sarà» G1, G4 e G5 calcolano sulla struttura ombra di F3a, non su una seconda copia: un solo motore di proiezione; il pulsante rosso di H1 è la conferma della persona di D3 | il piano gemello della scheda (riga sotto) tocca la stessa pagina |
| [PIANO_scheda-allineamento_20261118](../PIANO_scheda-allineamento_20261118.md) (SA1-SA6) | 7, 12 | 4 | si tiene; stato da riallineare | nessun cambio di sostanza: è la conferma della persona (D3) | SA1 e SA2 risultano nel codice (`db/migrations/000499_le_decisioni_dell_allineamento.sql`, `apps/api/src/modules/tenant-consolidation/allineamento.ts`) ma la tabella dice «in corso» |
| [PIANO_consolidamento-applicazione_20261113](../PIANO_consolidamento-applicazione_20261113.md) (P1, P2, P4, P5) | 3, 7 | 1 | chiuso, stato da riallineare | nessuno | P1 e P2 risultano nel codice (`db/migrations/000488_il_consolidamento_applica_le_decisioni.sql`, `tenant-consolidation/applicazione.ts`); P4 e P5 vanno verificati dal vivo prima di chiudere |
| [PIANO_applet-assistente_20261118](../PIANO_applet-assistente_20261118.md) (P2, P4-P14) | 3 | 3 | si assorbe in F5 (già dichiarato nel piano) | ogni applet si conferma dalla persona (E3); i passi delle applet diventano anche il modo in cui uno scenario (F3) diventa lavoro vero | aperte vere: il modulo `apps/api/src/modules/applets/` non esiste |
| [PIANO_assistente-come-claude_20261118](../PIANO_assistente-come-claude_20261118.md) (V1-V7) | 2, 10 | 1 | chiuso nella parte già fatta, stato da riallineare; il resto si assorbe | la finestra V4 riceve le fonti cliccabili di F6c; il rilascio V7 segue F0a | `omissis.ts`, `istruzioni.ts` e `ruoliPerAgente` esistono in `apps/agent-gateway/src/` e `apps/api/src/modules/agent-tokens/routes.ts`; lo dice già il registro delle scoperte del piano AI-driven |
| [PIANO_principi-agentici_20261106](../PIANO_principi-agentici_20261106.md) (T6, T6c) | 1, 4, 10 | 2, 3 | si assorbe: T6c nella casella F4b e nell'elenco delle attività di F5 (P10) | la conversazione persistente è la base della memoria per persona (D7, F2) | `apps/api/src/modules/agent-conversations/` esiste: T6 è almeno in parte fatto |
| [PIANO_endpoint-orfani-ondate_20261117](../PIANO_endpoint-orfani-ondate_20261117.md) (O1-O5 ACTIVE) | 3, 10 | 1 | O4 si assorbe in F1; O1, O2, O3, O5 si tengono | ogni pagina nuova di O3 nasce con la sua voce per l'agente (P1, controllo F1b); un ritiro di O5 si dichiara anche nel catalogo dell'agente | O4 «strumenti dell'agente classe b» è esattamente la copertura d'azione di F1 |
| [PROGRAMMA_change_management_20261103](../PROGRAMMA_change_management_20261103.md) (23 voci aperte) | 8, 7, 1 | 5, 7 | si assorbe in gran parte; due voci si fermano | F0-3 (test del valore) va in F8; F3-1 (registro degli agenti) va in G8 e F8; F4-1…F4-6 (il cambiamento come oggetto, C-1…C-5) vanno nel dominio D5 e negli scenari S-M1…S-M3; F5-1…F5-3 si tengono per l'asse 12; F1-x e F2-x si tengono (F2-1, l'API pubblica, sostiene gli assistenti esterni di F9); F6-1 si tiene, prima di un cliente vero (ADR-0063 §3) | **si fermano F3-2 e F3-3**: la «zona libera» dove gli agenti scrivono senza conferma e la promozione di una capacità secondo ADR-0053 contrastano D4; il bisogno di provare senza toccare RTL lo copre la struttura ombra di F3a |
| [PIANO_interfacce-intelligenti_20261110](../PIANO_interfacce-intelligenti_20261110.md) | 10, 5 | 1, 2 | si tiene | le parti «insight» delle pagine leggono le segnalazioni dei segnalatori (F4) invece di calcoli fissi nella pagina, e portano le fonti (F6c) | regole R1-R7 in `docs/kb/xtras/INTERFACCE_INTELLIGENTI.md` |
| [PIANO_interfaccia-sistematica_20261111](../PIANO_interfaccia-sistematica_20261111.md) | 10 | nessuno (qualità dell'interfaccia) | si tiene come metodo | nessuno | il metodo «un difetto è una classe» vale anche per le batterie F6a |
| [PIANO_interfacce_20261103](../PIANO_interfacce_20261103.md) (P-1 aperta) | 11 | nessuno (banco di prova) | si tiene | nessuno | `scripts/banco-prova.sh` non esiste: P-1 è aperta davvero |
| [PIANO_forense-frontend_20261115](../PIANO_forense-frontend_20261115.md) (I1, C8, C9) | 10 | nessuno (qualità dell'interfaccia) | si tiene | nessuno | C8 è «riunita nella PR del giudizio del 18/11»: da chiudere quando quella PR risulta rilasciata |
| [PIANO_ruolo-agenti-db_20261121](../PIANO_ruolo-agenti-db_20261121.md) (B2) | 1 | nessuno (sicurezza) | si tiene | è il fondo di D3 e D4: il database stesso rifiuta DROP, TRUNCATE e ALTER a un agente | lo stato di B2.5 (PR in bozza) va riletto: la PR non è fra quelle aperte oggi |
| [PIANO_turni-advanced-datastore_20261110](../PIANO_turni-advanced-datastore_20261110.md) (V4-V6, V9) | fuori dal metro | — | chiuso, stato da riallineare | nessuno | `.turno/gemelli.json`, `scripts/turno/` e `scripts/rilascio-copia.sh` esistono e `CLAUDE.md` dichiara i turni in vigore |
| [PIANO_velocita-ci-e-rilasci_20261122](../PIANO_velocita-ci-e-rilasci_20261122.md) | fuori dal metro | — | in attesa (proposta già a Enzo) | la batteria F6a (almeno 200 domande per dominio) peserà sui runner: la misura di questo piano serve anche lì | nessuna domanda nuova a Enzo |
| [PIANO_riordino-documentazione_20261125](../PIANO_riordino-documentazione_20261125.md) | fuori dal metro | — | chiuso, stato da riallineare | nessuno | la riga «Stato» in testa dice ancora «fase 1, in attesa»; le voci risultano fatte (R14 nella PR #492) |
| [PIANO_assistente-nelle-interfacce_20261110](../PIANO_assistente-nelle-interfacce_20261110.md), [PIANO_organigrammi-a-blocchi_20261114](../PIANO_organigrammi-a-blocchi_20261114.md), [PIANO_organigrammi-navigazione_20261115](../PIANO_organigrammi-navigazione_20261115.md), [PIANO_processi-e-progetti-sistematici_20261118](../PIANO_processi-e-progetti-sistematici_20261118.md), [PIANO_registro-corse-consolidamento_20261114](../PIANO_registro-corse-consolidamento_20261114.md), [PIANO_pacchetti-git-drive_20261104](../PIANO_pacchetti-git-drive_20261104.md), [PIANO_pulizia-repo_20261101](../PIANO_pulizia-repo_20261101.md) | 10, 7, 9, 12 o fuori dal metro | — | chiusi | nessuno: tutte le voci sono fatte | la pagina dei processi del 18/11 è la base degli scenari S-P1…S-P3 |
| [plurali-mancanti_20261115](../plurali-mancanti_20261115.md) | fuori dal metro | — | chiuso (è un elenco consegnato al thread forense) | nessuno | — |

## 4. heuresys-advanced, i programmi aperti di `.programmi/`

Misura: `python3 docs/kb/tools/programmi.py` (12 aperti al commit `fecb24a`).

| programma | assi | criteri | esito proposto | che cosa cambia con ADR-0063 |
|---|---|---|---|---|
| #214 adozione dell'agente sui perimetri in coda (6/7) | 2, 3 | 1 | si assorbe in F1 | la coda dei perimetri neutri si consuma con la classe di ogni scrittura; la prova avversaria resta |
| #254 apertura di tutti i perimetri in una mossa (0/3) | 2, 3 | 1 | si assorbe in F1, insieme a #214 | lo stesso lavoro di #214 visto da un'altra parte: un solo lotto in F1, non due |
| #159 il ponte gateway↔pagine anche per le pagine future (2/4) | 10 | 1 | si tiene; F3 «adozione su tutte le pagine idonee» è la misura dell'asse 10 | ogni pagina nuova dichiara il suo contesto (controllo F1b) |
| #79 cancello di esposizione (2/3) | 2, 10 | 1 | si assorbe in F1b | «un dato che nessuna API espone non è nel prodotto» si allarga a «una rotta che nessun agente può usare né dichiara esclusa è un difetto» |
| #265 gerarchia dei livelli, avviso con motivazione (3/5) | 7 | 2 | si tiene; diventa uno dei segnalatori del dominio D5 (ampiezza di controllo e livelli) | l'avviso nasce come segnalazione in casella (F4), senza scrittura |
| #263 la giunzione con il pacchetto del datastore (4/5) | 12 | 4 | si tiene | il pacchetto v0.3 della banca è la conoscenza di settore dei Capi ghost (D2) e il termine di confronto di S-O3 |
| #271 onda 2 in advanced, l'azienda vera completa (3/11) | 12, 7 | 4 | si tiene | la struttura del tenant di O2-03 è la stessa da cui si ricavano le unità ghost (G1): la si porta avanti con quel vincolo |
| #198 Tenant Builder P3 (9/10, resta T9b) | 12 | 4 | in attesa | T9b (costruzione vera in produzione, disfatta il 19/08) e #206 T9 chiedono un'azienda vera: arrivano con la scelta di Enzo di aprire a un cliente, non prima |
| #206 Tenant Builder P4, estrattori e ingestori (8/9) | 12 | 4 | in attesa | come #198 |
| #205 Tenant Builder 2b e 2c, la coda dei domini ricercabili (1/3) | 12, 2 | 4 | in attesa | come #198; i domini ricercabili sono anche conoscenza per i Capi ghost, quando ripartirà |
| #149 consegne del lab da trattare come non verificate (3/4) | fuori dal metro | — | si tiene come regola | nessuno |
| #76 verifica del piano «zero pendenze» (2/3) | fuori dal metro | — | in attesa | l'esecuzione «a ondate, un cluster per volta» oggi la fa il governo a thread (regola dei passi piccoli del 21/11); se Enzo lo conferma, il programma si chiude come superato |

Gli altri 84 file di `.programmi/` sono chiusi, mandati o esiti di sessione: non sono programmi aperti.

## 5. Le PR in bozza che portano un piano

| PR | assi | criteri | esito proposto | che cosa cambia con ADR-0063 |
|---|---|---|---|---|
| #272 piano della conoscenza agentica da mod-platform (piano K) | 2, 11, 1 | 7 | si assorbe in F2, F8 e D8 (già dichiarato nel piano) | la PR resta la fonte delle voci K; va unita come documento perché il piano AI-driven la cita |
| #217 il giudice del consolidamento interpreta le non corrispondenze | 7, 12 | 4 | si assorbe nella voce C1 del piano dell'allineamento | il giudice diventa uno specialista vero sotto il Capo ghost (D9: si chiama agente ciò in cui un modello ragiona) |
| #370 revisione del frontend con le soluzioni del datastore | 10, 12 | 1 | si tiene come oggi | i passi 5-9 restano legati a un caso d'uso reale (ADR-0061) |

## 6. heuresys-datastore

Programmi `esecuzione/programmi/001-021`: tutti `CHIUSO`. I fronti aperti stanno in `esecuzione/STATO_CORRENTE.md` («Da dove riparte») e nei piani segnati in corso.

| fronte | assi | criteri | esito proposto | che cosa cambia con ADR-0063 | nota |
|---|---|---|---|---|---|
| I venticinque passi della cascata come verbi, lato banco (cicli BI-BM) | 12, 3 | 1 | si tiene | ogni verbo è già uno strumento che un agente può chiamare: è il criterio 1 dentro il datastore | la scelta di costo sulle fonti web resta pendente in `STATO_CORRENTE.md`, punto 1 |
| Piano 110 W0-C, archiviazione delle corse | fuori dal metro | — | si tiene | nessuno | lo stato dice «in corso, non da fare»: è un lavoro di cura dei dati |
| D-68, un metodo per provare le famiglie di settore fuori dalle banche | 12, 11 | 7 | si tiene | serve al confronto di settore degli scenari (S-O3, S-C3, S-P3) per i tenant non bancari | da proporre a Enzo nel datastore, come il file già dice |
| ZZ-5, categorie legali, istituti dei contratti, gruppo ESCO | 12 | 4 | si tiene | gli istituti dei contratti sono i vincoli della famiglia «sotto vincoli» degli scenari (CCNL) | servono fonti e un disegno |
| EPIC del governo delle fonti (`esecuzione/EPIC_GESTIONE_FONTI.md`, commissionato il 27/08) | 2, 12 | 7 | si tiene | le fonti versionate sono le fonti cliccabili (D6) degli scenari che usano il modello di settore | non ancora pianificato |
| La console con la memoria delle conversazioni (piano K, voce K15) | 2, 10 | 1 | si assorbe in D8 | già nel piano AI-driven | — |
| EPIC della modellazione (`esecuzione/EPIC_MODELLAZIONE.md`, «IN CORSO») | 12 | 4 | chiuso, stato da riallineare | nessuno | il suo programma 021 è `CHIUSO` |
| Piano 70, voce CC-4 «non avviabile, serve Enzo» | fuori dal metro | — | chiuso, stato da riallineare | nessuno | CC-4 era l'apertura del programma 020, che oggi è `CHIUSO` |
| Piani 119, 123 e 124, testate «in esecuzione», «in corso», «in attesa di approvazione» | fuori dal metro | — | chiusi, stato da riallineare | nessuno | `STATO_CORRENTE.md` dice il 123 chiuso a 17 voci su 17 e il riordino (124) fatto con le PR #41 e #42 |

## 7. Che cosa propongo a Enzo, in una scheda sola

1. **Fermare** le voci F3-2 e F3-3 del programma del change management, perché contrastano ADR-0063 D4; il loro scopo (provare senza toccare RTL) lo prende la struttura ombra di F3a.
2. **Assorbire** nel piano AI-driven le voci della colonna «si assorbe», senza copiarle: i file d'origine restano la fonte del dettaglio e ricevono il rimando alla voce che li prende.
3. **Riallineare** gli stati dei nove piani che il codice o i file di stato danno per fatti: lo fa un thread Sonnet, una PR per repo, senza toccare la sostanza.

Le cinque voci in attesa (#198, #205, #206, #76, il piano della velocità della CI) restano come sono e non chiedono niente di nuovo. Se Enzo risponde sì, i punti 2 e 3 diventano due voci nuove nel registro delle scoperte del piano; il punto 1 è una riga di stato in quel programma.
