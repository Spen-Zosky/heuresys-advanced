# Piano — endpoint senza consumatori, ondate 1-5 (2026-11-17)

Mandato: Enzo ha approvato le 5 ondate nell'ordine proposto dalla classifica `docs/kb/analisi/endpoint-orfani/ENDPOINT_ORFANI_CLASSIFICATI_20261116.tsv` (PR #280). Criteri: (a) manca la schermata, (b) all'agente con le scritture approvate dall'utente, (c) ritiro disattivando, senza cancellazioni. Una PR per ondata; «fatta» solo con una prova dal vivo riproducibile. Rilascio solo con il turno libero, CI verde, backup verificato e verifica dal vivo.

Come si rimisura: `awk -F'\t' 'NR>1{print $10" "$5}' docs/kb/analisi/endpoint-orfani/ENDPOINT_ORFANI_CLASSIFICATI_20261116.tsv | sort | uniq -c`.

| id | cosa | chi | fatta vuol dire | stato |
|---|---|---|---|---|
| O1 | Vocabolario comune e distanza dal modello in `/consolidation` (PR #280) | Claude | PR #280 unita e rilasciata, pagina provata dal vivo come Direttore HR | ACTIVE |
| O2 | Azioni sulle schede esistenti (classe a, ondata 2) | Claude | PR unita e rilasciata, spec `ondata2-azioni-schede.spec.ts` verde, giro reversibile dal vivo | ACTIVE |
| O3 | Pagine nuove e sicurezza: team (nuova `/teams`, voce di menu da migrazione), mentoring, sondaggi, GDPR, carriere, sicurezza dell'utente | Claude | come sopra, una prova per pagina | ACTIVE |
| O4 | Strumenti dell'agente (classe b) e prova dal vivo delle 140 letture dell'agente | Claude | strumenti con approvazione in `write-gate.ts`, giro dell'agente provato dal vivo | ACTIVE |
| O5 | Cataloghi (classe a, ondata 5) e ritiri (classe c, disattivando) | Claude | PR unita e rilasciata; un ritiro si vede come rotta disattivata, nessuna riga cancellata | ACTIVE |

## Ondata 2 — voci e file

| endpoint | dove | file |
|---|---|---|
| `POST/DELETE /v1/positions/:id/skills` | `/positions/[id]/skills` | `positions/[positionId]/_components/requisiti-modifica.tsx`, `skills/page.tsx` |
| `POST/PATCH/DELETE /v1/positions/:id/kpis` | `/positions/[id]/kpis` | stesso componente, `kpis/page.tsx` |
| `POST /v1/user-position-assignments`, `/:id/terminate`, `/:id/transfer` | `/positions/[id]` | `_components/titolari-posizione.tsx` (crea richieste di approvazione, non incarichi) |
| `POST/PATCH /v1/projects`, `PATCH /:id/progress`, `PUT/DELETE /:id/members/:userId` | `/projects`, `/projects/[id]` | `projects/gestione-progetto.tsx` |
| `POST/PATCH /v1/training-initiatives` | `/learning/training-initiatives` | `iniziative-forms.tsx` |
| `PATCH /v1/content/categories/:id` | `/content` (scheda Categorie) | `content/categoria-rinomina.tsx` |
| `POST /v1/content/:id/return-to-draft`, `/unpublish` | `/content/[id]` | già chiamati da `transition.mutate(...)`: falso orfano dell'estrattore (percorso composto) |
| `POST /v1/delegations`, `/:id/revoke` | `/admin/roles` | `admin/roles/_components/deleghe-amministrazione.tsx` |
| `PATCH /v1/candidates/:id`, `PATCH /v1/interview-feedback/:id` | `/recruiting/applications/[id]` | `recruiting/applications/[id]/correzioni.tsx` |
| `PATCH /v1/me/notification-preferences`, `POST /v1/me/gdpr/export`, `POST /v1/me/consents` | `/me/security` | `me/security/privacy-notifiche.tsx` |
| `POST/PATCH /v1/teams`, `PUT/DELETE /:id/members/:userId` | nuova `/teams` | spostata in O3: chiede una pagina nuova e la voce di menu da migrazione |

Simulazione: tutte le rotte esistono con il loro permesso (`requirePermission`), i comandi compaiono solo a chi ha quel permesso, i dati vengono dalle `/v1/*` vive; nessun tocco al database né all'API. La prova E2E cambia e rimette com'era (reversibile).

## Fuori da questa sessione

Le ondate 3-5 non si chiudono stanotte: ognuna è una PR e un rilascio a sé, e il turno di rilascio è conteso.

## Registro delle scoperte

- L'estrattore di #280 conta come orfani i percorsi composti a runtime (`/v1/content/${id}/${action}`): `return-to-draft` e `unpublish` hanno già un chiamante.
