# ADR-0062 — Traduzione del dato nella risposta dell'API

- **Status**: ACCETTATO il 2026-11-26 da Enzo Spenuso, che ha risposto «sì» alla domanda «Lo segno ACCETTATO?» del coordinatore del progetto (alle 14:27 UTC, 15:27 ora di Roma); proposto lo stesso giorno, già in codice e in produzione con le PR #498 e #513
- **Date**: 2026-11-26
- **Redatto da**: Claude Code, thread «Tradurre i dati nelle pagine in inglese»
- **Richiesta**: Enzo Spenuso, regola delle lingue: ogni pagina è interamente nella lingua scelta, l'italiano è la lingua predefinita, un testo nell'altra lingua è un difetto. Voce fuori ciclo X3 del giro di verifica del 24-25/11 (`docs/piani/forense-frontend_20261123/RAPPORTO_giro-verifica-25-11.md`)
- **Estende**: ADR-0029 (italiano canonico nella riga, inglese in `sys.sys_reference_translations`, registro `sys.sys_translatable_field`, copertura e orfani). Non ne cambia il modello dei dati
- **Non tocca**: gli invarianti di `CLAUDE.md`; il contratto Zod delle risposte (cambia il valore di una stringa, non la forma)

> **In parole semplici.**
> 1. Le traduzioni inglesi stanno già in una tabella sola del database. Finora le usavano otto moduli dell'API su più di cento, uno per uno; quando lo stesso nome arrivava da un altro modulo la pagina inglese lo mostrava in italiano.
> 2. Da qui la traduzione la fa l'API in un punto solo, all'uscita: se la pagina è in inglese, ogni testo della risposta che è il nome italiano di un oggetto tradotto diventa il suo nome inglese. Vale per tutti i moduli, anche per quelli che verranno.
> 3. I nomi delle persone non si traducono, e nemmeno gli identificativi e i codici.
> 4. Il resto del lavoro è dare l'inglese ai contenuti che ancora non l'hanno, e correggere le frasi che il codice compone in italiano.

## Contesto

Censimento in sola lettura del 26/11 sulla VM (registri del giro `~/heuresys-advanced-giro/20261124-verifica-*`, database `heuresys_advanced` letto con `default_transaction_read_only=on`; lo script e il risultato sono in `~/heuresys-datastore/esecuzione/_misure/CENSIMENTO_X3_20261126/`): 1.978 testi distinti segnalati come italiani nelle pagine inglesi. Di questi 882 sono uguali al valore di una colonna di `sys.*`, gli altri sono frasi composte dal codice o pezzi di valori.

Fra i testi presenti in colonne registrate, la traduzione inglese esiste ma la pagina mostra l'italiano (skills, kpi_definitions, job_roles, activity_classifications, skill_groups): il testo arriva da join di moduli che non chiamano `localize`. Si ricava la lista dei moduli che leggono quelle colonne con `grep -rln "kpi_definition_name\|skill_name\b\|job_role_name" apps/api/src`.

## Decisione

1. **Un hook globale `preSerialization`** (`apps/api/src/lib/i18n/traduci-risposta.ts`, registrato in `app.ts` dopo il plugin della lingua) per le richieste `GET /v1/*` con lingua `en`: ogni stringa della risposta uguale al testo italiano canonico di un campo registrato si sostituisce con la sua traduzione.
2. **Il glossario** italiano → inglese si costruisce dal registro e da `sys_reference_translations`, sta in memoria e si rinfresca ogni cinque minuti; se lo stesso testo italiano ha più traduzioni vince la più frequente. Se la lettura fallisce la risposta esce com'è.
3. **Esclusioni**: le chiavi di identificativi, codici e segreti (`id`, `…Id`, `code`, `…Code`, `email`, `slug`, `url`, `password`, `token`, `secret`, `otp`); le risposte non 2xx; l'intestazione `x-localize: off`.
3a. **Il ritorno sulle scritture** (passo 5, 26/11): un secondo hook sincrono, `preValidation`, agganciato rotta per rotta alla registrazione (`onRoute`) alle sole scritture `POST`/`PATCH`/`PUT` di `/v1/*`, mai alle rotte di accesso `/v1/auth/` (che non lo ricevono proprio); in inglese riporta all'italiano canonico ogni stringa del corpo uguale a una traduzione del glossario, solo se quella traduzione viene da un testo italiano solo. Così un modulo di modifica precompilato in inglese, salvato senza toccare il nome, non scrive l'inglese al posto dell'italiano, in tutti i moduli e senza intervenire modulo per modulo. Un testo nuovo scritto dalla persona passa com’è; una traduzione ambigua (più testi italiani) resta com’è; ogni ritorno lascia una riga nel log dell’API (`ritornoItaliano`, con i testi e la rotta).
4. **Il dato del tenant segue la stessa regola dei dati di riferimento**: un campo di contenuto (nome di processo, passo, unità, corso, obiettivo, titolo di richiesta) si registra in `sys_translatable_field` e la sua traduzione va in `sys_reference_translations`, con le migrazioni o gli script del repo. La copertura (`sys.fn_reference_translation_coverage`) e gli orfani lo vedono da sé.
5. **Le frasi composte nel codice** («Consulted: …», «N persone comprese le unità sotto», «Corso completato: …») si correggono nel codice con i file di lingua, non nel glossario.

## Alternative scartate

- **`localize` modulo per modulo** (la sola via di ADR-0029): decine di interventi, e ogni modulo nuovo deve ricordarsene. Resta valido dove c'è già; il glossario lo completa.
- **Traduzione nel frontend**: il frontend non ha le traduzioni, e dovrebbe saperle per ogni campo di ogni pagina.

## Conseguenze e rischi

- Un testo italiano identico in due oggetti diversi riceve la stessa traduzione: per nomi e descrizioni è il comportamento voluto.
- Un modulo di modifica in una pagina inglese precompila l'inglese: il ritorno (3a) lo riporta all'italiano salvando. Restano due casi: una traduzione che viene da più testi italiani non si rovescia e si salva in inglese; un testo nuovo scritto in inglese diventa il testo canonico della riga, come prima di questo ADR.
- La scelta di 3a sostituisce quella scritta prima al passo 5 (`x-localize: off` nelle letture dei moduli di modifica): quella chiedeva di toccare ogni modulo, e il modulo si precompila dalla stessa lettura che mostra la pagina, che deve restare in inglese.
- Quando il testo italiano cambia, la traduzione per id resta quella vecchia finché non si aggiorna: la copertura conta le righe, non la freschezza. Un controllo di freschezza è un passo successivo dichiarato.

## Passi

1. Hook e prove (questo ADR).
2. Registrare i campi che hanno già traduzioni ma non sono nel registro (`sys_blueprint_content_*`, `sys_blueprint_process_registry`, `sys_ui_interfaces.ui_interface_label`).
3. Tradurre i contenuti di RTL per classe: processi e passi, corsi e percorsi, obiettivi e OKR, richieste di approvazione, posizioni, unità, iniziative formative.
4. Frasi composte nel codice.
5. Ritorno all'italiano canonico sulle scritture (3a); controllo di freschezza delle traduzioni.
