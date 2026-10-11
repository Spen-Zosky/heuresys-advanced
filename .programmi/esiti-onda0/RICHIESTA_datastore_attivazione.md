# Richiesta al datastore: che cosa deve portare il pacchetto perché un modello si attivi (voce #264, W0-A1)

Decisione di Enzo dell'11 ottobre 2026: tutto ciò che serve ad attivare un modello nato dal pacchetto lo produce il datastore; advanced non ricava niente da sé. Questo documento rilegge l'analisi del 4 ottobre contro il codice e il database di oggi (2026-10-11) e dice, per ogni lacuna, che cosa advanced legge e in quale forma deve arrivare. Nessun punto dell'analisi cade: tutti reggono. Cambia solo che M1 è già chiusa.

## Verifica dell'analisi del 4 ottobre, punto per punto

| punto | l'analisi dice | misurato oggi | regge |
|---|---|---|---|
| M1 categoria delle competenze | il pacchetto non la portava | il pacchetto della banca (p20261010010521tjb) ha la categoria su 443 competenze su 443; la costruzione del piano passa | sì, già chiusa dal datastore |
| M2 ruoli di catalogo e cruscotti | il pacchetto non ha il dominio | nessuna sezione `ruoli` né `cruscotti` nel pacchetto; le tabelle `sys_blueprint_content_job_roles` e `sys_blueprint_content_dashboards` (mig. 000397) esistono e le legge `apps/api/src/lib/scope/profilo.ts` (`codiciDelProfilo`) solo per versioni PUBLISHED con attivazione ACTIVE | sì |
| M3 porte di ricompensa | gli incentivi non diventano porte | 5 incentivi nel pacchetto, 0 porte; la vista `v_reward_gate_completeness` (mig. 000023) conta le attivazioni senza porte in `sys_reward_gate_catalog` | sì |
| M4 variante pubblicata | l'accoglienza crea una DRAFT senza chiave | misurato: stato DRAFT, chiave di costruzione assente; per attivare servono `build_source_key = BLUEPRINT_CONTENT` e stato PUBLISHED. Sulla copia di prova l'ho fatto con un gesto esplicito dell'operatore, e ho dichiarato che non è una derivazione | sì |
| M5 peso economico | tutte le posizioni a 0 | 109 posizioni su 109 con peso 0 nel piano costruito | sì |
| M6 identità del fascicolo | nessun codice porta il contesto nel fascicolo | invariato: nessun codice di advanced legge `sys_blueprint_content_context` | sì |

## Che cosa deve arrivare, e dove va a finire

Forma proposta, sezioni nuove del pacchetto (schema 0.3, additivo). Se il datastore sceglie nomi diversi, il caricatore in `db/scripts/pacchetto/definizione-pacchetto.mjs` si adegua: è un file solo.

1. **Ruoli di catalogo** (M2). Sezione `ruoli`: per ogni ruolo `codice` (quello di `sys_job_roles.job_role_code`, non una FK: un modello può nominare un ruolo che il catalogo non ha), `nome`, `nomeEn`, `seniority` in `ENTRY, JUNIOR, MID, SENIOR, LEAD, EXECUTIVE`. Destinazione: `sys_blueprint_content_job_roles`.
2. **Cruscotti tipici** (M2). Sezione `cruscotti`: `codice` (quello di `sys_dashboards`), `nome`, `nomeEn`, `ordine` (intero, non negativo). Destinazione: `sys_blueprint_content_dashboards`.
3. **Incentivi come porte di ricompensa** (M3). Sezione `porte` per ogni incentivo: `codice`, `nome`, `descrizione`, `bloccante` (vero/falso). Destinazione: `sys_reward_gate_catalog` legata alla variante, non alla versione.
4. **Famiglia e stato pubblicato** (M4). Nel `meta`: il codice della famiglia di modelli e l'aggancio al settore, cioè la classe ATECO primaria (tabella `sys_blueprint_family_activity_classes`, tipo `PRIMARY`); lo stato `PUBLISHED`; la chiave di costruzione `BLUEPRINT_CONTENT`. Oggi esistono famiglie solo per le classi 64 e 70.
5. **Identità del fascicolo** (M6). Intensità regolatoria e fatturato; il pacchetto ha già ATECO, fascia, addetti e paese nel `contesto`.
6. **Peso economico** (M5), se il datastore ha una fonte: valore tipico per posizione, dichiarato come tale con la sua origine. Se non c'è fonte, resta a 0 finché lo fissa il tenant.

## Che cosa fa advanced quando arriva

Il caricatore scrive le sezioni nelle tabelle sopra, nella stessa transazione che già scrive il resto, con la stessa rilettura (percorso per percorso) che oggi dà 257 su 257. Nessuna derivazione in advanced: se una sezione manca, la costruzione non la inventa.

## Domanda aperta a Cowork

Una sola cosa non la decide advanced e non è nel mandato: il gesto «pubblica la versione» (passo 4) può restare un gesto dell'operatore sulla copia in attesa dello schema 0.3, oppure no? Raccomandazione: sì, solo sulle copie di prova, mai in produzione.
