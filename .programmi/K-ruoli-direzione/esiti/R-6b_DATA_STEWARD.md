# R-6b — DATA_STEWARD (passo 57, sessione 2 di R-6) — ESITO

Data: 2026-09-19, sessione S1106 (mandato assegnato da Cowork). Migrazione `000449`.

## Passo 0 — la voce mancante

R-6 (STATO.md) risultava `CHIUSA` perche' la sessione 1 aveva chiuso PEOPLE_MANAGER (passo 56);
il passo 57 (DATA_STEWARD) era rinviato **solo dentro la nota** di quella riga, invisibile a
`dove_siamo.py` (vede solo `IN CORSO`/`SOSPESA`/`ATTESA_ENZO`). Aperta la riga `R-6b`,
`IN CORSO`, con nota di provenienza — commit isolato (`9bc9e71d`) prima di iniziare, come
richiesto.

## Permessi — misurati sul codice vivo, non assunti

Il mandato di Cowork chiedeva di generare l'elenco con `tools/permessi_da_classificazione.py`
(come passo 56/PEOPLE_MANAGER). **Verificato che non si applica**: il testo esatto del passo 57
nel mandato K (`K-mandato-v2.md` riga 499) e il docstring dello strumento stesso dicono
entrambi che DATA_STEWARD e' un elenco a mano, per moduli nominati, non derivato dalla
classificazione X-1 — deviazione dichiarata dalla lettera del prompt di Cowork, seguendo la
fonte primaria (il mandato committato) invece della sua parafrasi.

Misurato su `apps/api/src/modules/{tenant-import-runs,reference-sync,provenance,
generated-origins}/routes.ts`: sei permessi.

