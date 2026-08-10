# zero-pending — a che punto siamo

Piano: `2026-07-25-zero-pending-plan.md` del 2026-08-10

**46 chiusi su 262.** Restano 186 pezzi che posso fare da solo e 30 che aspettano te.

## Cosa resta, per ondata

- **W0** — 1 pezzi, circa 2 ore
- **W1** — 53 pezzi, circa 105 ore
- **W2** — 37 pezzi, circa 203 ore
- **W3** — 36 pezzi, circa 168 ore
- **W4** — 39 pezzi, circa 213 ore
- **W5** — 20 pezzi, circa 213 ore

## Lasciati a metà

- **Z-112** — adversarial ROSSO: 7 rilievi riproducibili, di cui uno confermato da due lenti indipendenti (il lucchetto della suite non viene rilasciato proprio quando il drift scatta) e tre che toccano il DISEGNO, non l'implementazione (falso verde muto su censimento vuoto; test che diventa vacuo restando verde; prefissi che non coprono l'unico scrittore che committa). adversarial.md: oltre tre rilievi confermati o rilievi di disegno => INTERRUPTED con i rilievi allegati, non correzioni impilate. Budget dell'iterazione a 2,7 USD su 12: insufficiente per correggere sette rilievi e ri-verificare. Progresso reale di questo giro: la seconda prova mancante e' stata prodotta e la coppia e' ora VALIDA (psql/stato + integration/sistema-api). (riprende da: I tre revisori sono girati (2 su 3 hanno consegnato prima dello stop per budget; verdetti completi in .zp/verdetti/z112-adversarial-parziale.json). Correggi in questo ordine, POI ri-esegui il passo 2 (zp_evidence registra le due prove) e infine 'bash scripts/gov-chiudi.sh 1':
1) [CONFERMATO da 2 lenti indipendenti] drift-check.ts:185 + vitest.config.ts:83 — quando il drift lancia, cioe' nel caso per cui il codice esiste, il teardown interrompe la catena di Vitest 4.1.10 (for/await senza try/catch per elemento) e .zp/suite.lock NON viene mai rilasciato: resta su disco col PID della corsa.
2) drift-check.ts:147 — censimento() non distingue «695 colonne censite, nessun residuo» da «zero colonne censite» (grant mancanti, DB sbagliato, schema invisibile): torna una mappa vuota e il check e' un falso verde muto.
3) drift-check.integration.test.ts:57 — il test che dimostra il «so dire di SI'» diventa vacuo restando VERDE appena i 4 residui di giugno vengono ripuliti, cioe' appena si esegue l'ordine che il messaggio d'errore stesso da'.
4) drift-check.ts:63 — PREFISSI non copre inbox-stream.integration.test.ts:113, che scrive con una seconda connessione fuori dal pool (sfugge a D-52) usando SUBJECT 'IT_SSE_*': l'unico scrittore che committa davvero.
5) vitest.config.ts:81 — il commento afferma che il lucchetto protegge il censimento; falso: .zp/suite.lock e' preso solo da apps/api, la suite E2E Playwright non lo prende.
6) [bassa] drift-check.ts:186 — il messaggio dice «N righe residue» ma N conta per COLONNA: una riga col prefisso in due colonne conta 2.
7) [bassa] drift-check.ts:21 — «737 colonne su 219 tabelle» non si riproduce: sono 695 su 199; 737 e' il conteggio senza il filtro table_type='BASE TABLE'.
NOTA DI STATO, misurata in questo giro e non scritta da nessuna parte: il commit 7eb39abf NON e' su main. Il merge 551dd8d0 citato in .zp/GOV-DA-FARE.md ha portato gov/w1 solo fino a f5aa771c; il commit di Z-112 e' successivo ed e' rimasto sul ramo. Le due prove sono gia' registrate e VALIDE in D:/heuresys-gov-workers/w1/.zp/prove/Z-112.json (psql 2026-08-09T23:03:23 + integration 2026-08-10T08:08:48, 5/5 exit 0).)

## Aspettano te

