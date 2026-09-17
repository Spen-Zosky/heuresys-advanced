# R-2 — domanda aperta prima di iniziare: come si realizza "il DPO legge mascherato"

Sessione S1105, 2026-09-17. Indagine fatta PRIMA di aprire R-2 (non ancora presa in carico),
perché tocca un invariante cardine e non voglio decidere da solo su quel terreno.

## Che cosa il mandato chiede, letteralmente

Passo 39: "gdpr:read, gdpr:export, gdpr:erase, gdpr:retention, più la lettura MASCHERATA dei
dati personali (stato «mask» di ADR-0036 in domains.ts)". Passo 44, fra le prove: "DPO su
profilo di una persona → campi retributivi mascherati".

## Che cosa ho misurato sul codice vivo

1. **Il modulo GDPR (`gdpr/service.ts`) NON ha bisogno di nulla in più.** `assertTenantScope`
   lascia passare chiunque abbia lo STESSO `tenantId` del soggetto (non richiede alcun mandato
   HR): concedendo i 4 permessi RBAC, DPO può già chiamare export/erasure/read su qualsiasi
   persona del proprio tenant. `runRetention` invece richiede `haMandatoGdpr(actor)` (oggi
   solo `PLATFORM_ADMIN`): se do `gdpr:retention` a DPO senza aggiungerlo a
   `GDPR_MANDATE_ROLES`, la rotta risponde comunque 403 `PLATFORM_ONLY` dal service — **ma è
   lo STESSO comportamento che TENANT_ADMIN e HRMS_MANAGER hanno GIÀ oggi** (misurato: hanno
   il permesso RBAC `gdpr:retention` ma la stessa `haMandatoGdpr` li esclude). Non è una
   regressione che introduco io: è coerenza con un difetto preesistente, registrato qui e non
   risolto in questa voce (fuori scope R-2).
2. **"Profilo di una persona → campi mascherati" è un'altra superficie**: `GET
   /v1/users/:id/dossier`, protetta da `user:read`. Chi può leggere il dossier di un ALTRO è
   deciso da `resolveOrgReadScope`/`canReadOrgTarget` (`lib/scope/resolver.ts`): PLATFORM_ADMIN
   → tutti; `HR_MANDATED_ROLES` (oggi **solo** `TENANT_ADMIN`, `HRMS_MANAGER`) → tenant-wide;
   chiunque altro → solo la propria catena organizzativa (I18).
3. **Il masking (`lib/scope/mask.ts`, `masksUnderPlatformMandate`) e `HR_MANDATED_ROLES` sono
   ALTERNATIVI, non componibili nella direzione che serve a DPO**: oggi chi è in
   `HR_MANDATED_ROLES` vede compensation/evaluation **IN CHIARO** (I20: "i mandati HR-mandati
   mantengono accesso sensibile tenant-wide"); chi ha `isPlatform` SENZA un mandato HR vede
   tutto ma **mascherato**. Non esiste oggi un terzo stato "tenant-wide ma mascherato", ed è
   esattamente quello che DPO chiederebbe.

## Perché mi fermo qui invece di deciderlo da solo

`HR_MANDATED_ROLES` e `masksUnderPlatformMandate` sono la fonte diretta di **I18** e **I20**
(CLAUDE.md — invarianti non negoziabili, ADR-0036 §5). Aggiungere DPO a `HR_MANDATED_ROLES`
gli darebbe accesso PIENO (non mascherato) — contraddice il mandato. Inventare un terzo stato
("tenant-wide + mascherato") introdurrebbe un pattern nuovo su un asse che la sezione 2 del
CLAUDE.md dichiara esplicitamente governato da un principio cardine, con quattro sole eccezioni
già enumerate (whistleblowing, SPECIAL_CATEGORY, retribuzione dei vertici, valutazioni non
comunicate) — DPO non è fra queste. Il mandato K non dice COME realizzare questo, solo COSA
deve succedere nelle prove: è esattamente il caso in cui "se durante il lavoro sembra che serva
una seconda decisione, non la prendo: la scrivo qui e chiedo".

## La domanda per Enzo, con le opzioni che ho trovato

**Il DPO deve poter leggere il profilo (dossier) di QUALSIASI persona del proprio tenant, con
compensation/evaluation mascherati — come lo si costruisce?**

- **Opzione A** — quinta eccezione dichiarata ad ADR-0036 §5: DPO entra in un nuovo insieme
  "tenant-wide-ma-mascherato" (nuova funzione in `mask.ts`/`resolver.ts`, non tocca
  `HR_MANDATED_ROLES`). Il costo tecnico è circoscritto (un nuovo predicato, non una riscrittura),
  ma è un precedente architetturale nuovo.
- **Opzione B** — DPO non ha bisogno del dossier generico: gestisce le richieste SOLO tramite
  gli endpoint `/v1/gdpr/*` (che già funzionano, punto 1 sopra), e "profilo mascherato" del
  mandato si soddisfa mostrando l'ESITO di un export/summary GDPR, non il dossier HR. Costo
  tecnico quasi nullo, ma non risponde alla prova esatta ("profilo di una persona") come scritta.
- **Opzione C** — rinviare questa parte a una voce futura (R-2 chiude sul nucleo GDPR: i 4
  permessi, il ritiro a HRMS_MANAGER, il rollback; la lettura mascherata del dossier diventa
  una voce D-nuova separata, con la sua decisione).

## Stato

R-2 **non è stata presa in carico** in questa sessione (S1105 si è fermata prima, guardiano al
64% con margine giudicato insufficiente per una voce di questa delicatezza). Resta
`BLOCCATA(fase)` in `STATO.md`, con questa domanda annotata perché la sessione che la riprende
la trovi subito, prima di cominciare — e non la scopra a metà lavoro come è successo qui.
