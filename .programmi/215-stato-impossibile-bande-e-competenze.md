# 215 — Lo stesso stato impossibile in altre due tabelle, dove la cura è l'opposto

> **item**: #215
> **stato**: NON AVVIATO

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

- [ ] **F1 La sentinella che vale 32 adesso e 0 dopo** — budget ~15k
      Una vista o un controllo che conta le righe nello stato impossibile nelle due tabelle.
      Va provata con una riga-sonda come si è fatto per `sys.v_learning_paths_senza_titolare`
      (inserita in transazione, contata, `ROLLBACK`). **Se valesse 0 già adesso misurerebbe la
      cosa sbagliata.** ⚠ Una vista `sys.v_*` nuova diventa sentinella automatica di `db_health`
      e pretende zero righe: o è a zero dopo la cura, o va dichiarata informativa.
- [ ] **F2 Le 29 bande: una UPDATE guardata** — budget ~25k
      Elenco esplicito dei codici, **mai un carattere jolly**. Guardia che ri-verifica la
      precondizione al momento dell'esecuzione; post-condizione che protegge anche ciò che **non**
      doveva cambiare (le bande di RTL con importi restano intatte); rollback dichiarato.
- [ ] **F3 Le 3 competenze: decidere e curare** — budget ~15k
      La decisione è tecnica e la prendo dai dati: sono trasversali, senza persone e senza
      appartenenza — la lettura da difendere è `is_global = true` come le altre comportamentali.
      Se il catalogo ne contenesse già gemelli per nome, la cura diventa la fusione, non la
      riclassificazione: **si misura prima**.
- [ ] **F4 La prova generale e la scrittura dell'esito** — budget ~15k
      `bash db/scripts/ci-rehearsal.sh` (obbligatoria su ogni tocco a `db/**`), e per ciascun
      gruppo è scritto **quale** delle due cure ha ricevuto e perché.

## Chiuso quando

Nessuna riga di `sys_compensation_bands` e `sys_skills` ha insieme `tenant_id IS NULL` e
`is_global = false`, e per ciascun gruppo è scritto quale cura ha ricevuto e perché.
