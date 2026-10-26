"""O2-09: confronta prima.jsonl e dopo.jsonl (O2-09_confronto-attori.mts) e SPIEGA ogni differenza.

Uso: python O2-09_confronta.py prima.jsonl dopo.jsonl righe.tsv titolari.tsv
  righe.tsv     dal database «dopo»: participant_id, oup_id, user_id (colonna persona), position_id,
                ruolo, attiva, classe del passo 2 (A/H/N), ruolo prima delle regole
  titolari.tsv  dal database «dopo»: position_id, user_id del titolare unico di oggi (posizione attiva)
Una differenza e' spiegata se discende da: (1) la partecipazione dell'altra persona, o la riga OWNER
dell'attore, nella classe H (posto oggi disattivato: non si risolve in nessuno) o N (disattivata dal
passo 2); (2) la regola D-P3-1 (l'attore e' oggi il process owner dell'unita' di governo).
Esce 1 se resta una differenza non spiegata.
"""
import json, sys
from collections import defaultdict

prima = {j["id"]: j for j in map(json.loads, open(sys.argv[1]))}
dopo = {j["id"]: j for j in map(json.loads, open(sys.argv[2]))}
righe = [l.rstrip("\n").split("\t") for l in open(sys.argv[3])]
titolare = dict(l.rstrip("\n").split("\t") for l in open(sys.argv[4]))

# Stato PRIMA (tutte attive, lette dalla persona; ruolo prima delle regole).
own_prima, part_prima = defaultdict(set), defaultdict(set)
# Stato DOPO (attive, lette dal posto).
own_dopo, part_dopo = defaultdict(set), defaultdict(set)
classe_di = {}
for pid, oup, uid, pos, ruolo, attiva, classe, ruolo_prima in righe:
    classe_di[(oup, uid)] = classe
    part_prima[oup].add(uid)
    if ruolo_prima == "OWNER":
        own_prima[uid].add(oup)
    if attiva == "t" and pos and pos in titolare:
        chi = titolare[pos]
        part_dopo[oup].add(chi)
        if ruolo == "OWNER":
            own_dopo[chi].add(oup)

def proc(own, part, a):
    return set().union(*[part[o] for o in own[a]]) if own[a] else set()

out, non_spiegate = [], 0
cont = defaultdict(int)
for a in sorted(prima):
    p, d = prima[a], dopo[a]
    sp, sd = set(p["scope"]), set(d["scope"])
    pp, pd = proc(own_prima, part_prima, a), proc(own_dopo, part_dopo, a)
    tolti, aggiunti = sp - sd, sd - sp
    righe_a = []
    if p["process_owner"] != d["process_owner"]:
        if d["process_owner"]:
            perche = "D-P3-1: oggi e' il process owner (responsabile dell'unita' di governo)" if own_dopo[a] else None
        else:
            cl = sorted({classe_di.get((o, a), "?") for o in own_prima[a]})
            perche = f"le sue righe OWNER erano in classe {'/'.join(cl)} (passo 2) e non e' responsabile di un'unita' di governo" if own_prima[a] and set(cl) <= {"H", "N"} else None
        righe_a.append(f"  process_owner {p['process_owner']} -> {d['process_owner']}: {perche or 'NON SPIEGATA'}")
        non_spiegate += perche is None
        cont["process_owner " + ("acquisito" if d["process_owner"] else "perso")] += 1
    for x in sorted(tolti):
        ok = x in pp and x not in pd
        if ok:
            cont["tolti (non piu' partecipante di un processo posseduto, o processo non piu' posseduto)"] += 1
        else:
            non_spiegate += 1
            righe_a.append(f"  tolto {x}: NON SPIEGATA")
    for x in sorted(aggiunti):
        ok = x in pd and x not in pp
        if ok:
            cont["aggiunti (partecipante oggi di un processo di cui e' owner per D-P3-1)"] += 1
        else:
            non_spiegate += 1
            righe_a.append(f"  aggiunto {x}: NON SPIEGATA")
    if tolti or aggiunti or righe_a:
        out.append(f"{a}: perimetro {len(sp)} -> {len(sd)} (tolti {len(tolti)}, aggiunti {len(aggiunti)}), process_owner {p['process_owner']} -> {d['process_owner']}")
        if tolti:
            cl = sorted({classe_di.get((o, a), "?") for o in own_prima[a]})
            out.append(f"  tolti: righe OWNER di prima in classe {'/'.join(cl) or '-'}; i tolti erano partecipanti dei processi che possedeva per persona")
        if aggiunti:
            out.append(f"  aggiunti: titolari di oggi dei posti che partecipano ai {len(own_dopo[a])} processi di cui e' owner (D-P3-1)")
        out.extend(righe_a)

print(f"persone attive di RTL Bank: {len(prima)}; con differenze: {sum(1 for a in prima if set(prima[a]['scope']) != set(dopo[a]['scope']) or prima[a]['process_owner'] != dopo[a]['process_owner'])}")
print(f"process_owner prima: {sum(j['process_owner'] for j in prima.values())}; dopo: {sum(j['process_owner'] for j in dopo.values())}")
for k, v in sorted(cont.items()):
    print(f"  {k}: {v}")
print(f"differenze NON spiegate: {non_spiegate}")
print()
print("\n".join(out))
sys.exit(1 if non_spiegate else 0)
