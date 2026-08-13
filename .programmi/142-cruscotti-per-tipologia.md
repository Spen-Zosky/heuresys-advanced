# 142 — Cruscotti focalizzati per tipologia di utilizzatore

> **item**: #142 · **priorità**: P1 · **stima register**: ~3-4 sessioni
> **stato**: NON AVVIATO
> **fonti**: direzione di Enzo 2026-08-05 (registrata nel register) · mig `000271`, `000272`

## Decisioni vincolanti (non si ri-chiedono)

- **Direzione di Enzo**: «la parola *cruscotto* da sola non sarà sufficiente per collegare un
  utente ad un cruscotto». Famiglia indicata: **Azienda · Processi · Organizzazione · Filiale ·
  HR Management · Platform Management · Tenant Management · Self-Service**, e altri.
- Ciascun cruscotto ha **requisiti d'accesso propri**, incluso il **divieto** e la
  **granularità delle viste**.
- **Chiusura dichiarata**: ogni cruscotto ha un permesso proprio; nessuna pagina è raggiungibile
  da chi non può vederne il contenuto; la granularità è dichiarata per vista e verificata con
  **un login reale per tipologia**.
- Stato di partenza già misurato (S1045): esiste **un solo** cruscotto, governato dal permesso
  generico `dashboard:view`, e la sua voce di menu ora lo dichiara (mig `000271`).
- Il ruolo `BRANCH_MANAGER` (mig `000272`) è **già l'aggancio previsto** per «Dashboard
  Filiale»: quando la famiglia arriva si sostituisce il grant generico con quello specifico,
  **senza toccare chi detiene il ruolo**.

## ⚠ Sovrapposizione da sciogliere prima di iniziare

La **F7 di #99** (`passo 8` del piano domini) prevede «dashboard guidate dal DBMS, tabelle
dashboard/blocchi derivate da M3». È lo stesso oggetto visto da un'altra parte. Aprire questo
programma senza decidere chi assorbe chi significa costruirlo due volte.

## Fasi

- [ ] **F1 — INDAGINE: perimetro, sovrapposizione con #99 F7, catalogo delle tipologie** — non è codice. Fatto = (a) decisione scritta su chi assorbe chi fra #142 e #99 F7; (b) elenco chiuso delle tipologie con, per ognuna, il permesso proprio e la persona reale con cui si dimostrerà; (c) misura di cosa il cruscotto unico mostra oggi e a chi · budget ~120k
- [ ] **F2 — Modello dei cruscotti e dei permessi** — migrazioni: un permesso per cruscotto, grant per ruolo, sostituzione del generico `dashboard:view` dove serve · budget ~180k
- [ ] **F3 — API per cruscotto** — un endpoint per famiglia, granularità dichiarata per vista, integration test per il **divieto** oltre che per l'accesso · budget ~250k
- [ ] **F4 — Frontend + dimostrazione live per tipologia** — pagine, e un login reale **per ogni** tipologia (non una a campione) · budget ~250k

## Da dove si riprende

**F1**, e la prima domanda è quella di sovrapposizione con #99 F7. Senza risposta, F2 è lavoro
a rischio di essere buttato.