| permesso | modulo/i che lo usano | stato |
|---|---|---|
| `seed_acquisition:read` | tenant-import-runs (GET) | esistente |
| `seed_acquisition:trigger` | tenant-import-runs (POST) | esistente |
| `reference_sync:read` | reference-sync (GET) | esistente |
| `reference_sync:trigger` | reference-sync (POST) | esistente |
| `provenance:read` | provenance + generated-origins (GET, sola lettura: zero rotte di scrittura in entrambi) | esistente |
| `conflitto_ibrido:resolve` | nessuna rotta (X-4 non l'ha creato) | **NUOVO**, congelato in `permessi-senza-rotta.allowlist.json` |

Nessuna scrittura sui dati nativi: verificato con typo-guard esplicito nella migrazione
(dominio per dominio) e confermato dal vivo (6 permessi, nessuno fuori dall'unione
espliciti+derivati dopo due passate della catena).

## Lettura mascherata dei dati personali

Misurato campo per campo, non assunto: `provenance`/`generated-origins` sono metadata di
provenienza per decisione esplicita **D-51** ("lineage rows are record-provenance metadata...
not person-level content") — zero campi personali. `reference-sync` e' tassonomia globale
(ESCO/ATECO) — zero campi personali. L'unico punto reale e' `GET /v1/tenant-import-runs/:id`:
`TenantImportCandidateSchema` porta `email`/`displayName` in chiaro, e le sei regole di
validazione (`PERSON_EMAIL`, `POSITION_VACANT`...) li ripetono nei propri `message`/`payload`.
Mascherare i soli campi top-level non avrebbe bastato (l'email sarebbe rimasta leggibile nel
payload di una regola) — **stessa classe di estensione che R-8 ha dichiarato fuori scope**
(estendere il resolver core I16/I18/I20), ma qui il costo e' locale (un servizio, non
l'architettura): mascherato l'intero campo `candidates` per DATA_STEWARD (`mask.ts`,
`maskFields`, per-FIELD/DICHIARATO/STABILE — I18/I20 non toccati). Schema esteso
(`candidates` opzionale + `masked` dichiarato). Provato sul vivo: DATA_STEWARD legge la corsa
(stato/referto/conteggi) senza `candidates`, con `masked: ["candidates"]`; TENANT_ADMIN la
legge intatta.

## Le quattro prove + controprova (passo 57) — tutte verdi

`apps/api/test/data-steward.integration.test.ts`, 7/7:

1. **(a)** PEOPLE_MANAGER scrive un obiettivo → 201 (controllo di contesto).
2. **(b)** NESSUNA rotta di scrittura tocca una tabella `importato` — **enumerata**, non
   contata a occhio (DIF-4): query su `sys_classificazione_direzione_dato`, scansione di ogni
   `repository.ts`/`routes.ts` del repo. Un'eccezione trovata e documentata (v. sotto).
   Più la prova concreta: DATA_STEWARD POST `/v1/me/pay-slips` → **404 di rotta**, non 403.
3. **(c)** DATA_STEWARD scrive un obiettivo → 403.
4. **(d)** controprova: HRMS_MANAGER sullo stesso obiettivo → 201.

Più due prove aggiuntive (non richieste dal passo ma coerenti col resto del mandato): lettura
del proprio dominio (GET tenant-import-runs, GET reference-sync/sources → 200) e la prova di
mascheratura sopra.

## Difetti trovati dalla prova generale, corretti nella stessa migrazione (non a valle)

Due giri di `ci-rehearsal.sh` (due passate ciascuno) hanno trovato, sulla **seconda** passata
(dove i self-healing pre-esistenti vedono per la prima volta il ruolo nuovo):

1. **`seed_acquisition:delete`** — il mirror "chi ha `trigger` riceve anche `delete`" (000177)
   avrebbe dato a DATA_STEWARD anche il potere di cancellare una corsa di acquisizione. Stessa
   eccezione gia' scritta per IMPLEMENTATION_CONSULTANT in R-8: emendato 000177 (ADR-0035, il
   file che crea il comportamento) con una seconda riga di esclusione.
2. **`gdpr:export:self`** classificato erroneamente "vietato" dal mio stesso typo-guard
   (`LIKE 'gdpr:%'` senza l'eccezione per il floor universale I17) — stesso bug gia' noto e
   gia' risolto in 000432/PEOPLE_MANAGER, che avevo dimenticato di copiare. Corretto nella
   migrazione prima di applicare.

Terzo giro **VERDE**: 421 applicate/24 skippate, 53/53 sentinelle a zero, due passate.

## Un difetto trovato dal mio stesso test dopo l'applicazione (non della migrazione)

L'enumerazione (prova b) ha trovato che `tenant-materialization` scrive su
`sys_user_kpi_evidence`, classificata `importato` — ma la classificazione X-1 lo dichiara gia'
nel proprio campo `motivo` ("materializzazione onboarding tenant", non import da HR esterno).
Rotta comunque PLATFORM_ADMIN-only, nessun ruolo di questo mandato la tocca. Escluso dal test
con motivo esplicito, registrato in `REGISTRO_SCOPERTE.md` (fuori da questo ciclo).

Il primo giro del test aveva anche un difetto mio: la controprova "vede i candidati intatti"
usava HRMS_MANAGER, che **non detiene** `seed_acquisition:read` (misurato: solo
PLATFORM_ADMIN/TENANT_ADMIN/DATA_STEWARD/IMPLEMENTATION_CONSULTANT). Sostituito con
TENANT_ADMIN.

## Perimetro — verificato oltre il minimo richiesto (W4 non lanciato, vedi sotto)

`provenance:read` e `reference_sync:read/trigger` mappano ESATTAMENTE ai quattro moduli del
mandato (nessuna rotta terza li usa — verificato con `grep -rl` su tutti i `routes.ts`).
`seed_acquisition:read/trigger` invece gatano ANCHE `seed-acquisition-runs` (letto+scritto),
`seed-approval-decisions` e `seed-candidate-records` (solo letti: la scrittura chiede
`:approve`, che DATA_STEWARD non ha) — gia' vero, con lo stesso perimetro, per
IMPLEMENTATION_CONSULTANT (R-8, chiuso). Non e' un difetto di questa migrazione: e' la
granularita' dei permessi del progetto (per famiglia di risorsa, non per modulo-cartella).
Registrato in `REGISTRO_SCOPERTE.md`.

## Ricetta I-F — completata (audit di chiusura ha trovato 3 file mancanti)

`role-codes.ts`, `roles-editor.tsx`, migrazione con `auth_role_category` valorizzata, persona
di collaudo, test dedicato: fatti nel primo giro. L'audit di chiusura (v. sotto) ha trovato
**3 file "da toccare SEMPRE" mancanti**: `role-precedence.ts`, `shell.json` IT/EN — aggiunti,
`i18n:check` verde (3346 chiavi × 2 lingue × 10 namespace). `domains.ts`, storia36,
`populate-reference-translations-governance.sql`, `e2e/fixtures.ts`, `domains-f7`: **non**
toccati per costruzione — DATA_STEWARD non entra in nessun insieme di mandato del resolver
organizzativo (RBAC diretto, non asse organizzativo) e non ha ancora una pagina web, stesso
precedente di PEOPLE_MANAGER (R-6 s1) per gli stessi due file.

## L'audit W4 — NON lanciato con il tool `Workflow`

Il mandato K prescrive un audit a tre lenti via il tool `Workflow` dopo ogni migrazione di
ruolo. Il tool `Workflow` di questa sessione richiede un opt-in esplicito dell'utente
("ultracode" o richiesta diretta) che il mandato di Cowork non conteneva — stessa deviazione
gia' presa da S1112 per X-6, con la stessa motivazione. Le tre lenti (diff dichiarato/concesso,
ricetta, perimetro) sono state fatte **in linea**, a mano, con misure dal vivo: risultato sopra.

## Verifica finale

`verify_gate.py run` lanciato come ultimo atto prima della chiusura del passo — vedi STATO.md
per il verdetto.

## Verdetto

Nessuna decisione nuova per Enzo. PASSO 57 CHIUSO.
