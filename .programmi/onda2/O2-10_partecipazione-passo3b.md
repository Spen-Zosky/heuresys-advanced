# Mandato O2-10 — partecipazione ai processi, passo 3b: la scrittura vecchia si spegne, nasce la sentinella

Modello: `claude-sonnet-5-5`. Tetto di spesa: 6 USD. Onda 2, sessione 10 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Precondizioni

P4 del piano del passo 3: il passo 3a (O2-09) in produzione, misurato con `bash scripts/verifica-deploy.sh`; se D-P3-1 o D-P3-3 erano sì, lo script delle regole eseguito in produzione dall'Amministratore di Sistema; lo scostamento sul vincolo (sezione 4 del piano) approvato. Se una manca: stato `WAIT-INPUT: <quale>`.

## Leggi

`CLAUDE.md`, memoria, `.claude/rules/db-migrations.md`; ADR-0044, ADR-0035, ADR-0037; `.programmi/onda2/PIANO_passo3-partecipazione.md` sezione 4; l'esito di O2-09; `000457`, `db/scripts/pe4-passo1-inversa.sql`; `chi_sorveglia.py sys_process_participants`.

## Consegna

1. Se D-P3-2 è sì: `db/scripts/pe4-passo3b-disattiva.sql` e la sua inversa, fuori catena, con giornale; da eseguire prima della migrazione.
2. Una migrazione: `process_participant_user_id` annullabile; `CHECK (NOT process_participant_is_active OR process_participant_position_id IS NOT NULL)` `NOT VALID`, guardia che conta le violazioni e si ferma se non sono zero, poi `VALIDATE`; la vista sentinella `sys.v_process_participants_active_without_position` (e quella sulle posizioni disattivate, se D-P3-2 è no e l'Amministratore di Sistema non ha detto di escluderle).
3. L'inversa fuori catena `db/scripts/pe4-passo3b-inversa.sql`, che rimette `NOT NULL` sulla persona solo se nessuna riga ha la persona nulla.
4. Il ramo di ripiego del passo 3a tolto; helper dei test e `prova-live-99-f7.mts` scrivono solo la posizione.
5. La riga di emendamento in ADR-0044 che rimanda al piano del passo 3 per il vincolo condizionato, se approvato.

## Prova di chiusura

- Su copia usa-e-getta nello stato della produzione (3a e regole applicate): migrazione due volte, sentinella a zero, `ci-rehearsal.sh` verde con la sentinella contata.
- Un `INSERT` di partecipazione attiva senza posizione fallisce, uno con posizione passa; una riga disattivata senza posizione resta valida.
- Inversa: andata e ritorno con lo schema identico; con una riga a persona nulla l'inversa si rifiuta.
- `pnpm test:api:vm` verde.

## Non fare

La colonna della persona non si toglie (passo successivo, con archivio, ADR-0035). Nessuna corsa in produzione.
