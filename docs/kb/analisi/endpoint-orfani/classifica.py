#!/usr/bin/env python3
"""Classifica gli endpoint orfani veri in (a) schermata mancante, (b) da affidare all'agente,
(c) superata da ritirare disattivando. Sola lettura. Uso:
  python3 classifica.py <cartella con endpoint.tsv e pagina_endpoint.tsv di V1> <orfani.json> <uscita.tsv>
"""
import csv, json, re, sys, collections
V1, ORF, OUT = sys.argv[1:4]
eps = [x for x in csv.DictReader(open(V1 + '/endpoint.tsv'), delimiter='\t') if x['progetto'] == 'advanced']
pe = list(csv.DictReader(open(V1 + '/pagina_endpoint.tsv'), delimiter='\t'))
rows = collections.defaultdict(list)
for e in eps: rows[(e['metodo'], e['percorso'])].append(e)
orf = [x for x in json.load(open(ORF)) if not x['hits'] and not x['agent_ops'] and not x['aut'].startswith('pubb')]

# riga "fantasma": lo estrattore attribuisce a ogni prefisso del file tenant-consolidation/routes.ts tutte le rotte del file
def reale_consolidamento(file_riga, percorso):
    if not file_riga.startswith('apps/api/src/modules/tenant-consolidation/routes.ts:'): return True
    n = int(file_riga.rsplit(':', 1)[1])
    pre = '/v1/tenant-consolidations' if n <= 190 else '/v1/consolidation-vocabulary' if n <= 205 else '/v1/consolidation-runs'
    return percorso.startswith(pre)

def pagina_del_modulo(percorso):
    base = '/'.join(percorso.split('/')[:3])
    for r in pe:
        if r['endpoint_esiste'] == 'si' and r['percorso_chiamato'].startswith(base):
            return f"{r['file_chiamata']}:{r['riga']}"
    return ''

