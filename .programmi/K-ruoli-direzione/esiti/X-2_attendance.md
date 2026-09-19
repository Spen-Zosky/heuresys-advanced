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

## Riconciliazione con la misura di Cowork (2026-09-19 16:00, COWORK_INBOX.md)

Cowork ha misurato la stessa cosa **indipendentemente, sul gemello** (non produzione):
`attendance_source` ha un solo valore, IMPORT, su 122.115 righe (leggermente diverso dalle
122.271 di produzione — normale disallineamento gemello/produzione, non un problema). Le due
misure, fatte su due macchine diverse con due strumenti diversi, **si confermano a vicenda**.

Cowork aggiunge un dato utile che io non avevo misurato: `attendance_status` ha **sette**
valori (PRESENT, REMOTE, VACATION, SICK, TRAINING, PAID_LEAVE, ABSENT), non tre — e ogni
combinazione status×source ha comunque `source=IMPORT`. Non cambia la proposta (la mappatura
riguarda `origine_dato`, non `attendance_status`), ma conferma che non c'è alcuna riga
"nascosta" con un'origine diversa dietro uno status meno comune.

**Domanda riformulata per Enzo, più semplice di quella originale del mandato** (proposta di
Cowork, che condivido): non c'è una corrispondenza a tre stati da ratificare — c'è un solo
valore nei dati. La domanda diventa: *«va bene che tutte le presenze esistenti risultino di
origine IMPORTATA?»*

**Il difetto di `attendance_source_reference` vuoto**: Cowork lo ha trovato indipendentemente
lo stesso giorno; io l'ho misurato anch'io durante X-6 (`esiti/X-6.md`, ipotesi 1) — stesso
fatto, due scoperte indipendenti. Cowork lo assegna a X-3; io in X-6 l'ho usato per escludere
l'ipotesi 1 (il campo non porta alcuna traccia della corsa di importazione). Non è un difetto
di X-3 in senso proprio (X-3 riconcilia le DUE GRAFIE del nome tabella nel registro, non
il contenuto dei campi delle tabelle bersaglio) — è piuttosto la stessa osservazione di X-6:
nessuno scrittore vivo di `sys_attendance` ha mai popolato quel campo. Registrato una sola
volta, qui, per non duplicarlo fra i due esiti.
