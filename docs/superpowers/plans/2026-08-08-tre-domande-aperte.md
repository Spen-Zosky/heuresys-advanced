# Piano — le tre domande aperte di S1049, risolte

**Sessione**: S1050 · **Aperto**: 2026-08-08 · **Mandato**: Enzo, «fai esattamente quello che hai proposto».

Le tre domande aperte lasciate da S1049 (`.handoff/STATE.md` §Open questions) hanno una risposta
misurata, non una preferenza. **La misura ha smentito il piano tre volte** — è la regola 1 del
metodo di bonifica applicata: il registro e il piano sono ipotesi, il database è la verità.

---

## Cosa la misura ha smentito

| # | Ipotesi di partenza | Cosa dice la misura |
|---|---|---|
| 1 | «la batteria si ferma al primo rosso» | Il **motore raccoglie già**: 65 controlli, ognuno avvolto in un gestore. Il punto cieco è **dentro** le 39 funzioni multi-parte → **99 sotto-verifiche** invisibili |
| 2 | «RAL e buste non coincidono, ~1,5% su 152 persone» | Lo scarto è il confronto di **12 mesi di storia** contro **lo stipendio di oggi**. La regola vera (`ultima busta × 13 = RAL`) regge su **148/158** |
| 2-bis | «10 persone hanno le buste sbagliate, vanno riparate» | **Le buste sono CORRETTE.** L'aumento è del **2026-08-04** (mig. 000264), l'ultima busta chiude il **2026-07-31**: la busta di agosto non esiste ancora. **Scarti non spiegati: 0 su 158** |
| 3 | «la password derivata espone i dati personali del proprietario» | Il suo account ha **0 buste, 0 contratto, 0 scheda impiego**. Il raggio d'azione è il *mandato*, identico a prima di #139. I difetti veri sono altri due |

---

## Voci del ciclo

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **C1** | Il segreto authenticator del proprietario è l'unico dei 158 in chiaro → cifrarlo | Claude | `select` che conta i segreti in chiaro = **0** | ✅ **0 in chiaro / 158 cifrati**, in PROD e sul clone CI. Login del proprietario provato dopo: 4 test verdi |
| **C2** | Guardia permanente: nessun segreto authenticator può stare in chiaro | Claude | vista sentinella creata, `db_health` la interroga, verde | ✅ `sys.v_mfa_secrets_in_cleartext`, selftest di accensione verde |
| **B1** | Propagare la promozione dei 10 a `sys_user_employment` — **alla fonte** (mig. 000264), non a valle | Claude | `employment.salary = contract.RAL` su **158/158**; prova generale CI verde | ✅ **0 disallineati** (erano 10). Prova LIVE su PROD: Tommaso Fiore e Roberta Caputo vedono QD3 / 73.000 e 73.200 nel proprio portale |
| **B2** | Sentinella: uno scarto busta↔contratto è ammesso **solo** se il contratto è più recente della busta | Claude | vista sentinella a **0**, e sa diventare rossa (selftest) | ✅ `sys.v_payslip_contract_mismatch` a 0; selftest riscritto dopo che il trigger `set_updated_at` l'aveva reso cieco |
| **A1** | Le 39 funzioni multi-parte dichiarano **tutti** i loro guasti, non il primo | Claude | 0 funzioni con `RAISE EXCEPTION` di check non accumulato | ⬜ |
| **A2** | I 125 selftest reggono al messaggio combinato (`LIKE 'X%'` → `LIKE '%X%'`) | Claude | `storia36.sh custodia` verde, tutti i selftest passano | ⬜ |
| **D1** | Registrare «separare i due segreti» come voce, agganciata a #147 | Claude | blocco nel register, `handoff_lint` verde | ⬜ |

**Confine di sessione dichiarato adesso**: C1·C2·B1·B2·D1 sono chiudibili in questa sessione.
**A1 è la voce a rischio** — 39 funzioni su 6.610 righe. Se non chiude, si dichiara non chiusa.

---

## Simulazione a 5 domande (R24 §3) — le risposte SONO findings

### C1 — cifrare il segreto in chiaro
- **Precondizioni**: `db/scripts/encrypt-totp-secrets.ts` esiste; la chiave di cifratura è la stessa che ha cifrato gli altri 157.
- **Meccanismo**: **letto, non presunto** — va aperto lo script prima di lanciarlo: se rigenera invece di cifrare, cambia il segreto a tutti e 158.
- **⚠ Correzione al mio stesso annuncio**: avevo detto «lo rigenero invece di cifrarlo». **Non è possibile**: il segreto è *derivato in modo deterministico* da chiave madre + email (`deriveTotpSecret`), quindi rigenerarlo restituisce lo stesso valore. Una rotazione vera richiederebbe di ruotare la chiave madre, che cambierebbe **tutte** le 158 password — il codice lo vieta esplicitamente. Quindi: **si cifra, non si ruota**, e il valore resta derivabile da chi ha la chiave madre — che è la condizione di progetto, non un difetto di stanotte.
- **Propagazione**: è un dato, non un file → vive nel DB di produzione; VM e linux-pc leggono lo stesso DB.
- **Chi**: Claude.
- **Guardia**: prima di scrivere, ri-contare i segreti in chiaro (deve essere **1**, non 0 e non 2).

