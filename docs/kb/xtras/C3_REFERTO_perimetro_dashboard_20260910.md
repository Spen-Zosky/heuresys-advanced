# C3 — Referto: chi deve consumare il perimetro delle dashboard, e quali cruscotti appartengono a un cliente

**Data**: 2026-09-10 · **Sessione**: S1096, fase 4 terzo blocco · **Tipo**: indagine, non lavoro.
**Chi decide**: Enzo. Questo documento non costruisce niente e non chiede di costruire niente
finché non è stato letto.

Il piano dichiarava C3 **indagine** perché la sequenza che la chiude non era scrivibile in
anticipo. Questo è il suo esito.

---

## ⚠ Il reperto che cambia la domanda: il modulo esiste

Il piano dice, testualmente: *«non esiste un modulo `dashboard` nell'API»*. **È falso, misurato
il 2026-09-10.** Il modulo esiste — `apps/api/src/modules/dashboard/` — e porta **quattro
rotte**:

| rotta | come è protetta |
|---|---|
| `GET /v1/dashboard/widgets` | `requirePermission("dashboard:view")` |
| `GET /v1/dashboard/catalog` | **nessun `requirePermission`**, filtro per riga nel service |
| `GET /v1/dashboard/catalog/:code` | idem |
| `GET /v1/dashboard/catalog/:code/data` | idem |

L'assenza di `requirePermission` sulle tre rotte del catalogo non è una dimenticanza: il file lo
dichiara e ne dà la ragione — *non esiste UN permesso per «vedere il catalogo»; ogni famiglia
porta il proprio, e il Self-Service non ne ha (I17)*. Il filtro è dentro `getCatalog`, riga per
riga, e usa due condizioni: il **permesso RBAC della famiglia** (`dashboard_permission_code`) e i
**domini funzionali** dell'attore.

Correggere il piano su questo punto è parte del deliverable: chi leggerà «non esiste un modulo»
costruirebbe il secondo.

---

## Domanda 1 — chi dovrebbe consumare il perimetro `dashboards`?

**La risposta è: il modulo che già esiste, e non oggi.**

`lib/scope/profilo.ts` dichiara il dominio `dashboards` e sa quale tabella leggere, ma nessun
modulo lo chiede: `perimetroDiCatalogo` è chiamata solo da `job-roles` e, dal 2026-09-10, da
`semantic-matching`. Il perimetro delle dashboard è quindi **costruito e non consumato**.

Le tre strade, con il loro costo:

| strada | cosa comporta | giudizio |
|---|---|---|
| **A.** Aggiungere il profilo come *seconda* condizione dentro `getCatalog` (permesso **e** profilo) | poche righe nel service esistente, nessun endpoint nuovo | **è la strada giusta quando servirà** |
| **B.** Un endpoint nuovo che restituisce il perimetro | un secondo posto da cui leggere la stessa cosa | **da scartare**: è il difetto che il bundle documenta ovunque |
| **C.** Lasciare il dominio dichiarato e non consumato | costo zero oggi | **è lo stato attuale**, e regge finché il catalogo è uguale per tutti |

**Perché non oggi.** Il catalogo delle dashboard è di **8 righe globali**, identiche per ogni
cliente: filtrarlo per profilo non toglierebbe nulla a nessuno, perché il profilo della banca le
contiene tutte e otto e quello di HEURESYS quattro (mig. `000400`). Il filtro diventa utile nel
momento in cui un cliente si dà **una dashboard propria** — che è la decisione di ADR-0039
(*«ogni cliente dovrà potersi fare i ruoli su misura»*, e lo stesso per le dashboard), non ancora
esercitata da nessuno.

**Il costo di aspettare è misurato e basso**: il livello del profilo esiste già, popolato per
entrambi i clienti. Quando la prima dashboard propria nascerà, la strada A è una condizione in
più dentro una funzione che già filtra — non una migrazione di contenuto.

**Se Enzo vuole chiudere la porta ora**, la forma è: dentro `getCatalog`, dopo il filtro dei
permessi, tenere solo i codici che il profilo del cliente dichiara; chi amministra la piattaforma
riceve tutto. Dichiarazione di cancello: **nessuna** oggi possibile, e va detto — la risorsa RBAC
delle rotte del catalogo non è `dashboard` ma nessuna (il filtro è nel service), quindi
`RISORSE_DI_CATALOGO` in `lib/scope/gate.ts` non le raggiungerebbe. Lo stesso limite già
dichiarato per `semantic-matching`, dove la risorsa è `matching`.

