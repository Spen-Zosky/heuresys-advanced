# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-25 (S1029 — piano «zero pendenze» + Wave 0 chiusa).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1029)

Mandato Enzo: censire TUTTO ciò che manca per arrivare a una sessione senza pendenze,
poi eseguire in autonomia non presidiata con doppia verifica e review adversarial per
ogni task. Il censimento (14 agenti su ogni fonte: register, debiti, linee di prodotto,
programma 100X, TODO nel codice, CI, mandati documentali, gap runtime live, due
diligence, design system, a11y, infra PROD) ha prodotto una lista grezza poi consolidata
in cluster canonici, con dedup verificata da tre verificatori adversarial su lenti
distinte: nessuna voce persa, nessun rilievo. Piano completo, con criterio di chiusura
osservabile per ogni voce e i conteggi per ondata, in
`docs/superpowers/specs/2026-07-25-zero-pending-plan.md`.

Wave 0 chiusa: CI di nuovo verde su main dopo due giorni di rosso, e nel farlo è emersa
la **root cause di D-55** — non il "jitter di pool" registrato da nove sessioni, ma un
deadlock fra transazioni sul DB condiviso, ora assorbito da un retry su 40P01/40001. Gli
alert di sicurezza aperti erano **dieci**, non cinque: chiusi tutti e verificati a zero.
I backup di produzione, che vivevano sullo stesso disco del database che proteggono,
hanno ora un archivio off-host verificato con un restore reale.

Lezione ricorrente della sessione: **le ipotesi registrate nei debiti vanno rimisurate,
non ereditate**. D-55 aveva la causa sbagliata; la "retention backup a 4 giorni" era un
falso positivo (il timer era nato da 4 giorni); un gate lint passava verde senza lintare
nulla; la strumentazione aggiunta in S1027 per diagnosticare D-55 non poteva funzionare
(correlava due id diversi). Tutte cose "note" e tutte diverse dal reale.

## ⚠ Top priorities (next session)

1. **W1 — igiene rapida** (~102h, 75 cluster ≤2h): la corsia a massimo rapporto
   chiusure/ora. ~12 già chiusi in S1029; il piano elenca i restanti con il criterio di
   chiusura di ciascuno.
2. **#66 / Z-004 Dependabot** (~6h): 8 PR aperte (3 major di GitHub Actions, 4 major
   runtime, 1 gruppo minor-and-patch da 37 update). Gli alert di sicurezza sono già a
   zero via override, quindi qui resta lavoro di aggiornamento, non di sicurezza.
3. **Z-015 alerting PROD** (~6h, ultimo HARD aperto): Prometheus senza rule_files né
   alertmanager e nessun `OnFailure` sui 10 timer — i fallimenti schedulati restano
   silenziosi.

## Open questions (autorità *cosa* = Enzo)

- **Contraddizione GDPR** (nuova, S1029): il design SuccessFactors afferma «nessuna
  governance PII/GDPR richiesta», mentre la due diligence elenca RoPA/DPIA/DPA fra i
  requisiti mancanti. È una posizione sul profilo legale, non una scelta tecnica.
- **Wave-3 (#17)** — sblocca il Blocco E Fase 3 (#69). In HOLD.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16**
  SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
gh run list --branch main --workflow=test-integration.yml --limit 1   # success
gh api repos/Spen-Zosky/heuresys-advanced/dependabot/alerts --paginate --jq '[.[]|select(.state=="open")]|length'  # 0
ssh linux-pc "ls -la ~/heuresys-backups/prod | tail -3"              # archivio off-host
ssh oracle-vm-default "ls -la /var/lib/aide/"                        # init AIDE completato?
python docs/kb/tools/session_start.py             # menu + salute
```
