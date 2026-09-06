# 235 — Le risposte ai sondaggi di clima si leggono fuori dalla catena organizzativa

> **item**: #235 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: CHIUSO
> **chiusa**: S1085 (2026-08-30), mig `000366`, con prova live su due persone reali —
> `status: DONE` nel register, cronaca estesa in `docs/archive/SOT_BACKLOG_CHIUSI.md`.
> Le spunte sono state allineate in S1090 (2026-09-06): questo file dichiarava ancora
> `NON AVVIATO` su una voce chiusa da sei giorni, e compariva a ogni avvio fra i programmi orfani
> **nasce-da**: S1083 (2026-08-28), misurando per `#214` F6

## Il fatto, misurato e non supposto

| tabella | righe | riconducibili a una persona |
|---|---:|---|
| `sys_engagement_survey_responses` | 862 | **862** (`response_subject_user_id`) |
| `sys_survey_assignments` | 948 | **948** (`survey_assignment_user_id`) |

**Nessuna risposta anonima. Non una.** E `surveys` non è classificata in `data-classes.ts`, quindi
è gated dal solo permesso RBAC più il tenant: oggi, in produzione, **chiunque abbia `surveys:read`
legge chi ha detto cosa sul clima aziendale**, anche di persone che non gli riportano.

La riga che lo dichiarava neutro veniva dalla decisione di Enzo del 2026-07-01 — *«feedback e clima
restano non mappati perché spesso anonimi o aggregati per politica»* — ed era una dichiarazione di
**politica** che i dati smentiscono.

⚠ **Non confondere con `engagement_feedback`**, dove la stessa frase è **vera**:
`sys_engagement_feedback` non ha alcuna colonna che identifichi l'autore — solo
`feedback_reviewed_by_user_id`, che è chi lo esamina. È anonimo **per costruzione**, non per
politica, ed è già dichiarato con la sua misura.

## Perché non è stata curata in S1083

Classificarla sensibile **non è una riga**: fa scattare `domains-f7` con
`ORG_GATE_MISSING: 21 read route(s)`. Annotarle è meccanico, ma la scelta fra `orgGate: "catalog"`
e `orgGate: "service"` **cambia chi vede le risposte in produzione** — i template sono catalogo, le
risposte no — e un cambiamento del genere pretende la dimostrazione **live** che la Definition of
Done impone: login reale, e la prova che chi deve vedere continua a vedere.

Stato attuale del codice, dichiarato: la riga in `RESOURCE_SENZA_DATI_DI_PERSONA` **resta** (il
cancello di `#99` F7 pretende che nessuna resource passi in silenzio, e non gli si mente per farlo
tacere), ma porta accanto la misura che la smentisce e il puntatore a questa voce. È un **debito
dichiarato**, non un'affermazione.

## Fasi

- [x] **F1 — Separare i template dalle risposte** — **FATTO 2026-08-30 (S1085)**: le 10 rotte read di `/v1/surveys/*` e `/v1/engagement/*` decise una per una, con la ragione accanto. **templates → `catalog`** (le domande sono catalogo: l'unica colonna di persona è l'autore) · **campagne → `service`** (`survey_audience_ids` è la platea, oggi vuota su tutte e 6 — e proprio per questo si filtra invece di dichiararla catalogo: una misura che può cambiare non regge una dichiarazione) · **risposte → `service`** (lista filtrata per allow-list, singola risposta gated con `canReadOrgTarget`, e **404 non 403**, perché un 403 confermerebbe che quella persona ha risposto) · **results + pulse → `aggregate`**. ⚠ Il censimento ha trovato un **secondo giacimento dieci volte più grande** di quello che questa voce conosceva: `sys_survey_responses` 8.288 righe e `sys_pulse_checks` 2.834, tutte con identità. — censire le 21 rotte e decidere, una per una,
      quale è catalogo e quale è dato di persona. **fatto =** elenco con la decisione e la ragione
      accanto a ognuna, prima di toccare una riga di codice
- [x] **F2 — Classificare e annotare** — **FATTO 2026-08-30 (S1085)**, mig `000366` (prova generale verde, poi produzione in 10 s sulla VM): `surveys` è `PERSONAL` in `RESOURCE_DATA_CLASS` e le rotte dichiarano il proprio `orgGate`; `domains-f7` verde. La voce di menu `engagement` dichiara `PERSONAL` **non aperta al tenant** — l'esenzione della `000317` è per la rubrica aziendale, e chi ha detto cosa sul clima è l'opposto; misurato prima: nessuno dei 18 titolari di `surveys:read` perde la voce. ⭐ Introdotto `K_ANONIMATO_MINIMO = 5`: un aggregato non è anonimo per il fatto di essere aggregato — con una sola risposta la media **è** quella risposta. — `surveys` entra in `RESOURCE_DATA_CLASS`, le rotte
      dichiarano il proprio `orgGate`. **fatto =** `domains-f7` verde e la riga falsa **rimossa**
      da `RESOURCE_SENZA_DATI_DI_PERSONA`
- [x] **F3 — La prova live, che è il motivo per cui la voce esiste** — **FATTO 2026-08-30 (S1085)**, `apps/api/scripts/prova-235-risposte-di-clima.mts`, eseguita **sul gemello** (da Windows l'API non si avvia: il pool va in timeout attraverso il tunnel; VM scarica, `loadavg 0.05`). Sondaggio da 150 risposte: **mandato HR** `federica.marchetti@rtl-bank.org` (TENANT_ADMIN) → **150 su 150**, `I20` intatto · **capo di catena** `paolo.caputo@rtl-bank.org` (MANAGER) → **18 risposte, catena di 19 persone, 0 fuori catena**; prima della cura ne avrebbe viste 150. **5 criteri su 5**, tre dei quali scritti per fallire. Cinque file di test verdi: `surveys` · `engagement` · `me-surveys` · `domains-f6` · `domains-f7`. — login reale con due
      profili di catena diversa: chi deve vedere vede ancora, chi non deve **non vede più**.
      **fatto =** comando, output e timestamp allegati, per entrambi i versi

## Le prove che devono poter fallire

- **F2** — se la classificazione fosse cosmetica, `domains-f7` resterebbe rosso: è il cancello a
  dire se è stata fatta davvero, non io.
- **F3** — la prova che conta è quella **negativa**: un profilo che *prima* vedeva e *dopo* non
  vede. Provare solo che «chi deve vedere vede ancora» è verde anche se non è cambiato nulla.

## Chiuso quando

Una risposta a un sondaggio di clima è leggibile solo da chi sta nella catena organizzativa di chi
l'ha data (più i mandati HR dichiarati da ADR-0036), e la dimostrazione live lo prova nei due versi.
