# ADR-0050 — La forza dell'identificazione segue il mandato funzionale

- **Status**: PROPOSTO il 2026-10-31, aspetta la decisione di Enzo
- **Date**: 2026-10-31
- **Redatto da**: Claude Code, thread «Analizzare a fondo le interfacce web di advanced»
- **Richiesta**: Amministratore di Sistema, 2026-10-31 17:09 ora di Roma: «crea la bozza di adr e suggeriscimi a chi vanno assegnati i ruoli funzionali in virtù dei loro scopi di lavoro»
- **Relates to**: ADR-0036 (domini gerarchici e funzionali, §C6 e §5), ADR-0027 (autorizzazione a due assi), ADR-0032 (mandato di piattaforma mascherato), ADR-0040 (l'agente legge ciò che legge la persona), I7, I16–I22
- **Poggia su**: migrazioni 000116, 000118, 000284 (esenzioni MFA), 000432 (Mandato K, R-6: `PEOPLE_MANAGER` nel mandato HR), `apps/api/src/lib/scope/resolver.ts` (`HR_MANDATED_ROLES`, `TENANT_WIDE_MASKED_ROLES`)

> **In parole semplici.**
> 1. Un ruolo gerarchico (capo di un'unità) vede ciò che ha sotto, e il suo perimetro cambia da solo quando cambia l'organigramma. Un ruolo funzionale con mandato (TENANT_ADMIN, HRMS_MANAGER, PEOPLE_MANAGER, DPO, SECURITY_ADMIN, PLATFORM_ADMIN, il custode delle segnalazioni) vede tutto il tenant, e lo deve alla sola concessione.
> 2. Per questo chi porta un mandato va identificato più forte di chiunque altro: secondo fattore sempre, nessuna esenzione, una nuova conferma prima di aprire retribuzioni e valutazioni di tutti.
> 3. Concedere un mandato diventa un atto registrato: chi lo concede, perché, fino a quando. Lo stesso vale per un'esenzione dal secondo fattore.
> 4. Un agente non porta mai un mandato suo: lavora con quello della persona, mai più largo, e lo dichiara.

---

## Contesto

L'analisi forense delle interfacce del 2026-10-31 (rapporto in `/mnt/project-files/analisi-interfacce/V9_rapporto/`, fuori dal deposito) ha misurato in produzione, in sola lettura:

- un'utenza di collaudo con `PEOPLE_MANAGER` e senza unità riceve retribuzioni e valutazioni dell'intero tenant, byte per byte come `TENANT_ADMIN`. È il comportamento voluto (ADR-0036 §C6; 000432): il giudizio di difetto dell'analisi è stato ritirato. Resta però la domanda su **chi** porta quel mandato e **come** entra;
- le utenze `@collaudo.invalid` esenti dal secondo fattore hanno l'esenzione senza scadenza (la tabella `sys.sys_auth_mfa_exemptions` non ha la colonna) e senza autore (`created_by` nullo, registro di audit con attore nullo); fra esse ci sono titolari di `TENANT_ADMIN` e `PLATFORM_ADMIN`;
- per alcuni mandati tenant-wide l'unico titolare in RTL è un'utenza di collaudo;
- nelle concessioni dei ruoli con mandato `user_auth_role_granted_by` (000005) è vuoto: il sistema non sa chi ha dato un mandato;
- la politica MFA (`apps/api/src/modules/mfa-policy`) è la stessa per tutti i ruoli.

Le misure si rifanno con le query dell'analisi (`~/analisi-interfacce-20261031/sql/` sulla VM) o con:

```sql
select r.role_code, u.user_type, count(*) as titolari,
       count(*) filter (where e.enabled) as esenti,
       count(*) filter (where ur.user_auth_role_granted_by is null) as senza_autore
from sys.sys_user_auth_roles ur
join sys.sys_auth_roles r on r.role_id = ur.user_auth_role_role_id
join sys.sys_users u on u.user_id = ur.user_auth_role_user_id
left join sys.sys_auth_mfa_exemptions e on e.user_id = u.user_id
where r.role_code in ('TENANT_ADMIN','HRMS_MANAGER','PEOPLE_MANAGER','DPO','SECURITY_ADMIN','PLATFORM_ADMIN','WHISTLEBLOWING_CUSTODIAN')
group by 1, 2 order by 1, 2;
```

(I nomi delle colonne vanno verificati sull'atlante prima dell'uso: la query è la traccia, non il controllo.)

Heuresys è una piattaforma agentica (regola di Enzo del 2026-10-31): un agente che agisce per conto di chi porta un mandato raggiunge l'intero tenant con una sola chiamata. Il rischio di un mandato rubato cresce con gli agenti, non diminuisce.

## Decisione

**D1 — Insieme dei mandati forti.** Un solo insieme nel codice, `MANDATE_ROLES`, unione di `HR_MANDATED_ROLES`, `TENANT_WIDE_MASKED_ROLES`, `PLATFORM_ADMIN`, `SECURITY_ADMIN` e il custode delle segnalazioni. Ogni regola di questo ADR lo legge da lì; nessuna lista sparsa.

**D2 — Secondo fattore obbligatorio, senza esenzioni, per chi porta un mandato.** La verifica di eleggibilità all'esenzione (000118, 000284) aggiunge una terza condizione: l'utenza non porta alcun ruolo di `MANDATE_ROLES`. Una concessione di mandato a un'utenza esente fallisce; un'esenzione a un'utenza con mandato fallisce. Le utenze di collaudo possono esistere in produzione solo senza mandati, oppure restare sospese fuori dalle finestre di collaudo (PR #130, D-02).

**D3 — Esenzioni con autore e scadenza.** `sys.sys_auth_mfa_exemptions` riceve `expires_at` (obbligatoria, al massimo 30 giorni) e `created_by` obbligatorio (persona, non utente di database). Un'esenzione scaduta vale come assente; un controllo di salute la segnala.

**D4 — La concessione di un mandato è un atto.** Concedere o revocare un ruolo di `MANDATE_ROLES` richiede autore, motivo e data di revisione (`user_auth_role_granted_by`, nuovo `_reason`, nuovo `_review_by`), e passa per proposta → approvazione → effetto da parte di un secondo titolare di mandato (mai chi la riceve). L'evento va nel registro di audit. Le concessioni esistenti senza autore vengono elencate e riconfermate una per una.

**D5 — Nuova conferma prima delle classi sensibili per mandato.** Quando la lettura di `COMPENSATION` o `EVALUATION` di un'altra persona passa per il mandato (asse di audit `hr_mandate`) e non per la catena, la sessione deve avere una verifica del secondo fattore recente (15 minuti, da regolare). Usa la verifica già esistente (`POST /verify-login`, WebAuthn); non vale per i propri dati (I17) né per la catena (I18).

**D6 — Gli agenti non portano mandati.** Un agente non riceve mai un ruolo di `MANDATE_ROLES`. Agisce con l'identità della persona (ADR-0040), dichiara in ogni chiamata per chi agisce, e il suo perimetro è al più quello della persona, restringibile per compito. Un'azione dell'agente che userebbe D5 richiede la conferma della persona, non dell'agente.

**D7 — Separazione dei compiti.** Il custode delle segnalazioni non porta mandati HR né `SECURITY_ADMIN`; `SECURITY_ADMIN` non è `TENANT_ADMIN` sulla stessa persona; `DPO` non porta un mandato HR in chiaro (già ADR-0036 §5, quinta eccezione). Il controllo sta nella stessa funzione di D4.

**D8 — Il ruolo segue il lavoro.** Principio generale e trasversale fissato dall'Amministratore di Sistema il 2026-10-31 alle 17:18 ora di Roma: «concordo sulla tua raccomandazione che il ruolo segua il lavoro. è un principio generale e trasversale, quindi lo applichiamo e controlliamo». Un ruolo, e soprattutto un ruolo funzionale con mandato, si concede solo perché lo richiede lo scopo del lavoro della posizione della persona, mai per comodità o per eredità. Due persone con scopi di lavoro diversi non portano lo stesso mandato soltanto perché stanno nella stessa area. La concessione (D4) cita la posizione che la giustifica. Un controllo periodico confronta i ruoli con le posizioni e segnala le concessioni senza giustificazione e quelle rimaste dopo un cambio di posizione.

## Conseguenze

- I mandati tenant-wide oggi tenuti solo da utenze di collaudo restano scoperti quando quelle utenze vengono sospese: prima di applicare D2, Enzo (o il TENANT_ADMIN del tenant) assegna ogni mandato a una persona vera con secondo fattore. Le assegnazioni sono un dato del tenant e non stanno in questo ADR.
- La documentazione dei ruoli (`docs/kb/xtras/RBAC_COME_FUNZIONA_DAVVERO.md`) va aggiornata: `PEOPLE_MANAGER`, `DPO` e `SECURITY_ADMIN` sono funzionali con perimetro tenant-wide.
- I giri dal vivo con utenze di collaudo diventano più costosi: riattivazione con motivo, esenzione a scadenza breve, sospensione a fine giro.
- D5 aggiunge un attrito per i titolari di mandato. È voluto, e misurabile dal registro di audit.

## Ordine di attuazione proposto

1. D1 e D2 (codice e una migrazione piccola), insieme alle assegnazioni dei mandati a persone vere.
2. D3 (migrazione su `sys_auth_mfa_exemptions`).
3. D4 e D7 (concessione come atto, con riconferma delle concessioni esistenti).
4. D6 (nel gateway degli agenti e nel resolver).
5. D5 (dopo una misura di quante letture passano per `hr_mandate`).

Ogni passo si chiude con una dimostrazione dal vivo su dati reali (ADR-0026).
