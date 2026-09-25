# STATE — vista rapida

*Ultimo aggiornamento: S1108 (2026-09-25), mandato Cowork D11, passaggio 3 del ciclo 2. I
numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**D11 chiusa, e con lei il mandato K: 53 voci CHIUSE, 2 RITIRATE, nessuna aperta.** Nasce il
**terzo stato** dell'autorizzazione — perimetro dell'intero tenant sull'asse gerarchico con
retribuzione e valutazioni assenti e dichiarate in `masked`, **quinta eccezione ad ADR-0036 §5**.
Oggi lo porta il solo `DPO`. `HR_MANDATED_ROLES` non è stato toccato (aprirebbe in chiaro) e I20
continua a vincere su chi porta entrambi.

**La CI rossa da due giorni non era il runner condiviso**, come l'aveva registrata la sessione
prima: sul linux-pc convivono **due chiavi di collaudo** e il processo del runner non usa quella
del proprio drop-in (mai riavviato). Il moltiplicatore però era nello strumento — il provisioning
diceva «già a posto» a qualunque credenziale esistente senza guardare da quale chiave venisse.
Ora lo verifica e ripara da sé, in qualunque verso; l'ambiguità sulla chiave è `#260`.

**Una domanda posta invece di una decisione presa**: il dossier si apre con `user:read`, che apre
anche tre altre letture del modulo `users`. Fermata, due strade con il loro costo, Enzo ha scelto
la prima → mig. `000451`. Le prove sono state **viste rosse prima due volte** (terzo stato spento;
permesso assente) e sono tutte verdi dopo. Le corse CI sono verdi, il cancello è GREEN.

## Top priorities

1. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): invariata.
2. **`#251` → `#252`** (contatore persone distinte, poi il ponte sulle letture): invariate.
3. **`#260` — le due chiavi di collaudo sul linux-pc** (P2, pochi minuti sulla macchina): non
   rompe più niente, ma resta un'ambiguità su un segreto.

▸ Poi: `#149` F4 · `#159` F3 · `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#79` F3.

## Open questions

- **Propagazione e deploy ancora NON eseguiti** — per mandato esplicito di Cowork (D11, come
  GRD-C prima). `refs/heads/prod` non è stato mosso. Conseguenza da conoscere: il permesso
  `user:read` del DPO è **nel database** di produzione ma l'API lo vedrà al **prossimo riavvio**,
  perché la mappa RBAC si carica all'avvio.
- **Due file non tracciati, lavoro in corso di Enzo, non toccarli**: `scripts/align-claude-ecosystem.sh`
  (modificato) e `scripts/align-codex-ecosystem.sh` (nuovo) — ancora intoccati.
- I due file scritti da agenti fuori cartella e le sette bozze `esiti/_bozza_*.md`: si cancellano
  solo con il tuo sì (invariato).
- Il titolo del commit `be8912b6` contiene un `%s` mal formattato: non corretto perché era già
  pubblicato e riscrivere la storia è vietato.
- Il `claude` del gemello e della VM ha la sessione OAuth scaduta (invariato).

## Verification

```bash
python docs/kb/tools/session_start.py                     # atteso: #259 DONE, #260 fra le P2
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check       # atteso: exit 0
python .programmi/K-ruoli-direzione/tools/dove_siamo.py   # atteso: nessun rosso, nessuna voce aperta
psql -c "SELECT 1 FROM sys.sys_auth_role_permissions rp JOIN sys.sys_auth_roles r USING(auth_role_id) JOIN sys.sys_auth_permissions p USING(auth_permission_id) WHERE r.auth_role_code='DPO' AND p.auth_permission_code='user:read' AND rp.revoked_at IS NULL"
git ls-remote origin refs/heads/prod refs/heads/main      # prod ancora indietro: nessun deploy da qui
```