AGENTE_HITL = 'apps/agent-gateway/src/write-gate.ts:3-15 (nessuna scrittura senza approvazione umana)'
# modulo -> (classe, destinazione, motivo, fiducia, ondata)
M = {
 'tenant-consolidation': ('a', '/consolidation', 'la pagina del consolidamento non ha il vocabolario né la distanza dal modello della corsa', 'alta', 1),
 'auth': ('a', '/me/security (codici di recupero); /users/[userId] (sessioni e revoca)', 'le azioni di sicurezza non hanno schermata: la pagina sicurezza copre solo l\'iscrizione ai fattori', 'media', 3),
 'tenants': ('a', '/tenants e /tenants/[tenantId]', 'crea/modifica tenant: la pagina elenca soltanto', 'media', 3),
 'mandate-acts': ('a', '/admin/roles', 'dettaglio dell\'atto di mandato non mostrato', 'media', 3),
 'gdpr': ('a', 'nuova /admin/gdpr', 'esportazione, cancellazione e retention sono irreversibili: vogliono una schermata dedicata con prova, non un\'azione conversazionale', 'media', 3),
 'me': ('a', 'nuova sezione privacy e notifiche in /me/security', 'preferenze, consensi ed export dei propri dati senza schermata', 'media', 2),
 'agent-capabilities': ('a', 'nuova /admin/agent-capabilities', 'il registro delle capacità degli agenti (ADR-0053) non ha amministrazione', 'media', 3),
 'positions': ('a', '/positions/[positionId]', 'la scheda legge competenze e KPI ma non li modifica', 'alta', 2),
 'projects': ('a', '/projects/[id]', 'la scheda progetto legge ma non modifica stato, avanzamento e membri', 'alta', 2),
 'teams': ('a', 'nuova /teams (voce in Organizzazione)', 'nessuna pagina usa il modulo: tutte le 6 rotte sono senza chiamanti', 'alta', 2),
 'candidates': ('a', '/recruiting/applications/[id]', 'la scheda candidatura legge ma non aggiorna', 'media', 2),
 'interview-feedback': ('a', '/recruiting/applications/[id]', 'la scheda legge il feedback ma non lo aggiorna', 'media', 2),
 'skill-aliases': ('a', '/skills', 'gli alias si leggono, non si modificano', 'media', 3),
 'training-initiatives': ('a', '/learning/training-initiatives', 'la pagina elenca soltanto', 'alta', 2),
 'assessments': ('a', 'nuova /learning/assessments', 'nessuna pagina usa il modulo', 'media', 3),
 'assessment-results': ('a', 'nuova /learning/assessments', 'risultati immutabili registrati senza schermata', 'media', 3),
 'learning-gaps': ('b', 'strumento agente: analisi dei gap con proposta', 'il gap si calcola dall\'analisi competenze: lo crea l\'analisi, la persona conferma', 'bassa', 4),
 'delegations': ('a', '/admin/roles (scheda Deleghe)', 'conferire e revocare una delega non ha schermata; /admin/roles legge solo gli atti di mandato', 'media', 2),
 'platform-tenant-assignments': ('a', '/tenants/[tenantId]', 'assegnare/revocare utenti di piattaforma ai tenant senza schermata', 'media', 3),
 'career-paths': ('a', '/career-succession', 'la pagina legge i percorsi ma non li gestisce', 'media', 3),
 'career-path-steps': ('a', '/career-succession', 'nessuna pagina usa i passi del percorso', 'media', 3),
 'position-career-paths': ('a', '/career-succession', 'collegamento posizione-percorso senza schermata', 'media', 3),
 'succession-pools': ('a', '/career-succession', 'la pagina legge i bacini ma non li gestisce', 'media', 3),
 'successor-candidates': ('a', '/career-succession', 'la pagina legge i candidati ma non li gestisce', 'media', 3),
 'successor-readiness': ('a', '/career-succession', 'valutazione di prontezza immutabile senza schermata', 'media', 3),
 'position-succession-relevance': ('a', '/career-succession', 'rilevanza di successione per posizione senza schermata', 'media', 3),
 'user-career-plans': ('b', 'strumento agente: piano di carriera della persona', 'è una conversazione personale ("pianifica la mia carriera"): l\'agente propone, la persona conferma', 'media', 4),
 'user-target-positions': ('b', 'strumento agente: posizioni obiettivo della persona', 'come i piani di carriera; esiste già la pagina /me/career/target in sola lettura', 'media', 4),
 'user-position-assignments': ('a', '/positions/[positionId]', 'le scritture creano solo una proposta in /approvals: manca il pulsante "assegna titolare" nella scheda', 'media', 2),
 'organization-unit-history': ('a', '/organization', 'nessun altro codice scrive il registro storico: va collegato alla modifica unità', 'bassa', 3),
 'visualization-graphs': ('c', 'rigenera + versions', 'il grafo si ricalcola dai dati vivi con "rigenera" e "versions"', 'alta', 5),
 'visualization-nodes': ('c', 'rigenera', 'nodi derivati dal ricalcolo: la modifica manuale è superata', 'alta', 5),
 'visualization-edges': ('c', 'rigenera', 'archi derivati dal ricalcolo', 'alta', 5),
 'visualization-layouts': ('c', 'rigenera', 'disposizione prodotta dal ricalcolo', 'media', 5),
 'visualization-node-layouts': ('c', 'rigenera', 'posizione dei nodi prodotta dal ricalcolo', 'media', 5),
 'visualization-styles': ('c', 'rigenera', 'stili del grafo fissati dal ricalcolo', 'media', 5),
 'activity-classifications': ('a', '/tenants/[tenantId]/enterprise-typing', 'catalogo letto dalla pagina, mai modificato', 'bassa', 5),
 'activity-classification-mappings': ('a', '/tenants/[tenantId]/enterprise-typing', 'mappature senza schermata', 'bassa', 5),
 'occupation-classifications': ('a', 'nuova /admin/tassonomie', 'nessuna pagina usa il modulo', 'bassa', 5),
 'enterprise-size-bands': ('a', '/tenants/[tenantId]/enterprise-typing', 'bande dimensionali lette, mai modificate', 'bassa', 5),
 'operating-models': ('a', '/tenants/[tenantId]/enterprise-typing', 'modelli operativi letti, mai modificati', 'bassa', 5),
 'enterprise-typing-profiles': ('a', '/tenants/[tenantId]/enterprise-typing', 'profilo di tipizzazione', 'media', 4),
 'blueprint-families': ('a', '/blueprints', 'la pagina legge le famiglie, non le gestisce', 'bassa', 5),
 'blueprint-variants': ('a', '/blueprints/[variantId]', 'la pagina legge le varianti, non le gestisce', 'bassa', 5),
 'blueprint-processes': ('a', '/blueprints/[variantId]', 'registro dei processi di modello senza modifica', 'bassa', 5),
 'blueprint-activations': ('a', '/blueprints/[variantId]', 'attivazione per cliente senza schermata', 'media', 4),
 'blueprint-overrides': ('a', '/blueprints/[variantId]', 'scostamenti decisi dal cliente senza schermata', 'media', 4),
 'process-kpi-templates': ('a', 'nuova /admin/catalogo-kpi', 'nessuna pagina usa i modelli KPI di processo', 'bassa', 5),
 'organization-unit-kpi-templates': ('a', 'nuova /admin/catalogo-kpi', 'nessuna pagina usa i modelli KPI di unità', 'bassa', 5),
 'organization-unit-processes': ('a', '/process-owner', 'assegnazione unità-processo senza schermata', 'media', 3),
 'tenant-blueprints': ('a', '/tenant-blueprints/[id]', 'fascicolo del tenant: modifica, collegamento e ricerca senza pulsanti', 'media', 4),
 'seed-acquisition-runs': ('b', 'strumento agente: corse di ricerca (research-propose)', 'la ricerca web è un\'attività dell\'agente (apps/agent-gateway/src/research-propose.ts)', 'media', 4),
 'seed-candidate-records': ('a', '/seed-acquisition/runs', 'la decisione su un candidato è umana: manca il pulsante', 'media', 4),
 'seed-approval-decisions': ('a', '/seed-acquisition/runs', 'decisione di approvazione umana senza pulsante', 'media', 4),
 'tenant-import-runs': ('b', 'strumento agente: importazione guidata (Tenant Builder P4)', 'importare fonti e consegnare è un flusso guidato: agente prepara, persona conferma', 'bassa', 4),
 'compensation': ('a', '/compensation-intelligence', 'raccomandazioni e passaggio di consegne senza pulsanti', 'media', 3),
 'mentorship': ('a', 'nuova /mentorship', 'nessuna pagina usa il modulo (17 rotte senza chiamanti)', 'alta', 3),
 'surveys': ('a', 'nuova /surveys', 'nessuna pagina usa il modulo', 'alta', 3),
 'engagement-feedback': ('a', 'nuova /engagement', 'nessuna pagina usa il modulo; l\'anonimato impone una schermata, non l\'agente', 'media', 3),
 'goals': ('b', 'strumento agente: aggiornamento obiettivi', 'aggiornare l\'avanzamento è una richiesta naturale all\'assistente', 'media', 4),
 'okrs': ('b', 'strumento agente: aggiornamento OKR', 'come gli obiettivi', 'media', 4),
 'review-cycles': ('a', '/performance', 'creare e chiudere i cicli di valutazione senza pulsanti', 'media', 3),
 'semantic-matching': ('b', 'perimetro lettura dell\'agente (agent-perimetri.json)', 'ricerche di somiglianza: sono letture per l\'agente; il reindex resta amministrativo', 'media', 4),
 'capability-composition': ('a', '/org-director', 'dettaglio per soggetto e ricalcolo senza pulsanti', 'media', 3),
 'capability-maturity': ('a', '/org-director', 'dettaglio per unità e ricalcolo senza pulsanti', 'media', 3),
 'reference-sync': ('a', 'nuova /admin/dati-di-riferimento', 'avvio dell\'aggiornamento delle fonti ufficiali senza schermata', 'bassa', 5),
 'job-families': ('a', '/job-catalog', 'catalogo letto, non modificato', 'media', 3),
 'users': ('a', '/users/[userId]', 'azioni sull\'utenza senza pulsante', 'media', 3),
 'content': ('a', '/content/[id]', 'riporta in bozza, ritira dalla pubblicazione, categorie: mancano i pulsanti', 'alta', 2),
}
ROOT_DELETE_C = re.compile(r'^/v1/[a-z-]+/:id$|^/v1/users/:id/purge$|^/v1/[a-z-]+/(templates|programs|pairings|sessions|action-plans)/:id$')
ECC = {  # eccezioni per percorso
 ('POST', '/v1/mentorship/pairings'): ('b', 'strumento agente: abbinamento mentore', 'l\'abbinamento è un suggerimento (match-scores): l\'agente propone, le persone confermano', 'media', 4),
 ('DELETE', '/v1/users/:id/purge'): ('c', '/v1/gdpr/users/:userId/erasure', 'la cancellazione dei dati personali ha già la via GDPR con registro delle richieste (modulo gdpr)', 'media', 5),
}
LINK = {'blueprint-activations', 'blueprint-overrides', 'position-career-paths', 'position-succession-relevance', 'organization-unit-processes', 'process-kpi-templates', 'organization-unit-kpi-templates', 'successor-candidates'}
out = []
fant = 0
for o in orf:
    e = rows[(o['m'], o['p'])].pop(0)  # stesso metodo+percorso più volte: righe in ordine di file
    fr = e['file']
    if not reale_consolidamento(fr, o['p']):
        fant += 1
        out.append([o['m'], o['p'], o['mod'], fr, 'fantasma', '', 'riga attribuita per errore dallo strumento V1 a un prefisso che non esiste', f'{fr}: il file registra le rotte sotto un solo prefisso, V1 le ripete sui tre', 'alta', 0])
        continue
    cl = ECC.get((o['m'], o['p'])) or M.get(o['mod'])
    if cl is None: raise SystemExit('modulo non classificato: ' + o['mod'])
    classe, dest, motivo, fid, onda = cl
    if o['m'] == 'DELETE' and classe != 'c' and ROOT_DELETE_C.match(o['p']) and o['mod'] not in LINK:
        classe, dest, motivo, fid, onda = 'c', 'disattivazione (stato/validità) al posto della cancellazione', 'cancellare l\'entità contraddice ADR-0035 («ritirare non è cancellare»): si disattiva', 'media', 5
    if classe == 'a':
        pg = pagina_del_modulo(o['p'])
        ev = f"{fr}; " + (f"pagina del modulo che legge senza scrivere: {pg}" if pg else 'nessuna pagina chiama questo modulo (apps/web/src, percorso /v1/' + o['p'].split('/')[2] + ')')
    elif classe == 'b':
        ev = f"{fr}; {AGENTE_HITL}"
    else:
        ev = f"{fr}; " + {'visualization': 'apps/web/src/app/(authenticated)/visualizations/[graphId]/page.tsx:119-136 usa solo versions e rigenera'}.get(o['mod'].split('-')[0], 'ADR-0035 / modulo gdpr')
    out.append([o['m'], o['p'], o['mod'], fr, classe, dest, motivo, ev, fid, onda])
H = ['metodo', 'percorso', 'modulo', 'definizione', 'classe', 'destinazione', 'motivo', 'prova', 'fiducia', 'ondata']
with open(OUT, 'w', newline='') as f:
    w = csv.writer(f, delimiter='\t', lineterminator='\n'); w.writerow(H); w.writerows(out)
c = collections.Counter(r[4] for r in out)
print(len(out), dict(c), 'fantasma', fant)
