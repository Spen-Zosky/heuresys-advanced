import csv,json,re,os,sys,collections
V1=sys.argv[1]
ops=json.load(open('docs/kb/atlas/agent-operations.json'))['concepts']
rows=[x for x in csv.DictReader(open(V1+'/endpoint.tsv'),delimiter='\t') if x['progetto']=='advanced']
orf=[x for x in rows if x['stato_uso']=='nessun consumatore rilevato']
roots={'web':['apps/web/src','apps/showcase','ux-design'],
 'gateway':['apps/agent-gateway/src'],
 'script':['scripts','deploy','db/scripts','.github','package.json'],
 'datastore':['/home/user/heuresys-datastore/src','/home/user/heuresys-datastore/apps','/home/user/heuresys-datastore/scripts']}
def walk(rs):
    out=[]
    for r in rs:
        if os.path.isfile(r): out.append(r);continue
        for d,ds,fs in os.walk(r):
            ds[:]=[x for x in ds if x not in('node_modules','.next','dist','.git','_da_eliminare')]
            for f in fs:
                p=os.path.join(d,f)
                if '/test' in p or '.test.' in p or '.spec.' in p or '/e2e' in p or '__tests__' in p: continue
                if f.endswith(('.ts','.tsx','.js','.mjs','.sh','.py','.service','.timer','.yml','.yaml','.json','.ps1')): out.append(p)
    return out
txt={}
for k,rs in roots.items():
    txt[k]={}
    for p in walk(rs):
        if os.path.getsize(p)>3_000_000: continue
        try:
            t=open(p,encoding='utf-8',errors='ignore').read()
            for nm,val in re.findall(r'''const\s+(\w+)\s*=\s*["'`](/v1[^"'`$]*)["'`]''',t):
                t=t.replace('${'+nm+'}',val)
                t=re.sub(r'(apiFetch(?:<[^>]*>)?\(\s*)'+nm+r'(?=\s*[,)])',lambda m:m.group(1)+'"'+val+'"',t)
            txt[k][p]=t
        except: pass
def rx(path):
    segs=[s for s in path.split('/') if s]
    return ''.join(('/(?:\\$\\{[^}]+\\}|\\$\\{?[A-Za-z_]+\\}?|\\{[A-Za-z_]+\\}|[A-Za-z0-9_.-]+)' if s.startswith(':') else '/'+re.escape(s)) for s in segs)
gw=txt['gateway']
def gwhit(m,path):
    q=rx(path[3:] if path.startswith('/v1') else path)
    r=re.compile(r'''call(?:<[^>]*>)?\(\s*["']'''+m+r'''["']\s*,\s*[`"']'''+q+r'''(?![A-Za-z0-9_-])''')
    return [f for f,t in gw.items() if r.search(t)]
res=[]
for x in orf:
    p=x['percorso']; m=x['metodo']
    r=re.compile(rx(p)+r'(?![A-Za-z0-9_-])')
    hits=collections.defaultdict(list)
    for k,fs in txt.items():
        for f,t in fs.items():
            for mm in r.finditer(t):
                win=t[mm.end():mm.end()+260]
                cut=re.search(r'apiFetch|queryFn|mutationFn|fetch\(',win)
                me=re.search(r'''method['"]?\s*[:=]\s*["'](GET|POST|PUT|PATCH|DELETE)["']|-X\s*(GET|POST|PUT|PATCH|DELETE)''',win)
                if me and cut and cut.start()<me.start(): me=None
                got=(me.group(1) or me.group(2)) if me else 'GET'
                if got==m: hits[k].append(f);break
    g=gwhit(m,p)
    if g: hits['gateway']=g
    # agent
    mod=x['modulo']; ag=False
    if m=='GET' and mod in ops:
        base='/v1/'+mod
        rel=p[len(base):] if p.startswith(base) else None
        if rel is not None:
            ag=any(o['path']==(rel or '/') for o in ops[mod]['operations'].values() if o['method']=='GET')
    res.append((x,dict(hits),ag))
json.dump([{'m':x['metodo'],'p':x['percorso'],'mod':x['modulo'],'perm':x['permessi'],'aut':x['autenticazione'],'api_test':x['n_test_api'],'hits':{k:v[:3] for k,v in h.items()},'agent_ops':ag} for x,h,ag in res],open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
n=len(res)
print('orfani V1:',n)
print('agent-operations (GET in perimetro agente):',sum(1 for _,h,a in res if a))
for k in roots: print('trovati in',k,':',sum(1 for _,h,a in res if k in h))
print('con almeno un consumatore extra:',sum(1 for _,h,a in res if h or a))
print('davvero senza nulla:',sum(1 for _,h,a in res if not h and not a))
