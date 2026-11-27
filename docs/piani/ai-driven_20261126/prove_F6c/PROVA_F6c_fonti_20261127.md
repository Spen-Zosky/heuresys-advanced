---
dominio: agenti-ia
natura: esito
stato: chiuso
aggiornato_il: 2026-11-27
sintesi: Prova dal vivo in produzione delle fonti cliccabili dell'assistente (F6c, PR 531), con il difetto sui nomi tecnici nei messaggi intermedi.
---

# Prova dal vivo F6c: fonti cliccabili (27/11/2026)

**Esito: le fonti cliccabili funzionano in tutte e quattro le risposte. Il controllo «nessun nome tecnico visibile» fallisce in una risposta su quattro, in un messaggio intermedio e non nelle fonti.**

Ambiente: https://www.heuresys.com, produzione (`refs/heads/prod` = `97bbf44b`). Persona: Conti, Valentina, accesso completo con secondo fattore. Browser: Chromium con Playwright sulla VM (il browser integrato dell'app desktop non è disponibile in questa sessione), 1440×1000, tema scuro. Orari in UTC.

## Domande ed esito

| n. | ora | pagina | domanda | 1 riga Fonti | 2 scheda | 3 Apri la pagina | 4 niente tecnico | 5 lingua |
|---|---|---|---|---|---|---|---|---|
| 1 | 08:23:57–08:25:13 | Utenti | Quante persone lavorano oggi in RTL Bank e come si distribuiscono fra le unità organizzative di primo livello? | 3 pulsanti | sì | 2 su 2 a Utenti | sì | italiano |
| 2 | 08:25:36–08:26:15 | Analisi degli indicatori | Quali KPI aziendali hanno il rilevamento più recente e quali sono sotto il loro obiettivo? Indica valori e date. | 3 pulsanti | sì | 2 su 2 ad Analisi degli indicatori | **NO** | italiano |
| 3 | 08:26:27–08:27:05 | Unità organizzative | Chi dirige la Divisione Crediti, quante persone ne fanno parte e da quali unità è composta? | 3 pulsanti | sì | 2 su 2 a Unità organizzative | sì | italiano |
| 4 | 08:27:26–08:28:45 | Users | How many people work at RTL Bank today, and how are they split across the first-level organizational units? | 3 pulsanti | sì | 2 su 2 a Users | sì | inglese |

Ogni scheda ha titolo, tipo (Dato letto / Pagina; Data read / Page) e dettaglio, ed è ridimensionabile (`resize: both`, maniglia visibile). Le tre fonti senza pulsante «Apri la pagina» sono di tipo dato senza pagina indicata, come previsto. In inglese titoli, tipi, dettagli e pulsanti sono tutti in inglese. Nessun JSON grezzo. Riaprendo la conversazione 2 dalla cronologia le tre fonti ci sono ancora. Ogni domanda ha chiesto la conferma per la lettura di dati di molte persone, e ho premuto «Consenti».

## Numeri ricontrollati sulle pagine

158 persone (pagina Utenti e organigramma). Divisione Crediti: Caputo, Paolo, 19 persone; Istruttoria 1, Ufficio Crediti PMI 5, Ufficio Crediti Retail 4, Monitoraggio 8; Divisione Retail Banking 80 (organigramma). 356 obiettivi su 80 indicatori e 9 indicatori con raggiungimento (pagina Analisi degli indicatori). Non ricontrollati sul database: le singole percentuali, le date e gli intervalli delle misure, gli altri conteggi per unità.

## Titoli e dettagli delle fonti

1. Elenco degli utenti (dato) · Unità organizzative (dato) · Pagina Utenti (pagina).
2. Raggiungimento degli obiettivi per indicatore (dato) · Misure di tre indicatori (dato) · Analisi degli indicatori (pagina).
3. Unità organizzative (dato) · Posizioni della Divisione Crediti (dato) · Unità organizzative (pagina).
4. People and their units (data) · Organizational structure (data) · Users page (page).

## Difetto

**Nome tecnico visibile nella risposta 2** (schermata `PROVA_F6c_fonti_20261127.2-kpi_difetto.png`). Testo esatto, prima della risposta vera:

> Sto cercando dove sono registrate le misure degli indicatori aziendali, perché l'elenco delle definizioni (560) non contiene i valori.
>
> La pagina «Analisi degli indicatori» si appoggia a «analytics get_kpi». Guardo i filtri di quell'operazione.

La regola violata è in `apps/agent-gateway/src/istruzioni.ts`, riga 26 («Non parlare mai di strumenti, chiamate, API, identificativi tecnici… o di come hai trovato i dati»). Anche la riga 22 («Non scrivere nulla della risposta finché non hai letto tutti i dati») non è rispettata: messaggi di lavorazione restano nella risposta nelle domande 1, 2, 3 e 4 (per esempio «Leggo le assegnazioni alle posizioni e le posizioni.», «controllo i filtri disponibili», «The assignment records are messy»). La riga 72 è la regola corrispondente in inglese. La regola è scritta ma il modello non sempre la segue: è un'osservazione, non una diagnosi della causa. Il difetto non riguarda il blocco delle fonti.

## Osservazioni minori

Nella domanda 3 le fonti «dato» e «pagina» hanno lo stesso titolo («Unità organizzative») e si distinguono solo per l'icona. La stessa fonte «pagina» promette di verificare «struttura e responsabili», ma la tabella di quella pagina non ha una colonna dei responsabili (ci sono nell'organigramma). La domanda 2 ha avuto una risposta parziale, dichiarata dall'assistente: date lette per 3 indicatori.

## Effetti della prova sulla produzione

Quattro conversazioni nuove nella cronologia di Conti, Valentina. Righe d'uso in `audit.valore_eventi` per le pagine visitate. La lingua della persona è passata a inglese durante la domanda 4 (08:27–08:28) ed è tornata italiana. Nello stesso intervallo la cronologia mostra domande di un'altra prova sullo stesso utente (9-box, piani di carriera): se quell'altra prova ha risposte in inglese in quei minuti, la causa può essere questa.

## Schermate

Per ogni domanda `…<n>-<nome>_risposta.png` (risposta con la riga Fonti) e `…_scheda.png` (prima scheda aperta), nella stessa cartella.
