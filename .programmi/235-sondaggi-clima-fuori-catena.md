# 235 — Le risposte ai sondaggi di clima si leggono fuori dalla catena organizzativa

> **item**: #235 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: NON AVVIATO
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

- [ ] **F1 — Separare i template dalle risposte** — censire le 21 rotte e decidere, una per una,
      quale è catalogo e quale è dato di persona. **fatto =** elenco con la decisione e la ragione
      accanto a ognuna, prima di toccare una riga di codice
- [ ] **F2 — Classificare e annotare** — `surveys` entra in `RESOURCE_DATA_CLASS`, le rotte
      dichiarano il proprio `orgGate`. **fatto =** `domains-f7` verde e la riga falsa **rimossa**
      da `RESOURCE_SENZA_DATI_DI_PERSONA`
- [ ] **F3 — La prova live, che è il motivo per cui la voce esiste** — login reale con due
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
