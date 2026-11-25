# Utenti con ruoli chiave nelle webapp di Heuresys

Aggiornato il 10/11/2026. Fonte: repository advanced (script di assegnazione dei ruoli, migrazioni, seed) e decisioni di Enzo registrate nel progetto. Non è una lettura del database vivo: questo thread non raggiunge né la produzione né i database della VM. Il codice SQL per rimisurare tutto è in fondo.

Dove un ruolo è stato deciso ma non ho potuto vedere l'esecuzione, la colonna Stato lo dice. Niente password e niente email personali: per le persone di RTL Bank l'indirizzo è nome.cognome@rtl-bank.org.

## Advanced (www.heuresys.com)

### Tenant RTL Bank (cliente modello)

Ordinato per cognome.

| Persona | Funzione nell'organizzazione | Ruoli applicativi attivi | A cosa serve nelle prove | Stato |
|---|---|---|---|---|
| Barbieri, Paolo | Responsabile Ufficio Organizzazione | People Manager | Gestione operativa delle persone, vede tutto il tenant | Concesso il 31/10 (run 2dcc7e1b). Blueprint Manager deciso il 5/11, esecuzione da verificare |
| Bellini, Quintino | Direttore IT (IT Director) | nessun ruolo funzionale | Il Blueprint Manager gli è stato tolto il 31/10 | Revocato |
| Bianchi, Luca | Direttore Operations | Process Owner | Titolare dei processi | Dalla migrazione 000049 |
| Caputo, Paolo | Manager dell'area crediti | Manager, Team Leader | Persona di prova per vista di un responsabile con collaboratori | Persona di prova storica |
| Colombo, Maria | HR Manager, responsabile Amministrazione del Personale | Data Steward, Team Leader | Custode del dato importato; prova del ruolo che segue il lavoro | Concesso il 31/10. HRMS Manager revocato |
| Conti, Valentina | Direttrice HR (HR Director) | Tenant Admin, HRMS Manager, Hiring Manager, Org Director | Vertice HR: mandato di amministrazione del tenant, apertura delle posizioni, console dell'organizzazione | Tenant Admin 31/10; Hiring Manager 5/11 (script p6, esecuzione da verificare) |
| Costa, Alice | Responsabile Infrastrutture (System Administrator) | Security Admin | Sicurezza: sessioni, politiche di autenticazione, deleghe | Concesso il 31/10 |
| De Santis, Marco | Direttore IT | nessun mandato | Il Tenant Admin gli è stato tolto il 31/10 | Revocato |
| Fiore, Tommaso | Collaboratore (riporta a Paolo Caputo) | Utente | Prova dell'area personale `/me` | Persona di prova storica |
| Marchetti, Federica | Direttrice Generale (CEO) | CEO | Vertice esecutivo; dal 31/10 non è più Tenant Admin | Tenant Admin revocato. Test e README la citano ancora come Tenant Admin: da spostare su Valentina Conti |
| Parisi, Antonio | Collaboratore (fuori dalla catena di Caputo) | Utente | Prova del confine fra catene: non deve vedere i dati altrui | Persona di prova storica |
| Rinaldi, Marco | Collaboratore | Utente | Prova dell'utente semplice | Team Leader revocato il 31/10 |
| Rossetti, Alberto | Compliance Officer | Utente | La sola lettura estesa gli è stata tolta il 31/10 | Revocato |
| Russo, Beatrice | Ufficio Organizzazione, Divisione HR | Taxonomy Steward, Recruiter | Governo delle competenze del cliente; conduzione della selezione | Taxonomy Steward 31/10; Recruiter 5/11 (esecuzione da verificare) |
| Santoro, Laura | Specialista Compliance | DPO | Protezione dei dati: accesso mascherato al dossier, esportazione, cancellazione GDPR | Concesso il 31/10 |

Ruoli senza titolare per decisione del 31/10: Hiring Manager (ora assegnato a Conti), Recruiter (ora assegnato a Russo).

Il ruolo Utente è comune a ogni persona e non va assegnato a mano (regola del 31/10).

### Tenant Heuresys System (piattaforma)

| Persona | Funzione | Ruoli applicativi | A cosa serve | Stato |
|---|---|---|---|---|
| Spenuso, Enzo | Amministratore di Sistema | Platform Admin; dal 5/11 anche Blueprint Manager, Sales, Platform Operator, Implementation Consultant | Gestione tecnica della piattaforma; vede Compensi e Valutazioni sempre mascherati | Platform Admin vivo; gli altri quattro dallo script p6 del 5/11, esecuzione da verificare |

### Utenze di collaudo

Quindici utenze con dominio `collaudo.invalid`, sospese in produzione dal 31/10 (esiti nella memoria del progetto). Si riaccendono solo per un giro di prova, con motivo scritto, e si rispengono a fine giro (`pnpm db:sospendi-collaudo`). Non sono persone e non vanno contate fra i titolari dei ruoli.

## Datastore (console e banco)

Il datastore non ha ruoli applicativi per persona. L'accesso è a livello di sito, con autenticazione di base davanti alla pagina:

| Indirizzo | Chi entra | Note |
|---|---|---|
| console.datastore.heuresys.com | Enzo Spenuso (utente `enzo`) | Unica interfaccia di lavoro dal 26/10 |
| banco.datastore.heuresys.com | Utente ospite del banco dimostrativo | Vetrina su una copia del database; non apre la console |

Le password sono nella cassaforte di Drive (`Heuresys/30_cassaforte/`), non qui.

## Come rimisurare dal vivo

Sul gemello o sulla VM, in sola lettura:

```sql
SELECT t.tenant_code, u.user_email, r.auth_role_code
FROM sys.sys_user_auth_roles x
JOIN sys.sys_users u ON u.user_id = x.user_auth_role_user_id
JOIN sys.sys_auth_roles r ON r.auth_role_id = x.user_auth_role_role_id
JOIN sys.sys_tenancies t ON t.tenant_id = x.user_auth_role_tenant_id
WHERE x.user_auth_role_revoked_at IS NULL
  AND r.auth_role_code NOT IN ('USER','TEAM_MEMBER')
  AND u.user_email NOT LIKE '%@collaudo.invalid'
ORDER BY t.tenant_code, r.auth_role_code, u.user_email;
```

Un confronto con questo elenco chiude le caselle "da verificare". La lettura sulla produzione richiede una frase di Enzo nel thread.
