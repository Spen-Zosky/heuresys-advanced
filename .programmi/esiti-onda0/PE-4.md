# Esito PE-4 — partecipazione ai processi legata alla posizione, passi 1 e 2 (ADR-0044)

Sessione S1119, 2026-10-17. Mandato assegnato da Cowork. Sola prova su copie del gemello con nome unico: nessuna scrittura sul database di produzione, nessun rilascio armato né propagato, nessuna cancellazione di file o di righe.

## Le voci

| # | voce | chi | fatta quando | esito |
|---|---|---|---|---|
| 1 | passo 1: migrazione `000457` (colonna, FK `RESTRICT`, indice, indice unico parziale), guardia sul formato, post-condizione sull'impronta, inversa fuori catena | Claude | file committati, prova verde | fatto: `db/migrations/000457_pe4_passo1_posizione_nelle_partecipazioni.sql`, `db/scripts/pe4-passo1-inversa.sql` |
| 2 | passo 2: classe certa, poi H dalla storia e disattivazione di N (D3), con giornale e registro dei dubbi, fuori catena | Claude | file committati, prova verde | fatto: `db/scripts/pe4-passo2-riempi.sql`, `db/scripts/pe4-passo2-inversa.sql` |
| 3 | prova a andata e ritorno, rossa prima e verde dopo, con mutazioni | Claude | `db/scripts/pe4-prova.sh` verde su copia, mutazioni rosse | fatto (vedi sotto) |
| 4 | `verify_gate.py run` sul gemello | Claude | verdetto GREEN | fatto (vedi sotto, con una nota sul gemello) |

## Che cosa è stato misurato e provato (copia `heuresys_advanced_pe4_prova2`, creata dal gemello)

- Partenza: 845 partecipazioni. Oracolo indipendente (join e group by, scritto diverso dallo script): A 185, H 496, N 164; somma 845.
- Passo 1: la migrazione si applica due volte; colonna, FK `RESTRICT`, due indici presenti; le 845 righe sono identiche all'originale (541303 byte, confronto con `cmp`).
- Passo 2, fase A: riempite 185, uguali all'oracolo; nessuna disattivata; registro dei dubbi 660 (H e N, in attesa). Una seconda passata non cambia niente (confronto byte per byte).
- Passo 2, fase D3: riempite in tutto 681 (185 + 496), disattivate 164; 681 + 164 = 845. Il registro dei dubbi ha 660 voci, tutte con motivo: 496 «riempita da storia» e 164 «disattivata». Persona, ruolo, metadati e chiavi invariati per tutte le righe (impronta); nessuna riga con `metadata.storia36`. Una seconda passata non cambia niente.
- Come leggo «845 = riempite + disattivate + registro dei dubbi»: le 845 si dividono in 681 riempite e 164 disattivate; il registro dei dubbi (660) non è una terza parte, è l'elenco delle 660 righe non certe, e ognuna è già contata in una delle due.
- Ritorno: l'inversa del passo 2 riporta la tabella allo stato di prima, byte per byte (575948 byte); il giornale resta (845 voci, tutte annullate); una seconda passata non cambia niente. L'inversa del passo 1 toglie la colonna e la tabella torna all'originale, byte per byte; si rifiuta se la colonna ha ancora valori.
- Prova generale della catena (`ci-rehearsal.sh` su una copia di `heuresys_ci`, catena intera due volte con la 000457): VERDE, sentinelle 53/53 a zero.

## Prova rossa prima, verde dopo, e mutazioni

