# X-2 — universo delle tabelle e default, decisione tecnica S1112

## Il numero "11" non ha un elenco esplicito nel mandato

`K-mandato-v2.md` (passo 61) parla di "colonna origine_dato sulle 11 tabelle" e di "6
importate/ibride più piccole" (sessione 1) + "5 restanti" (sessione 2), ma non elenca MAI le
11 per nome. L'unica fonte canonica che le nomina è lo strumento che il passo 61 stesso
dichiara come misura di partenza:

```python
# .programmi/K-ruoli-direzione/tools/misura_k.py
TABELLE_AMMINISTRATIVE = [
    "sys_user_contracts", "sys_attendance", "sys_user_pay_slips",
    "sys_time_off_requests", "sys_time_off_balances", "sys_leave_accrual_rules",
    "sys_leave_balance_transactions", "sys_user_identity_documents",
    "sys_compensation_bands", "sys_position_compensation_profiles",
    "sys_compensation_recommendations", "sys_payroll_handoff_records",
    "sys_overtime",
]
```

13 righe, non 11 — il commento del file lo dichiara: "Le 12 tabelle amministrative del
dossier (Parte K3) + `sys_overtime`... 13 righe". Il "12" o "11" del testo prosaico del
mandato precede quindi l'estensione K3.3 che ha aggiunto `sys_overtime` (e probabilmente
`sys_compensation_bands`/`sys_leave_accrual_rules`).

**Decisione**: uso le 13 di `TABELLE_AMMINISTRATIVE` come universo — è la fonte più fresca e
canonica, esplicitamente lo strumento di misura del mandato stesso, non un numero scritto a
mano in un paragrafo. `sys_attendance` resta a parte per la ratifica di Enzo (`esiti/X-2_attendance.md`).
**Restano 12 tabelle da migrare in questa sessione** (non 10 — il conteggio "10" del testo
prosaico del mandato eredita la stessa imprecisione).

## Il default: "dire il vero" applicato a tutte, non solo a D6

Il mandato prescrive `DEFAULT 'IMPORT'` per le tabelle classificate `importato`, `DEFAULT
'NATIVO'` per le `nativo`, con l'eccezione esplicita delle 4 tabelle di D6 → `MATERIALIZZAZIONE`
("seminate dal collaudo: dire il vero"). Ho verificato **sul vivo**, per ciascuna delle 12,
quale sia davvero l'origine delle righe esistenti — non mi sono fidato della sola
classificazione X-1 (che descrive il pattern *concettuale* atteso, non necessariamente le
righe di oggi):

| tabella | stato X-1 | righe | verifica sul vivo | default scelto |
|---|---|---|---|---|
| sys_user_contracts | importato (D6) | — | dichiarata D6, nessuna porta | MATERIALIZZAZIONE |
| sys_user_pay_slips | importato (D6) | — | dichiarata D6, nessuna porta | MATERIALIZZAZIONE |
| sys_user_identity_documents | importato (D6) | — | dichiarata D6, nessuna porta | MATERIALIZZAZIONE |
| sys_position_compensation_profiles | importato (D6) | — | dichiarata D6, nessuna porta | MATERIALIZZAZIONE |
| sys_time_off_requests | ibrido | 2.213 | `request_natural_key LIKE 'TOR::APPROVAL::%'` → **0/2.213**: nessuna riga nativa reale, tutte da seed | IMPORT |
| sys_time_off_balances | ibrido | 1.886 | stesso scrittore nativo (`applyUsageToBalance`) mai esercitato su righe con questa provenienza | IMPORT |
| sys_leave_balance_transactions | **nativo** | 20 | `transaction_natural_key LIKE 'LBT::APPROVAL::%'` → **0/20**: la classificazione dice "nativo" (il codice esiste), ma le 20 righe di oggi sono TUTTE da seed. Applico "dire il vero" alle righe, non alla classificazione concettuale | IMPORT |
| sys_compensation_recommendations | ibrido | 116 | tutte le 116 righe hanno **lo stesso identico `created_at`** (`2026-06-03 20:58:38.829941`) — impossibile da una chiamata API una per una, è il timestamp di un batch (`db/seeds/reconciliation/25_compensation_recommendations.sql`) | IMPORT |
| sys_payroll_handoff_records | ibrido | 37 | scritte da `db/seeds/storia36/03_compensation.sql` (`recipient_system='ZUCCHETTI_PAGHE'` è il destinatario dell'handoff, non la fonte della riga) | IMPORT |
| sys_leave_accrual_rules | importato | 20 | nessuno scrittore API (`grep` vuoto), seed `storia36/13_avanzamento.sql`-adiacente | IMPORT |
| sys_compensation_bands | importato | 41 | nessuno scrittore API, `db/seeds/rtl-rebuild/05_compensation.sql` | IMPORT |
| sys_overtime | importato | 12.128 | nessuno scrittore API (verificato anche in `time-off/repository.ts` e `compensation/repository.ts`, che sono i moduli più vicini concettualmente — zero riscontri), `db/seeds/storia36/13_avanzamento.sql` | IMPORT |

**Perché non `MATERIALIZZAZIONE` anche per queste 8**: tutte le righe di oggi vengono da script
di collaudo/storia sintetica esattamente come le 4 di D6. La differenza che il mandato traccia
non è "chi le ha scritte oggi" ma "che canale è previsto per domani": D6 è dichiarata "porta
non ancora costruita" **per sempre**, finché non arriva il primo cliente vero (D6=A, nessun
mandato aperto ora) — la sua origine resta scenografia di collaudo a tempo indeterminato. Le
altre 8 hanno un canale di importazione concettualmente reale (rilevazione presenze, regole di
maturazione ferie, bande retributive, straordinari) che oggi è popolato da storia36 ma non è
dichiarato "sospeso a tempo indeterminato" come D6. Marcarle `IMPORT` invece di
`MATERIALIZZAZIONE` segue la lettera del mandato (l'eccezione è dichiarata solo per le 4 di
D6) ed evita di inventare una terza categoria implicita.

## Le colonne dei "cinque scrittori nativi" e "due scrittori di importazione"

Il passo 61 chiede anche che i cinque scrittori nativi noti scrivano `'NATIVO'` esplicitamente
e i due scrittori di importazione scrivano `'IMPORT'` esplicitamente — **non solo la
migrazione con un default**. Individuati sul codice attuale:

- **Nativi** (`origine_dato='NATIVO'` da aggiungere al literal INSERT):
  `time-off/repository.ts` → `insertApprovedTimeOffRequest` (sys_time_off_requests),
  `applyUsageToBalance` (sys_time_off_balances, UPDATE),
  `insertUsageTransaction` (sys_leave_balance_transactions);
  `compensation/repository.ts` → `insertCompensationRecommendation`
  (sys_compensation_recommendations), `insertPayrollHandoffRecord`
  (sys_payroll_handoff_records).
- **Importazione**: gli script di seed (`db/seeds/storia36/*.sql`, `db/seeds/rtl-rebuild/*.sql`,
  `db/seeds/reconciliation/*.sql`) — non hanno bisogno di modifica: scrivono senza nominare la
  colonna e ricadono nel `DEFAULT` della tabella, che è già `IMPORT`/`MATERIALIZZAZIONE`
  secondo la riga sopra. Nessuna riga di codice da toccare per loro.

Questo è lavoro di codice, non solo di migrazione — eseguito nella stessa sessione dopo le 12
migrazioni, prima della verifica finale.