### C2 — guardia permanente
- **Precondizioni**: esistono già 12 viste sentinella `v_*` interrogate da `db_health.py`.
- **Meccanismo**: nuova vista che elenca i segreti in chiaro; deve entrare nell'elenco che `db_health.py` interroga — **verificare come le scopre**, non assumere che basti il prefisso `v_`.
- **Propagazione**: migrazione → catena → tutti gli host.
- **Chi**: Claude.
- **Guardia**: la vista deve saper diventare rossa (regola 5) — provata iniettando un valore in chiaro e rollbackando.

### B1 — propagare la promozione
- **Precondizioni**: mig. 000264 applicata; 10 righe disallineate; **0 scarti busta non spiegati**.
- **Meccanismo**: **ADR-0035** — la 000264 è il file che *crea* il disallineamento (alza il contratto senza propagare). Si emenda **quella**, aggiungendo la propagazione a `sys_user_employment` più una post-condizione che la verifica. Una migrazione a valle funzionerebbe, ma lascerebbe la 000264 capace di ri-creare il difetto.
- **⚠ Le buste NON si toccano**: l'aumento è di agosto, la busta di agosto non esiste. Riscriverle sarebbe falsificare la storia.
- **Propagazione**: `db/migrations/**` → catena → **prova generale obbligatoria** `ci-rehearsal.sh` prima di applicare.
- **Chi**: Claude.
- **Guardia**: ri-misurare le 10 al momento dell'esecuzione (mai ereditare la misura). **Post-condizione che protegge ciò che NON doveva cambiare**: 161 persone, 5.641 buste, 0 scarti non spiegati — invariati.
- **Rollback**: giornale `staging.employment_salary_undo` popolato **prima**, con la funzione che lo applica.

### B2 — sentinella busta↔contratto
- **Precondizioni**: la relazione `ultima busta × 13 = RAL` regge su 148/158; i 10 scarti sono tutti spiegati da `contract.updated_at > payslip.period_end`.
- **Meccanismo**: vista che elenca **solo** gli scarti *non* spiegati. Oggi = 0.
- **⚠ Va TOLTO il confronto sbagliato**, se esiste in batteria: somma-12-mesi contro RAL è la domanda sbagliata e sarebbe rossa per sempre. **Da verificare che esista prima di dire di averla tolta.**
- **Chi**: Claude.
- **Guardia**: selftest che inietta uno scarto non spiegato e verifica che la vista lo veda.

### A1/A2 — la custodia dichiara tutto
- **Precondizioni**: 65 funzioni, 39 multi-parte, 99 sotto-verifiche nascoste, 125 selftest con confronto a **prefisso**.
- **Meccanismo**: ogni sotto-verifica accumula in un `text[]` locale invece di sollevare; un solo `RAISE EXCEPTION` alla fine con tutti i messaggi uniti. `RAISE EXCEPTION 'msg', a, b` → `format('msg', a, b)`: stessi segnaposto, conversione diretta.
- **⚠ Trappola misurata**: i selftest confrontano con `SQLERRM LIKE 'C6c(ii)%'` — **a prefisso**. Con il messaggio combinato il prefisso è quello della *prima* sotto-verifica rossa, e il selftest fallirebbe. Vanno portati a `LIKE '%C6c(ii)%'`: resta falsificabile (un guasto diverso non contiene quella stringa).
- **⚠ Secondo rischio**: non tutti i `RAISE EXCEPTION` dentro una funzione sono *verifiche* — alcuni sono guardie di precondizione (es. «universo vuoto»), e quelle **devono** interrompere subito. Vanno distinte una per una, non convertite in blocco.
- **Propagazione**: `db/scripts/verify-storia36.sql` è versionato → `align-clones` lo porta su VM e linux-pc.
- **Chi**: Claude.
- **Guardia**: la custodia era **verde** prima; deve restare verde dopo, con **tutti** i selftest passati. Un selftest che smette di accendersi è una prova che ha smesso di poter fallire.

### D1 — registrare la voce
- **Precondizioni**: register in `docs/kb/SOT_BACKLOG.md`, integrità da `handoff_lint.py`.
- **Meccanismo**: blocco strutturato nell'Action register, `GATED` su #147.
- **Chi**: Claude.
- **Guardia**: `handoff_lint.py` verde (10 controlli bloccanti).

---

## Fuori da questo ciclo (registro separato — R24 §5)

Scoperte durante la misura, **non** pendenze di questo ciclo, presentate una volta sola:

1. **3 buste di Chiara Spenuso** hanno il periodo scritto in un formato diverso (`September 2025` invece di `2025-09`) e la sua storia si ferma a novembre 2025 mentre tutti gli altri arrivano a luglio 2026.
2. **La 000264 non ha snapshot di rollback**: dichiara «rollback dallo snapshot pre-migrazione» ma lo snapshot non è nel file.
3. **Lo stipendio è scritto in tre posti** (contratto, scheda impiego, buste) e nessuno è dichiarato padrone nello schema. B1 ripara le righe; la dichiarazione di proprietà resta da fare.
