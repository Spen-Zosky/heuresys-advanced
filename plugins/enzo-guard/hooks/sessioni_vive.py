"""Quante ALTRE sessioni vive lavorano sullo stesso progetto.

Legge il registro delle sessioni (~/.claude/sessioni/attive/*.md, scritto da
sessione-registra.ps1): una sessione conta se `principale:` e' il progetto
chiesto, `stato:` non e' «chiusa», e il suo `pid:` esiste ancora (la vita la
dice il sistema operativo, non la dichiarazione). Stampa il numero; exit 0.
Uso: python sessioni_vive.py <nome-progetto> [<session-id-proprio>]
"""
import ctypes, os, sys

def pid_vivo(pid: int) -> bool:
    if os.name == 'nt':
        SYNCHRONIZE = 0x00100000
        h = ctypes.windll.kernel32.OpenProcess(SYNCHRONIZE, False, pid)
        if not h:
            return False
        ctypes.windll.kernel32.CloseHandle(h)
        return True
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def main() -> int:
    progetto = sys.argv[1] if len(sys.argv) > 1 else ''
    mio = sys.argv[2] if len(sys.argv) > 2 else ''
    attive = os.path.join(os.path.expanduser('~'), '.claude', 'sessioni', 'attive')
    n = 0
    try:
        nomi = os.listdir(attive)
    except OSError:
        print(0); return 0
    for nome in nomi:
        if not nome.endswith('.md'):
            continue
        try:
            righe = open(os.path.join(attive, nome), encoding='utf-8', errors='replace').read().splitlines()
        except OSError:
            continue
        campi = {}
        for r in righe:
            if ':' in r and not r.startswith(('#', '<', '>', ' ')):
                k, _, v = r.partition(':')
                campi.setdefault(k.strip(), v.strip())
        if campi.get('principale') != progetto or campi.get('stato') == 'chiusa':
            continue
        if mio and campi.get('sessione', '').startswith(mio):
            continue
        try:
            if pid_vivo(int(campi.get('pid', '0'))):
                n += 1
        except ValueError:
            pass
    print(n)
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