- **Z-026** (decisione-business) — Migrazione a PostgreSQL managed + runtime HA (ADR-0010 Option C) incl. read replica: decisione di spesa
- **Z-028** (decisione-business) — Archiviazione off-disk dei 27 dump pre-op (3,7G): meccanismo pronto, esecuzione mai fatta
- **Z-060** (decisione-business) — #17 Wave-3: onboarding dei tenant legacy non-banking (SmartFood 82 emp, EcoNova 26 emp) — multi-industry vs re
- **Z-074** (decisione-business) — Tassonomia skill: decisione hard/soft (D-34) + 14.010 skill su 14.041 senza categoria + premessa della migrati
- **Z-076** (decisione-business) — Import legacy succession pools/candidates rinviato (decisione B di Enzo), riattivabile su richiesta
- **Z-101** (decisione-business) — RACI di produzione: modello a ruolo singolo e popolazione da seed demo 'NOT production truth'
- **Z-179** (decisione-business) — #4 Pricing page: servono importi, nomi piani e feature per tier (la DoD vieta il placeholder)
- **Z-195** (decisione-business) — #41 graphify: top-up semantico dei 26 chunk mancanti (limite di spesa Claude colpito nel run S1016)
- **Z-199** (decisione-business) — WI-D1: endpoint di bulk-apply lineage-imitating (rinviato per decisione)
- **Z-200** (decisione-business) — WI-D3: recommender typing->variant da NACE+size a blueprint_variant (rinviato per decisione)
- **Z-201** (decisione-business) — agent-gateway non deployato in PROD: serve la decisione su credenziale/provider per l'uso non-interattivo (con
- **Z-202** (decisione-business) — Rubrica Maturity L0-L5: i cutoff numerici non hanno mai avuto il sign-off e la rubrica non e' versionabile/riv
- **Z-204** (decisione-business) — Predictions/'AI-ML': read-model di valori legacy senza engine — riposizionare come explainable rule-based scor
- **Z-205** (decisione-business) — Promessa 'BPM' senza runtime generico: esistono le approvazioni, non process-instance / task inbox / SLA arbit
- **Z-210** (decisione-business) — Layer commerciale assente: signup/provisioning self-service multi-tenant, billing/metering, onboarding (+ Fase
- **Z-222** (decisione-business) — Decision log MVP-4: RD-29 (dry-run OCI Managed), RD-32 (licenza React Flow Pro), Q-MVP4-01..10 e la Tappa F (P
- **Z-244** (decisione-business) — SBOM (CycloneDX) e license-attribution mai generati; titolarita' IP del legacy e di @heuresys/ui solo asserita
- **Z-247** (decisione-business) — Domande al founder Q1-Q8 della due diligence mai risposte (financials, funding, pricing, ICP, titolarita' IP, 
- **Z-248** (decisione-business) — Verdetto acquirente 'spietato' (45-57/100, NO-GO come investimento in azienda) mai riconciliato ne' registrato
- **Z-052** (esterno) — Hardening commerciale F5: pentest indipendente / OWASP ASVS + load testing k6
- **Z-103** (esterno) — Crosswalk ISCO-08 <-> CP2021: tabella creata e vuota (serve la corrispondenza ufficiale Istat)
- **Z-118** (esterno) — 4 classi a11y dichiarate out-of-scope nel 2026-05 e mai riprese: keyboard manuale, screen reader, forced-color
- **Z-182** (esterno) — #16 SuccessFactors: sandbox reale + design ancora EXPLORATORY con 4 decisioni aperte
- **Z-241** (esterno) — Bus factor = 1: nessun secondo sviluppatore, nessuna clausola di retention del founder (unico finding CRITICAL
- **Z-242** (esterno) — Strato GDPR DOCUMENTALE assente (RoPA, DPIA, basi giuridiche per categoria, informativa, erasure-flow per inte
- **Z-243** (esterno) — Classificazione formale AI Act (Annex III high-risk) e conformity assessment mai prodotti benche' la mitigazio
- **Z-245** (esterno) — Nessun DPA con i sub-processor (Oracle, Anthropic) e infra su account personale free-tier
- **Z-246** (esterno) — Nessun pilota cliente reale firmato (kill-criteria dichiarato della fase F2 della due diligence)
- **Z-045** (segreto) — SSO enterprise OIDC (Azure AD / Google) con JIT-link su sys_auth_*
- **Z-180** (segreto) — #8 EMAIL dormiente: app-password Outlook per SMTP (sblocca EMAIL_OTP e digest)

## I prossimi cinque

- **Z-032** (W1, 1.0h, classe B) — claude-mem disabilitato con stub bun-runner: retest sulla 13.12.2 o fail-open permanente dell'hook
- **Z-123** (W1, 1.0h, classe B) — Nessun test asserisce che il boot usi loadRolePermissionCacheWithRetry (i test iniettano un loader f
- **Z-239** (W1, 1.0h, classe A) — Ecosistema Claude: MEMORY.md non re-indicizzato (55 nodi su disco vs 53 link), nodi session-state da
- **Z-152** (W1, 1.5h, classe B) — Brand v1: 5 refinement del social media kit (SK-1..SK-5)
- **Z-221** (W1, 1.5h, classe A) — Roadmap MVP-4 ancora in DRAFT 'awaiting Enzo's review' con AC-01..12 e checklist §11 mai spuntate (s

## Spesa

9 giri, circa 68.96 dollari su un tetto di 120.
