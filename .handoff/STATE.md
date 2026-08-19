# STATE — vista rapida

> Priorità e domande aperte. I numeri (versioni, conteggi, architettura) stanno in
> `docs/kb/SOT_STATE.md`, che è l'altra metà e non ripete niente di quanto è scritto qui.

## Last session brief — l'ultima sessione, in breve

**S1072 — l'archetipo scritto a mano non esiste più.** Il contenuto di un modello si legge dal
database, e la costruzione di un'azienda ha smesso di produrre sempre la stessa banca. Chiuse
cinque voci: `#132` F2 e F3, `Z-251`, `#218` per intero, `#69` per intero, `#211` per intero.
Ogni fase è passata dalla prova generale sul gemello e da un sabotaggio che la rendeva rossa.

Il filo che le lega: **una misura vera può suggerire una conclusione falsa**. È successo due
volte in un giorno — su `#132` F1 e su `#218` F2 — e in entrambi i casi la smentita stava nel
file che crea l'oggetto. Ne è nata una memoria di lavoro.

## Top priorities — le priorità

1. **`#132` F4 — il motore di ricerca.** L'indagine è fatta e ridimensiona la fase: il registro
   delle corse **esiste già** (tre moduli API completi su cinque tabelle), manca solo il motore
   che le esegue. Da progettare per prima la difesa §4.4 — una pagina web può contenere
   istruzioni, e senza motore non esiste ancora il punto in cui metterla.
   ⚠ Le tabelle di acquisizione **sono già in uso da storia36**: conviverci, non appropriarsene.
   → `.programmi/132-ricerca-genera-il-modello.md` · ~1-2 sessioni per F4
2. **`#198` T9b — la costruzione in produzione.** Resta bloccata, e ora si sa fino a quando:
   `#132` F6. La versione ancorata dichiara `BLUEPRINT_CONTENT` e quelle tabelle sono vuote,
   quindi l'atto si rifiuta invece di costruire una quarta banca.
3. **`#219` — gli otto guasti dietro i rossi della E2E.** Nuova, nata dal triage di `#211`.
   Prima le due firme che potrebbero non essere guasti (MFA e il test che riceve 400): se
   l'ipotesi regge, tolgono 3 casi su 12 senza toccare il prodotto.
   → `.programmi/219-otto-guasti-suite-e2e.md`

## Open questions — le domande aperte

1. **Il dominio «processi» ha due case, e una è nata vuota.** `sys_blueprint_process_registry`
   esisteva già (23 righe, agganciata alla versione) e `#132` F1 ne ha creata una seconda,
   ancora vuota. `#132` F5 dovrà sceglierne una — e la scelta non è simmetrica: le due
   attribuiscono il processo a cose diverse, una posizione contro una unità.
2. ✅ **CHIUSA in S1074 — il clone di CI e la produzione NON sono alla deriva.** La domanda
   diceva che su `sys_source_lineage_records` il clone portava una FK su `tenant_id` che la
   produzione non ha. **Non riproduce**: misurato il 2026-08-19, il vincolo
   `sys_source_lineage_records_source_lineage_tenant_id_fkey` c'è in **entrambi**, identico.
   E il confronto strutturale dell'intero schema `sys` non lascia margine: **nessuna** tabella
   esiste nel clone e manca in produzione; le sole due in più in produzione sono di quel giorno
   (`sys_research_sources` e la sentinella `v_research_evidence_source_not_approved`, mig.
   `000333`). Anche lo scarto dei vincoli torna **uno per uno**: 5 `CHECK` e 4 FK in più in
   produzione = i 4 `CHECK` + 3 FK della tabella nuova, più il `CHECK` sulla coppia e la FK
   verso la versione di fascicolo aggiunti a `sys_seed_acquisition_runs`. Il clone è **indietro
   di una sessione**, non divergente, ed è il suo comportamento normale: lo riallinea il proprio
   processo, non le migrazioni applicate a mano.
3. **La suite E2E non entra in CI**, per criterio dichiarato in `#211` F4: dura ~25 minuti su
   un runner che ne impiega già ~20 per la suite API. Entra quando `#219` porta i falliti a zero.

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py          # menu + salute, un giro solo
python docs/kb/tools/guardiano.py              # contesto e finestra 5h, misurati
python docs/kb/tools/censimento_riferimenti_orfani.py --da-risolvere   # deve dire 0
bash scripts/verifica-deploy.sh                # com'è finita in produzione
```
