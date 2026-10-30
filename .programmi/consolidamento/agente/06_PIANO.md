# Agente di consolidamento del tenant — piano di lavoro

Versione 1 del 2026-10-30. Discende da `05_DISEGNO_TECNICO.md` e dalla specifica `00_SPECIFICA.md` (confermata da Enzo il 2026-10-30 alle 19:33 UTC). Le voci si chiamano AC-n per non confondersi con gli incrementi C0…C13 del programma, con i rilievi R-nn e con le contraddizioni K1…K13 di `lavoro/B_capacita.md`.

## Che cosa non si chiude in questa sessione

Questa sessione consegna solo il disegno e il piano (AC-0 in parte, nient'altro). Tutte le voci da AC-1 in poi aspettano il via di Enzo sulle decisioni del §10 del disegno; AC-12 e AC-13 toccano la produzione e restano decisioni sue anche dopo quel via.

## Le voci

| id | cosa | chi la completa | fatta quando | dipende da | stato |
|---|---|---|---|---|---|
| AC-0 | Indagine sullo schema vero: per ogni gruppo le tabelle e le colonne del tenant e del prototipo ricevuto, la chiave stabile di una voce del prototipo, quali righe sono importate (I23), se esiste un'utenza RTL Bank con `HRMS_MANAGER` usata da Enzo | Claude | la tabella dei gruppi del §4 del disegno è compilata con nomi di colonne misurati e il comando che li produce | — | da fare (il disegno è scritto; la misura sul database no) |
| AC-1 | Decisioni di Enzo sul §10 del disegno | Enzo | una risposta per le cinque decisioni, registrata nel disegno con data e ora | AC-0 non serve | aspetta Enzo |
| AC-2 | Prerequisiti del programma: C5 (strada unica di materializzazione) e C6 (origine e impronta, anche per nome e codice) | Claude, nel programma | C5 e C6 nel codice e provati su copia, come da `03_PIANO.md` | AC-1 | da fare |
| AC-3 | Migrazione `000464`: le sei tabelle del §4 | Claude | la catena si applica due volte su una copia usa-e-getta senza differenze; l'inversa riporta la copia allo stato di prima | AC-0, AC-1 | da fare |
| AC-4 | Migrazione `000465`: permessi `consolidation:*` e `vocabulary:approve`, ambito di delega `CONSOLIDATION` con i gruppi (emendata la `000314` alla fonte) | Claude | i permessi risultano assegnati come nella tabella del §7; una delega limitata alle competenze non può decidere su un'unità (prova rossa prima, verde dopo) | AC-3 | da fare |
| AC-5 | Contratti Zod in `packages/shared/src/schemas/tenant-consolidation.ts` (sessione, giro, proposta, decisione, lotto del giudice e sua risposta) | Claude | typecheck verde nei pacchetti che li usano | AC-3 | da fare |
| AC-6 | Il giudice: `apps/agent-gateway/src/consolidation-propose.ts` e rotta `POST /consolidation/propose`, senza strumenti, con segreto condiviso, risposta convalidata | Claude | prove del gateway verdi; una prova mostra che un lotto con un campo `*UserId` viene rifiutato prima della chiamata | AC-5 | da fare |
| AC-7 | Il motore: modulo `apps/api/src/modules/tenant-consolidation/` (sessione, giro zero per chiavi, candidati con `pg_trgm`, giri, arresto, dipendenze, rifacimento al rifiuto) con il giudice iniettato | Claude | prove pure con un doppio del giudice: convergenza, arresto a zero adozioni, fusibile al dodicesimo giro, rifacimento dopo un rifiuto | AC-5, AC-6 | da fare |
| AC-8 | L'applicazione delle decisioni (§6 del disegno): collegamento, normalizzazione, forma del tenant, nome del prototipo, adozione da C5, personalizzazione; giornale `staging.tenant_consolidation_undo` | Claude | prova d'integrazione su copia: per ogni tipo di decisione cambia solo ciò che deve, e il giornale riporta i valori di prima | AC-2, AC-7 | da fare |
| AC-9 | Rotte `/v1/tenant-consolidations/*` con permesso, CSRF sulle scritture, tenant dalla sessione | Claude | prova d'integrazione: un tenant non vede le sessioni di un altro; un delegato vede solo i suoi gruppi | AC-4, AC-8 | da fare |
| AC-10 | Le quattro pagine del §8 del disegno, con `@heuresys/ui` e testi it/en | Claude | login vero di una persona di RTL Bank con `HRMS_MANAGER` sulla copia, uso della pagina di un gruppo | AC-9 | da fare |
| AC-11 | Vocabolario comune: rotte di piattaforma e pagina `/admin/vocabolario-comune` | Claude | un'equivalenza proposta da una sessione compare da approvare; una approvata entra nel giro zero della sessione successiva | AC-9 | da fare |
| AC-12 | L'agente di advanced in servizio sulla VM: unità di systemd, abbonamento, segreto condiviso con l'API nell'ambiente | Claude prepara, Enzo dà il via | `systemctl status` attivo e una chiamata vera al giudice con un lotto di prova | AC-6, via di Enzo | da fare |
| AC-13 | Prima prova vera: RTL Bank contro il prototipo bancario, su una copia del database di produzione; Enzo conferma come Direttore; si misurano giri, equipollenze, rifiuti e token; si ritara la soglia sicura | Claude e Enzo | il registro mostra una decisione per ogni voce di almeno un gruppo, con comando, uscita, percorso e orario; poi rilascio in produzione su via di Enzo | AC-10, AC-11, AC-12, un prototipo ricevuto | da fare |
| AC-14 | Ritorno al datastore: nella proiezione di C8 i conteggi per gruppo e i nomi strutturali delle personalizzazioni e delle lacune rifiutate; la pagina dei vuoti li mostra | Claude, nei due progetti | la pagina dei vuoti mostra il ritorno di RTL Bank letto dalla proiezione, non dal database di advanced | AC-13, C8 | da fare |
| AC-15 | L'agente conversazionale legge il registro (letture della persona, ADR-0040 R1) | Claude | il Direttore chiede all'agente che cosa resta da decidere e la risposta coincide con la pagina dell'avanzamento | AC-9 | da fare |

## La simulazione delle voci

Scritta prima di eseguire, secondo le regole di Enzo: che cosa deve già essere vero, quale strumento fa l'effetto, chi porta il risultato altrove, se serve Enzo, quale guardia ferma il caso limite.

**AC-0.** Deve esistere la copia di advanced sul 5436 della VM (`~/pg-prova-advanced`, memoria del progetto). Strumento: `psql` in sola lettura su quella copia, e `lavoro/C_schema_advanced.tsv` per i nomi. Niente da portare altrove. Enzo non serve. Non distruttiva.

**AC-1.** Deve esserci il disegno pubblicato. Strumento: la scheda di decisione nel thread. Chi registra: Claude, nel §10 del disegno. Serve Enzo, ed è il solo modo di chiudere la voce.

**AC-2.** È lavoro del programma, già disegnato in `03_PIANO.md`; qui si aggiunge solo l'origine per campo di nome e codice dentro C6. Prova su copia usa-e-getta con `bash scripts/copia-prova.sh apri`. Il rilascio è di Enzo.

**AC-3 e AC-4.** Devono essere prenotati i numeri `000464` e `000465` in `00_INDICE.md` (fatto in questa sessione). Strumento: `bash db/scripts/migrate.sh ~/pg-prova-advanced/prova.env` su una copia nuova del 5436, e `bash db/scripts/prova-idempotenza.sh`. La CI del ramo porta la prova al repository. Enzo non serve fino al rilascio. Guardia: le migrazioni sono additive; l'emendamento della `000314` allarga il CHECK e non toglie valori, quindi nessuna delega esistente diventa non valida; la post-condizione conta le deleghe prima e dopo.

**AC-5, AC-6, AC-7.** Nessun database. Strumento: `pnpm -C apps/agent-gateway test`, `pnpm -C apps/api exec vitest run` sui file nuovi, typecheck. Il giudice si prova con un doppio; la chiamata vera aspetta AC-12. Guardia: il lotto si convalida contro l'elenco chiuso di colonne prima di uscire dal motore.

**AC-8.** Devono esserci C5 e C6. Strumento: prova d'integrazione su copia usa-e-getta. È una scrittura di massa: misura prima, guardia che rilegge la decisione al momento di applicarla, post-condizione su nomi e codici del tenant (devono restare uguali salvo la scelta «nome del prototipo»), giornale di ritorno. Nessuna cancellazione.

**AC-9, AC-10, AC-11.** Strumento: prove d'integrazione e, per le pagine, login vero sulla copia secondo la definizione di fatto del progetto. Serve un'utenza RTL Bank con `HRMS_MANAGER` (misurata in AC-0); se non c'è, crearla è un gesto da chiedere a Enzo.

**AC-12.** Deve essere autenticato `claude` sulla VM con l'abbonamento di Enzo. Strumento: unità di systemd scritta nel repository e installata dal deploy. È produzione: serve il via di Enzo con una frase scritta nel thread (limite della delega del 26/10). Guardia: il gateway ascolta solo su `127.0.0.1`, e senza segreto la rotta non esiste.

**AC-13.** Deve esserci un prototipo bancario ricevuto in advanced (C3, primo caricamento vero). Strumento: una copia del database di produzione sul 5436, poi la sessione dalle pagine. Serve Enzo, che conferma come Direttore di RTL Bank. Il rilascio in produzione dopo la prova è una sua decisione.

**AC-14.** Deve esistere C8. Tocca i due progetti: in advanced lo script della proiezione, nel datastore la lettura. Guardia: la proiezione porta solo colonne in elenco chiuso e nessun dato di persona.

**AC-15.** Le letture dell'agente conversazionale passano già per i permessi della persona; basta che le rotte di AC-9 siano nel catalogo dell'atlante.

## Registro delle scoperte fuori da questo ciclo

Le cose trovate strada facendo, da proporre una volta sola a Enzo.

1. La pagina dei vuoti del datastore legge RTL Bank direttamente dalla produzione di advanced attraverso il servizio 3104. ADR-0047 punto 6 e C8 hanno già deciso di ritirare questa lettura; oggi è ancora attiva.
2. Il README del gateway (`apps/agent-gateway/README.md`) dice «12 sorgenti» e «8 file di test»; oggi sono 14 e 12 (`ls apps/agent-gateway/src`, `ls apps/agent-gateway/test`).

## Chiusura

Si legge da questa tabella: «CICLO CHIUSO — 16/16 voci fatte» oppure «CICLO NON CHIUSO — manca la voce K, serve Enzo per Y».
