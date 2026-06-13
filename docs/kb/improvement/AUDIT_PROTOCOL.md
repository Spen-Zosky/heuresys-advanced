# AUDIT_PROTOCOL — metodo forense del programma 100X

> Operativizza il §3 del kickoff. Vale per ogni sessione di audit (S-100X-A?). Ogni sessione successiva riparte leggendo `MASTER_PLAN_100X.md` + `TODO_100X.md` + questo file come primo atto.

## Principi vincolanti

1. **Evidence > narrative diagnosis**: ogni finding cita comando + output reale, oppure `path:linea`. Nessuna diagnosi a impressione.
2. **Granularità E2E**: per ogni WS si percorre l'intera catena **codice → config → test → CI → deploy → doc**, non solo il codice.
3. **Baseline PRIMA di proporre**: misura tempi/dimensioni/latenze/durate/coverage prima di qualsiasi raccomandazione (aggiorna `BASELINE_METRICS.md`).
4. **Sub-agent split**: l'esplorazione va in sub-agent read-only (Explore/general-purpose); la **sintesi** resta nel main thread (mai delegata).
5. **Time-box 60-90 min** sui rabbit hole; 2+ tentativi falliti nella stessa direzione → cambia approccio.
6. **Read-only nelle fasi A**: nessuna modifica a codice/schema/config/CI/deploy; nessuna azione su ambienti live oltre a letture. Le modifiche sono solo in fase E (esecuzione), su branch, post-go.
7. **Secret hygiene**: mai stampare valori di segreti; solo nomi/struttura/`path:linea (redatto)`.

## Classificazione finding

- **Severità**: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW` · `INFO`.
- **Flag**: `QUICK-WIN` (≤1h, zero/low rischio, eseguibile come CLASS-A su go) · `DOSSIER` (richiede decisione Enzo) · `ASSET` (conferma di una forza da non toccare).

## Template FINDING (in `FINDINGS/WS-<x>.md`)

```
### F-<WS>-<n> — <titolo>
- Severità: <CRITICAL|HIGH|MEDIUM|LOW|INFO>  | Flag: <QUICK-WIN|DOSSIER|ASSET>
- Evidenza: <comando + output | path:linea>
- Impatto: <perf|robustezza|DX|UX|footprint|sicurezza>
- Baseline: <misura corrente>
- Proposta: <azione | rimando a dossier D-NN>
```

## Template DOSSIER (in `DOSSIERS/D-NN_<slug>.md`)

```
# D-NN — <oggetto>
## Contesto misurato
<fatti con numeri/evidenza>
## Opzioni
### Conservativa | ### Evolutiva | ### Radicale
  per ognuna: impatto (perf/robustezza/DX/UX) · costo (sessioni/ore) · rischio · reversibilità · prerequisiti
## Raccomandazione motivata
## Cosa decide l'utente
```
Ogni dossier presenta **almeno** una opzione conservativa, una evolutiva, una radicale. Nessun contratto pubblico (`/v1/*`, schema `sys.*`, URL, Zod) né invariante I1-I14 è pre-escluso (esito intervista #2); la decisione è di Enzo.

## Flusso di sessione audit (A?)

1. Step Zero: rileggi le SoT vive + questo file.
2. Recon WS via sub-agent read-only (fan-out per sotto-area).
3. Sintesi main-thread → `FINDINGS/WS-<x>.md` (finding classificati) + baseline aggiornata.
4. Marca i candidati dossier; aggiorna `TODO_100X.md`.
5. Commit doc-only (`docs(kb): 100X A? — WS-<x> findings`); push solo su ask.
6. Context budget esaurito → handoff pulito marcando il residuo nella todo (programma multi-sessione by design).
