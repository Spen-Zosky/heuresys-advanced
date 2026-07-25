# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-25 (S1029 — piano «zero pendenze»: Wave 0 chiusa, W1 avviata).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1029)

Sessione lunga in autonomia non presidiata. Prima metà: censimento esaustivo del residuo
(14 agenti su 13 fonti) consolidato in un piano a ondate, poi Wave 0 — CI di nuovo verde
dopo due giorni di rosso, root cause di D-55 trovata (un deadlock, non il "jitter di pool"
registrato per nove sessioni), 10 alert di sicurezza chiusi, backup di produzione portati
off-host con restore verificato. Seconda metà: chiusa Wave 0 con l'alerting (prima nessun
job schedulato aveva un `OnFailure`: AIDE falliva ogni notte da settimane senza che
nessuno lo sapesse, e il suo database non era mai stato inizializzato) e avviata W1.

Il filo conduttore, ricorrente al punto da essere una regola: **le ipotesi registrate nei
debiti vanno rimisurate, non ereditate**. Sbagliate o superate: la causa di D-55, la
retention dei backup, un gate di lint che passava verde senza lintare nulla, la
strumentazione di S1027 che correlava due id diversi, il conteggio degli alert (10, non
5), l'ampiezza del token colore rotto (molto più ampia del previsto), e due cluster che a verifica
si sono rivelati inefficaci o dannosi (Z-110, Z-018).

## Obiettivo permanente (mandato Enzo, S1029 — vale per OGNI sessione futura)

**Portare heuresys-advanced a una fresh session senza pendenze**: zero debiti, zero task
incompleti, zero pending, zero errori aperti. Il censimento è fatto; ora è esecuzione.
Ogni sessione: avvio → identificazione azioni sul piano → esecuzione con **doppia verifica
e review adversarial per ogni task** → quando conviene ripartire puliti, chiusura completa
(SoT + commit + push + deploy + allineamento macchine e DB) e fresh session. Tutte le
decisioni tecniche sono di Claude; a Enzo vanno solo le voci che dipendono da un suo input.
**Il tracciamento del piano è responsabilità di Claude**, non di Enzo.

## Stato del piano

`docs/superpowers/specs/2026-07-25-zero-pending-plan.md` — **248 cluster, 33 chiusi**.
Le caselle spuntate portano la nota di chiusura con l'evidenza; il resto è aperto.

- **W0 sblocco — COMPLETA** (tutti i blocchi HARD).
- **W1 igiene** — 22 chiusi, ~53 aperti (~70h).
- **W2-W5** — non ancora iniziate. **W6** — dipende da input di Enzo.

## ⚠ Top priorities (next session)

1. **Proseguire W1** (~53 cluster ≤2h): è la corsia a massimo rapporto chiusure/ora.
   Prossimi già istruiti: `Z-224`/`Z-225` (doc superati), `Z-125` (naming test
   notifications), `Z-230`/`Z-234` (doc Dependabot e upstream stale), `Z-022` (timer di
   refresh del clone DB su linux-pc), `Z-029`/`Z-030`/`Z-031` (ecosistema Claude).
2. **Z-004 Dependabot** (~6h): 8 PR aperte, da **rebasare sul main di S1029** perché parte
   del contenuto è già assorbita dagli override di sicurezza. 3 major di GitHub Actions +
   4 major runtime + 1 gruppo minor-and-patch.
3. **W2 debito/test** (~203h): il pezzo più utile è il gate E2E in CI — oggi gira **1 spec
   Playwright su 72**, quindi 71 non sono monitorate cross-sessione.

## Open questions (autorità *cosa* = Enzo)

- **Contraddizione GDPR**: il design SuccessFactors afferma «nessuna governance PII/GDPR
  richiesta», la due diligence elenca RoPA/DPIA/DPA fra i requisiti mancanti. Posizione
  sul profilo legale, non scelta tecnica.
- **Wave-3 (#17)** — sblocca il Blocco E Fase 3 (#69). In HOLD.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16**
  SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
gh run list --branch main --workflow=test-integration.yml --limit 1   # success
gh api repos/Spen-Zosky/heuresys-advanced/dependabot/alerts --paginate --jq '[.[]|select(.state=="open")]|length'  # 1 = solo D-75 (rischio accettato)
grep -c '^- \[x\]' docs/superpowers/specs/2026-07-25-zero-pending-plan.md   # 33 chiusi
ssh oracle-vm-default "curl -s localhost:9091/api/v1/rules | head -c 80"    # regole di alert attive
python docs/kb/tools/session_start.py             # menu + salute
```