---

## Domanda 2 — `platform` e `tenant` devono stare nel profilo di un cliente?

**No. E oggi non fanno danno, ma dicono una cosa falsa.**

Le otto dashboard e chi le può vedere, misurato su `sys_auth_role_permissions` il 2026-09-10:

| cruscotto | permesso | ruoli che lo possiedono |
|---|---|---|
| company | `dashboard_company:view` | CEO, HRMS_MANAGER, PLATFORM_ADMIN, TENANT_ADMIN |
| process | `dashboard_process:view` | HRMS_MANAGER, PLATFORM_ADMIN, PROCESS_OWNER, TENANT_ADMIN |
| org | `dashboard_org:view` | HRMS_MANAGER, ORG_DIRECTOR, PLATFORM_ADMIN, TENANT_ADMIN |
| branch | `dashboard_branch:view` | BRANCH_MANAGER, MANAGER, PLATFORM_ADMIN |
| hr | `dashboard_hr:view` | HRMS_MANAGER, PLATFORM_ADMIN, TENANT_ADMIN |
| **platform** | `dashboard_platform:view` | **PLATFORM_ADMIN soltanto** |
| **tenant** | `dashboard_tenant:view` | PLATFORM_ADMIN, TENANT_ADMIN |
| self | *(nessuno)* | tutti — è il pavimento ESS di I17 |

**Non c'è esposizione.** `platform` è chiuso a chiunque non amministri la piattaforma, e il
permesso agisce **prima** del profilo: un utente della banca non lo vede oggi e non lo vedrebbe
neanche se il filtro per profilo esistesse. La presenza di quei due codici nel profilo della
banca (`000398`) non apre nulla.

**Ma è un'affermazione sbagliata**, e in questo progetto un'affermazione sbagliata dentro un dato
è un difetto anche quando non fa danno — è la stessa ragione per cui il commento falso in
`profilo.ts` è stato corretto invece che lasciato. Dire «`platform` fa parte del profilo di RTL
Bank» significa dire che l'amministrazione della piattaforma è una cosa che quel cliente usa. Non
lo è: è la console con cui *noi* amministriamo *lui*.

**La distinzione che li separa** — e vale come criterio, non come elenco: un cruscotto sta nel
profilo di un cliente se mostra **i dati di quel cliente**; sta fuori se mostra **la piattaforma o
l'elenco dei clienti**. Con questo criterio: `company`, `process`, `org`, `branch`, `hr`, `self`
dentro; `platform` e `tenant` fuori. È esattamente la scelta già applicata a HEURESYS nella
`000400`, dove i due amministrativi non sono stati messi — e la ragione scritta lì rimanda a
questo referto.

**Cosa comporta toglierli dal profilo della banca**: una migrazione che rimuove due righe da
`sys_blueprint_content_dashboards` per la versione bancaria. ⚠ È una **cancellazione di righe**, e
in questo progetto non si cancella senza conferma esplicita di Enzo — per questo non è stata
fatta, e non è una pendenza: è una decisione che aspetta.

---

## Le tre cose che Enzo deve decidere

1. **Il filtro per profilo sulle dashboard si fa ora o quando servirà?** Raccomandazione: quando
   servirà, cioè alla prima dashboard propria di un cliente. Oggi non toglierebbe nulla a
   nessuno, e il livello su cui appoggiarsi esiste già.
2. **`platform` e `tenant` si tolgono dal profilo della banca?** Raccomandazione: sì, per
   coerenza — non per sicurezza, che il permesso già garantisce. Serve la sua conferma perché
   comporta togliere due righe.
3. **Il modulo `dashboard` esiste**: il piano diceva di no. Se qualcosa in un prossimo blocco
   presuppone quell'assenza, va riscritto prima di partire.

---

## Cosa questa indagine NON ha guardato, e va dichiarato

- I **blocchi** delle dashboard (`sys_dashboard_blocks`, 27 righe) e le loro classi di dato
  (`sys_dashboard_block_data_classes`, 21): il perimetro del profilo dichiara i cruscotti, non i
  blocchi. Se un cliente vorrà spostare un riquadro, la domanda si riapre a quel livello — e non è
  stata guardata qui.
- Il **frontend**: se e come le pagine consumino `/v1/dashboard/catalog`. Fuori dal perimetro di
  questa indagine, che riguarda l'API.
