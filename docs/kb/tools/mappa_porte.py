#!/usr/bin/env python3
"""Chi occupa cosa, sulle tre macchine — MISURATO, non ricordato.

NASCE DA UNA FRASE DI ENZO (2026-09-04): «in realta' non so chi occupa cosa». E da tre
incidenti veri nella stessa notte, tutti della stessa specie:

  · un `pnpm dev` orfano sulla :3001 del gemello, acceso dal 31 agosto -> CI ROSSA per
    tre giorni, e la produzione ferma su un commit vecchio
  · una SECONDA sessione abbandonata sulla stessa macchina, dormiente: copiarci dentro
    un file ha fatto RIPARTIRE il suo `tsx watch`, che si e' ripreso la porta
  · un terzo orfano sulla :3001 della VM, acceso dal 31 agosto e mai notato

⭐ IL PUNTO FISSO. Una mappa di porte scritta a mano e' vera il giorno che la scrivi e
falsa poco dopo: `deploy/README.md` ne dichiara una per la sola VM, ed e' un'ALLOCAZIONE
(cosa DEVE stare dove), non un'osservazione. Questo strumento misura cosa c'e' DAVVERO, e
confronta le due cose. Non si aggiorna un numero: si riesegue il comando.

  python docs/kb/tools/mappa_porte.py            # le tre macchine
  python docs/kb/tools/mappa_porte.py --intrusi  # solo cio' che non torna
"""
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
REMOTI = ["linux-pc", "oracle-vm-default"]

# Le porte che questo progetto si aspetta, e chi le tiene. NON e' un'osservazione: e' cio'
# che deve valere. Lo scostamento fra questa tabella e la misura e' l'informazione utile.
ATTESE = {
    3013: "heuresys-advanced web (next start, prod)",
    8013: "heuresys-advanced API (node dist, prod)",
    5432: "PostgreSQL",
    3001: "RISERVATA CI — API effimera di playwright-smoke: fuori da una corsa DEVE essere libera",
    8790: "agent-gateway della ricerca: fuori da una corsa DEVE essere libera",
}
# Le porte che, se occupate quando nessuna corsa CI e' in volo, sono un INTRUSO.
EFFIMERE = {3001, 8790}


def _sh(cmd, timeout=60):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout
    except Exception as e:  # noqa: BLE001 — un host che non risponde e' un esito, non un crash
        return f"__ERRORE__ {e}"


def porte_remote(host):
    """(porta, processo, pid) su un host remoto. Senza sudo: alcuni nomi mancano, e si dice."""
    out = _sh(f'ssh -n -o ConnectTimeout=15 {host} "ss -ltnpH 2>/dev/null"')
    if out.startswith("__ERRORE__"):
        return None, out
    righe = []
    for l in out.splitlines():
        campi = l.split()
        if len(campi) < 4:
            continue
        porta = campi[3].rsplit(":", 1)[-1]
        if not porta.isdigit() or not (1024 <= int(porta) < 20000):
            continue
        m = re.search(r'users:\(\("([^"]+)".*?pid=(\d+)', l)
        righe.append((int(porta), m.group(1) if m else "?", m.group(2) if m else "?"))
    return sorted(set(righe)), None


def porte_windows():
    """⚠ Via FILE .ps1, mai inline: un comando PowerShell con virgolette annidate profonde
    termina senza eseguire nulla E SENZA ERRORE — misurato qui, la sezione usciva vuota e
    sembrava «nessuna porta occupata». E' la regola del CLAUDE.md globale, violata e ripagata."""
    script = Path(__file__).with_suffix(".ps1")
    if not script.exists():
        return []
    out = _sh(f'powershell -NoProfile -ExecutionPolicy Bypass -File "{script}"')
    righe = []
    for l in out.splitlines():
        parti = l.strip().split("|")
        if len(parti) == 3 and parti[0].isdigit():
            righe.append((int(parti[0]), parti[1], parti[2]))
    return sorted(set(righe))


def main():
    solo_intrusi = "--intrusi" in sys.argv
    intrusi = []

    for etichetta, righe, errore in [("windows (questa macchina)", porte_windows(), None)] + [
        (h, *porte_remote(h)) for h in REMOTI
    ]:
        if errore:
            print(f"\n=== {etichetta}\n  [? ] NON MISURABILE — {errore.strip()}")
            print("      «non ho potuto guardare» non e' «va bene».")
            continue
        if not solo_intrusi:
            print(f"\n=== {etichetta}")
        for porta, proc, pid in righe:
            atteso = ATTESE.get(porta)
            if porta in EFFIMERE:
                intrusi.append((etichetta, porta, proc, pid))
                if not solo_intrusi:
                    print(f"  [!!] {porta:<6} {proc:<16} pid {pid:<8} INTRUSO — {atteso}")
            elif not solo_intrusi:
                print(f"  [ok] {porta:<6} {proc:<16} pid {pid:<8} {atteso or ''}")

    print()
    if intrusi:
        print(f"INTRUSI: {len(intrusi)} — una porta effimera occupata fuori da una corsa.")
        for host, porta, proc, pid in intrusi:
            print(f"  {host}: :{porta} tenuta da {proc} (pid {pid})")
        print("\n  Si chiude PER PID risalendo da chi tiene la porta, mai con `pkill -f`:")
        print("  quello ha mancato il bersaglio due volte, perche' `tsx watch` rigenera il figlio.")
        print("  E se il processo vive in una sessione utente abbandonata, va chiusa QUELLA:")
        print("  un watcher dormiente riparte al primo file che tocchi nel suo repo.")
        return 1
    print("Nessun intruso sulle porte effimere (3001, 8790).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