- Rossa prima: la prima corsa su `heuresys_advanced_pe4_prova1` è uscita rossa per un difetto vero dell'inversa del passo 2 (un nome di variabile ambiguo nel controllo finale); corretto, la corsa su `_prova2` è verde.
- Mutazione 1 (la disattivazione salta gli OWNER): ROSSA, il controllo interno dello script si ferma (136 disattivate invece di 164) e 9 controlli della prova falliscono.
- Mutazione 2 (l'inversa non ripristina `updated_at`): ROSSA, la tabella non torna identica byte per byte.
- Mutazione 3 (una riga riempita a mano fuori dal giornale): ROSSA, 12 controlli falliscono, fra cui il ritorno allo stato di prima.
- Mutazione 5 (la classe H ignora la data di fine delle assegnazioni): ROSSA, 5 controlli falliscono (riempite 669 invece di 681).
- Mutazione 4 (la finestra di date della classe H si allarga alle assegnazioni future): VERDE. Non è un difetto della prova: su questi dati nessuna riga cambia classe con quella modifica, quindi quella parte della regola non è sensibile ai dati attuali.

## Il cancello

`verify_gate.py run`: typecheck, handoff-lint, db-health, no-contamination verdi; migrate-idempotent verde. Una nota sul gemello: il clone del repository sul linux-pc è indietro (452 migrazioni contro 453) e ha file modificati a mano, quindi `prova-idempotenza.sh` si rifiutava di girare. Non ho fatto `git pull` lì (propagare non è nel mandato): ho esportato l'HEAD committato in una cartella nuova del gemello (`~/pe4-prova-catena2`) e ho lanciato il cancello con `IDEMPOTENZA_REPO` su quella cartella. Il verde riguarda quindi la catena all'HEAD, non il clone vecchio. Un primo `handoff-lint` rosso (D3: titolo di `SOT_STATE` fermo a 000456) è stato corretto con `docs/kb/tools/aggiorna_numeri_sot.py`.

## Che cosa va deciso o saputo prima di portare questo in produzione

- Il passo 2 sulla produzione non è stato eseguito e non è nella catena delle migrazioni: va lanciato a mano (`psql -v fase=tutto -f db/scripts/pe4-passo2-riempi.sql`) dopo che la 000457 è in produzione. Le tre letture dell'API controllano `process_participant_is_active`, quindi la disattivazione delle 164 righe cambia subito la visibilità funzionale delle persone coinvolte.
- I 57 OWNER non sono stati esclusi dalle regole D3: 29 sono nella classe H (riempiti con la posizione) e 28 nella classe N (disattivati). Ho seguito la decisione D3 per classe, come scritta; la correzione delle letture (passo 3) resta fuori.
- Tutte le 496 posizioni scritte per la classe H sono oggi posizioni disattivate (`position_is_active = false`). Quando il passo 3 farà risolvere la persona dalla posizione, queste 496 partecipazioni non troveranno nessuna persona. È coerente con D3 ma è un effetto da conoscere al passo 3.
- Non c'era nessuna collisione fra (processo, posizione): lo script si ferma se ne trova una in produzione.

## Fuori da questo ciclo: lo vuoi nel prossimo?

- La sentinella `sys.v_*` per le partecipazioni attive senza posizione: per ADR-0044 nasce al passo 3b, non prima.
- Rinfrescare il clone del gemello (`scripts/clone-vm-db.sh`) e riallinearne il repository: serve a far girare i cancelli senza la cartella di appoggio. È propagazione, decisione dell'Amministratore di Sistema.

## Database di prova creati sul gemello (non cancellati)

`heuresys_advanced_pe4_prova1` (corsa rossa, lasciata con passo 1 e 2 applicati), `heuresys_advanced_pe4_prova2` (corsa verde), `heuresys_advanced_pe4_mut1`, `_mut2`, `_mut3`, `_mut4`, `_mut5`. La copia di `heuresys_ci` della prova generale si cancella da sola alla fine dello script (comportamento di `ci-rehearsal.sh`, non una mia cancellazione).

## File temporanei (non cancellati)

Sul linux-pc: `~/pe4-prova`, `~/pe4-prova-catena`, `~/pe4-prova-catena2`, `~/pe4-mut/m1..m5`, `~/pe4-lavoro/<database>/` (istantanee della prova). Su questa macchina: `/tmp/pe4/` (query, script delle mutazioni, uscite).

## Verifica

```bash
ssh linux-pc 'sudo -n -u postgres createdb -T heuresys_advanced heuresys_advanced_pe4_provaN'
ssh linux-pc 'cd ~/pe4-prova && bash db/scripts/pe4-prova.sh heuresys_advanced_pe4_provaN'
python docs/kb/tools/verify_gate.py check
```
