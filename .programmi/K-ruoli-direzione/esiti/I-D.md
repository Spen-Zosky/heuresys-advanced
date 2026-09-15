# I-D — Il registro di provenienza normalizzato (passo 17) — ESITO

> **Righe oggi in conflitto fra gesto nativo e saldo importato: 682** (ferie 422 saldi + 62 richieste, straordinari 178, regole di maturazione 20), misurate con `tools/misura_id.py` il 2026-09-15 (evidenza `evidenze/I-D_rimisure_202609150300.txt`, sezione 4).
>
> **Che cosa significa il numero, in parole semplici.** Non esiste ancora la colonna che dice «questa riga è nata qui / è stata importata» (arriverà con X-2). Quindi «in conflitto» oggi vuol dire: la riga è stata importata (sta nel registro di provenienza) **e** qualcuno l'ha modificata **dopo** l'importazione. 682 righe su 16.177 delle quattro tabelle rispondono a questa definizione.
>
> **Ma chi le ha modificate?** Ho guardato *quando*: **681 delle 682 sono state modificate a blocchi** — 26 blocchi, ciascuno con decine o centinaia di righe cambiate nello stesso identico istante — il 27 e il 29 luglio 2026 (le bonifiche di quel periodo) e poi una volta per notte (il lavoro automatico che porta avanti la storia di RTL). Una sola riga ha un istante tutto suo, ed è dello stesso giorno dei blocchi. **Nessuna delle 682 è riconoscibile come il gesto di una persona nella piattaforma** (una richiesta di ferie fatta da un dipendente, per esempio). Delle altre righe delle quattro tabelle, 15.416 non stanno nel registro (sono nate qui o dalla storia, non da un'importazione: per loro il conflitto non si pone) e 79 sono importate e mai più toccate.
>
> **Quindi, per D5:** oggi il conflitto «gesto della persona contro saldo importato» **non si è ancora verificato**; le 682 righe sono importazioni ritoccate da lavori automatici. La regola serve comunque, perché il caso nascerà con il primo cliente vero che importa saldi e usa la piattaforma insieme. **La decisione resta di Enzo: le tre opzioni sono nel rapporto.**

Data: 2026-09-15, sessione S1103. Lettori W1 (`I-D` haiku + `I-D-codice` sonnet, cartelle `evidenze/wf_F1_W1_202609150148` e `_b`), spie trovate; numeri discordanti o non ri-eseguibili **ri-misurati in linea** con `tools/misura_id.py` (transazione READ ONLY, query scritte per intero). Dove lettore e sessione principale differiscono vale la sessione principale (3.6 W3).

## 1. Le due convenzioni del registro = due provenienze distinte

`select (source_lineage_target_table_name like 'sys.%'), count(*), count(distinct source_lineage_target_table_name), count(*) filter (where source_lineage_source_natural_key is null) from sys.sys_source_lineage_records group by 1`

| convenzione | righe | tabelle | senza natural key |
|---|---|---|---|
| senza prefisso (`sys_x`) | **64.577** | 29 | 0 |
| con prefisso (`sys.sys_x`) | **6.382** | 7 | **6.382** (tutte) |

Grafie distinte 36 = tabelle normalizzate 36: **nessuna tabella compare in entrambe le grafie**. Le 7 con prefisso sono `sys_attendance` 5.199, `sys_time_off_balances` 498, `sys_overtime` 380, `sys_users` 162, `sys_time_off_requests` 99, `sys_leave_balance_transactions` 24, `sys_leave_accrual_rules` 20 — cioè il pilota tempo/assenze e il pilota utenti del motore brownfield (le schede in `cowork_reserved/batch_c4/time_leave_pilot/mapping_cards/*.md` citano proprio `target_table_name='sys.sys_attendance'`). I «6.382 solo per identificativo» del lettore sono **lo stesso insieme** delle righe con prefisso.

**Scrittori.** In `apps/api/src` **nessuno scrive** il registro: `rg --no-ignore --hidden -c "insert into|INSERT INTO" apps/api/src/modules/provenance apps/api/src/modules/evidence` → 0; i 57 riscontri di `source_lineage` sono tutti letture. Gli scrittori storici sono fuori dal codice vivo: `db/migrations/000257_ingest_legacy_calibration.sql:209-214` (INSERT **senza** prefisso, **con** natural key) e i seed/script del motore brownfield ritirato (`docs/archive/etl-brownfield-ritirato/**`, `cowork_reserved/batch_c*/**`), che per il pilota tempo/assenze hanno scritto **con** prefisso e senza natural key. Il rubinetto è chiuso (ADR-0038): **oggi non esiste un «prossimo scrittore»**; la regola di X-3 vale per chiunque nasca in futuro.

**Consumatori che leggono `target_table_name` senza normalizzare** (`rg --no-ignore --hidden -n source_lineage_target_table_name apps/api/src`):
- `apps/api/src/modules/provenance/repository.ts:53` — filtro `source_lineage_target_table_name = $n` sul parametro del chiamante
- `apps/api/src/modules/provenance/repository.ts:95` e `:105` — `SELECT … GROUP BY source_lineage_target_table_name` grezzo
- `apps/api/src/modules/evidence/repository.ts:189` — `JOIN … ON l.source_lineage_target_table_name = ev.source_table` con letterali `source_table` scritti **senza** prefisso (righe 32-143): per le 7 tabelle con prefisso il JOIN non trova mai nulla

## 2. Orfani del registro (registro > tabella), per tabella normalizzata

Misura completa in `evidenze/I-D_rimisure_202609150300.txt` §2 (36 tabelle). **11 tabelle con orfani, 15.054 orfani totali** (il lettore diceva 15.104: differenza sulle righe reali di `sys_okrs`/`sys_skill_categories`, vince la ri-misura):

| tabella | nel registro | righe reali | orfani | id del registro senza riga |
|---|---|---|---|---|
| sys_skills | 19.764 | 14.031 | 5.733 | 5.758 |
| sys_learning_modules | 4.959 | 92 | 4.867 | 4.959 |
| sys_learning_paths | 3.294 | 66 | 3.228 | 3.230 |
| sys_goal_updates | 1.811 | 1.075 | 736 | 736 |
| sys_goal_comments | 856 | 500 | 356 | 356 |
| sys_job_roles | 231 | 176 | 55 | 91 |
| sys_compensation_bands | 75 | 41 | 34 | 46 |
| sys_skill_categories | 32 | 7 | 25 | 0 |
| sys_job_families | 27 | 16 | 11 | 11 |
| sys_okrs | 20 | 15 | 5 | 5 |
| sys_leave_balance_transactions | 24 | 20 | 4 | 4 |

Due definizioni, entrambe misurate: **per totale** (`max(0, righe_registro − righe_reali)`, quella del dossier) e **per riga** (`id del registro che non trova la riga bersaglio`: `not exists (select 1 from sys.<t> t where t.<pk>::text = l.source_lineage_target_record_id::text)`). La seconda è più vera: `sys_skill_categories` ha 25 orfani per totale ma **0** per riga (32 righe di registro puntano tutte a 7 righe esistenti: duplicati di registro, non orfani); `sys_attendance` ha 0 per totale e **2.154** per riga.

## 3. Le presenze: il divario 3.045 / 5.199 è SPIEGATO

`select count(*) from sys.sys_attendance` = **121.491**. Registro per `sys_attendance`: **5.199** righe, tutte per identificativo, **0** per nome. Di quelle 5.199, **3.045** puntano a una presenza che esiste ancora e **2.154** a un identificativo che non esiste più. Presenze **con** provenienza: 3.045; **senza**: **118.446**. L'ipotesi del mandato («il nome conta anche righe che puntano a identificativi non più esistenti») era **giusta nella sostanza**: il 5.199 è il registro intero, il 3.045 è la parte del registro che trova ancora la sua riga. X-6 eredita la domanda su **perché** 118.446 presenze non hanno provenienza e 2.154 righe di registro hanno perso il bersaglio.

## 4. Conflitti per D5 — la definizione eseguita, per intero

```sql
select count(*) filter (where l.source_lineage_record_id is not null and b.updated_at > l.created_at)
  from sys.<tabella> b
  left join sys.sys_source_lineage_records l
    on l.source_lineage_target_record_id = b.<id> and replace(l.source_lineage_target_table_name,'sys.','') = '<tabella>'
```

| tabella | righe | importate (nel registro) | native (fuori registro) | **in conflitto** | oltre 1 h dall'import | persone coinvolte |
|---|---|---|---|---|---|---|
| sys_time_off_balances | 1.886 | 494 | 1.392 | **422** | 422 | 158 |
| sys_time_off_requests | 2.210 | 69 | 2.141 | **62** | 62 | 52 |
| sys_overtime | 12.061 | 178 | 11.883 | **178** | 178 | 111 |
| sys_leave_accrual_rules | 20 | 20 | 0 | **20** | 20 | 1 (tenant) |
| **totale** | 16.177 | 761 | 15.416 | **682** | 682 | |

Onestà sulla definizione: è un'euristica (X-2 non c'è). Conta **ogni** modifica post-import, comprese quelle delle migrazioni. La prova sugli istanti (§5 dell'evidenza) dice che 681/682 sono modifiche **in blocco** (26 blocchi, 27-29 luglio + notturni) e 1 è ambigua: **zero gesti individuali riconoscibili**. Il valore importato vs nativo **non è confrontabile campo per campo** senza X-2 (il registro conserva solo l'hash del contenuto sorgente, `source_lineage_source_content_hash`).

## Verdetti

- **S-3 — SBLOCCA.** Definizione di «orfano» per la vista: **per riga** — riga di registro il cui `source_lineage_target_record_id` non trova la riga bersaglio nella tabella normalizzata (`replace(target_table_name,'sys.','')`); in aggiunta, per compatibilità col dossier, la colonna «per totale». Nasce ROSSA con **11 tabelle** (per totale) — non 2 — e si dichiara INFORMATIVE con motivo «orfani noti, da spiegare in X-6».
- **X-3 — SBLOCCA.** Consumatori da portare sulla vista normalizzata: `provenance/repository.ts:53, :95, :105`; `evidence/repository.ts:189`. Le 6.382 righe con prefisso sono storia e non si riscrivono (V5); la sentinella «prefisso nuovo» nasce a 0 perché **oggi non esiste alcuno scrittore vivo** del registro.
- **X-6 — eredita**: 118.446 presenze senza provenienza e 2.154 righe di registro delle presenze senza bersaglio (la prima delle tre ipotesi del passo 66 è già suggerita dalla §3).
- **D5 → `ATTESA_ENZO(D5: 682 righe importate e poi modificate in blocco; 0 gesti individuali; opzioni A/B/C)`.** La CLI non decide.
