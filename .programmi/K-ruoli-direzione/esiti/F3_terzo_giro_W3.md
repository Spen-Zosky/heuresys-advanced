# Terzo giro di confutazione — X-0 (ADR-0041) e K1-ADR (ADR-0042)

Per Enzo, in cima: il terzo giro ha prodotto **11 confutazioni**, tutte vere (nessuna scartata),
**tutte di precisione, zero di sostanza**. Nessuna tocca il contenuto di una decisione che hai già
letto e approvato. I due ADR sono corretti e **RATIFICATI**: la tua condizione del 2026-09-16
("ratifica subordinata al terzo giro") è soddisfatta. `X-0` e `K1-ADR` sono `CHIUSA`.

## Come si è svolto

Guardiano prima del lancio: contesto 16,8%, finestra 5 ore 7,0% (sotto la soglia del 50% imposta
dal mandato). Lanciato `workflows/W3_confutazione_adr.js` con 6 agenti (3 lenti × 2 ADR, tutti
`sonnet`/`high`, sola lettura): `evidenze/wf_F3_32c_202609162236/`. Nessun agente ha violato il
perimetro di sola lettura; 0 errori; 905.358 token spesi dai sub-agenti (fuori dal contesto di
questa sessione).

## Le 11 confutazioni, una per una

| # | ADR | lente | affermazione confutata | tipo | esito |
|---|---|---|---|---|---|
| 1 | 0041 | database | tabelle `sys.sys_*` = 246, non 245 | precisione | corretto: sono 247 (mancava `sys_ritiri_ammessi`, migrazione 000420) — ri-verificato io stessa in linea |
| 2 | 0041 | database | conflitto ibrido "422/422 invariato" su `sys_time_off_balances` | precisione | riformulato: il numero è una fotografia datata (423/494 oggi), non un fatto fermo |
| 3 | 0041 | codice | i tre ruoli di piattaforma "vedono e scrivono per assegnazione-cliente" come meccanismo operante | precisione | chiarito: l'insieme è vuoto oggi (verificato io stessa: `mandati.ts:37`), 3 dei 4 ruoli non esistono ancora nel DB |
| 4 | 0041 | codice | stesso numero di tabelle (246) ripetuto in una nota diversa | precisione | stessa correzione del punto 1 |
| 5 | 0041 | codice | "due convenzioni di nome" senza citazione file:riga | precisione | aggiunta la citazione (`I-D.md` §1, riga 13-15) e la nota che la convenzione vecchia non ha più scrittori vivi |
| 6 | 0041 | decisioni | I23 letto come una restrizione nuova su `HRMS_MANAGER`, non autorizzata oltre D3 | precisione | chiarito: I23 nomina un'assenza di rotta già vera prima di questo ADR, non toglie nulla che `HRMS_MANAGER` avesse oggi; l'unica eccezione a I22 resta D3 |
| 7 | 0041 | decisioni | scritto `IMPORT` invece di `IMPORTATO` in due punti (viola D7: nomi letterali) | precisione | corretto in entrambi i punti |
| 8 | 0041 | decisioni | "importato... mai un'interfaccia" contraddetto dalla cancellazione GDPR, che è una porta reale | precisione | aggiunta l'eccezione GDPR anche nella colonna e nel paragrafo che non la citavano (era già nel Contesto) |
| 9 | 0042 | database | tabella dei quattro modi non aggiornata dopo la riclassificazione di `sys_tenant_blueprints` (resta a 12, non 13) | precisione | corretto: `sys_tenant_blueprints` aggiunta alla riga C, totale 13 |
| 10 | 0042 | codice | le 28 righe di `sys_skills` del tenant citate come prova che il modo B "funziona", senza verificarne la provenienza | precisione | aggiunta nota: nessuna delle 28 porta la firma della materializzazione (`materialized_from` sempre NULL); il registro dei generati è vuoto; sono CRUD ordinario, non la catena descritta |
| 11 | 0042 | decisioni | R-5 descritto solo come grant di piattaforma a `BLUEPRINT_MANAGER`, omesso il grant di cliente a `TENANT_ADMIN` | precisione | aggiunto il secondo grant, verificato contro il testo esatto del mandato (passo 51) |

## Perché nessuna è sostanza

Il criterio del mandato: sostanza è cambiare quale categoria governa una tabella, o chi può
scrivere dove. Nessuna delle 11 lo fa. Le più delicate (#6, #8) sembravano toccare i permessi di
`HRMS_MANAGER`, ma verificando: l'assenza di rotta che I23 formalizza esisteva già prima di questo
mandato (nessuno, nemmeno `HRMS_MANAGER`, aveva mai una rotta per scrivere ordinariamente su una
tabella importata), e l'eccezione GDPR era già dichiarata nel Contesto dell'ADR — mancava solo
ripeterla nei due punti dove il testo sembrava contraddirla. Nessuna riga di codice, nessuna
migrazione, nessun permesso cambia per effetto di queste correzioni: cambia solo il testo dei due
ADR.

## Bilancio dei tre giri

| giro | confutazioni | confermate | di sostanza |
|---|---|---|---|
| 1 | 13 | 13 | 0 |
| 2 | 9 | 9 | 0 |
| 3 | 11 | 11 | 0 |
| **totale** | **33** | **33** | **0** |

## Esito

`X-0` (ADR-0041, invariante I23) e `K1-ADR` (ADR-0042, catena del semilavorato): **RATIFICATI**,
stato `ACCETTATO` nei due file. Voci `STATO.md` portate a `CHIUSA`.
