# 215 — Lo stesso stato impossibile in altre due tabelle, dove la cura è l'opposto

> **item**: #215
> **stato**: CHIUSO

Nasce da `#213`. Chiudendo i percorsi formativi ho misurato **tutte** le tabelle che hanno
insieme una colonna `*_tenant_id` e una `*_is_global`, invece di fermarmi alla mia: sette
tabelle, e lo stato impossibile — `tenant_id IS NULL` **e** `is_global = false`, cioè invisibile
a ogni azienda — c'era in tre.

**La misura uguale non fa la cura uguale.** Applicare a 32 righe il gesto studiato per 7
— la rimozione — avrebbe cancellato i contratti collettivi nazionali.

## Misura di partenza (2026-08-17)

| tabella | righe nello stato impossibile | cura |
|---|---|---|
| `sys_compensation_bands` | **29** | riclassificare (`is_global = true`) |
| `sys_learning_paths` | 5 | ✅ chiuse da `#213` (mig `000321`) |
| `sys_skills` | **3** | da decidere |
| `career_paths`, `kpi_definitions`, `learning_modules`, `payout_curves` | 0 | — |

## Decisioni vincolanti

1. **Le 29 NON si cancellano, si riclassificano.** Sono i **CCNL e i sindacati** —
   `CCNL_CRED_2024` «CCNL Credito 2024», `CCNL_METMEC_2024`, `CGIL`, `CISL`, `FABI`,
   `FILCAMS_CGIL`… — e **I21** li nomina esplicitamente fra ciò che resta **aperto a ogni
   industria** («CCNL/union reference bands»). Sono righe classificate male, non residui.
   Coerente con S1042, dove il criterio «nomina un'entità inesistente» le respinse già come
   falsi positivi.
2. **Le 3 competenze sono un caso diverso**: codice `COMP::<uuid>` — chiave-macchina nel
   *codice*, stessa famiglia di `OLDDB::` e `LEGACY_BAND::` — con nomi veri e italiani
   (`Collaborazione`, `Orientamento ai risultati`, `Orientamento al cliente`), nessun URI ESCO,
   **0 persone** che le portano, create 2026-02-25. Sono competenze comportamentali trasversali:
   o diventano catalogo comune (`is_global`), o appartengono a un'azienda.
3. **Ritirare non è cancellare** (ADR-0035): si emenda il file che crea l'oggetto, non solo
   l'esemplare. Il costo si misura in file da emendare, e va stimato prima di iniziare.

## Fasi

- [x] **F1 La sentinella che vale 32 adesso e 0 dopo** — FATTO 2026-08-18 · `sys.v_righe_senza_titolare_e_non_globali` (mig. `000325`) · misurata **32 prima** e **0 dopo**, e provata capace di vedere: due righe-sonda in transazione la portano a 2 nominando entrambe le tabelle, il `ROLLBACK` la riporta a 0
- [x] **F2 Le 29 bande: una UPDATE guardata** — FATTO 2026-08-18 · `UPDATE 29` con elenco esplicito dei 29 codici, mai un jolly · post-condizione che protegge anche il totale delle bande, confrontato col PRIMA misurato nella stessa transazione
- [x] **F3 Le 3 competenze: la misura ha ribaltato la decisione del piano** — FATTO 2026-08-18 · `DELETE 3` con giornale di undo (`staging.competenze_orfane_rimosse_undo`) · i 68 usi dei gemelli vivi verificati intatti prima e dopo
- [x] **F4 La prova generale e la scrittura dell'esito** — FATTO 2026-08-18 · `ci-rehearsal.sh` VERDE su due passate, sentinelle **21/21** a zero (la nuova entra da sé nella batteria) · migrazione ri-applicata in produzione senza errori: è idempotente

## Il ribaltamento, che è la cosa da ricordare

**Questo piano diceva la cosa sbagliata sulle 3 competenze**, e la misura sul vivo l'ha
smentito. Diceva: *«sono trasversali, senza persone e senza appartenenza — la lettura da
difendere è `is_global = true`»*. Prevedeva anche il ramo giusto — *«se il catalogo ne
contenesse già gemelli per nome, la cura diventa la fusione: si misura prima»* — ed è
esattamente quello che è successo:

| nome | la riga orfana | il gemello in RTL_BANK |
|---|---|---|
| Collaborazione | 0 usi | 1 persona · 2 requisiti |
| Orientamento ai risultati | 0 usi | 19 persone · 25 requisiti |
| Orientamento al cliente | 0 usi | 48 persone · 53 requisiti |

Non erano competenze comportamentali da promuovere: erano **copie morte** di righe vive,
create lo stesso giorno (2026-02-25), sopravvissute alla deduplicazione della `000189`
perché quella raggruppava per `(tenant, nome)` e queste hanno tenant diversi — NULL contro
RTL. Promuoverle a globali avrebbe messo nel catalogo comune il doppione di una competenza
che un'azienda già possiede.

**ADR-0035 verificato, non assunto**: l'unico file che le crea è archiviato e fuori dalla
catena (`docs/archive/etl-brownfield-ritirato/…/wave1_skilgro.sql`), quindi la rimozione non
viene disfatta al deploy dopo. Stesso accertamento di `#213`.

## Due cose imparate eseguendo

1. **Le post-condizioni con numeri cablati sarebbero state verdi qui e rosse in CI.** La
   prima stesura pretendeva «68 usi» e «almeno 29 bande»: sul database della CI, che non ha
   i dati caricati dagli script, quei numeri non esistono. Riscritte contro una fotografia
   del **prima** presa nella stessa transazione — così il controllo tace dove non c'è nulla
   da misurare, invece di mentire.
2. **Rimuovere una competenza lascia orfane le sue traduzioni.** Applicata la cura senza
   quel blocco, `db_health` è uscita **rossa** con 6 righe (3 competenze × 2 lingue). La
   `000239` aveva già lo stesso blocco per la stessa ragione: non me lo sono ricordato, l'ho
   visto perché la batteria l'ha detto.

## Chiuso quando

Nessuna riga di `sys_compensation_bands` e `sys_skills` ha insieme `tenant_id IS NULL` e
`is_global = false`, e per ciascun gruppo è scritto quale cura ha ricevuto e perché.
