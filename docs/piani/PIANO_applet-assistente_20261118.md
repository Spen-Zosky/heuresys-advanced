# Piano delle applet dell'assistente (2026-11-18)

Attua [ADR-0060](../architecture/adr/0060_le_applet_dell_assistente.md). Richiesta di Enzo del 2026-11-18 (15:32, 15:37 e 15:40 UTC, thread «Progettare le applet generate dall'assistente»): l'assistente di pagina genera applet sulla base della richiesta della persona e le svolge in autonomia, con limiti e perimetro derivati interamente dai permessi della persona che ha fatto login. Caso guida: «21 processi su 42 non hanno un responsabile in carica», dalla pagina del consolidamento.

**Che cosa non si chiude in questa sessione.** Questa sessione fa solo la voce P0 (ADR, piano, PR di sola documentazione). Tutte le altre voci partono dopo il sì di Enzo su ADR-0060 (voce P1), ciascuna con la sua PR, le sue prove e la sua dimostrazione dal vivo (ADR-0026). P5 e P8 aspettano che siano unite le PR #298 e #300.

## Le voci

| id | cosa | file e comandi | chi | fatta quando | stato |
|---|---|---|---|---|---|
| P0 | ADR-0060 e questo piano | `docs/architecture/adr/0060_le_applet_dell_assistente.md`, questo file, `python docs/kb/tools/build_adr_index.py` | Claude | PR di sola documentazione aperta | fatta |
| P1 | Sì di Enzo su ADR-0060 e sulle decisioni della sezione «Che cosa decide Enzo» | — | Enzo | stato ACCETTATO scritto nell'ADR | fatta (2026-11-18, 15:50 UTC, «Accetto tutto») |
| P2 | Misura del caso guida in produzione, in sola lettura, divisa per causa | query della sezione «Misura del caso guida», via tunnel | Claude | numeri per causa scritti qui con comando, output e orario | aperta |
| P3 | Rotta mancante: il responsabile di un processo del tenant (`PATCH /v1/tenant-processes/:id/owner`, più `GET /v1/tenant-processes/:id` per rileggere), classe B, annullabile rimandando `previousOwnerPositionId`. Nessun permesso nuovo: usa `bpm_process:read` e `bpm_process:update`, che esistono dalla 000005 senza rotta (TENANT_ADMIN, HRMS_MANAGER, BLUEPRINT_MANAGER, PROCESS_OWNER); il PROCESS_OWNER cambia solo i processi di cui regge la posizione responsabile | `apps/api/src/modules/tenant-processes/`, `packages/shared/src/schemas/tenant-processes.ts`, `apps/api/test/tenant-processes.integration.test.ts`, tolte le due righe da `permessi-senza-rotta.allowlist.json` | Claude | prove d'integrazione verdi in CI; dimostrazione dal vivo con Valentina Conti su un processo | codice scritto il 2026-11-18, typecheck e lint verdi in locale; pubblicato il 2026-11-20 nella PR della voce P3 |
| P4 | Catalogo derivato dai permessi: `GET /v1/applets/catalogo` restituisce per la persona ogni operazione con classe e stato `ESEGUIBILE` / `DA_RICHIEDERE` / `NON_DISPONIBILE`, e per `DA_RICHIEDERE` il ruolo che può | `apps/api/src/modules/applets/catalogo.ts`, lettura di `docs/kb/atlas/agent-operations.json` e di `classi-azioni.ts` (la classe va spostata in un modulo condiviso fra API e gateway) | Claude | prova: per ogni ruolo del tenant il catalogo coincide con la matrice dei permessi (`sys.sys_auth_role_permissions`) | aperta |
| P5 | Schema `AppletSpec` (sei parti, nessun campo libero, nessun codice) e libreria dei componenti v1 | `packages/shared/src/schemas/applets.ts`; repo `ux-design-shared` per i componenti | Claude | prove dello schema: rifiuta campi ignoti, espressioni, URL, HTML, SQL | aperta |
| P6 | Tabelle dell'applet: applet, versioni con impronta, righe con decisione, passi eseguiti, giornale `staging.agent_applet_undo`; collegamento a `sys.sys_agent_requests` (PR #300) | migrazione nuova in `db/migrations/`, righe in `000429` e `000062` come per la `000501`, allowlist di Storia36, `db/scripts/applets/inversa-<n>.sql` | Claude | catena applicata due volte su una copia (`bash db/scripts/prova-idempotenza.sh`), prova generale della CI sul gemello | aperta |
| P7 | Indagine: quali moduli reggono la prova a secco in transazione condivisa (`AsyncLocalStorage` sul pool di `apps/api/src/db/client.ts`, `withTransaction` annidato come punto di salvataggio) | `apps/api/src/db/client.ts`, elenco dei moduli toccati dal catalogo di scrittura | Claude | elenco moduli «con prova a secco» e «senza», scritto qui | aperta |
| P8 | Esecutore: bozza, decisioni, anteprima a secco, conferma con impronta e CSRF, riconferma del secondo fattore per le C, esecuzione a passi con `app.inject` e sessione della persona, verifica, annullamento per passo e per applet | `apps/api/src/modules/applets/` (routes, service, esecutore, anteprima), `audit.registro_scritture` con riferimento all'applet | Claude | prove d'integrazione per ruolo (HRMS_MANAGER, PEOPLE_MANAGER, capo unità, dipendente); impronta diversa ferma; identificativo non letto rifiutato | aperta |
| P9 | Gateway: lo strumento che crea l'applet (classe A, scrive solo la bozza), istruzioni del modello, previsione di spesa prima di costruirla, righe in `sys.sys_agent_call_log` | `apps/agent-gateway/src/` (`mcp-tools.ts`, `classi-azioni.ts`, `istruzioni.ts`), dopo l'unione di #298 e #300 | Claude | prove del gateway verdi | aperta |
| P10 | Finestra: l'applet disegnata nella conversazione, a tutto schermo e in modale ridimensionabile, avviso arancione, pulsante rosso, barra di avanzamento, ripresa dall'elenco delle attività | `apps/web/src/components/assistente/` (PR #298), componenti da `@heuresys/ui` | Claude | prova E2E con login reale | aperta |
| P11 | Prova avversaria estesa alle applet (rito R5) | `apps/agent-gateway/test/prova-avversaria.test.ts`, prove dell'esecutore | Claude | casi verdi, ciascuno visto rosso togliendo la sua guardia | aperta |
| P12 | Caso guida su copia usa-e-getta: esecuzione, annullamento intero, conteggio di tutte le righe toccate uguale prima e dopo | `bash scripts/copia-prova.sh apri applet "caso guida"`, poi `chiudi` | Claude | comando, output e orario scritti qui | aperta |
| P13 | Caso guida in produzione con Valentina Conti; un annullamento di un singolo passo; la stessa applet aperta da una persona senza mandato | rilascio con `bash scripts/rilascia.sh <sha>`, `scripts/verifica-deploy.sh` | Claude | lente rimisurata dal vivo, traccia di D11 leggibile | aperta |
| P14 | Secondo caso, altro dominio: «27 posizioni critiche non hanno un successore» | nessun codice nuovo atteso: se ne serve, è un difetto del disegno | Claude | dimostrazione dal vivo | aperta |

## Simulazione delle voci che scrivono

- **P3.** Precondizione: P1 fatta. Strumento: modulo API con `requirePermission("tenant_process:update")` e `app.verifyCsrf`; il servizio controlla che posizione e processo siano dello stesso tenant (I5). Chi lo porta in produzione: il rilascio ordinario. Serve Enzo: no, salvo il sì di P1. Guardia: la rotta non accetta posizioni di un altro tenant né processi inattivi; il valore precedente va nel giornale.
- **P6.** Precondizione: P1 fatta, numero di migrazione libero al momento della PR (oggi l'ultimo in volo è `000501`). Strumento: migrazione idempotente provata due volte sul gemello. Chi la porta: il rilascio. Guardia: nessuna tabella esistente cambia; i campi categorici sono `varchar + CHECK`; le colonne che nominano una persona sono `ON DELETE SET NULL`.
- **P8.** Precondizione: P4, P5, P6, P7. Strumento: `app.inject` con la sessione della persona; nessun accesso diretto al database fuori dalle rotte. Guardia: l'esecutore non ha permessi propri; la prova che lo dimostra chiama l'esecutore con una persona senza il permesso e si aspetta `DA_RICHIEDERE`, non una scrittura.
- **P12 e P13.** Precondizione: backup verificato da meno di 24 ore (`bash ~/.claude/tools/backup-verificato.sh heuresys_advanced`). Guardia: il tetto di scritture per applet; l'annullamento provato su copia prima della produzione.

## Misura del caso guida (per la voce P2)

La stessa condizione della lente `processi-senza-responsabile` (`apps/api/src/modules/quadro/lenti.ts`), divisa per causa. Si esegue in sola lettura via tunnel; il tenant si sceglie per nome.

```sql
select case when tp.tenant_process_owner_position_id is null then 'posizione assente'
            else 'posizione scoperta' end as causa,
       count(*) as processi
  from sys.sys_tenant_processes tp
  join sys.sys_tenancies t on t.tenant_id = tp.tenant_process_tenant_id
 where tp.tenant_process_is_active
   and t.tenant_name ilike 'RTL%'
   and (tp.tenant_process_owner_position_id is null
        or not exists (select 1 from sys.sys_user_position_assignments a
                        where a.user_position_assignment_position_id = tp.tenant_process_owner_position_id
                          and a.user_position_assignment_status = 'ACTIVE'))
 group by 1 order by 1;
```

(Colonne verificate sulle migrazioni il 2026-11-18: `tenant_name` in `000367`, le altre nella lente stessa.)

## Che cosa decide Enzo

Tutte con raccomandazione; il sì a ADR-0060 le accoglie come scritte.

| n. | decisione | raccomandazione | perché |
|---|---|---|---|
| E1 | Chi scrive al pulsante rosso | la sessione della persona, attraverso le rotte ordinarie (ADR-0060 D3) | è l'unico modo in cui i limiti coincidono esattamente con i permessi della persona, mandati compresi, senza dare mandati al gettone d'agente |
| E2 | Applet come descrizione o come codice | descrizione dichiarativa con componenti della libreria (D1, D4) | il codice generato è classe X; la descrizione copre gli stessi casi e resta controllabile |
| E3 | Lavoro senza clic | solo azioni B dentro una capacità `LIBERA` di ADR-0053 (D9) | le C non possono essere automatiche per legge; le B lo diventano con le regole già accettate |
| E4 | Azioni che la piattaforma non ha | diventano richieste di sviluppo in coda, con previsione di spesa, e passano dal tuo sì | la coda di sviluppo nasce dall'uso reale; la prima è la rotta di P3 |
| E5 | Ordine | P3 subito dopo il sì (serve al caso guida e non dipende dalle altre PR); P5-P10 dopo l'unione di #298 e #300 | evita conflitti con le PR in coda |

## Registro delle scoperte fuori ciclo

- 2026-11-18: nessuna rotta dell'API scrive il responsabile di un processo del tenant (`grep -rln "tenant_process_owner_position_id" apps/api/src`). Entra nel piano come P3 perché il caso guida la richiede.
