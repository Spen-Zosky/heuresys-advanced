# X-2 — proposta per `sys_attendance`, in attesa di ratifica di Enzo

Misurato S1112, 2026-09-19:

```sql
select attendance_source, count(*) from sys.sys_attendance group by 1;
```

```
 IMPORT | 122271
```

Un solo valore su tutte le 122.271 righe: `attendance_source = 'IMPORT'`. Nessuna riga porta
un altro valore — non c'è materializzazione, non c'è scrittura nativa mai avvenuta.

**Proposta**: `origine_dato = 'IMPORT'` per tutte le righe esistenti, mappatura 1:1 diretta
(`attendance_source='IMPORT' → origine_dato='IMPORT'`). Non serve una tabella di corrispondenza
a più valori: c'è un solo valore da mappare. La colonna nasce con `DEFAULT 'IMPORT'` e un
`CHECK` che vieta 'NATIVO'/'MATERIALIZZAZIONE' finché non esisterà un vero scrittore nativo di
presenze (che oggi non esiste — nessuna rotta API scrive su `sys_attendance`, verificato con
`grep -rn "INSERT INTO sys.sys_attendance" apps/api/src` → zero risultati fuori da script di
seed/import).

**Resta ATTESA_ENZO per decisione esplicita del mandato** (è un giudizio sui dati, non una
scelta tecnica): la migrazione di questa tabella NON parte finché Enzo non conferma. Le altre
tabelle di X-2 procedono senza aspettare questa risposta.
